from __future__ import annotations

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from mystyle import main
from mystyle.catalog import ITEMS, PALETTES, STYLE_OPTIONS, OCCASIONS, WOMEN_ONLY, MEN_ONLY, UNISEX_ITEMS


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




def test_fall_recommendations_respect_weather_and_exclude_unlayered_white_shirt_looks(client):
    csrf = signed_in(client)
    profile = {
        "country": "CA", "season": "fall", "climate": "variable", "budget": "any",
        "genderPreference": "men", "styleTags": ["classic", "casual"], "occasions": ["everyday", "work"],
        "colorScheme": "earth", "fitPreference": "balanced",
    }
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "limit": 16})
    assert response.status_code == 200
    items = response.json()["recommendations"]
    ids = {item["id"] for item in items}
    assert "look-men-white-shirt-casual-pants" not in ids
    assert "look-men-white-oxford" not in ids
    assert items
    assert all(item["category"].lower() in {"outerwear", "layering", "knitwear", "jackets"} or "cold" in item.get("climates", []) for item in items)


def test_light_white_shirt_catalogue_rows_are_not_tagged_for_fall():
    items = {item["id"]: item for item in ITEMS}
    for item_id in ("look-men-white-shirt-casual-pants", "look-men-white-oxford", "look-men-striped-shirt", "look-women-white-shirt"):
        assert "fall" not in items[item_id]["seasons"]


def test_seasonal_weather_gate_is_not_applied_to_accessory_references():
    from mystyle.main import _weather_compatible
    bag = next(item for item in ITEMS if item["id"] == "accessory-men-crossbody")
    light_shirt = next(item for item in ITEMS if item["id"] == "look-men-white-shirt-casual-pants")
    assert _weather_compatible(bag, "fall", "variable") is True
    assert _weather_compatible(light_shirt, "fall", "variable") is False


def test_gender_preference_filters_clothing_recommendations(client):
    csrf = signed_in(client)
    base = {"country": "CA", "season": "fall", "climate": "variable", "budget": "any", "styleTags": [], "occasions": [], "colorScheme": "earth"}
    women = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": {**base, "genderPreference": "women"}, "limit": 16}).json()
    men = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": {**base, "genderPreference": "men"}, "limit": 16}).json()
    women_ids = {item["id"] for item in women["recommendations"]}
    men_ids = {item["id"] for item in men["recommendations"]}
    assert women_ids and men_ids
    assert "look-men-white-oxford" not in women_ids
    assert "look-women-white-shirt" not in men_ids
    assert all(item["gender_tags"] != ["women"] for item in men["recommendations"])
    assert all(item["gender_tags"] != ["men"] for item in women["recommendations"])


def test_legacy_male_gender_value_filters_womenswear_and_accessories(client):
    csrf = signed_in(client)
    profile = {
        "country": "CA", "season": "fall", "climate": "variable", "budget": "any",
        "genderPreference": "male", "colorScheme": "earth", "skinAnalysis": {"skin_color": "#b8795e"},
    }
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "limit": 16})
    assert response.status_code == 200
    payload = response.json()
    assert payload["recommendations"]
    assert all(item["id"] not in WOMEN_ONLY for item in payload["recommendations"])
    assert all("women" not in item["gender_tags"] for item in payload["recommendations"])
    assert payload["accessories"]
    assert all(item["id"] not in WOMEN_ONLY for item in payload["accessories"])
    assert all("women" not in item["gender_tags"] for item in payload["accessories"])
    assert all(item["gender_tags"] != ["women"] for item in payload["recommendations"])


def test_gender_tags_are_explicit_and_match_all_catalogue_items():
    catalogue_ids = {item["id"] for item in ITEMS}
    assert catalogue_ids == WOMEN_ONLY | MEN_ONLY | UNISEX_ITEMS
    for item in ITEMS:
        assert item["gender_tags"] in (["women"], ["men"], ["unisex"])


def test_catalogue_has_a_quality_first_real_photo_set_by_gender():
    assert len(ITEMS) >= 70
    assert len({item["image_url"] for item in ITEMS}) == len(ITEMS)
    assert len({item["name"] for item in ITEMS}) == len(ITEMS)
    counts = {}
    for gender in ("women", "men", "unisex"):
        group = [item for item in ITEMS if item["gender_tags"] == [gender]]
        counts[gender] = sum(item["item_type"] == "clothing" for item in group)
        assert counts[gender] >= (25 if gender in {"women", "men"} else 8)
    assert counts["women"] == 27 and counts["men"] == 27 and counts["unisex"] == 9


def test_catalogue_uses_unique_real_photo_urls_and_honest_metadata():
    from urllib.parse import urlparse

    urls = [item["image_url"] for item in ITEMS]
    names = [item["name"] for item in ITEMS]
    assert len(urls) == len(set(urls)) == len(ITEMS)
    assert len(names) == len(set(names)) == len(ITEMS)
    for item in ITEMS:
        parsed = urlparse(item["image_url"])
        assert parsed.scheme == "https"
        assert parsed.hostname == "images.pexels.com"
        assert item["image_kind"] == "photo"
        assert item["photographer_source"] == "Pexels"
        assert item["image_source_url"].startswith("https://www.pexels.com/search/")
        assert item["image_url"] in item["description"] or "Real outfit photography" in item["description"]
        assert item["try_on_supported"] is True
        if item["item_type"] == "accessory":
            assert item["try_on_kind"] in {"bag", "hat", "scarf", "shoes"}
    white_shirt = next(item for item in ITEMS if item["id"] == "look-men-white-oxford")
    colour_block = next(item for item in ITEMS if item["id"] == "look-men-plaid-layer")
    assert white_shirt["colors"] == ["white", "brown"]
    assert colour_block["colors"] == ["burgundy", "green", "black"]
    assert white_shirt["image_url"] != colour_block["image_url"]


def test_catalogue_photography_and_shopping_controls_are_present(client):
    csrf = signed_in(client)
    response = client.get("/api/catalog", headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == len(ITEMS) == 75
    assert all(item["image_kind"] == "photo" for item in items)
    assert all(item["image_url"].startswith("https://images.pexels.com/photos/") for item in items)
    html = client.get("/app").text
    script = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert 'id="buy-dialog"' in html
    assert 'data-buy-item' in script
    assert "https://www.google.com/search?tbm=shop&gl=${shoppingCountry}&hl=en&q=" in script
    assert "https://www.amazon.ca/s?k=${q}" in script
    assert "https://www.target.com/s?searchTerm=" not in script
    assert "https://www.uniqlo.com" not in script
    assert "https://www.simons.ca" not in script
    assert "Photo via Pexels" in script


def test_accessories_require_skin_analysis_and_use_detected_colour_cues(client):
    csrf = signed_in(client)
    base = {"country": "CA", "season": "fall", "climate": "variable", "budget": "any", "genderPreference": "all", "colorScheme": "earth"}
    before = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": base, "limit": 16}).json()
    assert before["accessories"] == []
    assert all(item["item_type"] == "clothing" for item in before["recommendations"])
    after = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": {**base, "skinAnalysis": {"skin_color": "#b8795e"}}, "limit": 16}).json()
    assert after["skin_palette_guide"]["family"] == "warm"
    assert after["accessories"]
    assert all(item["item_type"] == "accessory" for item in after["accessories"])
    assert any("skin analysis" in item["recommendation_reason"].lower() for item in after["accessories"])


def test_catalog_has_try_on_metadata_for_accessories_and_gender_tags():
    ids = {item["id"]: item for item in ITEMS}
    assert ids["accessory-men-crossbody"]["item_type"] == "accessory"
    assert ids["accessory-men-layered-scarf"]["try_on_kind"] == "scarf"
    assert ids["accessory-women-sunhat"]["try_on_kind"] == "hat"
    assert ids["accessory-women-boots"]["try_on_kind"] == "shoes"
    assert ids["look-women-city-tie"]["gender_tags"] == ["women"]
    assert ids["look-men-white-oxford"]["gender_tags"] == ["men"]
    assert ids["look-unisex-black-minimal"]["gender_tags"] == ["unisex"]
    assert ids["look-men-white-oxford"]["try_on_supported"] is True


def test_profile_quiz_walkthrough_tabs_and_persistent_photos_are_wired(client):
    signed_in(client)
    html = client.get("/app").text
    source = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text()
    assert 'id="profile-gender-preference"' in html
    assert 'id="quiz-gender-preference"' in html
    assert 'data-ensemble-tab="clothing"' in html and 'data-ensemble-tab="accessories"' in html
    assert 'id="open-mystyle-walkthrough"' in html
    assert 'id="walkthrough-previous"' in html and 'id="walkthrough-next"' in html and 'id="walkthrough-skip"' in html
    assert 'id="skin-photo-memory"' in html and 'id="try-on-photo-memory"' in html
    assert "await loadCachedPhotos();" in source
    assert "state.cachedImages.skinAnalysis" in source and "state.cachedImages.tryOn" in source
    assert "switchView(state.profile.hasCompletedQuiz ? 'discover' : 'quiz')" in source
    assert "renderRecommendations(state.recommendations); renderSaved();" not in source
    assert "el.focus?.({ preventScroll: true });" in source



def test_my_wardrobe_adds_user_clothes_and_accessories_in_local_indexeddb():
    # The wardrobe is browser-local and photo-backed; no API endpoint persists it server-side.
    root = Path(__file__).resolve().parents[1]
    html = (root / "mystyle" / "templates" / "app.html").read_text(encoding="utf-8")
    source = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert 'id="view-wardrobe"' in html
    assert 'id="wardrobe-form"' in html
    assert 'id="wardrobe-photo"' in html
    assert 'value="clothing"' in html and 'value="accessory"' in html
    assert "createObjectStore('wardrobe'" in source
    assert "await dbRequest('wardrobe', 'put', item)" in source
    assert "form.append('item_image', wardrobeReference.imageBlob" in source
    assert "Photos and item details are stored in this browser only" in html


def test_legacy_gender_values_are_normalized_before_profile_submission():
    source = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert "function normalizeGenderPreference(value)" in source
    assert "['men', 'male', 'man', 'mens'" in source
    assert "const normalizedGender = normalizeGenderPreference(state.profile.genderPreference);" in source
    assert "normalizeGenderPreference($('#profile-gender-preference')?.value" in source
    assert "normalizeGenderPreference($('#quiz-gender-preference')?.value" in source

def test_accessory_try_on_requires_supported_kind_and_gender_before_provider_call(client):
    csrf = signed_in(client)
    from mystyle.main import try_on
    response = client.post(
        "/api/try-on",
        headers={"X-CSRF-Token": csrf},
        data={"item_image_url": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa", "consent": "true", "item_type": "accessory", "accessory_kind": "bag", "gender": ""},
        files={"photo": ("person.jpg", b"image bytes", "image/jpeg")},
    )
    assert response.status_code == 400
    assert "gender option" in response.json()["detail"]
    assert callable(try_on)


def test_ensemble_exposes_real_photo_buy_and_virtual_try_on_actions(client):
    signed_in(client)
    html = client.get("/app").text
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert 'id="buy-dialog"' in html
    assert 'id="buy-retailer-links"' in html
    assert 'id="ensemble-wardrobe-matches"' in html
    assert "data-try-on=\"${escapeHTML(item.id)}\"" in script
    assert "item.try_on_supported && item.image_kind === 'photo' && tryOnTypeSupported" in script
    assert "Try on from My wardrobe" not in script
    assert "form.append('item_image_url', dialog.dataset.itemImage)" in script
    assert "function openBuyDialog(itemId)" in script
    assert "function retailerChoices(item)" in script
    assert "https://www.google.com/search?tbm=shop&gl=${shoppingCountry}&hl=en&q=" in script
    assert "https://www.amazon.ca/s?k=${q}" in script
    assert "https://www.target.com/s?searchTerm=" not in script
    assert "https://www.uniqlo.com" not in script
    assert "https://www.simons.ca" not in script
    assert "function productSearchQuery(item)" in script
    assert "function productFocus(item)" in script
    assert "https://www.simons.ca/en/search?query=" not in script
    assert "function renderEnsembleWardrobeMatches()" in script



def test_style_profile_uses_country_specific_region_dropdown_before_city(client):
    signed_in(client)
    html = client.get("/app").text
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")

    assert '<select id="profile-region" name="region" required>' in html
    assert '<input id="profile-region"' not in html
    assert html.index('id="profile-region"') < html.index('id="profile-city"')
    assert "function renderRegionOptions(preferredRegion = state.profile.region || '')" in script
    assert "state.profile.region = '';" in script
    assert "renderRegionOptions('');" in script

    us_block = re.search(r"US: \[([\s\S]*?)\n    \]", script).group(1)
    ca_block = re.search(r"CA: \[([\s\S]*?)\n    \],\n    US:", script).group(1)
    us_states = re.findall(r"\['[A-Z]{2}', '([^']+)'\]", us_block)
    ca_regions = re.findall(r"\['[A-Z]{2}', '([^']+)'\]", ca_block)
    assert len(us_states) == 50
    assert "California" in us_states and "Wyoming" in us_states and "New York" in us_states
    assert len(ca_regions) == 13
    assert "Ontario" in ca_regions and "Quebec" in ca_regions and "Yukon" in ca_regions


def test_ensemble_and_style_profile_share_a_tabbed_workspace_without_blending_features(client):
    signed_in(client)
    html = client.get("/app").text
    script = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert 'data-linked-tab="ensemble"' in html and 'data-linked-tab="profile"' in html
    assert 'data-linked-panel="ensemble"' in html and 'data-linked-panel="profile"' in html
    assert 'data-view-panel="profile"' not in html
    assert 'data-view="profile"' not in html
    assert "catalogue-photo-note" not in html
    assert "Ensemble uses real fashion photographs for style inspiration." not in html
    assert "function switchStyleWorkspaceTab(tab)" in script
    assert "if (state.activeStyleWorkspaceTab === 'profile') renderProfileChoices();" in script


def test_catalogue_recommendations_offer_try_on_without_wardrobe_fallback():
    assert all(item["try_on_supported"] for item in ITEMS)
    for item in ITEMS:
        if item["item_type"] == "accessory":
            assert item["try_on_kind"] in {"bag", "hat", "scarf", "shoes"}
    script = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    card_function = re.search(r"function renderStyleCard\(item, savedView = false\) \{([\s\S]*?)\n  \}", script).group(1)
    assert "data-try-on=\"${escapeHTML(item.id)}\"" in card_function
    assert "Try on from My wardrobe" not in card_function
    assert "if (!state.wardrobeItems.length || !recommendations.length)" in script


def test_profile_skin_summary_is_read_only_and_updates_after_new_analysis(client):
    signed_in(client)
    html = client.get("/app").text
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    style = (root / "public" / "assets" / "marketing-controls.css").read_text(encoding="utf-8")
    assert 'id="profile-skin-summary"' in html
    assert 'aria-disabled="true"' in html
    assert 'id="profile-skin-swatches"' in html
    assert "function renderProfileSkinSummary" in script
    assert "state.profile.skinAnalysisUpdatedAt = new Date().toISOString()" in script
    assert "renderProfileSkinSummary(colors)" in script
    assert '.profile-skin-summary[data-available="false"] { filter: grayscale(1); opacity: .48; }' in style


def test_dark_mode_has_complementary_plum_and_coral_palette():
    root = Path(__file__).resolve().parents[1]
    styles = (root / "public" / "assets" / "marketing-controls.css").read_text(encoding="utf-8")
    assert "--page: #17141c;" in styles
    assert "--surface: #211b28;" in styles
    assert "--blue: #ffad8b;" in styles
    assert 'html[data-theme="dark"] .button-primary' in styles


def test_catalogue_has_no_generated_svg_artwork_left():
    root = Path(__file__).resolve().parents[1]
    assert not (root / "scripts" / "generate_catalog_art.py").exists()
    assert not (root / "public" / "assets" / "catalog").exists()


def test_health_uses_mystyle_brand(client):
    response = client.get("/health")
    assert response.json() == {"status": "ok", "app": "myStyle"}


def test_landing_page_has_new_brand_and_style_flow(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "myStyle" in response.text
    assert "Get dressed like" in response.text
    assert "myStyle brings together" in response.text
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
    assert 'data-linked-tab="profile"' in response.text
    assert 'id="linked-panel-profile"' in response.text
    assert "WornOnTV" not in response.text
    assert csrf in response.text


def test_signout_clears_session_and_redirects_to_landing_page(client):
    app_csrf = signed_in(client)
    response = client.get("/signout")
    assert response.status_code == 200
    csrf = re.search(r'name="csrf" value="([^"]+)"', response.text).group(1)
    response = client.post("/signout", data={"csrf": csrf}, follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "/"
    landing = client.get("/")
    assert landing.status_code == 200
    assert "Build my style profile" in landing.text
    protected = client.get("/app", follow_redirects=False)
    assert protected.status_code == 303
    assert protected.headers["location"].startswith("/signin")


def test_signout_rejects_invalid_csrf_without_clearing_session(client):
    signed_in(client)
    response = client.post("/signout", data={"csrf": "invalid-token"}, follow_redirects=False)
    assert response.status_code == 403
    assert client.get("/app", follow_redirects=False).status_code == 200


def test_skin_analysis_sits_immediately_below_ensemble_in_sidebar(client):
    signed_in(client)
    response = client.get("/app")
    nav = re.search(r'<nav class="side-nav".*?</nav>', response.text, re.DOTALL).group(0)
    nav_views = re.findall(r'data-view="([^"]+)"', nav)
    assert nav_views[:2] == ["discover", "skin-analysis"]


def test_redundant_skin_colour_banner_is_removed_from_ensemble(client):
    signed_in(client)
    page = client.get("/app").text
    script = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert 'id="skin-insight-banner"' not in page
    assert "Your Style incorporates colour cues from your skin analysis alongside your selected palette" not in script
    assert "Warm-leaning colour ideas" not in script


def test_skin_analysis_automatically_sets_the_guided_palette():
    app_js = Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js"
    source = app_js.read_text(encoding="utf-8")
    assert "function applySkinAnalysisToProfile(colors)" in source
    assert "state.profile.skinAnalysis = colors;" in source
    assert "state.profile.colorScheme = 'selfie';" in source
    assert "applySkinAnalysisToProfile(colors);" in source
    assert "const hasSkinColour = typeof colors.skin_color === 'string'" in source


def test_catalogue_contains_style_concepts_and_not_shows(client):
    csrf = signed_in(client)
    response = client.get("/api/catalog", headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 75
    assert data["palettes"] == PALETTES
    assert data["styles"] == STYLE_OPTIONS
    assert data["occasions"] == OCCASIONS
    assert "shows" not in data
    assert {"look-men-white-oxford", "look-women-white-shirt", "look-unisex-black-minimal"}.issubset({x["id"] for x in data["items"]})


def test_catalogue_has_season_and_region_aware_fields():
    assert all(item["seasons"] for item in ITEMS)
    assert all(item["climates"] for item in ITEMS)
    assert all(item["target_usd"] > 0 and item["target_cad"] > 0 for item in ITEMS)
    assert all(item["image_url"].startswith("https://images.pexels.com/photos/") for item in ITEMS)
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
    assert any(x["id"] == "look-men-white-winter-jacket" for x in data["recommendations"])
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
    profile = {"country": "CA", "season": "fall", "climate": "variable", "budget": "any", "styleTags": ["casual"], "occasions": ["everyday"], "colorScheme": "earth", "notForMeItemIds": ["look-men-plaid-layer"]}
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "limit": 16})
    assert response.status_code == 200
    assert "look-men-plaid-layer" not in {item["id"] for item in response.json()["recommendations"]}


def test_recommendations_use_search_query_to_rank_existing_items(client):
    csrf = signed_in(client)
    profile = {"country": "CA", "season": "spring", "climate": "mild", "budget": "any", "styleTags": [], "occasions": [], "colorScheme": "earth"}
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "query": "white shirt casual trousers", "limit": 4})
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["recommendations"]]
    assert ids[0] == "look-men-white-shirt-casual-pants"


def test_recommendations_standard_path_does_not_wait_for_gemini(client, monkeypatch):
    csrf = signed_in(client)
    monkeypatch.setattr(main, "GEMINI_API_KEY", "configured-test-key")

    async def fail_if_called(*args, **kwargs):
        raise AssertionError("The standard recommendation path must not wait for Gemini")

    monkeypatch.setattr(main, "gemini_rank_items", fail_if_called)
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": {"country": "CA", "season": "auto", "budget": "any"}, "limit": 8})
    assert response.status_code == 200
    assert response.json()["source"] == "profile-ranker"
    assert response.json()["ai_status"] == "deterministic_fast_path"
    assert response.json()["recommendations"]


def test_recommendations_search_filters_out_unmatched_catalogue_items(client):
    csrf = signed_in(client)
    profile = {"country": "CA", "season": "spring", "climate": "mild", "budget": "any", "styleTags": [], "occasions": [], "colorScheme": "earth"}
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "query": "dragon egg impossible", "limit": 8})
    assert response.status_code == 200
    assert response.json()["recommendations"] == []
    assert response.json()["count"] == 0


def test_recommendations_search_supports_common_product_synonyms(client):
    csrf = signed_in(client)
    profile = {"country": "CA", "season": "spring", "climate": "mild", "budget": "any", "genderPreference": "men", "styleTags": [], "occasions": [], "colorScheme": "earth"}
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "query": "casual white shirt trousers", "limit": 8})
    assert response.status_code == 200
    items = response.json()["recommendations"]
    assert items
    assert items[0]["id"] == "look-men-white-shirt-casual-pants"
    assert all(item["id"] == "look-men-white-shirt-casual-pants" or any(term in (item["name"] + " " + item["description"]).lower() for term in ("white", "shirt", "trouser", "pant", "casual")) for item in items)


def test_recommendations_return_disclaimer_about_editorial_images_and_prices(client):
    csrf = signed_in(client)
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": {"budget": "any", "country": "CA", "season": "auto"}})
    assert response.status_code == 200
    note = response.json()["catalogue_note"]
    assert "real fashion photographs" in note
    assert "current price" in note


def test_skin_colour_guide_uses_detected_color_as_optional_inspiration():
    warm = main.palette_guide({"skin_color": "#b8795e", "eye_color": "#293f9b"})
    cool = main.palette_guide({"skin_color": "#9e9cc1"})
    assert warm and warm["family"] == "warm"
    assert cool and cool["family"] == "cool"
    assert "not a definitive" in warm["note"]


def test_skin_guided_palette_changes_ranking_when_analysis_is_applied():
    base = {
        "country": "CA", "season": "fall", "climate": "variable", "budget": "any",
        "styleTags": [], "occasions": [], "fitPreference": "balanced",
        "skinAnalysis": {"skin_color": "#9e9cc1"},
    }
    manual_palette = {**base, "colorScheme": "earth"}
    skin_guided_palette = {**base, "colorScheme": "selfie"}
    manual_scores = {item["id"]: item["match_score"] for item in main.rank_items(manual_palette, ITEMS, limit=len(ITEMS))}
    guided_items = main.rank_items(skin_guided_palette, ITEMS, limit=len(ITEMS))
    guided_scores = {item["id"]: item["match_score"] for item in guided_items}
    assert guided_scores["look-men-navy-jacket"] > manual_scores["look-men-navy-jacket"]
    assert guided_scores["look-men-shirt-scarf"] < manual_scores["look-men-shirt-scarf"]
    assert any("skin analysis" in item["recommendation_reason"].lower() for item in guided_items)


def test_recommendations_include_skin_palette_guide(client):
    csrf = signed_in(client)
    profile = {"country": "CA", "season": "fall", "climate": "variable", "budget": "any", "colorScheme": "selfie", "skinAnalysis": {"skin_color": "#b8795e"}}
    response = client.post("/api/recommendations", headers={"X-CSRF-Token": csrf}, json={"profile": profile, "limit": 5})
    assert response.status_code == 200
    data = response.json()
    assert data["skin_palette_guide"]["family"] == "warm"
    assert data["recommendations"]
    assert any("skin analysis" in item["recommendation_reason"].lower() for item in data["recommendations"])


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


def test_app_ui_uses_one_selfie_and_one_consent_for_combined_skin_analyses(client):
    signed_in(client)
    response = client.get("/app")
    html = response.text
    assert "Facial colour tones" in html
    assert "Facial &amp; skin health" in html
    assert "One selfie powers both analyses." not in html
    assert "Choose a clear, front-facing selfie. One consent starts both analyses." not in html
    assert "It stays in this browser unless you replace it." not in html
    assert "These preferences also guide skincare suggestions in Ensemble Style." not in html
    assert "more than 60% of the image width" in html
    assert 'id="skin-analysis-run-status" class="skin-analysis-run-status" role="alert"' in html
    assert "try-on-dialog" in html
    assert "Skin analysis" in html
    assert html.count('id="skin-photo"') == 1
    assert html.count('id="skin-analysis-consent"') == 1
    assert html.count('id="run-combined-skin-analysis"') == 1
    assert 'id="skin-consent"' not in html
    assert 'id="skincare-consent"' not in html
    assert 'id="run-skin-analysis"' not in html
    assert 'id="run-skincare-analysis"' not in html
    assert 'class="skin-analysis-results-grid"' in html
    script = (__import__("pathlib").Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text()
    assert "async function runCombinedSkinAnalysis()" in script
    assert "const tasks = await apiFetch('/api/skin-analysis'" in script
    assert "/api/tasks/color/" in script
    assert "/api/tasks/skincare/" in script



def test_skin_analysis_success_message_clears_when_leaving_section():
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    switch_start = script.index("  function switchView(view) {")
    switch_end = script.index("\n  async function saveProfile", switch_start)
    switch_view = script[switch_start:switch_end]
    leave_branch_start = switch_view.index("if (state.currentView === 'skin-analysis' && view !== 'skin-analysis')")
    leave_branch_end = switch_view.index("    state.currentView = view;", leave_branch_start)
    leave_branch = switch_view[leave_branch_start:leave_branch_end]
    assert "status?.classList.contains('is-success')" in leave_branch
    assert "setSkinAnalysisStatus('', 'info')" in leave_branch
    # Only the transient message clears; analysis results remain saved.
    assert "state.profile.skinAnalysis" not in leave_branch
    assert "state.profile.skinHealthAnalysis" not in leave_branch


def test_combined_skin_analysis_explains_small_face_errors_and_highlights_them():
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert "function formatSkinAnalysisError(message, dimensions = null)" in script
    assert "more than 60% of the image width" in (root / "mystyle" / "templates" / "app.html").read_text(encoding="utf-8")
    assert "YouCam requires the face to occupy more than 60% of the image width." in script
    assert "status.scrollIntoView({ behavior: 'smooth', block: 'center' })" in script
    assert "setSkinAnalysisStatus(friendly, 'error')" in script
    assert "const unsupportedImageType = /unsupported image type|unsupported file type|unsupported image format|invalid image type/i.test(flattened);" in script
    assert "myStyle now converts the selfie to a standard JPG before sending it to both analyses." in script

def test_app_ui_has_style_quiz_custom_palette_and_saved_feedback(client):
    signed_in(client)
    html = client.get("/app").text
    assert "Ensemble" in html
    assert "Have a colour scheme in mind?" not in html
    assert 'id="quiz-palette-choices"' in html
    assert 'id="quick-color-scheme"' not in html
    assert '"My own colour scheme"' in (__import__("pathlib").Path(__file__).resolve().parents[1] / "mystyle" / "catalog.py").read_text()
    script = (__import__("pathlib").Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text()
    assert "Not for me" in script or "data-not-for-me" in script
    assert "Saved pieces" in html


def test_app_ui_discloses_not_live_product_data(client):
    signed_in(client)
    html = client.get("/app").text.lower()
    assert "catalogue-disclaimer" not in html
    assert "how ensemble works" not in html
    assert "my edit" not in html
    assert "personal edit" not in html


def test_virtual_try_on_reuses_style_profile_gender_and_shows_result_near_modal_top(client):
    signed_in(client)
    root = Path(__file__).resolve().parents[1]
    html = client.get("/app").text
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    css = (root / "public" / "assets" / "style.css").read_text(encoding="utf-8")

    # There is no redundant gender selector in the try-on dialog; profile/item data resolves it.
    dialog = html.split('<dialog id="try-on-dialog"', 1)[1].split('</dialog>', 1)[0]
    assert 'id="try-on-gender"' not in dialog
    assert 'id="try-on-gender-field"' not in dialog
    assert "function resolveAccessoryTryOnGender(item)" in script
    assert "normalizeGenderPreference(state.profile.genderPreference)" in script
    assert "const accessoryGender = itemType === 'accessory' ? resolveAccessoryTryOnGender(item) : '';" in script
    assert "$('#try-on-gender')" not in script
    assert "form.append('gender', gender)" in script
    assert "then try again. Your recommendation preferences can remain unchanged" in script

    # Result area is placed before the long form so it remains prominent after generation.
    assert dialog.index('id="try-on-result"') < dialog.index('class="dialog-content"')
    assert "scrollTo({ top: 0, behavior: 'smooth' })" in script
    assert "position: sticky" in css[css.index(".try-on-dialog .dialog-header"):css.index(".try-on-reference")]
    assert "max-height: min(54dvh, 520px)" in css
    assert "#try-on-result[hidden] { display: none !important; }" in css


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


def test_requested_ux_cleanup_and_no_unexplained_walkthrough(client):
    signed_in(client)
    html = client.get("/app").text
    assert "How Ensemble works" not in html
    assert 'id="how-it-works-dialog"' not in html
    assert 'id="how-it-works-open"' not in html
    assert 'class="sidebar-season-card"' not in html
    assert 'class="brand-mark' not in html
    assert "How Ensemble works" not in html
    assert "✳" not in html and "◈" not in client.get("/").text
    assert "Photo requirements" in html
    assert "Photo size and framing" not in html
    assert "face centred" in html
    assert "4,096 pixels" in html
    assert "720 × 1,080 pixels" in html
    assert "Photo requirements" in html
    assert ".skin-analysis-run-status.is-error" in (Path(__file__).resolve().parents[1] / "public" / "assets" / "style.css").read_text(encoding="utf-8")
    assert "sidebar-walkthrough" not in html
    assert 'data-view-panel="skin-analysis"' in html
    assert 'data-view="skin-analysis"' in html
    assert 'data-view="skin-analysis">Review analysis</button>' not in html
    assert 'id="skin-insight-banner"' not in html
    assert 'data-scroll-to="skin-analysis-card"' not in html
    assert 'id="mystyle-hero"' not in html
    assert html.index('id="recommendation-grid"') < html.index('id="view-quiz"')
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



def test_ensemble_navigation_is_icon_free_and_new_search_replaces_previous_request(client):
    signed_in(client)
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    html = client.get("/app").text
    script = (root / "public" / "assets" / "app.js").read_text()
    assert "<title>myStyle — Personal styling</title>" in html
    assert 'name="description" content="myStyle helps you discover clothing recommendations matched to your style' in html
    assert '<h1 class="topbar-title">myStyle</h1>' in html
    assert '<h1>Your Style</h1>' in html
    assert '<h1>Your style profile</h1>' in html
    assert '<h1>Your style profile.</h1>' not in html
    assert 'id="edit-summary"' not in html
    assert 'id="recommendation-source"' not in html
    assert 'class="user-avatar"' not in html
    assert 'class="side-nav-link is-active" data-view="discover" type="button">Ensemble Style</button>' in html
    assert '<strong class="user-name">Welcome! James</strong>' in html
    assert 'Where and when you dress' not in html
    assert 'Season recommendations are based on the current North American season' not in html
    profile_fields = [html.index('id="profile-country"'), html.index('id="profile-region"'), html.index('id="profile-city"')]
    assert profile_fields == sorted(profile_fields)
    assert html.index('id="profile-season"') < html.index('id="profile-climate"')
    assert 'Build a profile around your colours' not in client.get('/signin').text
    signin = client.get('/signin').text
    assert 'Back to home' not in signin
    assert 'Sign in to open your styling profile and saved pieces in this browser.' not in signin
    assert 'Your selfie is sent to YouCam only after you give consent and start analysis.' not in html
    assert 'Use these as styling inspiration—not as rules about what suits you.' not in script
    assert 'These are detected facial colour values. Use them as styling inspiration.' in script
    assert 'You can edit your style profile at any time.' in html
    assert 'class="side-nav-link" data-view="skin-analysis" type="button">Skin analysis</button>' in html
    assert 'class="button button-outline skin-profile-link" data-view="discover" data-linked-tab="profile" type="button">Style profile <span aria-hidden="true">→</span></button>' in html
    assert "Colour suggestions are approximate styling inspiration, not rules." not in script
    assert "Your Style incorporates colour cues from your skin analysis alongside your selected palette" not in script
    assert "Ensemble also considers colour cues from your skin analysis" not in script
    assert "state.recommendationsLoading" in script
    assert "aria-busy" in script
    assert "getImageDimensions(photo)" in script
    assert "dimensions.width < 320" in script
    styles = (root / "public" / "assets" / "style.css").read_text()
    controls = (root / "public" / "assets" / "marketing-controls.css").read_text()
    assert ".quiz-layout { max-width: none; width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px;" in styles
    assert ".mystyle-auth-body .button-primary" not in styles
    assert "--button-primary-ink: #ffffff" in controls
    assert "--button-primary-ink: #281620" in controls
    assert "calc(44px * var(--font-scale, 1))" in controls
    assert "skin-insight-mark" not in html and "skin-empty-mark" not in script
    assert "search-symbol" not in html
    assert "state.recommendationsLoading = true" in script
    assert "state.recommendationController.abort()" in script
    assert "const controller = new AbortController()" in script
    assert "Searching the style catalogue" in script
    assert "$('#clear-style-search')" not in script.split('const triggers = [', 1)[1].split('];', 1)[0]
    assert "Loading recommendations…" not in script


def test_photo_upload_accepts_jpg_jpeg_and_png_across_every_photo_input(client):
    signed_in(client)
    html = client.get("/app").text
    expected_accept = 'accept=".jpg,.jpeg,.png,image/jpeg,image/jpg,image/png"'
    for input_id in ("skin-photo", "wardrobe-photo", "try-on-photo"):
        input_markup = html.split(f'id="{input_id}"', 1)[1].split(">", 1)[0]
        assert expected_accept in input_markup

    source = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert "function supportedPhotoMimeType(file)" in source
    assert "jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png'" in source
    assert "function normalizedPhotoBlob(file)" in source
    assert "async function encodePhotoAsJpeg(file)" in source
    assert "canvas.toBlob(result => result ? resolve(result)" in source
    assert "form.append('photo', analysisJpeg, 'mystyle-selfie.jpg')" in source
    assert "Preparing your selfie in a consistent format…" in source
    assert "Use a JPG, JPEG or PNG photo." in source


def test_combined_skin_analysis_reencodes_images_to_real_jpeg_bytes_before_upload():
    source = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert "async function encodePhotoAsJpeg(file)" in source
    assert "canvas.toBlob(result => result ? resolve(result) : reject" in source
    assert "'image/jpeg', quality" in source
    assert "form.append('photo', analysisJpeg, 'mystyle-selfie.jpg')" in source
    assert "The two YouCam analysis endpoints can handle uploaded formats differently." in source


def test_photo_mime_resolution_accepts_mime_and_extension_variants():
    from fastapi import HTTPException
    from mystyle.main import resolve_photo_content_type

    assert resolve_photo_content_type("top.jpg", "image/jpeg") == "image/jpeg"
    assert resolve_photo_content_type("top.jpeg", "image/jpg") == "image/jpeg"
    assert resolve_photo_content_type("top.png", "image/png") == "image/png"
    assert resolve_photo_content_type("top.JPEG", "application/octet-stream") == "image/jpeg"
    assert resolve_photo_content_type("top.JPG", "") == "image/jpeg"
    with pytest.raises(HTTPException) as exc_info:
        resolve_photo_content_type("top.gif", "image/gif")
    assert exc_info.value.status_code == 415
    with pytest.raises(HTTPException) as exc_info:
        resolve_photo_content_type("top.png", "image/jpeg")
    assert exc_info.value.status_code == 415


def test_broken_fashion_images_retry_then_remove_card_instead_of_photo_unavailable_tile():
    root = Path(__file__).resolve().parents[1]
    source = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    controls = (root / "public" / "assets" / "marketing-controls.css").read_text(encoding="utf-8")
    assert "Photo unavailable" not in source
    assert "function stylePhotoRetryUrls(source)" in source
    assert "candidate.searchParams.set('w', String(width))" in source
    assert "card?.remove()" in source
    assert "Fashion photos could not be loaded." in source
    assert 'id="retry-edit"' in source
    assert "style-image-fallback" not in source
    assert 'style-card-media[data-image-state="error"] .style-image-fallback' not in controls


def test_all_button_families_share_authoritative_theme_aware_tokens():
    root = Path(__file__).resolve().parents[1]
    controls = (root / "public" / "assets" / "marketing-controls.css").read_text(encoding="utf-8")
    templates = list((root / "mystyle" / "templates").glob("*.html"))
    assert "--action-primary-bg: var(--blue)" in controls
    assert "--action-secondary-bg: var(--surface)" in controls
    assert "--action-secondary-border: var(--line)" in controls
    assert ".button-primary:hover," in controls
    assert ".button-outline:hover," in controls
    assert ".style-card-actions .button," in controls
    assert ".wardrobe-card-actions .button," in controls
    assert ".wardrobe-match-actions .button" in controls
    assert "--action-control-height: max(40px, calc(44px * var(--font-scale, 1)))" in controls
    assert 'input[type="file"]::file-selector-button' in controls
    assert all("marketing-controls.css?v=20261024-combined-skin-analysis" in template.read_text(encoding="utf-8") for template in templates)


def test_button_design_uses_shared_theme_and_font_scale_tokens():
    root = Path(__file__).resolve().parents[1]
    controls = (root / "public" / "assets" / "marketing-controls.css").read_text(encoding="utf-8")
    assert "--button-radius: 6px" in controls
    assert ".button-primary:visited" in controls
    assert ".button-outline:visited" in controls
    assert "calc(40px * var(--font-scale, 1))" in controls
    assert '.font-control button[aria-pressed="true"]' in controls
    assert ".wardrobe-filter.is-active" in controls
    for selector in (".theme-toggle,", ".icon-control,", ".dialog-close,", ".wardrobe-filter,", ".save-style-button"):
        assert selector in controls


def test_skincare_analysis_requires_a_separate_explicit_consent(client, monkeypatch):
    csrf = signed_in(client)
    monkeypatch.setattr(main, "YCE_API_KEY", "test-key")
    response = client.post(
        "/api/skincare-analysis",
        headers={"X-CSRF-Token": csrf},
        data={"consent": "false"},
        files={"photo": ("selfie.jpg", b"fake-image", "image/jpeg")},
    )
    assert response.status_code == 400
    assert "skin-health analysis" in response.json()["detail"].lower()


def test_skincare_analysis_without_provider_key_does_not_upload(client, monkeypatch):
    csrf = signed_in(client)
    monkeypatch.setattr(main, "YCE_API_KEY", "")
    response = client.post(
        "/api/skincare-analysis",
        headers={"X-CSRF-Token": csrf},
        data={"consent": "true"},
        files={"photo": ("selfie.jpg", b"fake-image", "image/jpeg")},
    )
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"].lower()


def test_combined_skin_analysis_uploads_one_selfie_and_starts_both_tasks(client, monkeypatch):
    csrf = signed_in(client)
    uploads = []
    task_sources = []

    async def fake_upload(image_bytes, filename, content_type):
        uploads.append((image_bytes, filename, content_type))
        return "shared-yce-file-id"

    async def fake_color_task(file_id):
        task_sources.append(("colour", file_id))
        return {"data": {"task_id": "colour-task-123"}}

    async def fake_health_task(file_id):
        task_sources.append(("health", file_id))
        return {"data": {"task_id": "health-task-456"}}

    monkeypatch.setattr(main, "upload_image_to_yce", fake_upload)
    monkeypatch.setattr(main, "create_yce_color_task", fake_color_task)
    monkeypatch.setattr(main, "create_yce_skin_health_task", fake_health_task)
    response = client.post(
        "/api/skin-analysis",
        headers={"X-CSRF-Token": csrf},
        data={"consent": "true"},
        files={"photo": ("selfie.jpg", b"same-selfie-bytes", "image/jpeg")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["color_task_id"] == "colour-task-123"
    assert body["skin_health_task_id"] == "health-task-456"
    assert len(uploads) == 1
    assert {file_id for _, file_id in task_sources} == {"shared-yce-file-id"}
    assert {kind for kind, _ in task_sources} == {"colour", "health"}


def test_combined_skin_analysis_requires_one_explicit_consent(client, monkeypatch):
    csrf = signed_in(client)
    monkeypatch.setattr(main, "YCE_API_KEY", "test-key")
    response = client.post(
        "/api/skin-analysis",
        headers={"X-CSRF-Token": csrf},
        data={"consent": "false"},
        files={"photo": ("selfie.jpg", b"fake-image", "image/jpeg")},
    )
    assert response.status_code == 400
    assert "both facial colour-tone and skin-health analysis" in response.json()["detail"].lower()


def test_combined_skin_analysis_returns_partial_task_errors_when_one_feature_is_unavailable(client, monkeypatch):
    csrf = signed_in(client)

    async def fake_upload(image_bytes, filename, content_type):
        return "shared-yce-file-id"

    async def fake_color_task(file_id):
        return {"data": {"task_id": "colour-task-123"}}

    async def fail_health_task(file_id):
        raise main.HTTPException(status_code=502, detail="Skin Analysis v2.1 is not enabled.")

    monkeypatch.setattr(main, "upload_image_to_yce", fake_upload)
    monkeypatch.setattr(main, "create_yce_color_task", fake_color_task)
    monkeypatch.setattr(main, "create_yce_skin_health_task", fail_health_task)
    response = client.post(
        "/api/skin-analysis",
        headers={"X-CSRF-Token": csrf},
        data={"consent": "true"},
        files={"photo": ("selfie.jpg", b"fake-image", "image/jpeg")},
    )
    assert response.status_code == 200
    assert response.json()["color_task_id"] == "colour-task-123"
    assert response.json()["skin_health_task_id"] is None
    assert "not enabled" in response.json()["skin_health_error"]


def test_skincare_task_uses_v21_and_only_sd_analysis_features(monkeypatch):
    import asyncio

    monkeypatch.setattr(main, "YCE_API_KEY", "test-key")

    class Response:
        is_error = False
        status_code = 200
        def json(self):
            return {"data": {"task_id": "skin-task-123"}}

    class AsyncClient:
        def __init__(self, timeout=30):
            self.timeout = timeout
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return False
        async def post(self, url, headers, json):
            assert url.endswith("/s2s/v2.1/task/skin-analysis")
            assert headers["Authorization"] == "Bearer test-key"
            assert json["src_file_id"] == "uploaded-file-id"
            assert json["format"] == "json"
            assert json["dst_actions"] == ["skin_type", "moisture", "oiliness", "redness", "pore", "acne", "radiance", "texture"]
            assert all(not action.startswith("hd_") for action in json["dst_actions"])
            return Response()

    monkeypatch.setattr(main.httpx, "AsyncClient", AsyncClient)
    response = asyncio.run(main.create_yce_skin_health_task("uploaded-file-id"))
    assert response["data"]["task_id"] == "skin-task-123"


def test_skin_health_metric_parser_extracts_scores_without_image_urls():
    payload = {
        "status": 200,
        "data": {
            "task_status": "success",
            "results": {
                "skin_type": {"whole": {"type": "Combination"}, "t_zone": {"type": "Oily"}},
                "moisture": {"ui_score": 72, "raw_score": 59.4, "output_mask_name": "moisture.png"},
                "pore": {"nose": {"ui_score": 55}},
                "internal_image_url": "https://provider.example/private-result.png",
            },
        },
    }
    metrics = main.find_skin_health_payload(payload)
    assert metrics["skin_type"]["whole"]["type"] == "Combination"
    assert metrics["moisture"]["ui_score"] == 72
    assert metrics["pore"]["nose"]["ui_score"] == 55
    assert "internal_image_url" not in metrics
    assert "output_mask_name" not in metrics["moisture"]


def test_skincare_task_status_returns_sanitized_metrics(client, monkeypatch):
    signed_in(client)
    monkeypatch.setattr(main, "YCE_API_KEY", "test-key")

    class Response:
        is_error = False
        status_code = 200
        def json(self):
            return {
                "status": 200,
                "data": {"task_status": "success", "results": {
                    "skin_type": {"whole": {"type": "Dry"}},
                    "moisture": {"ui_score": 54, "raw_score": 42},
                }},
            }

    class AsyncClient:
        def __init__(self, timeout=25):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return False
        async def get(self, url, headers):
            assert url.endswith("/s2s/v2.1/task/skin-analysis/skin-task-123")
            assert headers["Authorization"] == "Bearer test-key"
            return Response()

    monkeypatch.setattr(main.httpx, "AsyncClient", AsyncClient)
    response = client.get("/api/tasks/skincare/skin-task-123")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["task_kind"] == "skincare"
    assert body["metrics"]["skin_type"]["whole"]["type"] == "Dry"
    assert body["metrics"]["moisture"]["ui_score"] == 54


def test_skincare_is_available_in_skin_analysis_and_ensemble_with_four_retailers(client):
    signed_in(client)
    html = client.get("/app").text
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    css = (root / "public" / "assets" / "style.css").read_text(encoding="utf-8")
    assert 'data-ensemble-tab="skincare"' in html
    assert 'data-ensemble-panel="skincare"' in html
    assert 'id="run-combined-skin-analysis"' in html
    assert 'id="skin-analysis-consent"' in html
    assert 'id="skin-health-analysis-preview"' in html
    assert 'id="skincare-recommendation-grid"' in html
    assert 'id="skincare-sensitivity"' in html
    assert 'id="skincare-budget"' in html
    assert "async function runCombinedSkinAnalysis()" in script
    assert "async function pollSkincareTask(" in script
    assert "'/api/skin-analysis'" in script
    assert "/api/tasks/skincare/" in script
    assert "'/api/skincare-analysis'" not in script
    assert "skinHealthAnalysisUpdatedAt" in script
    assert "function skincareProductSuggestions(" in script
    assert "https://www.sephora.com/ca/en/search?keyword=" in script
    assert "https://www.lancome.ca/en/skincare/" in script
    assert "https://www.clinique.ca/skincare-all" in script
    assert "https://www.amazon.ca/s?k=" in script
    assert "skin-health analysis" in html.lower()
    assert ".skincare-product-card" in css
    assert ".skincare-retailer-grid" in css


def test_skincare_uses_country_specific_retailer_paths_and_currency():
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert "https://www.sephora.com/search?keyword=${query}" in script
    assert "https://www.lancome-usa.com/skincare/" in script
    assert "https://www.clinique.com/skincare-all" in script
    assert "https://www.amazon.com/s?k=${query}" in script
    assert "state.profile.country === 'US' ? 'US$' : 'CA$'" in script
    assert "under ${currencyLabel} 25" in script


def test_replacing_selfie_clears_old_colour_and_skin_health_results():
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert "function isSamePhotoFile(previous, next)" in script
    assert "async function clearAnalysesForReplacedPhoto()" in script
    assert "state.profile.skinAnalysis = null;" in script
    assert "state.profile.skinHealthAnalysis = null;" in script
    assert "New selfie selected. Previous results were cleared. Run both analyses together to use this photo." in script
    assert "state.skinPhotoGeneration += 1;" in script
    assert "if ($('#skin-analysis-consent')) $('#skin-analysis-consent').checked = false;" in script
    assert "isCurrentSkinPhoto(photo, photoGeneration)" in script



def test_skincare_reuses_legacy_and_wrapped_skin_health_results():
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert "function normalizeSkinHealthMetrics(value, depth = 0)" in script
    assert "profile.skincareAnalysis, profile.skinHealthResults" in script
    assert "profile.skin_health_analysis, profile.skinHealth, profile.skinAnalysis" in script
    assert "const migratedHealth = getSavedSkinHealthMetricsFromProfile(state.profile);" in script
    assert "state.profile.skinHealthAnalysis = migratedHealth;" in script
    assert "normalizeSkinHealthMetrics(healthResult.metrics || healthResult)" in script


def test_skincare_tab_reuses_existing_colour_analysis_instead_of_blocking_on_new_scan():
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert "function hasSavedColourAnalysis()" in script
    assert "const hasColourResults = hasSavedColourAnalysis();" in script
    assert "if (!hasHealthResults && !hasColourResults)" in script
    assert "Using your saved profile and skincare preferences. Your existing colour analysis is retained" in script
    assert "const products = skincareProductSuggestions(metrics || {}, preferences);" in script
    assert "a skin-health scan can further tailor these suggestions." in script


def test_skincare_recommendations_are_category_level_and_keep_sunscreen_included():
    root = Path(__file__).resolve().parents[1]
    script = (root / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert "hydration is worth exploring" in script
    assert "lightweight non-comedogenic facial cleanser moisturizer" in script
    assert "broad spectrum SPF 30 facial sunscreen" in script
    assert "const tailored = products.filter(product => product.id !== 'daily-sunscreen').slice(0, 3);" in script
    assert "These cosmetic indicators are not a medical diagnosis" in script or "These results are not a medical diagnosis" in script


def test_skincare_panel_only_shows_analysis_prompt_until_results_exist(client):
    signed_in(client)
    html = client.get("/app").text
    script = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert '<h2>Start with skin-health analysis</h2>' in html
    assert 'id="skincare-status" aria-live="polite" hidden' in html
    assert 'class="skincare-disclaimer"' not in html
    assert "Suggestions are product categories, not medical advice or exact-SKU matches." not in html
    assert "status.hidden = true;" in script
    assert "empty.hidden = true;" in script
    assert "Using your saved skin-health analysis" in script
    assert "state.profile.skinHealthAnalysis" in script


def test_skin_colour_insight_banner_is_removed_without_breaking_accessory_palette_matching(client):
    signed_in(client)
    html = client.get("/app").text
    script = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert 'id="skin-insight-banner"' not in html
    assert "Your Style incorporates colour cues from your skin analysis alongside your selected palette" not in script
    assert "function skinPaletteGuide(colors)" in script
    assert "const guide = skinPaletteGuide(state.profile.skinAnalysis)" in script


def test_my_closet_supports_skincare_items_and_keeps_them_out_of_outfit_matches(client):
    signed_in(client)
    html = client.get("/app").text
    script = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert '>My closet <span class="nav-count" id="wardrobe-count">' in html
    assert '<h1>My closet</h1>' in html
    assert '<option value="skincare">Skincare product</option>' in html
    for category in ("Cleanser", "Moisturizer", "Serum", "Sunscreen", "Eye care", "Other skincare"):
        assert f'value="{category}"' in html
    assert 'data-wardrobe-filter="skincare"' in html
    assert "['clothing', 'accessory', 'skincare'].includes(rawType)" in script
    assert "if (wardrobe.item_type === 'skincare') return null;" in script
    assert "if (item.item_type === 'skincare') return '';" in script
    assert "Added to My closet." in script


def test_style_quiz_reuses_saved_skin_information_and_updates_sensitivity(client):
    signed_in(client)
    html = client.get("/app").text
    script = (Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text(encoding="utf-8")
    assert '<h2>Skin information</h2>' in html
    assert 'id="quiz-skin-info"' in html
    assert 'id="quiz-skincare-sensitivity"' in html
    assert "function renderQuizSkinInfo()" in script
    assert "const colours = state.profile.skinAnalysis || {};" in script
    assert "const health = getSavedSkinHealthMetrics() || {};" in script
    assert "sensitivity: $('#quiz-skincare-sensitivity')?.value || 'unknown'" in script
    assert "renderQuizSkinInfo();" in script


def test_my_closet_photo_picker_has_room_for_file_button_and_filename():
    controls = (Path(__file__).resolve().parents[1] / "public" / "assets" / "marketing-controls.css").read_text(encoding="utf-8")
    assert 'input[type="file"] {\n  display: block;' in controls
    assert 'height: auto !important;' in controls
    assert 'min-height: max(56px, calc(58px * var(--font-scale, 1)))' in controls
    assert 'input[type="file"]::file-selector-button,' in controls
    assert 'input[type="file"]::-webkit-file-upload-button' in controls
    assert '#wardrobe-colours-field[hidden]' in controls
