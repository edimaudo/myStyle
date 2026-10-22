# myStyle — Personal Styling Studio

A FastAPI + Jinja2 prototype for a Stitch Fix / Trunk Club-inspired personal styling experience. Users can choose a colour scheme or take a style quiz, save fit/budget/lifestyle preferences, receive seasonal clothing recommendations through Ensemble for Canada or the United States, save favourite pieces, and use feedback such as **Not for me** to refine future recommendations. An optional selfie workflow uses YouCam's Facial Color Tones Analyzer; detected colour values are saved in the browser profile and the selfie is kept separately in local IndexedDB for reuse.

## Current product scope

- **myStyle branding:** myStyle is the application name. Ensemble and Style profile live in one shared workspace with separate tabs, so recommendations and profile editing stay connected without mixing their controls.
- **Personal style quiz:** style aesthetics, occasions, palette and item-budget target.
- **Custom colour schemes:** choose a palette direction or type the colours you want to build around.
- **Season-aware Ensemble recommendations:** auto-detects the current North American season (spring, summer, fall or winter) or lets a user choose a season manually. Climate preference is saved separately.
- **US / Canada support:** users choose their market; Buy / Find Similar opens country-aware Google Shopping listing comparisons and adds Amazon Canada search for Canadian profiles. The app avoids hard-coded item/SKU URLs because its fashion photographs are inspiration, not linked inventory.
- **Recommendation logic:** deterministic ranking uses style tags, occasions, selected and custom colours, skin-analysis colour cues, preferred fit, season, climate, per-item budget target and `Not for me` feedback. Catalogue search is a true filter with common product synonyms, not just a ranking nudge. Weather suitability is a hard gate for fall/winter clothing: cold climates require cold-weather metadata, while variable climates prioritize tagged cold-weather looks and actual layering, knitwear or outerwear. Light standalone tops are excluded from that seasonal combination. After a successful skin analysis, the guided palette is selected automatically and recommendations are refreshed; the user can choose a different palette later. The standard UI uses deterministic in-process ranking so search, clear and refresh do not wait for a third-party AI call.
- **Gender and location preferences:** Style quiz and Style profile offer no preference, women's styles, men's styles, or gender-neutral/unisex. The Style profile's Country selection controls a Province or state dropdown: Canada shows its provinces and territories; the United States shows all 50 states. Province or state appears before City, and changing country clears the previous region and city. Every catalogue item has an explicit women/men/unisex tag; a selected range only receives items tagged for that range or unisex. Legacy saved values such as `male` and `female` are normalized before recommendations are generated.
- **Real-photo style catalogue:** Ensemble uses 75 manually curated Pexels fashion-photo references: 27 men's clothing looks, 27 women's clothing looks, 9 gender-neutral clothing looks, and 12 accessory styling references. The cards show actual people wearing clothes, not vector drawings. The title and colour tags describe the intended style reference; each card links back to Pexels for attribution/discovery. This is a deliberately quality-first starter set, not 100 looks per group; do not pad it by reusing the same image under different labels. Expand it using an authorized product/photo feed and photo-by-photo verification.
- **Virtual try-on from Ensemble:** All catalogue clothing photo references and the supported accessory types (bags, hats, scarves and shoes) expose a Virtual try-on action. After consent, the app sends the user's saved/replaced target photo and the selected reference to the corresponding YouCam workflow. A wardrobe upload is not required to try on a recommended item. Whether a provider can successfully process a particular photograph still depends on its framing and content; a configured provider key and available units are required.
- **My wardrobe repository:** Users can add photos of their own clothing and accessories with a name, category, colours, season and notes. Photos and details are stored only in IndexedDB in the current browser; they do not upload on save and do not sync across devices. The Ensemble "From My wardrobe" area appears only when the wardrobe contains real saved items that match the current recommendations. Those items can also be used as reference images for supported virtual try-on.
- **Retailer search:** Buy opens a dialog with a product-focused query based on the main garment, colours, profile audience, budget and chosen market. It is limited to Google Shopping listing comparisons and, for Canadian profiles, Amazon Canada search. These are not exact-SKU links and not affiliate claims; the user confirms the final product, price, size and stock with the seller.
- **Ensemble tabs:** Clothing recommendations are available immediately. Accessories are intentionally empty until a valid skin analysis is saved; the accessory ranking then uses the derived colour guide alongside season, budget, gender preference, fit and occasion. The accessory try-on routes bags, hats, scarves and shoes to YouCam's dedicated endpoints.
- **Local photo reuse:** Skin-analysis and try-on photos are stored in separate IndexedDB entries in the current browser. Each is reused until a replacement is selected; each submission still requires consent. Photos are not sent to YouCam on selection alone.
- **First visit and walkthrough:** A new local profile opens the Style quiz first. The myStyle Walkthrough sidebar item opens a guided sequence with Back, Next and Skip controls.
- **Skin colour analysis:** uploads a front-facing JPG/PNG selfie to YouCam only after consent, polls the task, shows detected skin/hair/eye/brow/lip colour values and applies a cautious, heuristic palette guide to Ensemble ranking. Style profile has a greyed-out, read-only skin-analysis summary before the first analysis and refreshes it after each new analysis. The selfie is stored only in local IndexedDB for reuse and is not sent until the user starts analysis with consent. This does not claim to provide a professional seasonal colour analysis or decide which colours a person is allowed to wear.
- **Saved pieces:** profile and saved / hidden feedback persist in IndexedDB in the current browser. They do not synchronize across browsers or devices.
- **Dark mode:** uses a plum/charcoal surface palette with coral/apricot accents instead of a green-dominant theme.
- **Display accessibility:** responsive layout, keyboard focus styling, reduced-motion support, light/dark mode, and small/medium/large text controls.

## Product and image data limitation

This is a two-week MVP foundation, not a live retail product aggregator. The built-in catalogue contains **75 curated real fashion-photo references** sourced from Pexels, not guaranteed-to-exist SKUs. Photos show real outfits but are style inspiration; a pictured outfit is not necessarily sold as a single product. Budget targets are illustrative, not current prices. Buy / Find Similar opens Google Shopping live-listing comparisons and, for Canadian profiles, Amazon Canada search. Verify the exact item, current price, size, inventory, shipping and return terms with the seller.

For a production shopping service, integrate authorized retailer/affiliate product feeds or catalogue APIs, plus per-SKU product images and variant data. The current code does not scrape retailer pages or claim that an image reference is an available SKU. Pexels photos are used as references under the Pexels license; Pexels permits use on websites and apps but restricts bulk redistribution and making a competing photo library. Keep the set curated and do not turn it into a photo-rehosting service.

## Skin analysis and privacy

- The skin-analysis selfie is used only by the facial colour-tone workflow and is never reused as the try-on target photo. The try-on photo is stored separately. Each image stays in IndexedDB in this browser for reuse until replaced or cleared by the user.
- The frontend requires the user to select a selfie and check consent before the request is made.
- The backend requires `consent=true`, accepts JPG/JPEG/PNG, enforces a 9.5 MB limit, uploads via YouCam's File API and creates a `skin-tone-analysis` task.
- The browser displays and stores the selected selfie in a separate IndexedDB image store so the user can reuse it without reselecting it. It is sent to YouCam only after explicit consent and starting analysis. Detected colour values are stored separately in the local profile.
- Provider retention and processing are governed by YouCam's terms. Add a formal privacy policy, deletion/help contact and production authentication before publicly opening this prototype.
- The heuristic palette direction is an optional suggestion based on detected image colour values, not a definitive undertone assessment, medical conclusion or personal colour consultant diagnosis. Size values and fit notes are saved as profile context; without live retailer SKU data, the app cannot verify a specific garment’s size availability or fit.

## Run locally

Requires Python 3.12+ (the included `.python-version` is set for a compatible Vercel runtime).

```bash
cd myStyle
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env             # optional for local demo; set provider keys as needed
uvicorn index:app --reload --env-file .env
```

Open http://127.0.0.1:8000.

Demo sign-in:

- Email: `demo@mystyle.app`
- Password: `myStyle2026`

These are deliberately visible demo credentials, not production authentication. Change them before sharing the prototype.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Required on Vercel | Long, random secret used to sign the demo session cookie. |
| `DEMO_EMAIL` | Optional | Demo account email; defaults to `demo@mystyle.app`. |
| `DEMO_PASSWORD` | Optional | Demo password; defaults to `myStyle2026`. |
| `GEMINI_API_KEY` | Optional legacy helper | Not used by the standard recommendation/search request path; ranking is deterministic for responsiveness. |
| `GEMINI_MODEL` | Optional legacy helper | Defaults to `gemini-3.6-flash`; the standard UI path does not call it. |
| `YCE_API_KEY` | Optional until testing skin analysis | Enables live YouCam Facial Color Tones Analyzer. |
| `YCE_API_BASE` | Optional | Defaults to `https://yce-api-01.makeupar.com`. |
| `VERCEL` | Set by Vercel | Uses secure session cookies when set to `1`. |

Never commit `.env` or API keys. `.env.example` contains blank provider keys.

## Deploy to Vercel

1. Push the `myStyle` directory to a repository and import it into Vercel.
2. Set `SESSION_SECRET` to a high-entropy value in Project Settings → Environment Variables.
3. Set `DEMO_EMAIL` and `DEMO_PASSWORD` if using the demo account.
4. Add `YCE_API_KEY` when ready to test live skin analysis. The standard style recommendation/search path is deterministic and does not require an AI-provider key.
5. Deploy. The Vercel entry point is the root `index.py`; templates are included by `vercel.json` and static assets live in `public/assets`.

The demo login is for a prototype. Before real users, add a production identity provider, rate limiting, robust session/CSRF controls, deletion controls, privacy/consent handling and backend persistence if cross-device profile sync is required.

## API routes

- `GET /` — landing page
- `GET /signin` and `POST /signin` — demo sign-in
- `GET /signout` and `POST /signout` — sign-out flow
- `GET /app` — authenticated workspace
- `GET /api/config` — provider configuration status
- `GET /api/catalog` — curated real-photo style references, palette options, style options and occasions
- `POST /api/recommendations` — season-, budget-, climate-, palette- and preference-aware ranking
- `POST /api/color-analysis` — create YouCam skin colour analysis task after consent
- `GET /api/tasks/color/{task_id}` — poll YouCam skin analysis task
- `POST /api/try-on` — upload the user photo and selected clothing/accessory reference to YouCam after consent; supports Clothes V4 plus dedicated bag, hat, scarf and shoes tasks
- `GET /api/tasks/try-on/{task_id}?kind={provider_task_kind}` — poll the corresponding clothing or accessory task
- `GET /health` — health check

## Testing

```bash
python -m pytest -q
node --check public/assets/app.js
python -m compileall -q index.py mystyle
```

Automated tests cover authentication, gender-specific recommendations, real-photo catalogue metadata, distinct photo URLs, official retailer-search links, skin-guided accessory suggestions, wardrobe integration, virtual try-on wiring, read-only profile skin-analysis status, dark mode accents, local image reuse, first-visit quiz routing, walkthrough controls, save-without-scroll behavior, region/currency selection, budget and season filtering, query ranking, hidden-item feedback, and skin-analysis consent. Real YouCam requests and external photo loads require live provider/network access and must be smoke-tested in staging; the automated suite does not claim live provider verification. Run `python scripts/verify_photo_catalog.py` in a network-enabled environment to check the remote photo references before deployment.

## Design note

The reference pattern is a personal styling service: style profile → Ensemble recommendations → feedback → progressively better suggestions. The linked comparison article is dated 2020, so the implementation uses the durable interaction model rather than treating that article as an up-to-date inventory or pricing source.
