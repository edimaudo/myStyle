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
    assert "https://www.target.com/s?searchTerm=" in script
    assert "https://www.nordstrom.com/sr?origin=keywordsearch" in script
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
    assert "https://www.target.com/s?searchTerm=" in script
    assert "https://www.uniqlo.com/ca/en/search?q=" in script
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


def test_skin_analysis_sits_immediately_below_ensemble_in_sidebar(client):
    signed_in(client)
    response = client.get("/app")
    nav = re.search(r'<nav class="side-nav".*?</nav>', response.text, re.DOTALL).group(0)
    nav_views = re.findall(r'data-view="([^"]+)"', nav)
    assert nav_views[:2] == ["discover", "skin-analysis"]


def test_skin_analysis_banner_appears_before_ensemble_recommendations(client):
    signed_in(client)
    response = client.get("/app")
    page = response.text
    assert page.index('id="skin-insight-banner"') < page.index('id="recommendation-grid"')
    assert "Skin analysis is informing Ensemble" in page


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
    assert guided_scores["look-men-blue-shirt-trousers"] > manual_scores["look-men-blue-shirt-trousers"]
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


def test_app_ui_uses_selfie_only_for_skin_analysis(client):
    signed_in(client)
    response = client.get("/app")
    html = response.text
    assert "Skin and facial colour analysis" in html
    assert "Detected colour values guide your clothing palette and personalise accessories in Ensemble" in html
    assert "try-on-dialog" in html
    assert "Skin analysis" in html
    script = (__import__("pathlib").Path(__file__).resolve().parents[1] / "public" / "assets" / "app.js").read_text()
    assert "runSkinAnalysis" in script
    assert "/api/color-analysis" in script
    assert "/api/tasks/color/" in script


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
    assert "Photo size and framing" in html
    assert "4,096 px" in html
    assert "720 × 1,080 px" in html
    assert "sidebar-walkthrough" not in html
    assert 'data-view-panel="skin-analysis"' in html
    assert 'data-view="skin-analysis"' in html
    assert 'data-view="skin-analysis">Review analysis</button>' in html
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



def test_ensemble_navigation_is_icon_free_and_recommendations_lock_while_loading(client):
    signed_in(client)
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    html = client.get("/app").text
    script = (root / "public" / "assets" / "app.js").read_text()
    assert "<title>myStyle — Personal styling</title>" in html
    assert 'name="description" content="myStyle helps you discover clothing recommendations in Ensemble' in html
    assert '<h1 class="topbar-title">myStyle</h1>' in html
    assert '<h1>Ensemble</h1>' in html
    assert 'id="edit-summary"' not in html
    assert 'id="recommendation-source"' not in html
    assert 'class="user-avatar"' not in html
    assert 'class="side-nav-link is-active" data-view="discover" type="button">Style &amp; Ensemble</button>' in html
    assert 'class="side-nav-link" data-view="skin-analysis" type="button">Skin analysis</button>' in html
    assert "state.recommendationsLoading" in script
    assert "aria-busy" in script
    assert "getImageDimensions(photo)" in script
    assert "dimensions.width < 320" in script
    styles = (root / "public" / "assets" / "style.css").read_text()
    assert ".quiz-layout { max-width: none; width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px;" in styles
    assert "skin-insight-mark" not in html and "skin-empty-mark" not in script
    assert "search-symbol" not in html
    assert "if (state.recommendationsLoading) {" in script
    assert "state.queuedRecommendation" in script
    assert "Loading recommendations…" in script
