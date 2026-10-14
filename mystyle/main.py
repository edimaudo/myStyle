from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import secrets
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware

from .catalog import ITEMS, PALETTES, STYLE_OPTIONS, OCCASIONS, catalog_payload

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public"
TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mystyle")

SESSION_SECRET = os.getenv("SESSION_SECRET", "").strip()
if os.getenv("VERCEL", "0") == "1" and not SESSION_SECRET:
    raise RuntimeError("Set SESSION_SECRET in Vercel Environment Variables before deploying myStyle.")

app = FastAPI(title="myStyle", version="1.0.0", description="Seasonal personal styling and colour-aware clothing inspiration.")
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET or "local-only-change-me-please-replace",
    session_cookie="mystyle_demo_session",
    max_age=60 * 60 * 8,
    same_site="lax",
    https_only=os.getenv("VERCEL", "0") == "1",
)
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
SEASONS = {"spring", "summer", "fall", "winter"}
SEASON_LABELS = {"spring": "Spring", "summer": "Summer", "fall": "Fall", "winter": "Winter"}
CLIMATE_LABELS = {"cold": "Cold winters", "variable": "Variable weather", "mild": "Mild climate", "warm": "Warm climate"}


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
    return "image/png" if content_type == "image/png" else "image/jpg"


def yce_headers() -> dict[str, str]:
    if not YCE_API_KEY:
        raise HTTPException(status_code=503, detail="YouCam skin analysis is not configured. Add YCE_API_KEY to enable live analysis.")
    return {"Authorization": f"Bearer {YCE_API_KEY}", "Content-Type": "application/json"}


async def upload_image_to_yce(image_bytes: bytes, filename: str, content_type: str) -> str:
    if not image_bytes or len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Choose a selfie smaller than 9.5 MB.")
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Use a JPG or PNG selfie.")
    provider_content_type = normalize_yce_content_type(content_type)
    clean_name = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename or "selfie.jpg").name)[:100]
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
            raise HTTPException(status_code=502, detail="YouCam could not prepare the selfie upload. Check API access and try again.")
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
            raise HTTPException(status_code=502, detail="The selfie could not be transferred to YouCam. Please try another image.")
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


def find_color_payload(payload: dict[str, Any]) -> dict[str, Any] | None:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    results = data.get("results") if isinstance(data.get("results"), dict) else {}
    colors = results.get("color") or data.get("color")
    return colors if isinstance(colors, dict) else None


async def create_yce_color_task(file_id: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{YCE_BASE}/s2s/v2.0/task/skin-tone-analysis",
            headers=yce_headers(),
            json={"src_file_id": file_id, "face_angle_strictness_level": "high"},
        )
        if response.is_error:
            logger.warning("YouCam skin tone task creation failed: %s", response.status_code)
            detail = "YouCam could not start skin colour analysis. Check API access, remaining units and selfie requirements."
            if response.status_code == 401:
                detail = "YouCam rejected the API key. Check YCE_API_KEY."
            elif response.status_code == 429:
                detail = "YouCam rate or unit limit reached. Check your account and try again later."
            raise HTTPException(status_code=502, detail=detail)
        try:
            return response.json()
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="YouCam returned an unexpected task response.") from exc


def _normalise_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").casefold()).strip()


def current_season(profile: dict[str, Any]) -> str:
    value = _normalise_text(profile.get("season") or "auto")
    if value in SEASONS:
        return value
    month = datetime.now().month
    if month in (12, 1, 2):
        return "winter"
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    return "fall"


def palette_guide(skin_analysis: Any) -> dict[str, Any] | None:
    """Derive cautious colour inspiration from detected facial colour values.

    The YouCam API returns hex tones, not a professional seasonal colour typing.
    This heuristic is deliberately labelled as inspiration and never as a rule.
    """
    if not isinstance(skin_analysis, dict):
        return None
    skin_hex = skin_analysis.get("skin_color")
    if not isinstance(skin_hex, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", skin_hex):
        return None
    r, g, b = (int(skin_hex[i:i + 2], 16) for i in (1, 3, 5))
    delta = r - b
    if delta >= 16:
        family = "warm"
        label = "Warm-leaning colour ideas"
        suggestions = ["olive", "rust", "camel", "warm cream", "terracotta", "teal"]
        palette_ids = {"earth"}
    elif delta <= -10:
        family = "cool"
        label = "Cool-leaning colour ideas"
        suggestions = ["navy", "berry", "cobalt", "cool grey", "plum", "icy blue"]
        palette_ids = {"cool", "jewel"}
    else:
        family = "balanced"
        label = "Balanced colour ideas"
        suggestions = ["soft white", "denim blue", "sage", "burgundy", "taupe", "charcoal"]
        palette_ids = {"cool", "earth", "jewel", "monochrome"}
    return {
        "family": family,
        "label": label,
        "suggestions": suggestions,
        "palette_ids": sorted(palette_ids),
        "skin_color": skin_hex,
        "note": "An approximate palette prompt from detected image colours, not a definitive undertone or professional seasonal colour analysis.",
    }


def _profile_palette_ids(profile: dict[str, Any], skin_guide: dict[str, Any] | None) -> set[str]:
    scheme = _normalise_text(profile.get("colorScheme") or "earth")
    if scheme == "selfie":
        # Never substitute a generic palette and describe it as skin-informed.
        return set((skin_guide or {}).get("palette_ids") or [])
    if scheme in {"earth", "cool", "jewel", "pastel", "bright", "monochrome"}:
        return {scheme}
    if scheme == "custom":
        return set()
    return {"earth"}


def _season_compatible(item: dict[str, Any], season: str) -> bool:
    seasons = set(item.get("seasons") or [])
    return season in seasons or "all" in seasons


def _country_currency(profile: dict[str, Any]) -> tuple[str, str]:
    country = _normalise_text(profile.get("country") or "ca")
    return ("CAD", "target_cad") if country in {"ca", "canada", "can"} else ("USD", "target_usd")


def _budget_value(profile: dict[str, Any]) -> float | None:
    value = profile.get("budget", "any")
    if value in (None, "", "any"):
        return None
    try:
        number = float(value)
        return number if number > 0 else None
    except (TypeError, ValueError):
        return None


def _query_tokens(query: str) -> set[str]:
    stop = {"the", "and", "for", "with", "style", "styles", "item", "items", "clothing", "clothes", "outfit", "outfits", "find", "show", "me", "my", "under", "below", "less", "than", "price", "budget", "shop", "similar"}
    return set(re.findall(r"[a-z0-9]+", _normalise_text(query))) - stop


def _guide_colour_terms(guide: dict[str, Any] | None) -> set[str]:
    qualifiers = {"warm", "cool", "soft", "icy", "bright", "light", "deep"}
    terms: set[str] = set()
    for suggestion in (guide or {}).get("suggestions", []):
        terms.update(_query_tokens(str(suggestion)) - qualifiers)
    return terms


def rank_items(profile: dict[str, Any], items: list[dict[str, Any]], limit: int = 8, query: str = "") -> list[dict[str, Any]]:
    season = current_season(profile)
    country_currency, price_field = _country_currency(profile)
    budget = _budget_value(profile)
    excluded = {str(x) for x in (profile.get("notForMeItemIds") or [])}
    style_tags = {_normalise_text(x) for x in (profile.get("styleTags") or [])}
    occasions = {_normalise_text(x) for x in (profile.get("occasions") or [])}
    scheme_ids = _profile_palette_ids(profile, palette_guide(profile.get("skinAnalysis")))
    custom_colors = _query_tokens(str(profile.get("customColors") or ""))
    explicit_colors = {_normalise_text(x) for x in (profile.get("colorPreferences") or [])}
    query_tokens = _query_tokens(query)
    guide = palette_guide(profile.get("skinAnalysis"))
    preferred_fit = _normalise_text(profile.get("fitPreference") or "balanced")
    guide_palettes = set((guide or {}).get("palette_ids") or [])
    guide_colour_terms = _guide_colour_terms(guide)

    scored: list[tuple[float, dict[str, Any]]] = []
    for item in items:
        if item["id"] in excluded:
            continue
        # This is a seasonal edit, not a year-round catalogue sorted by a seasonal score.
        # Omit items not marked for the selected North American season.
        if not _season_compatible(item, season):
            continue
        target_price = float(item[price_field])
        if budget is not None and target_price > budget:
            continue
        tags = {_normalise_text(x) for x in item.get("style_tags", [])}
        item_palettes = set(item.get("palettes", []))
        item_colors = {_normalise_text(x) for x in item.get("colors", [])}
        item_seasons = set(item.get("seasons", []))
        item_climates = set(item.get("climates", []))
        item_occasions = {_normalise_text(x) for x in item.get("occasions", [])}
        searchable = _normalise_text(" ".join([
            item.get("name", ""), item.get("category", ""), item.get("description", ""),
            *item.get("style_tags", []), *item.get("colors", []), *item.get("palettes", []),
            *item.get("seasons", []), *item.get("occasions", []), item.get("shop_query", ""),
        ]))
        searchable_tokens = set(re.findall(r"[a-z0-9]+", searchable))
        score = 1.0
        score += 4.0 * len(style_tags & tags)
        score += 3.0 * len(occasions & item_occasions)
        score += 4.5 if scheme_ids & item_palettes else 0.0
        score += 2.5 * len(explicit_colors & item_colors)
        score += 3.0 * len(custom_colors & (item_colors | tags | item_palettes))
        score += 6.0 if season in item_seasons else (1.5 if "all" in item_seasons else -1.5)
        fit_tags = set(item.get("fit_tags", ["balanced"]))
        if preferred_fit in fit_tags:
            score += 3.5
        # Use YouCam's detected colour data as an additional signal without
        # overriding a palette the user deliberately selected.
        if guide:
            score += 2.25 if guide_palettes & item_palettes else 0.0
            score += min(4.0, 1.25 * len(guide_colour_terms & item_colors))
        climate = _normalise_text(profile.get("climate") or "variable")
        if "all" in item_climates or climate in item_climates or (climate == "variable" and "mild" in item_climates):
            score += 3.0
        else:
            score -= 1.0
        score += 2.0 * len(query_tokens & searchable_tokens)
        if guide and scheme_ids and scheme_ids & item_palettes:
            score += 1.0
        enriched = dict(item)
        enriched["target_price"] = int(target_price)
        enriched["currency"] = country_currency
        enriched["season_match"] = season in item_seasons or "all" in item_seasons
        enriched["fit_match"] = preferred_fit in fit_tags
        enriched["recommendation_reason"] = _recommendation_reason(item, style_tags, occasions, scheme_ids, season, guide, preferred_fit)
        enriched["match_score"] = round(score, 3)
        scored.append((score, enriched))

    scored.sort(key=lambda pair: (-pair[0], pair[1]["target_price"], pair[1]["name"].casefold()))
    return [item for _, item in scored[:limit]]


def _recommendation_reason(item: dict[str, Any], style_tags: set[str], occasions: set[str], palettes: set[str], season: str, guide: dict[str, Any] | None, preferred_fit: str) -> str:
    tags = {_normalise_text(x) for x in item.get("style_tags", [])}
    matched = sorted(tags & style_tags)
    if matched:
        reason = f"Fits your {', '.join(matched[:2])} style direction"
    elif set(item.get("palettes", [])) & palettes:
        reason = "Works with your selected colour direction"
    elif set(item.get("occasions", [])) & occasions:
        reason = "A useful option for the occasions you selected"
    else:
        reason = "A versatile piece to build an outfit around"
    if season in item.get("seasons", []):
        reason += f" · suited to {SEASON_LABELS[season].lower()}"
    if preferred_fit in set(item.get("fit_tags", ["balanced"])):
        reason += f" · aligns with your {preferred_fit} fit preference"
    item_palettes = set(item.get("palettes", []))
    guide_palettes = set((guide or {}).get("palette_ids", []))
    if guide and (item_palettes & guide_palettes):
        reason += " · colour direction aligns with your facial colour cues"
    elif guide and _guide_colour_terms(guide) & {_normalise_text(c) for c in item.get("colors", [])}:
        reason += " · colour ideas informed by your facial colour cues"
    return reason + "."


async def gemini_rank_items(profile: dict[str, Any], query: str, items: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not GEMINI_API_KEY or not items:
        return None
    try:
        from google import genai
        allowed = [{"id": i["id"], "name": i["name"], "category": i["category"], "tags": i["style_tags"], "colours": i["colors"], "seasons": i["seasons"], "occasions": i["occasions"]} for i in items]
        prompt = (
            "You are the product ranking engine for myStyle, a North American personal-styling app. "
            "Rank only the supplied style concepts. Never invent items, brands, retailer inventory, exact product prices, "
            "availability, or claims about the user's body. Respect the provided season, budget, color scheme and style preferences. "
            "Return JSON only: {\"item_ids\":[ordered supplied IDs],\"explanation\":\"one concise sentence\"}. "
            "Do not include any IDs not in the list.\n"
            f"QUERY: {query}\nPROFILE: {json.dumps(profile, ensure_ascii=False)}\nITEMS: {json.dumps(allowed, ensure_ascii=False)}"
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
        ids = parsed.get("item_ids")
        allowed_ids = {i["id"] for i in items}
        if not isinstance(ids, list):
            return None
        valid = list(dict.fromkeys(x for x in ids if isinstance(x, str) and x in allowed_ids))
        if not valid:
            return None
        return {"item_ids": valid, "explanation": str(parsed.get("explanation", "")).strip()[:300]}
    except Exception:
        logger.exception("Gemini personal styling ranking failed; using deterministic matching")
        return None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "app": "myStyle"}


@app.get("/", response_class=HTMLResponse)
async def landing(request: Request):
    return templates.TemplateResponse(request, "landing.html", {"request": request, "signed_in": bool(request.session.get("demo_user")), "csrf_token": csrf_token(request)})


@app.get("/signin", response_class=HTMLResponse)
async def signin_page(request: Request, error: str | None = None):
    if request.session.get("demo_user"):
        return RedirectResponse("/app", status_code=303)
    return templates.TemplateResponse(request, "signin.html", {"request": request, "error": error, "csrf_token": csrf_token(request)})


@app.post("/signin")
async def signin(request: Request, email: str = Form(...), password: str = Form(...), csrf: str = Form(...)):
    expected_csrf = str(request.session.get("csrf_token", ""))
    if not expected_csrf or not secrets.compare_digest(csrf, expected_csrf):
        return RedirectResponse("/signin?error=expired", status_code=303)
    demo_email = os.getenv("DEMO_EMAIL", "demo@mystyle.app").strip().lower()
    demo_password = os.getenv("DEMO_PASSWORD", "myStyle2026")
    if not secrets.compare_digest(email.strip().lower(), demo_email) or not secrets.compare_digest(password, demo_password):
        return RedirectResponse("/signin?error=invalid", status_code=303)
    request.session.clear()
    request.session["demo_user"] = {"email": demo_email, "name": "myStyle Member"}
    request.session["csrf_token"] = secrets.token_urlsafe(32)
    return RedirectResponse("/app", status_code=303)


@app.get("/signout", response_class=HTMLResponse)
async def signout_page(request: Request, done: bool = False):
    return templates.TemplateResponse(request, "signout.html", {"request": request, "signed_in": bool(request.session.get("demo_user")), "done": done, "csrf_token": csrf_token(request)})


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
    return templates.TemplateResponse(request, "app.html", {"request": request, "user": request.session["demo_user"], "csrf_token": csrf_token(request)})


@app.get("/api/config")
async def config(request: Request):
    require_session(request)
    return {
        "gemini_configured": bool(GEMINI_API_KEY),
        "gemini_model": GEMINI_MODEL,
        "youcam_configured": bool(YCE_API_KEY),
        "demo_mode": True,
        "supported_countries": ["CA", "US"],
    }


@app.get("/api/catalog")
async def api_catalog(request: Request):
    require_session(request)
    return catalog_payload()


class RecommendationRequest(BaseModel):
    query: str = Field(default="", max_length=1200)
    profile: dict[str, Any] = Field(default_factory=dict)
    limit: int = Field(default=8, ge=1, le=16)


@app.post("/api/recommendations")
async def api_recommendations(body: RecommendationRequest, request: Request):
    require_session(request)
    profile = body.profile
    season = current_season(profile)
    currency, price_field = _country_currency(profile)
    target_price_label = "budget target" if currency == "CAD" else "budget target"
    all_ranked = rank_items(profile, ITEMS, limit=len(ITEMS), query=body.query)
    ai = None
    if GEMINI_API_KEY and all_ranked:
        try:
            # Only rerank the already filtered catalogue. Gemini cannot add items or bypass budget/season exclusions.
            ai = await asyncio.wait_for(
                gemini_rank_items(profile, body.query, all_ranked),
                timeout=RECOMMENDATION_AI_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.warning("Gemini personal styling ranking timed out; using deterministic matching")
        except Exception:
            logger.exception("Gemini personal styling request failed; using deterministic matching")
    if ai:
        by_id = {item["id"]: item for item in all_ranked}
        ordered = [by_id[i] for i in ai["item_ids"] if i in by_id]
        ordered.extend(item for item in all_ranked if item["id"] not in {x["id"] for x in ordered})
        all_ranked = ordered
    guide = palette_guide(profile.get("skinAnalysis"))
    return {
        "recommendations": all_ranked[:body.limit],
        "count": len(all_ranked[:body.limit]),
        "season": season,
        "season_label": SEASON_LABELS[season],
        "climate": _normalise_text(profile.get("climate") or "variable"),
        "climate_label": CLIMATE_LABELS.get(_normalise_text(profile.get("climate") or "variable"), "Variable weather"),
        "country": "CA" if currency == "CAD" else "US",
        "currency": currency,
        "source": "gemini" if ai else "profile-ranker",
        "ai_status": "used" if ai else ("fallback" if GEMINI_API_KEY else "not_configured"),
        "model": GEMINI_MODEL if ai else None,
        "explanation": (ai or {}).get("explanation") or f"Ranked {len(all_ranked)} style concepts against your palette, fit preferences, budget, lifestyle and {SEASON_LABELS[season].lower()} season.",
        "skin_palette_guide": guide,
        "catalogue_note": "Cards are curated style concepts with editorial inspiration images and illustrative budget targets—not live retailer listings. Shop links open searches for similar items; verify current price, size and availability with the retailer.",
    }


@app.post("/api/color-analysis")
async def color_analysis(request: Request, photo: UploadFile = File(...), consent: bool = Form(...)):
    require_session(request)
    if not consent:
        raise HTTPException(status_code=400, detail="Consent is required before sending your selfie to YouCam.")
    content_type = (photo.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Use a JPG or PNG selfie.")
    photo_bytes = await photo.read(MAX_UPLOAD_BYTES + 1)
    file_id = await upload_image_to_yce(photo_bytes, photo.filename or "mystyle-skin-analysis.jpg", content_type)
    payload = await create_yce_color_task(file_id)
    try:
        task_id = payload["data"]["task_id"]
    except (KeyError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="YouCam did not return a skin analysis task ID.") from exc
    return {"task_id": task_id, "task_kind": "color", "message": "YouCam is analyzing detected facial colour tones."}


@app.get("/api/tasks/color/{task_id:path}")
async def task_status(task_id: str, request: Request):
    require_session(request)
    if not task_id or len(task_id) > 512 or ".." in task_id:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    async with httpx.AsyncClient(timeout=25.0) as client:
        response = await client.get(f"{YCE_BASE}/s2s/v2.0/task/skin-tone-analysis/{task_id}", headers=yce_headers())
        if response.is_error:
            logger.warning("YouCam skin analysis status lookup failed: %s", response.status_code)
            raise HTTPException(status_code=502, detail="Could not retrieve the YouCam analysis status. Retry in a moment.")
        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="YouCam returned an unexpected task status response.") from exc
    status = extract_task_status(payload)
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    result: dict[str, Any] = {"status": status, "task_kind": "color"}
    if status == "error":
        result["message"] = data.get("error_message") or payload.get("error_message") or "Skin colour analysis could not be completed. Try a clearer front-facing selfie."
    elif status == "success":
        result["colors"] = find_color_payload(payload) or {}
        result["message"] = "Skin colour analysis completed. The detected colours can inform styling suggestions, not determine what you can wear."
    return result
