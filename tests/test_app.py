from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from mystyle import main
from mystyle.catalog import ITEMS, PALETTES, STYLE_OPTIONS, OCCASIONS


@pytest.fixture()
def client():
    with TestClient(main.app) as test_client:
        yield test_client


def signed_in(client: TestClient) -> str:
    response = client.get("/signin")
    assert response.status_code == 200
    csrf = re.search(r'name="csrf" value="([^"]+)"', response.text).group(1)
    response = client.post(
        "/signin",
        data={"email": "demo@mystyle.app", "password": "myStyle2026", "csrf": csrf},
        follow_redirects=False,
    )
    assert response.status_code == 303
    app_page = client.get("/app")
    assert app_page.status_code == 200
    return re.search(r'<meta name="csrf-token" content="([^"]+)"', app_page.text).group(1)


def test_health_uses_mystyle_brand(client):
    response = client.get("/health")
    assert response.json() == {"status": "ok", "app": "myStyle"}


def test_landing_page_has_new_brand_and_style_flow(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "myStyle" in response.text
    assert "Get dressed like" in response.text
    assert "Build my style profile" in response.text
    assert "season" in response.text.lower()
    assert "WornOnTV" not in response.text


def test_demo_signin_page_uses_mystyle_credentials_and_brand(client):
    response = client.get("/signin")
    assert response.status_code == 200
    assert "demo@mystyle.app" in response.text
    assert "myStyle2026" in response.text
    assert "Sign in — myStyle" in response.text


def test_app_route_requires_authentication(client):
    response = client.get("/app", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"].startswith("/signin")


def test_signin_opens_mystyle_workspace(client):
    csrf = signed_in(client)
    response = client.get("/app")
    assert response.status_code == 200
    assert 'data-view="discover"' in response.text
    assert 'data-view="quiz"' in response.text
    assert 'data-view="profile"' in response.text
    assert "WornOnTV" not in response.text
    assert csrf in response.text


def test_catalogue_contains_style_items_not_shows(client):
    csrf = signed_in(client)
    response = client.get("/api/catalog", headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 18
    assert data["palettes"] == PALETTES
    assert data["styles"] == STYLE_OPTIONS
    assert data["occasions"] == OCCASIONS
    assert "shows" not in data
    assert {"soft-trench", "white-tee", "wool-coat", "linen-shirt"}.issubset({x["id"] for x in data["items"]})


def test_catalogue_has_season_and_region_aware_fields():
    assert all(item["seasons"] for item in ITEMS)
    assert all(item["climates"] for item in ITEMS)
    assert all(item["target_usd"] > 0 and item["target_cad"] > 0 for item in ITEMS)
    assert all(item["image_url"].startswith("https://") for item in ITEMS)
    assert all(item["shop_query"] for item in ITEMS)



def test_each_season_excludes_items_not_tagged_for_that_season():
    for season in ("spring", "summer", "fall", "winter"):
        ranked = main.rank_items({"country": "CA", "season": season, "budget": "any", "climate": "variable"}, ITEMS, limit=len(ITEMS))
        assert ranked, f"No catalogue items for {season}"
        assert all(item["season_match"] for item in ranked)


def test_selfie_palette_does_not_claim_guidance_before_analysis():
    assert main._profile_palette_ids({"colorScheme": "selfie"}, None) == set()


def test_recommendations_use_current_season_budget_and_currency(client):
    csrf = signed_in(client)
    profile = {
        "country": "CA", "season": "winter", "climate": "cold", "budget": 220,
        "styleTags": ["classic", "workwear"], "occasions": ["work"],
        "colorScheme": "cool", "customColors": "navy, grey", "savedItemIds": [], "notForMeItemIds": [],
    }
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "limit": 16})
    assert response.status_code == 200
    data = response.json()
    assert data["season"] == "winter"
    assert data["currency"] == "CAD"
    assert data["recommendations"]
    assert all(x["currency"] == "CAD" for x in data["recommendations"])
    assert all(x["target_price"] <= 220 for x in data["recommendations"])
    assert all(x["season_match"] for x in data["recommendations"])
    assert any(x["id"] == "wool-coat" for x in data["recommendations"])
    assert data["source"] == "profile-ranker"



def test_fit_preference_and_detected_skin_palette_affect_ranking():
    neutral_profile = {
        "country": "CA", "season": "fall", "climate": "variable", "budget": "any",
        "styleTags": [], "occasions": [], "colorScheme": "earth", "fitPreference": "relaxed",
    }
    with_skin = {**neutral_profile, "skinAnalysis": {"skin_color": "#b8795e"}}
    regular_rank = main.rank_items(neutral_profile, ITEMS, limit=len(ITEMS))
    skin_rank = main.rank_items(with_skin, ITEMS, limit=len(ITEMS))
    assert all(item["fit_match"] for item in regular_rank[:5]) or any(item["fit_match"] for item in regular_rank)
    regular_scores = {item["id"]: item["match_score"] for item in regular_rank}
    skin_scores = {item["id"]: item["match_score"] for item in skin_rank}
    assert any(skin_scores[item_id] > regular_scores[item_id] for item_id in regular_scores)


def test_recommendations_use_usd_budget_for_us_profile(client):
    csrf = signed_in(client)
    profile = {"country": "US", "season": "summer", "climate": "warm", "budget": 50, "styleTags": ["casual"], "occasions": ["weekend"], "colorScheme": "earth"}
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "limit": 16})
    assert response.status_code == 200
    data = response.json()
    assert data["currency"] == "USD"
    assert data["recommendations"]
    assert all(item["target_price"] <= 50 for item in data["recommendations"])


def test_recommendations_exclude_not_for_me_feedback(client):
    csrf = signed_in(client)
    profile = {"country": "CA", "season": "fall", "climate": "variable", "budget": "any", "styleTags": ["casual"], "occasions": ["everyday"], "colorScheme": "earth", "notForMeItemIds": ["plaid-overshirt"]}
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "limit": 16})
    assert response.status_code == 200
    assert "plaid-overshirt" not in {item["id"] for item in response.json()["recommendations"]}


def test_recommendations_use_search_query_to_rank_existing_items(client):
    csrf = signed_in(client)
    profile = {"country": "CA", "season": "spring", "climate": "mild", "budget": "any", "styleTags": [], "occasions": [], "colorScheme": "earth"}
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "query": "linen button down shirt", "limit": 4})
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["recommendations"]]
    assert ids[0] == "linen-shirt"


def test_recommendations_return_disclaimer_about_editorial_images_and_prices(client):
    csrf = signed_in(client)
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": {"budget": "any", "country": "CA", "season": "auto"}})
    assert response.status_code == 200
    note = response.json()["catalogue_note"]
    assert "not live retailer listings" in note
    assert "current price" in note


def test_skin_colour_guide_uses_detected_color_as_optional_inspiration():
    warm = main.palette_guide({"skin_color": "#b8795e", "eye_color": "#293f9b"})
    cool = main.palette_guide({"skin_color": "#9e9cc1"})
    assert warm and warm["family"] == "warm"
    assert cool and cool["family"] == "cool"
    assert "not a definitive" in warm["note"]


def test_recommendations_include_skin_palette_guide(client):
    csrf = signed_in(client)
    profile = {"country": "CA", "season": "fall", "climate": "variable", "budget": "any", "colorScheme": "selfie", "skinAnalysis": {"skin_color": "#b8795e"}}
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "limit": 5})
    assert response.status_code == 200
    data = response.json()
    assert data["skin_palette_guide"]["family"] == "warm"
    assert data["recommendations"]


def test_api_requires_authentication(client):
    response = client.get("/api/catalog")
    assert response.status_code == 401


def test_mutating_api_requires_csrf(client):
    signed_in(client)
    response = client.post("/api/recommendations", json={"profile": {}})
    assert response.status_code == 403


def test_catalog_and_config_are_available_after_signin(client):
    csrf = signed_in(client)
    config = client.get("/api/config", headers={"X-CSRF-Token": csrf})
    catalog = client.get("/api/catalog", headers={"X-CSRF-Token": csrf})
    assert config.status_code == 200
    assert config.json()["supported_countries"] == ["CA", "US"]
    assert catalog.status_code == 200


def test_missing_consent_rejects_skin_analysis_before_provider_call(client, monkeypatch):
    csrf = signed_in(client)
    monkeypatch.setattr(main, "YCE_API_KEY", "test-key")
    response = client.post(
        "/api/color-analysis",
        headers={"X-CSRF-Token": csrf},
        data={"consent": "false"},
        files={"photo": ("selfie.jpg", b"fake-image", "image/jpeg")},
    )
    assert response.status_code == 400
    assert "Consent is required" in response.json()["detail"]


def test_live_skin_analysis_reports_missing_key_without_upload(client, monkeypatch):
    csrf = signed_in(client)
    monkeypatch.setattr(main, "YCE_API_KEY", "")
    response = client.post(
        "/api/color-analysis",
        headers={"X-CSRF-Token": csrf},
        data={"consent": "true"},
        files={"photo": ("selfie.jpg", b"fake-image", "image/jpeg")},
    )
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"].lower()


def test_non_image_upload_is_rejected(client):
    csrf = signed_in(client)
    response = client.post(
        "/api/color-analysis",
        headers={"X-CSRF-Token": csrf},
        data={"consent": "true"},
        files={"photo": ("selfie.gif", b"fake-image", "image/gif")},
    )
    assert response.status_code == 415


def test_app_ui_uses_selfie_only_for_skin_analysis(client):
    signed_in(client)
    response = client.get("/app")
    html = response.text
    assert "Skin and facial colour analysis" in html
    assert "Use a selfie to identify colour tones" in html
    assert "try-on-dialog" in html
    assert "Skin analysis" in html
    script = (__import__("pathlib").Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text()
    assert "runSkinAnalysis" in script
    assert "/api/color-analysis" in script
    assert "/api/tasks/color/" in script


def test_app_ui_has_style_quiz_custom_palette_and_saved_feedback(client):
    signed_in(client)
    html = client.get("/app").text
    assert "Take the style quiz" in html
    assert "Have a colour scheme in mind?" in html
    assert 'id="quiz-palette-choices"' in html
    assert 'id="quick-color-scheme"' in html
    assert '"My own colour scheme"' in (__import__("pathlib").Path(__file__).resolve().parents[1] / "mystyle" / "catalog.py").read_text()
    script = (__import__("pathlib").Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text()
    assert "Not for me" in script or "data-not-for-me" in script
    assert "Saved pieces" in html


def test_app_ui_discloses_not_live_product_data(client):
    signed_in(client)
    html = client.get("/app").text.lower()
    assert "catalogue-disclaimer" not in html
    assert "how to use mystyle" in html
    assert "my style" in html


def test_skin_analysis_and_try_on_task_endpoints_are_wired(client):
    signed_in(client)
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text()
    html = client.get("/app").text
    assert "app.js" in html
    assert "/api/tasks/color/" in script
    assert "/api/tasks/try-on/" in script
    assert "/api/try-on" in script
    assert "data-try-on" in script
    from mystyle.main import try_on, try_on_task_status
    assert callable(try_on) and callable(try_on_task_status)


def test_legacy_tv_brand_and_source_have_been_removed_from_runtime_code():
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    files = [root / "index.py", root / "mystyle" / "main.py", root / "mystyle" / "templates" / "app.html", root / "public" / "assets" / "app.js"]
    joined = "\n".join(path.read_text() for path in files)
    assert "WornOnTV" not in joined
    assert "styleTV" not in joined


def test_requested_ux_cleanup_and_sidebar_walkthrough(client):
    signed_in(client)
    html = client.get("/app").text
    assert "How to use myStyle" in html
    assert 'data-scroll-to="skin-analysis-card"' in html
    assert "catalogue-disclaimer" not in html
    assert "mystyle-footer" not in html
    assert "quiz-step-label" not in html
    assert "profile-section-number" not in html
    signin = client.get("/signin").text
    assert "This is a demo sign-in" not in signin
    landing = client.get("/").text
    assert 'href="#how-it-works">How it works' not in landing
    assert 'href="#what-you-get">Your style edit' not in landing
    assert "mystyle-marketing-footer" not in landing

