from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import secrets
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware

from .catalog import SHOWS

# Never invent outfits or local garment listings; recommendation cards point to verified source pages.
ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public"
TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("styletv")

SESSION_SECRET = os.getenv("SESSION_SECRET", "").strip()
if os.getenv("VERCEL", "0") == "1" and not SESSION_SECRET:
    raise RuntimeError("Set SESSION_SECRET in Vercel Environment Variables before deploying styleTV.")

app = FastAPI(title="styleTV", version="0.1.0", description="TV-inspired personal fashion discovery and virtual try-on.")
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET or "local-only-change-me-please-replace",
    session_cookie="styletv_demo_session",
    max_age=60 * 60 * 8,
    same_site="lax",
    https_only=os.getenv("VERCEL", "0") == "1",
)
# Vercel serves public/** assets through its CDN; mount them directly only for local Uvicorn runs.
if os.getenv("VERCEL", "0") != "1":
    app.mount("/assets", StaticFiles(directory=str(PUBLIC_DIR / "assets")), name="assets")
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

YCE_BASE = os.getenv("YCE_API_BASE", "https://yce-api-01.makeupar.com").rstrip("/")
YCE_API_KEY = os.getenv("YCE_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip() or "gemini-3.6-flash"
MAX_UPLOAD_BYTES = 9_500_000
RECOMMENDATION_AI_TIMEOUT_SECONDS = 7.5
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png"}

# These provider paths match the current YouCam API reference documentation.
YCE_TASK_PATHS = {
    "try-on": "/s2s/v2.0/task/cloth-v4",
    "color": "/s2s/v2.0/task/skin-tone-analysis",
}


def csrf_token(request: Request) -> str:
    token = request.session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        request.session["csrf_token"] = token
    return token


def require_session(request: Request) -> dict:
    user = request.session.get("demo_user")
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        provided = request.headers.get("x-csrf-token", "")
        if not provided or not secrets.compare_digest(provided, str(request.session.get("csrf_token", ""))):
            raise HTTPException(status_code=403, detail="Your session token expired. Refresh the page and try again.")
    return user


def normalize_yce_content_type(content_type: str) -> str:
    """Map browser image/jpeg to the image/jpg MIME type used in YouCam File API examples."""
    return "image/png" if content_type == "image/png" else "image/jpg"


def yce_headers() -> dict[str, str]:
    if not YCE_API_KEY:
        raise HTTPException(status_code=503, detail="YouCam is not configured. Add YCE_API_KEY to the environment to enable live analysis and try-on.")
    return {"Authorization": f"Bearer {YCE_API_KEY}", "Content-Type": "application/json"}


async def upload_image_to_yce(image_bytes: bytes, filename: str, content_type: str) -> str:
    """Upload bytes using YouCam's metadata + presigned URL workflow."""
    if not image_bytes or len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Choose an image smaller than 9.5 MB.")
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Use a JPG or PNG image.")

    # YouCam's File API examples use image/jpg for JPEG uploads. Browsers normally
    # report image/jpeg, so normalize the provider-facing metadata while preserving
    # the original accepted input types at the HTTP boundary.
    provider_content_type = normalize_yce_content_type(content_type)
    clean_name = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename or "upload.jpg").name)[:100]
    if not clean_name.lower().endswith((".jpg", ".jpeg", ".png")):
        clean_name += ".png" if provider_content_type == "image/png" else ".jpg"

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        metadata_response = await client.post(
            f"{YCE_BASE}/s2s/v2.0/file",
            headers=yce_headers(),
            json={"files": [{"content_type": provider_content_type, "file_name": clean_name, "file_size": len(image_bytes)}]},
        )
        if metadata_response.is_error:
            logger.warning("YouCam file metadata request failed: %s", metadata_response.status_code)
            raise HTTPException(status_code=502, detail="YouCam could not prepare the image upload. Check your API access and try again.")
        try:
            file_payload = metadata_response.json()["data"]["files"][0]
            file_id = file_payload["file_id"]
            upload_request = file_payload["requests"][0]
            upload_url = upload_request["url"]
            upload_headers = upload_request.get("headers", {})
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            logger.exception("Unexpected YouCam file response")
            raise HTTPException(status_code=502, detail="YouCam returned an unexpected image-upload response.") from exc

        upload_response = await client.put(upload_url, headers=upload_headers, content=image_bytes)
        if upload_response.is_error:
            logger.warning("YouCam signed upload failed: %s", upload_response.status_code)
            raise HTTPException(status_code=502, detail="The image could not be transferred to YouCam. Please retry with a different image.")
    return str(file_id)


def extract_task_status(payload: dict[str, Any]) -> str:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    raw = data.get("task_status") or data.get("status") or payload.get("task_status") or payload.get("status")
    if isinstance(raw, str):
        normalized = raw.lower()
        if normalized in {"success", "succeeded", "completed", "complete", "done"}:
            return "success"
        if normalized in {"error", "failed", "failure", "cancelled", "canceled"}:
            return "error"
        if normalized in {"running", "pending", "queued", "processing", "created"}:
            return "running"
    if data.get("results") and not data.get("task_status"):
        return "success"
    return "running"


def extract_output_url(value: Any) -> str | None:
    """Best-effort extraction of the generated image URL from YouCam result payloads."""
    preferred_keys = {"result_url", "output_url", "image_url", "generated_image_url", "dst_url", "download_url", "url"}
    if isinstance(value, dict):
        for key in preferred_keys:
            item = value.get(key)
            if isinstance(item, str) and item.startswith("https://"):
                return item
        for key, item in value.items():
            if key in {"mask_urls", "requests", "upload_url"}:
                continue
            found = extract_output_url(item)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = extract_output_url(item)
            if found:
                return found
    return None


def find_color_payload(payload: dict[str, Any]) -> dict[str, Any] | None:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    results = data.get("results") if isinstance(data.get("results"), dict) else {}
    colors = results.get("color") or data.get("color")
    if isinstance(colors, dict):
        return colors
    return None


async def create_yce_task(path: str, body: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{YCE_BASE}{path}", headers=yce_headers(), json=body)
        if response.is_error:
            logger.warning("YouCam task creation failed: %s %s", path, response.status_code)
            detail = "YouCam could not start this task. Check API access, remaining units, and the image requirements."
            if response.status_code == 401:
                detail = "YouCam rejected the API key. Check YCE_API_KEY."
            elif response.status_code == 429:
                detail = "YouCam rate limit or unit limit reached. Try again later or check your account."
            raise HTTPException(status_code=502, detail=detail)
        try:
            return response.json()
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="YouCam returned an unexpected task response.") from exc


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "app": "styleTV"}


@app.get("/", response_class=HTMLResponse)
async def landing(request: Request):
    return templates.TemplateResponse(
        request,
        "landing.html",
        {"request": request, "signed_in": bool(request.session.get("demo_user")), "csrf_token": csrf_token(request)},
    )


@app.get("/signin", response_class=HTMLResponse)
async def signin_page(request: Request, error: str | None = None):
    if request.session.get("demo_user"):
        return RedirectResponse("/app", status_code=303)
    return templates.TemplateResponse(
        request,
        "signin.html",
        {"request": request, "error": error, "csrf_token": csrf_token(request)},
    )


@app.post("/signin")
async def signin(request: Request, email: str = Form(...), password: str = Form(...), csrf: str = Form(...)):
    expected_csrf = str(request.session.get("csrf_token", ""))
    if not expected_csrf or not secrets.compare_digest(csrf, expected_csrf):
        return RedirectResponse("/signin?error=expired", status_code=303)
    demo_email = os.getenv("DEMO_EMAIL", "demo@styletv.app").strip().lower()
    demo_password = os.getenv("DEMO_PASSWORD", "styleTV2026")
    if not secrets.compare_digest(email.strip().lower(), demo_email) or not secrets.compare_digest(password, demo_password):
        return RedirectResponse("/signin?error=invalid", status_code=303)
    request.session.clear()
    request.session["demo_user"] = {"email": demo_email, "name": "Demo stylist"}
    request.session["csrf_token"] = secrets.token_urlsafe(32)
    return RedirectResponse("/app", status_code=303)


@app.get("/signout", response_class=HTMLResponse)
async def signout_page(request: Request, done: bool = False):
    signed_in = bool(request.session.get("demo_user"))
    return templates.TemplateResponse(
        request,
        "signout.html",
        {"request": request, "signed_in": signed_in, "done": done, "csrf_token": csrf_token(request)},
    )


@app.post("/signout")
async def signout(request: Request, csrf: str = Form(...)):
    expected_csrf = str(request.session.get("csrf_token", ""))
    if expected_csrf and secrets.compare_digest(csrf, expected_csrf):
        request.session.clear()
    return RedirectResponse("/signout?done=1", status_code=303)


@app.get("/app", response_class=HTMLResponse)
async def app_page(request: Request):
    if not request.session.get("demo_user"):
        return RedirectResponse("/signin?next=/app", status_code=303)
    return templates.TemplateResponse(
        request,
        "app.html",
        {"request": request, "user": request.session["demo_user"], "csrf_token": csrf_token(request)},
    )


@app.get("/api/config")
async def config(request: Request):
    require_session(request)
    return {
        "gemini_configured": bool(GEMINI_API_KEY),
        "gemini_model": GEMINI_MODEL,
        "youcam_configured": bool(YCE_API_KEY),
        "storage": "IndexedDB (this browser)",
        "demo_mode": True,
    }


@app.get("/api/catalog")
async def api_catalog(request: Request):
    """Return the curated daytime show directory only; outfit items stay on WornOnTV."""
    require_session(request)
    return {
        "shows": SHOWS,
        "catalogue": {
            "count": len(SHOWS),
            "limit": len(SHOWS),
            "source": "Curated daytime shows with official outbound WornOnTV wardrobe links",
            "source_url": "https://wornontv.net/",
            "source_status": "curated",
        },
    }


class RecommendationRequest(BaseModel):
    query: str = Field(default="", max_length=1200)
    profile: dict[str, Any] = Field(default_factory=dict)
    limit: int = Field(default=6, ge=1, le=12)
    # Explicit show context keeps the Explore actions deterministic.
    focus_show_id: str | None = Field(default=None, max_length=100)
    focus_show_name: str | None = Field(default=None, max_length=240)
    focus_show_tags: list[str] = Field(default_factory=list, max_length=12)


def _normalise_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").casefold()).strip()


def _resolve_focus_show(query: str, show_catalog: list[dict[str, Any]], focus_show_id: str | None = None) -> dict[str, Any] | None:
    if focus_show_id:
        hit = next((show for show in show_catalog if show.get("id") == focus_show_id), None)
        if hit:
            return hit
    normalized = _normalise_text(query)
    candidates = [show for show in show_catalog if _normalise_text(show.get("name")) and _normalise_text(show.get("name")) in normalized]
    return max(candidates, key=lambda show: len(show.get("name", "")), default=None)


def rank_show_recommendations(
    profile: dict[str, Any],
    shows: list[dict[str, Any]],
    limit: int = 6,
    query: str = "",
    focus_show_id: str | None = None,
) -> list[dict[str, Any]]:
    """Rank real daytime wardrobe sources; never generate or fabricate garment listings."""
    favorites = set(profile.get("favoriteShows") or [])
    focus = _resolve_focus_show(query, shows, focus_show_id)
    favorite_cues: set[str] = set()
    by_id = {show.get("id"): show for show in shows}
    for show_id in favorites:
        favorite_cues.update(_normalise_text(tag) for tag in (by_id.get(show_id, {}).get("tags") or []))

    profile_tags = {_normalise_text(tag) for tag in (profile.get("styleTags") or [])}
    profile_patterns = {_normalise_text(tag) for tag in (profile.get("patterns") or [])}
    query_normalized = _normalise_text(query)
    query_words = set(re.findall(r"[a-z0-9]+", query_normalized))
    stop_words = {"the", "and", "for", "with", "show", "outfit", "outfits", "style", "styles", "looks", "look", "find", "me", "my", "please", "under", "below", "less", "than", "up", "to", "max", "maximum", "price", "budget", "dollar", "dollars"}
    query_words -= stop_words

    scored: list[tuple[float, dict[str, Any]]] = []
    for show in shows:
        tags = {_normalise_text(tag) for tag in (show.get("tags") or [])}
        searchable = _normalise_text(" ".join([show.get("name", ""), show.get("category", ""), show.get("description", ""), *show.get("tags", [])]))
        words = set(re.findall(r"[a-z0-9]+", searchable))
        score = 0.0
        score += 4.0 * len(profile_tags & tags)
        score += 2.5 * len(profile_patterns & tags)
        score += 1.25 * len(favorite_cues & tags)
        score += 2.0 * len(query_words & tags)
        score += 0.5 * len(query_words & words)
        if query_normalized and _normalise_text(show.get("name")) == query_normalized:
            score += 100.0
        elif query_normalized and _normalise_text(show.get("name")) in query_normalized:
            score += 70.0
        if focus and show.get("id") == focus.get("id"):
            score += 1000.0
        # A search for a specific programme should return that programme even if it is already a favourite.
        if not focus and show.get("id") in favorites:
            continue
        scored.append((score, show))

    scored.sort(key=lambda item: (-item[0], _normalise_text(item[1].get("name"))))
    selected = [item[1] for item in scored[:limit]]
    # Keep explicit focus first, even when a later tie-break or AI shortlist is involved.
    if focus and all(item.get("id") != focus.get("id") for item in selected):
        selected = [focus, *selected[: max(0, limit - 1)]]
    return selected[:limit]


def show_recommendation_reason(show: dict[str, Any], profile: dict[str, Any], query: str = "", focus_show_id: str | None = None) -> str:
    if focus_show_id and show.get("id") == focus_show_id:
        return "You selected this programme. Open its wardrobe page to see documented outfits worn on screen."
    tags = {_normalise_text(tag) for tag in (show.get("tags") or [])}
    selected_tags = {_normalise_text(tag) for tag in (profile.get("styleTags") or [])}
    selected_patterns = {_normalise_text(tag) for tag in (profile.get("patterns") or [])}
    matches = sorted((tags & selected_tags) | (tags & selected_patterns))
    if matches:
        readable = ", ".join(matches[:3])
        return f"Matches style preferences in your profile: {readable}. View the actual outfit records on WornOnTV."
    q = _normalise_text(query)
    if q and q in _normalise_text(show.get("name", "")):
        return "Matches the programme you searched for. View the actual outfit records on WornOnTV."
    return "A daytime wardrobe source to explore. Outfit details and shopping links remain on WornOnTV."


async def gemini_recommendations(
    profile: dict[str, Any], query: str, candidates: list[dict[str, Any]], shows: list[dict[str, Any]] | None = None
) -> dict[str, Any] | None:
    """Ask Gemini to rank known daytime wardrobe sources, never invent specific outfits."""
    if not GEMINI_API_KEY:
        return None
    try:
        from google import genai

        allowed_shows = [
            {"id": item["id"], "name": item["name"], "category": item.get("category", ""), "style_cues": item.get("tags", []), "description": item.get("description", "")[:180]}
            for item in candidates
        ]
        prompt = (
            "You are the recommender for styleTV, a daytime-TV fashion discovery app. "
            "Rank only the supplied daytime programmes by relevance to the user's style profile and query. "
            "Do not invent outfits, cast clothing, item details, prices, brands, retailers, or availability. "
            "Actual documented outfits must be viewed through the supplied programme's WornOnTV wardrobe page. "
            "Return valid JSON only with keys show_ids (ordered array of supplied show IDs) and explanation (one concise sentence). "
            "If the query explicitly names a programme, put that programme first.\n"
            f"QUERY: {query}\nPROFILE: {json.dumps(profile, ensure_ascii=False)}\n"
            f"KNOWN DAYTIME PROGRAMMES: {json.dumps(allowed_shows, ensure_ascii=False)}"
        )
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=GEMINI_MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        raw = getattr(response, "text", None)
        if not raw:
            return None
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
        parsed = json.loads(cleaned)
        allowed_ids = {item["id"] for item in candidates}
        parsed_ids = parsed.get("show_ids", [])
        if not isinstance(parsed_ids, list):
            return None
        valid_ids = [show_id for show_id in parsed_ids if isinstance(show_id, str) and show_id in allowed_ids]
        # Empty / unrelated IDs are not a usable Gemini ranking; trigger the explicit fallback.
        if not valid_ids:
            return None
        return {
            "show_ids": list(dict.fromkeys(valid_ids)),
            "explanation": str(parsed.get("explanation", "")).strip()[:360],
        }
    except Exception:
        logger.exception("Gemini wardrobe-source recommendations failed; using profile ranking")
        return None


@app.post("/api/recommendations")
async def api_recommendations(body: RecommendationRequest, request: Request):
    """Recommend relevant daytime shows and link to their original, documented outfits."""
    require_session(request)
    focus = _resolve_focus_show(body.query, SHOWS, body.focus_show_id)
    focus_id = focus.get("id") if focus else None
    candidates = rank_show_recommendations(
        body.profile,
        SHOWS,
        limit=max(body.limit, 12),
        query=body.query,
        focus_show_id=focus_id,
    )
    ai = None
    if GEMINI_API_KEY:
        try:
            ai = await asyncio.wait_for(
                gemini_recommendations(body.profile, body.query, candidates, SHOWS),
                timeout=RECOMMENDATION_AI_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.warning("Gemini wardrobe-source recommendations timed out; using profile ranking")
        except Exception:
            logger.exception("Gemini wardrobe-source recommendation request failed; using profile ranking")

    by_id = {show["id"]: show for show in candidates}
    if ai:
        valid_ai_ids = [show_id for show_id in ai.get("show_ids", []) if isinstance(show_id, str) and show_id in by_id]
        if valid_ai_ids:
            ordered = [by_id[show_id] for show_id in dict.fromkeys(valid_ai_ids)]
            ordered.extend(show for show in candidates if show["id"] not in {item["id"] for item in ordered})
            candidates = ordered
            ai = {**ai, "show_ids": valid_ai_ids}
        else:
            # An empty or out-of-catalog Gemini response is not a successful recommendation.
            ai = None
    if focus and focus.get("id") in by_id:
        candidates = [by_id[focus["id"]], *[show for show in candidates if show["id"] != focus["id"]]]

    results = []
    for show in candidates[:body.limit]:
        item = dict(show)
        item["recommendation_reason"] = show_recommendation_reason(show, body.profile, body.query, focus_id)
        item["wardrobe_url"] = show.get("wornontv_url") or "https://wornontv.net/"
        results.append(item)

    ai_status = "used" if ai else ("fallback" if GEMINI_API_KEY else "not_configured")
    default_explanation = (
        f"Showing the documented wardrobe source for {focus['name']}. styleTV does not copy its outfit listings."
        if focus else "Ranked daytime wardrobe sources using your saved style directions, favourite-show cues, and search terms. Open a show to see actual documented outfits."
    )
    return {
        "recommendations": results,
        "source": "gemini" if ai else "profile-ranker",
        "model": GEMINI_MODEL if ai else None,
        "ai_status": ai_status,
        "explanation": (ai or {}).get("explanation") or default_explanation,
        "outfit_source": "WornOnTV",
        "outfit_listing_mode": "outbound-link",
        "price_filter_note": "Specific outfit prices and stock are provided by WornOnTV and linked retailers; styleTV does not duplicate those listings.",
    }


@app.post("/api/try-on")
async def try_on_outfit(
    request: Request,
    photo: UploadFile = File(...),
    outfit_reference: UploadFile = File(...),
    consent: bool = Form(...),
    garment_category: str = Form(default="auto"),
):
    """Run Clothes V4 on the user's photo and the exact outfit reference they chose."""
    require_session(request)
    if not consent:
        raise HTTPException(status_code=400, detail="Consent is required before sending either image to YouCam.")
    if garment_category not in {"auto", "full_body", "upper_body", "lower_body", "shoes", "outer"}:
        raise HTTPException(status_code=400, detail="Choose a supported garment category.")
    photo_type = (photo.content_type or "").lower()
    reference_type = (outfit_reference.content_type or "").lower()
    if photo_type not in ALLOWED_IMAGE_TYPES or reference_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Use JPG or PNG files for both the personal photo and outfit reference.")

    photo_bytes, reference_bytes = await asyncio.gather(
        photo.read(MAX_UPLOAD_BYTES + 1),
        outfit_reference.read(MAX_UPLOAD_BYTES + 1),
    )
    if not photo_bytes or not reference_bytes:
        raise HTTPException(status_code=400, detail="Both image files are required and cannot be empty.")
    if len(photo_bytes) > MAX_UPLOAD_BYTES or len(reference_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Each image must be smaller than 9.5 MB.")

    # Both images are explicitly uploaded through YouCam's File API; the reference
    # is the user's selected real outfit, not a random local catalogue garment.
    src_file_id, ref_file_id = await asyncio.gather(
        upload_image_to_yce(photo_bytes, photo.filename or "styleTV-photo.jpg", photo_type),
        upload_image_to_yce(reference_bytes, outfit_reference.filename or "worn-outfit.jpg", reference_type),
    )
    payload = await create_yce_task(
        YCE_TASK_PATHS["try-on"],
        {
            "src_file_id": src_file_id,
            "ref_file_id": ref_file_id,
            "garment_category": garment_category,
            "filter_multi_person": "normal",
        },
    )
    try:
        task_id = payload["data"]["task_id"]
    except (KeyError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="YouCam did not return a try-on task ID.") from exc
    return {
        "task_id": task_id,
        "task_kind": "try-on",
        "reference_mode": "user-selected-outfit-image",
        "message": "YouCam Clothes V4 is processing the selected outfit reference.",
    }


@app.post("/api/color-analysis")
async def color_analysis(request: Request, photo: UploadFile = File(...), consent: bool = Form(...)):
    require_session(request)
    if not consent:
        raise HTTPException(status_code=400, detail="Consent is required before sending your photo to YouCam.")
    content_type = (photo.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Use a JPG or PNG selfie.")
    photo_bytes = await photo.read(MAX_UPLOAD_BYTES + 1)
    file_id = await upload_image_to_yce(photo_bytes, photo.filename or "styleTV-colour-selfie.jpg", content_type)
    payload = await create_yce_task(
        YCE_TASK_PATHS["color"],
        {"src_file_id": file_id, "face_angle_strictness_level": "high"},
    )
    try:
        task_id = payload["data"]["task_id"]
    except (KeyError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="YouCam did not return a colour-analysis task ID.") from exc
    return {"task_id": task_id, "task_kind": "color", "message": "Your colour analysis is processing."}


@app.get("/api/tasks/{kind}/{task_id:path}")
async def task_status(kind: str, task_id: str, request: Request):
    require_session(request)
    if kind not in {"try-on", "color"}:
        raise HTTPException(status_code=404, detail="Unknown task type.")
    if not task_id or len(task_id) > 512 or ".." in task_id:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    endpoint = YCE_TASK_PATHS[kind] + "/"
    async with httpx.AsyncClient(timeout=25.0) as client:
        response = await client.get(f"{YCE_BASE}{endpoint}{task_id}", headers=yce_headers())
        if response.is_error:
            logger.warning("YouCam task status lookup failed: %s", response.status_code)
            raise HTTPException(status_code=502, detail="Could not retrieve the YouCam task status. Retry in a moment.")
        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="YouCam returned an unexpected task status response.") from exc

    status = extract_task_status(payload)
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    result: dict[str, Any] = {"status": status, "task_kind": kind}
    if status == "error":
        result["message"] = data.get("error_message") or payload.get("error_message") or "The task could not be completed. Try a different photo."
    elif status == "success":
        if kind == "color":
            result["colors"] = find_color_payload(payload) or {}
            result["message"] = "Colour analysis completed. Use these colour cues as inspiration, not rules."
        else:
            result["result_url"] = extract_output_url(payload)
            if not result["result_url"]:
                result["message"] = "YouCam completed the task, but the response did not include a recognized result image URL."
            else:
                result["message"] = "Your try-on is ready. This is a visual preview, not a fit guarantee."
    return result
