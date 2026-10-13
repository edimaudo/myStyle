# styleTV — TV-inspired personal fashion discovery

A web app for exploring TV-inspired fashion, maintaining an editable style profile, discovering new shows, saving looks, exploring colour ideas


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


## YouCam workflows
- Clothing virtual try-on
-  Facial colour-tone analysis



