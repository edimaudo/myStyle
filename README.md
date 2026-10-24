# myStyle

myStyle is a responsive personal-styling web app built with **FastAPI, Jinja2, and browser-side storage**. It combines seasonal clothing inspiration, a saved style profile, facial colour-tone analysis, optional skin-health analysis for skincare discovery, virtual try-on, shopping comparisons, and a private closet catalogue.

## Product overview

### Style profile and Ensemble

The sidebar entry **Ensemble Style** opens one workspace with separate tabs for **Your Style** (recommendations) and **Your style profile** (preferences). The profile includes country, state or province, city, preferred style range, occasions, palette, fit, sizes, budget, season, and typical local climate. Choosing Canada displays Canadian provinces and territories; choosing the United States displays all 50 states. Changing countries clears the old region and city.

Recommendations are ranked locally from the saved profile and catalogue metadata. They account for style and occasion preferences, colours, fit, budget, season, climate, skin-analysis colour cues, and feedback such as **Not for me**. Search filters the catalogue for matching terms and common synonyms instead of simply promoting unrelated items. Fall and winter suggestions are screened for seasonal and weather suitability before ranking.

Accessories appear after a usable skin-analysis result has been saved. Users can change the selected palette at any time; detected colours are optional styling inspiration, not rules about what a person should wear.

### Fashion-photo catalogue

The starter catalogue contains **75 curated Pexels photo references**: 27 men's clothing looks, 27 women's clothing looks, 9 gender-neutral clothing looks, and 12 accessory references. These photos are outfit inspiration, not a verified inventory of purchasable products. Each card credits Pexels and offers **Buy / find similar**, **Virtual try-on** when supported, saving, and recommendation feedback.

If a catalogue photo fails to load, the app tries alternate image sizes. If it still fails, the card is removed instead of displaying a broken-photo tile. If no photos load, the user can refresh recommendations. Remote photo availability can change; check the references from a network-enabled environment before deployment:

```bash
python scripts/verify_photo_catalog.py
```

The script checks response status, image content type, empty results, and duplicate image hashes. It does not save or redistribute the images.

### Shop similar items

Shopping links are intentionally limited to:

- **Compare live product listings:** a country-specific Google Shopping search for the selected item and relevant profile details.
- **Amazon Canada:** an Amazon.ca search shown for Canadian profiles.

These are live search results, not exact-SKU product links. Price guides are illustrative; users must check the specific product, current price, size, availability, shipping, and return policy at the retailer. For exact product and inventory matching, integrate authorized retailer or affiliate feeds/APIs rather than inferring inventory from inspiration photos.

### Virtual try-on

Virtual try-on is available from supported catalogue references and saved closet items. It sends the user's photo and the selected reference to YouCam only after explicit consent and when the provider key is configured. Clothing uses YouCam's clothing workflow; supported accessories include bags, hats, scarves, and shoes. The selected photo can be retained locally for reuse until replaced or cleared. Provider access, task compatibility, account units, image framing, and service availability affect whether a try-on completes successfully.

### My closet and saved pieces

The **My closet** section supports photos and details for clothing, accessories, and skincare products, including product category and routine notes. Users can filter the list by clothing, accessories or skincare. Closet items, saved pieces, profile preferences, display settings, and reusable skin-analysis/try-on photos are stored in **IndexedDB in the current browser**. They are not uploaded just by choosing a file or saving a closet item, and they do not sync between browsers or devices. Clothing and supported accessory photos are only sent to YouCam when the user starts a virtual try-on with consent. Skincare product photos remain local.

The **From My closet** section in Ensemble only appears when saved clothing or accessory items actually match the current recommendations. Skincare products stay in the closet and are not treated as outfit items. Photos are kept locally until the user removes them or clears the site's browser data.

### Skin analysis and skincare discovery

The **Skin analysis** section has two separate workflows that can use the same selfie:

- **Facial colour-tone analysis** uses YouCam's Facial Color Tones Analyzer. After the user consents and starts analysis, myStyle uploads the selected selfie, polls the asynchronous task, displays detected colour values, and refreshes clothing/accessory styling suggestions. These colour cues are optional style inspiration, not rules about what suits a person.
- **Skin-health analysis** uses the separate YouCam Skin Analysis API v2.1 to request SD metrics for skin type, moisture, oiliness, redness, pores, acne, radiance, and texture. This task requires a separate explicit consent checkbox. It is not automatically run as part of colour analysis. YouCam account access, API units, feature entitlements, image compatibility, and service availability affect whether it can complete.

The **Skincare** tab in **Ensemble Style** reuses saved skin-health metrics plus the user's sensitivity preference and budget to rank broad product categories. It also recognizes compatible older or wrapped result formats and migrates them to the current profile field. If a user has completed facial colour-tone analysis but has no saved skin-health metrics, the tab still offers general skincare starting points from their profile and preferences instead of blocking the section with a new-analysis prompt. A skin-health scan can further tailor those suggestions, but is not required just to browse the section. See the [official YouCam Skin Analysis API v2.1 reference](https://docs.perfectcorp.com/reference/ai_skin_analysis/v2.1) for its asynchronous task request, supported SD/HD actions, and account-dependent feature access. Suggestions can include hydration support, gentle/fragrance-free care, lightweight or non-comedogenic cleansing/moisture products, texture/radiance products, and daily facial sunscreen. Recommendations are deterministic category-level matching, not a diagnosis, a medical treatment plan, a guarantee that an ingredient is suitable, or proof that a product works. Users should check ingredients, patch-test as appropriate, confirm products with retailers, and seek qualified advice for persistent or concerning skin symptoms.

Skincare suggestions link to product searches on [Sephora Canada](https://www.sephora.com/ca/en), [Amazon Canada](https://www.amazon.ca), or their US equivalents when the profile country is United States, plus official skincare catalogues from [Lancôme Canada](https://www.lancome.ca/en/skincare/), [Clinique Canada](https://www.clinique.ca/skincare-all), and their US sites. These links are not verified exact-SKU matches. Exact product titles, ingredients, stock, sizes, price and shipping are not imported from authorized retail product feeds in this prototype. Retail search and category pages can change.

Skin-health analysis has a client-side minimum of 480 pixels on the shorter image side; a portrait near 720 × 1,080 pixels is a useful target. Facial colour analysis requires both image sides to be at least 320 pixels. All user-photo upload fields accept **JPG, JPEG, and PNG**. Uploads sent to YouCam must be non-empty and under **9.5 MB**, with a longest side no greater than 4,096 pixels. Each analysis requires its own consent before the selfie is sent to the provider. When a different selfie is selected, any saved colour and skin-health results from the previous selfie are cleared so recommendations do not rely on stale analysis.

YouCam's processing and retention are governed by its own service terms.

## Interface and accessibility

- A shared button system defines primary, secondary, icon, file-picker, filter, and compact card actions.
- Button colours, borders, hover states, and focus indicators adapt to light and dark themes. Dark mode uses plum/charcoal surfaces with coral/apricot accents.
- Small, medium, and large text settings scale interface text and control dimensions. Theme and text-size preferences persist in the browser.
- Layouts are responsive and include keyboard-focus styling and reduced-motion support.
- The style quiz shows any existing facial colour notes and skin-health indicators, and lets users set their skin-sensitivity preference without repeating an analysis. It reuses saved results and can link back to Skin analysis when the user needs to update them. An optional guided walkthrough helps users get started.
- After successful sign-out, the session is cleared and the app redirects to the public landing page (`/`).

## Technology

- Python 3.13
- FastAPI and Uvicorn
- Jinja2 templates
- Browser JavaScript and CSS
- IndexedDB for browser-local profile, settings, photos, saved pieces, and closet items (clothing, accessories, and skincare products)
- YouCam API for facial colour-tone analysis, Skin Analysis v2.1 skin-health metrics, and virtual try-on (optional; configured with a provider key and provider entitlement)
- Curated Pexels photo references for outfit inspiration

The standard recommendation and search path uses deterministic local ranking; it does not require a generative AI API key.

## Run locally

From the repository root (the directory containing `index.py`):

```bash
python3.13 -m venv .venv
source .venv/bin/activate       # macOS/Linux
python -m pip install -r requirements.txt
uvicorn index:app --reload
```

Open <http://127.0.0.1:8000>. On Windows, activate the environment with `.venv\Scripts\Activate.ps1` in PowerShell or `.venv\Scripts\activate.bat` in Command Prompt.

The current prototype uses a demo account. The sign-in page displays the credentials and pre-fills the form. Defaults are:

- Email: `demo@mystyle.app`
- Password: `myStyle2026`

Set `DEMO_EMAIL` and `DEMO_PASSWORD` to change them. This is demo authentication, not a production identity system.

## Configuration

Environment variables can be set in the shell for local development or in the deployment platform's project settings.

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Required on Vercel | Secret used to sign the session cookie. Set a long, randomly generated value. The app refuses to start on Vercel without it. |
| `DEMO_EMAIL` | Optional | Demo account email. Defaults to `demo@mystyle.app`. |
| `DEMO_PASSWORD` | Optional | Demo account password. Defaults to `myStyle2026`. |
| `YCE_API_KEY` | Required for live YouCam features | Enables facial colour-tone analysis, Skin Analysis v2.1 skin-health analysis, and virtual try-on, subject to the account's access and remaining units. |
| `YCE_API_BASE` | Optional | YouCam API base URL; defaults to `https://yce-api-01.makeupar.com`. |
| `VERCEL` | Set by Vercel | Enables deployment-specific session cookie behavior and startup validation. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Not required | Retained helper settings; the standard recommendation/search route does not call Gemini. |

Do not commit secrets or provider keys to source control. Local development falls back to a clearly marked local-only session secret when `SESSION_SECRET` is unset; configure a proper secret for any shared environment.

## Deploy to Vercel

1. Push the repository to GitHub and import it into Vercel.
2. Set a strong `SESSION_SECRET` in the Vercel project's environment variables.
3. Set `DEMO_EMAIL` and `DEMO_PASSWORD` if the demo credentials need to change.
4. Set `YCE_API_KEY` to enable live YouCam workflows. Configure provider access and verify account permissions/units before testing.
5. Deploy and test sign-in, sign-out, assets, photo uploads, recommendations, and the provider workflows in staging.

`index.py` exposes the FastAPI app. `vercel.json` includes the Jinja2 templates in the Python function, and static assets are in `public/assets`.

**Production readiness:** demo authentication is not suitable for a public production service. Before onboarding real users, implement a production identity provider, account-level authorization, rate limiting, data deletion controls, a formal privacy policy and consent process, and persistent server-side storage only where required by the product.

## API routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | Public landing page |
| `GET`, `POST` | `/signin` | Sign-in page and demo authentication |
| `GET`, `POST` | `/signout` | Sign-out confirmation; the POST clears the session and redirects to `/` |
| `GET` | `/app` | Authenticated application |
| `GET` | `/health` | Health check |
| `GET` | `/api/config` | Provider-configuration status and supported markets |
| `GET` | `/api/catalog` | Style catalogue, palettes, styles, and occasions |
| `POST` | `/api/recommendations` | Profile-aware recommendation and search results |
| `POST` | `/api/color-analysis` | Starts a consented YouCam facial colour-tone analysis task |
| `GET` | `/api/tasks/color/{task_id}` | Checks facial colour-tone task status |
| `POST` | `/api/skincare-analysis` | Starts a separately consented YouCam Skin Analysis v2.1 task |
| `GET` | `/api/tasks/skincare/{task_id}` | Checks skin-health task status and returns sanitized metrics |
| `POST` | `/api/try-on` | Starts a consented clothing or supported accessory try-on task |
| `GET` | `/api/tasks/try-on/{task_id}` | Checks virtual try-on task status; accepts a provider task `kind` query parameter |

The authenticated API uses the session cookie and CSRF checks for state-changing requests.

## Tests and checks

Run from the repository root:

```bash
python -m pytest -q
node --check public/assets/app.js
python -m compileall -q index.py mystyle scripts
```

Automated tests cover authentication and CSRF, landing-page sign-out, recommendation and search filtering, seasonal and region-aware profile preferences, catalogue metadata, shopping links, separate skin-analysis consent, skin-health task creation and result sanitization, category-level skincare matching, retailer links, virtual try-on wiring, browser-local closet integration, photo upload types, region dropdowns, dark/light theme behaviour, text-size controls, and the shared button system.

The automated suite does not make live provider requests or guarantee that remote photo and shopping results will remain available. Use a network-enabled staging environment to test external photos and YouCam end-to-end before release.
