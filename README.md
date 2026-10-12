# styleTV — TV-inspired personal fashion discovery

A runnable FastAPI + Jinja2 prototype for exploring TV-inspired fashion, maintaining an editable style profile, discovering new shows, saving looks, exploring colour ideas, and optionally using YouCam virtual try-on and facial colour-tone analysis.

## Product boundaries in this prototype

- The show/product catalogue is a **curated demo fixture**, not a complete wardrobe database or a live retailer feed.
- Images are generic fashion inspiration, not official show stills or guaranteed photos of the exact garment worn on a show.
- Displayed prices are explicitly sample estimates. Retail buttons open searches for similar items; they do not verify exact product, size, stock, or current pricing.
- Virtual try-on and colour analysis are real YouCam API workflows when `YCE_API_KEY` is configured. Without it, the UI reports that live processing is not configured; it does not fake a successful response.
- Gemini-powered query interpretation is enabled when `GEMINI_API_KEY` is set. Otherwise, a deterministic catalogue matcher keeps the app usable.
- Sign-in is a single demo account, not production authentication. The editable profile, preferences, theme/text settings, saved looks and colour-tone results are stored in **IndexedDB in the current browser**. They do not sync across browsers or devices.
- Uploaded photo bytes are not written to IndexedDB or to a styleTV database. They are sent to YouCam only after the user explicitly consents. Photos are not saved by styleTV, but YouCam processes uploads under its own retention terms. Add an explicit privacy policy and deletion/help contact before any public launch.

## Run locally

Requires Python 3.12+ (the Vercel runtime is pinned to 3.13 in `.python-version`).

```bash
cd styleTV
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env             # optional for local demo; edit the values you need
uvicorn index:app --reload --env-file .env
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

Demo sign-in defaults:

- Email: `demo@styletv.app`
- Password: `styleTV2026`

These are deliberately visible demo credentials. Change them before sharing the prototype.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Required on Vercel | Long, random secret used to sign the demo session cookie. |
| `DEMO_EMAIL` | Optional | Demo account email; defaults to `demo@styletv.app`. |
| `DEMO_PASSWORD` | Optional | Demo password; defaults to `styleTV2026`. |
| `GEMINI_API_KEY` | Optional | Enables Gemini recommendation interpretation. |
| `GEMINI_MODEL` | Optional | Defaults to the requested `gemini-3.6-flash`. |
| `YCE_API_KEY` | Optional until testing YouCam | Enables YouCam colour-tone analysis and Clothes V4 tasks. |
| `YCE_API_BASE` | Optional | Defaults to `https://yce-api-01.makeupar.com`. |
| `VERCEL` | Set by Vercel | Causes session cookies to use `Secure` in production. |

Never commit `.env` or provider API keys. `.env.example` contains blank provider keys only.

## Deploy to Vercel

1. Push this folder to a Git repository and import it into Vercel.
2. Set `SESSION_SECRET` to a high-entropy secret in Project Settings → Environment Variables. The app intentionally raises an error on Vercel if this secret is missing.
3. Set `DEMO_EMAIL` and `DEMO_PASSWORD` to your demo credentials.
4. Add `GEMINI_API_KEY` and `YCE_API_KEY` when ready to run the real integrations. Confirm provider account access, image requirements, available units and billing first.
5. Deploy. Vercel detects the FastAPI `app` exported from the root `index.py`. Static assets live in `public/assets`; templates are included in the function bundle by `vercel.json`.

The demo login is intended for a judging prototype only. Before allowing real users, add a proper identity provider, rate limiting, robust session/CSRF controls, privacy notice, deletion controls and backend persistence if cross-device profile sync is required.

## YouCam workflows

### Clothing virtual try-on

- `POST /api/try-on/{product_id}` accepts a JPG/PNG user photo that follows YouCam V4 source-image requirements and explicit `consent=true`. The provider docs differ between the integration overview and detailed image specs about framing, so verify the accepted target-photo composition in your account’s API Playground.
- Server calls the YouCam File API to request an upload URL, transfers bytes to that signed URL, then creates a V4 task at `/s2s/v2.0/task/cloth-v4`.
- `GET /api/tasks/try-on/{task_id}` polls the task result.
- The result URL comes from YouCam's response. The browser shows it as a temporary visual preview, not a guarantee of fit/colour.

### Facial colour-tone analysis

- `POST /api/color-analysis` accepts a JPG/PNG front-facing selfie and explicit `consent=true`.
- Server uploads the file through the same YouCam File API process, then creates `/s2s/v2.0/task/skin-tone-analysis`.
- `GET /api/tasks/color/{task_id}` returns the facial colour values after task completion.
- The app stores returned colour *values* in IndexedDB but does not store the source photo. Facial colour analysis is optional and does not determine whether a style is suitable.

Provider documentation:

- YouCam Clothes V4: https://docs.perfectcorp.com/reference/ai_clothes/v4.0/paths/~1s2s~1v2.0~1task~1cloth-v4/post
- YouCam Clothes integration guide: https://docs.perfectcorp.com/reference/ai_clothes/section/overview/integration-guide
- YouCam Facial Color Tones Analyzer: https://docs.perfectcorp.com/reference/ai_skin_tone_analysis/v1.0
- Gemini model documentation: https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash
- Vercel FastAPI guide: https://vercel.com/kb/guide/ship-a-fastapi-app-on-vercel

The catalogue's demo try-on reference images must be checked and replaced with a properly licensed, matching product reference for any product-specific retail demo. The code intentionally has an explicit `try_on_reference_url` per catalogue record for that reason.

## Test

```bash
pytest -q
```

The tests cover the landing page, demo sign-in/sign-out, protected APIs, catalogue integrity and recommendation fallback. A live YouCam/Gemini smoke test requires provider credentials and must be run against the actual provider account.

## Main routes

- `GET /` — landing page
- `GET /signin` / `POST /signin` — demo sign-in
- `GET /signout` / `POST /signout` — sign-out confirmation and action
- `GET /app` — authenticated app shell
- `GET /api/catalog` — demo show and look catalogue
- `POST /api/recommendations` — Gemini-aware or deterministic recommendation ranking
- `POST /api/try-on/{product_id}` — create YouCam Clothes V4 task
- `POST /api/color-analysis` — create YouCam facial colour-tone task
- `GET /api/tasks/{kind}/{task_id}` — task polling
- `GET /health` — health check
