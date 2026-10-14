import asyncio
import re

import pytest
from fastapi.testclient import TestClient

from styletv import main


client = TestClient(main.app)


@pytest.fixture
def stub_catalogue():
    """The curated daytime catalogue is local and needs no network stub."""
    return None


def sign_in(client_instance=client):
    page = client_instance.get('/signin')
    assert page.status_code == 200
    match = re.search(r'name="csrf" value="([^"]+)"', page.text)
    assert match, 'CSRF hidden field not rendered'
    csrf = match.group(1)
    response = client_instance.post(
        '/signin',
        data={'email': 'demo@styletv.app', 'password': 'styleTV2026', 'csrf': csrf},
        follow_redirects=False,
    )
    assert response.status_code == 303
    return client_instance


def test_landing_page_renders():
    response = client.get('/')
    assert response.status_code == 200
    assert 'The looks you love.' in response.text
    assert 'styleTV' in response.text


def test_app_redirects_to_signin_for_anonymous_user():
    anon = TestClient(main.app)
    response = anon.get('/app', follow_redirects=False)
    assert response.status_code == 303
    assert response.headers['location'].startswith('/signin')


def test_demo_signin_catalog_and_signout_flow(stub_catalogue):
    authed = sign_in(TestClient(main.app))
    page = authed.get('/app')
    assert page.status_code == 200
    assert 'My style profile' in page.text

    config = authed.get('/api/config')
    assert config.status_code == 200
    assert config.json()['storage'] == 'IndexedDB (this browser)'

    catalog = authed.get('/api/catalog')
    assert catalog.status_code == 200
    payload = catalog.json()
    assert len(payload['shows']) >= 5
    assert len(payload['products']) >= 5
    assert all(item.get('shop_url') for item in payload['products'])
    assert all(item.get('try_on_reference_url') for item in payload['products'])

    signin_page = authed.get('/signout')
    assert signin_page.status_code == 200
    match = re.search(r'name="csrf" value="([^"]+)"', signin_page.text)
    assert match
    out = authed.post('/signout', data={'csrf': match.group(1)}, follow_redirects=False)
    assert out.status_code == 303
    assert '/signout?done=1' in out.headers['location']
    forbidden = authed.get('/api/catalog')
    assert forbidden.status_code == 401


def test_recommendations_are_grounded_in_catalogue(stub_catalogue, monkeypatch):
    authed = sign_in(TestClient(main.app))
    csrf = authed.get('/app').text
    token = re.search(r'<meta name="csrf-token" content="([^"]+)"', csrf).group(1)
    monkeypatch.setattr(main, 'GEMINI_API_KEY', '')
    response = authed.post(
        '/api/recommendations',
        headers={'X-CSRF-Token': token},
        json={
            'query': 'punk plaid jacket under 100',
            'profile': {'favoriteShows': ['the-view'], 'styleTags': ['tailoring', 'bold'], 'patterns': ['plaid'], 'budget': 100},
            'limit': 4,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    catalog_ids = {item['id'] for item in main.PRODUCTS}
    assert 1 <= len(payload['products']) <= 4
    assert all(item['id'] in catalog_ids for item in payload['products'])
    assert payload['source'] == 'catalogue-matcher'


def test_yce_is_never_faked_when_key_is_missing(monkeypatch):
    authed = sign_in(TestClient(main.app))
    monkeypatch.setattr(main, 'YCE_API_KEY', '')
    app_page = authed.get('/app').text
    token = re.search(r'<meta name="csrf-token" content="([^"]+)"', app_page).group(1)
    response = authed.post(
        '/api/color-analysis',
        headers={'X-CSRF-Token': token},
        files={'photo': ('selfie.jpg', b'not-a-real-jpeg', 'image/jpeg')},
        data={'consent': 'true'},
    )
    assert response.status_code == 503
    assert 'not configured' in response.json()['detail'].lower()


def test_explicit_query_budget_is_a_hard_ceiling():
    ranked = main.deterministic_rank(
        {"favoriteShows": [], "styleTags": ["punk"], "patterns": ["plaid"], "budget": 80},
        "punk-inspired jacket under $100",
    )
    assert ranked
    assert all(item["price"] <= 100 for item in ranked)


def test_explore_looks_query_prioritizes_selected_daytime_show():
    ranked = main.deterministic_rank({"favoriteShows": [], "budget": "any"}, "CBS Mornings")
    assert ranked
    assert ranked[0]["id"] == "black-utility-jacket"


def test_yce_result_url_schema_is_recognized():
    payload = {"data": {"task_status": "success", "results": {"url": "https://example.test/generated.jpg"}}}
    assert main.extract_output_url(payload) == "https://example.test/generated.jpg"


def test_yce_paths_and_jpeg_metadata_match_provider_contract():
    assert main.YCE_TASK_PATHS["try-on"] == "/s2s/v2.0/task/cloth-v4"
    assert main.YCE_TASK_PATHS["color"] == "/s2s/v2.0/task/skin-tone-analysis"
    assert main.normalize_yce_content_type("image/jpeg") == "image/jpg"
    assert main.normalize_yce_content_type("image/jpg") == "image/jpg"
    assert main.normalize_yce_content_type("image/png") == "image/png"


def test_ineligible_standalone_lower_body_reference_is_not_sent_to_youcam(monkeypatch):
    authed = sign_in(TestClient(main.app))
    page = authed.get('/app').text
    token = re.search(r'<meta name="csrf-token" content="([^"]+)"', page).group(1)
    monkeypatch.setattr(main, "YCE_API_KEY", "")
    response = authed.post(
        "/api/try-on/wide-leg-denim",
        headers={"X-CSRF-Token": token},
        files={"photo": ("selfie.jpg", b"not-a-real-jpeg", "image/jpeg")},
        data={"consent": "true"},
    )
    assert response.status_code == 400
    assert "not eligible" in response.json()["detail"].lower()


def test_landing_hero_images_share_one_responsive_grid_row():
    from pathlib import Path
    template = Path("styletv/templates/landing.html").read_text()
    css = Path("public/assets/style.css").read_text()
    assert 'class="hero-art"' in template
    assert 'class="hero-image hero-image-main"' in template
    assert 'class="hero-image hero-image-side"' in template
    assert ".hero-art { position: relative; height: 485px;" in css
    assert "grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: minmax(0, 1fr)" in css
    assert ".hero-image-main, .hero-image-side { min-height: 0; margin-top: 0; }" in css


def test_try_on_uses_documented_clothes_v4_request(monkeypatch):
    authed = sign_in(TestClient(main.app))
    page = authed.get('/app').text
    token = re.search(r'<meta name="csrf-token" content="([^"]+)"', page).group(1)
    calls = {}

    async def fake_upload(_content, _filename, _content_type):
        return 'uploaded-source-id'

    async def fake_create_task(path, body):
        calls['path'] = path
        calls['body'] = body
        return {'data': {'task_id': 'task-demo-123'}}

    monkeypatch.setattr(main, 'YCE_API_KEY', 'test-key')
    monkeypatch.setattr(main, 'upload_image_to_yce', fake_upload)
    monkeypatch.setattr(main, 'create_yce_task', fake_create_task)
    response = authed.post(
        '/api/try-on/plaid-overshirt',
        headers={'X-CSRF-Token': token},
        files={'photo': ('person.jpg', b'valid-enough-for-mocked-upload', 'image/jpeg')},
        data={'consent': 'true'},
    )
    assert response.status_code == 200
    assert calls['path'] == '/s2s/v2.0/task/cloth-v4'
    assert calls['body']['src_file_id'] == 'uploaded-source-id'
    assert calls['body']['ref_file_url'] == main.get_product('plaid-overshirt')['try_on_reference_url']
    assert calls['body']['garment_category'] == 'outer'
    assert calls['body']['filter_multi_person'] == 'normal'


def test_color_analysis_uses_documented_skin_tone_task(monkeypatch):
    authed = sign_in(TestClient(main.app))
    page = authed.get('/app').text
    token = re.search(r'<meta name="csrf-token" content="([^"]+)"', page).group(1)
    calls = {}

    async def fake_upload(_content, _filename, _content_type):
        return 'uploaded-selfie-id'

    async def fake_create_task(path, body):
        calls['path'] = path
        calls['body'] = body
        return {'data': {'task_id': 'color-demo-123'}}

    monkeypatch.setattr(main, 'YCE_API_KEY', 'test-key')
    monkeypatch.setattr(main, 'upload_image_to_yce', fake_upload)
    monkeypatch.setattr(main, 'create_yce_task', fake_create_task)
    response = authed.post(
        '/api/color-analysis',
        headers={'X-CSRF-Token': token},
        files={'photo': ('selfie.jpg', b'valid-enough-for-mocked-upload', 'image/jpeg')},
        data={'consent': 'true'},
    )
    assert response.status_code == 200
    assert calls['path'] == '/s2s/v2.0/task/skin-tone-analysis'
    assert calls['body'] == {'src_file_id': 'uploaded-selfie-id', 'face_angle_strictness_level': 'high'}


def test_task_status_routes_poll_matching_youcam_v4_and_color_endpoints(monkeypatch):
    authed = sign_in(TestClient(main.app))
    requested_urls = []

    class FakeResponse:
        is_error = False

        def __init__(self, payload):
            self.payload = payload

        def json(self):
            return self.payload

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, **kwargs):
            requested_urls.append(url)
            if "skin-tone-analysis" in url:
                return FakeResponse({"data": {"task_status": "success", "results": {"color": {"skin_color": "#b9947c"}}}})
            return FakeResponse({"data": {"task_status": "success", "results": {"url": "https://cdn.example/try-on.jpg"}}})

    monkeypatch.setattr(main, "YCE_API_KEY", "test-key")
    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    try_on = authed.get('/api/tasks/try-on/task-123')
    color = authed.get('/api/tasks/color/color-123')
    assert try_on.status_code == 200 and try_on.json()['result_url'] == 'https://cdn.example/try-on.jpg'
    assert color.status_code == 200 and color.json()['colors']['skin_color'] == '#b9947c'
    assert requested_urls == [
        f"{main.YCE_BASE}/s2s/v2.0/task/cloth-v4/task-123",
        f"{main.YCE_BASE}/s2s/v2.0/task/skin-tone-analysis/color-123",
    ]


def test_curated_daytime_show_style_cues_influence_garment_recommendations():
    show = next(item for item in main.SHOWS if item["id"] == "cbs-mornings")
    ranked = main.deterministic_rank(
        {"favoriteShows": [], "styleTags": [], "patterns": [], "colorPreferences": [], "budget": "any"},
        "CBS Mornings",
        shows=[show],
    )
    assert ranked
    assert ranked[0]["id"] == "black-utility-jacket"


def test_try_on_dialog_follows_current_clothes_v4_full_body_guidance():
    from pathlib import Path
    app_template = Path('styletv/templates/app.html').read_text()
    assert 'high-resolution, front-facing full-body photo' in app_template
    assert 'showing the full body, with one person and a simple background' in app_template


def test_daytime_show_focus_tags_rank_relevant_existing_garments():
    daytime_show = next(item for item in main.SHOWS if item["id"] == "the-view")
    ranked = main.deterministic_rank(
        {"favoriteShows": [], "styleTags": [], "patterns": [], "colorPreferences": [], "budget": "any"},
        daytime_show["name"],
        shows=[daytime_show],
        focus_show_id=daytime_show["id"],
        focus_show_tags=daytime_show["tags"],
    )
    assert ranked[0]["id"] == "statement-shirt"
    assert all(item["id"] in {product["id"] for product in main.PRODUCTS} for item in ranked)


def test_recommendation_endpoint_accepts_explicit_daytime_show_context(monkeypatch):
    authed = sign_in(TestClient(main.app))
    monkeypatch.setattr(main, "GEMINI_API_KEY", "")
    show = next(item for item in main.SHOWS if item["id"] == "the-view")
    page = authed.get('/app').text
    token = re.search(r'<meta name="csrf-token" content="([^"]+)"', page).group(1)
    response = authed.post(
        '/api/recommendations',
        headers={'X-CSRF-Token': token},
        json={
            'query': show["name"],
            'profile': {'favoriteShows': [], 'styleTags': [], 'patterns': [], 'colorPreferences': [], 'budget': 'any'},
            'limit': 4,
            'focus_show_id': show["id"],
            'focus_show_name': show["name"],
            'focus_show_tags': show["tags"],
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result['products'][0]['id'] == 'statement-shirt'
    assert show["name"] in result['explanation']


def test_find_my_looks_uses_the_local_daytime_catalogue(monkeypatch):
    authed = sign_in(TestClient(main.app))
    page = authed.get('/app').text
    token = re.search(r'<meta name="csrf-token" content="([^"]+)"', page).group(1)
    monkeypatch.setattr(main, 'GEMINI_API_KEY', '')

    response = authed.post(
        '/api/recommendations',
        headers={'X-CSRF-Token': token},
        json={
            'query': 'tailored plaid jacket under $100',
            'profile': {'favoriteShows': ['the-view'], 'styleTags': ['tailoring', 'bold'], 'patterns': ['plaid'], 'colorPreferences': ['Black'], 'budget': 100},
            'limit': 6,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['products']
    assert all(product['price'] <= 100 for product in payload['products'])
    assert payload['source'] == 'catalogue-matcher'


def test_find_my_looks_falls_back_when_gemini_times_out(monkeypatch):
    authed = sign_in(TestClient(main.app))
    page = authed.get('/app').text
    token = re.search(r'<meta name="csrf-token" content="([^"]+)"', page).group(1)
    monkeypatch.setattr(main, 'GEMINI_API_KEY', 'configured-for-test')
    monkeypatch.setattr(main, 'RECOMMENDATION_AI_TIMEOUT_SECONDS', 0.01)

    async def slow_gemini(*_args, **_kwargs):
        await asyncio.sleep(0.1)
        return None

    monkeypatch.setattr(main, 'gemini_recommendations', slow_gemini)
    response = authed.post(
        '/api/recommendations',
        headers={'X-CSRF-Token': token},
        json={
            'query': 'black jacket',
            'profile': {'favoriteShows': ['cbs-mornings'], 'styleTags': ['workwear'], 'patterns': ['solid'], 'budget': 100},
            'limit': 6,
        },
    )
    assert response.status_code == 200
    assert response.json()['products']
    assert response.json()['source'] == 'catalogue-matcher'


def test_find_my_looks_form_has_submit_handler_and_bounded_fallback():
    from pathlib import Path
    template = Path('styletv/templates/app.html').read_text()
    script = Path('public/assets/app.js').read_text()
    assert 'id="style-search-form"' in template
    assert "addEventListener('submit'" in script
    assert 'new AbortController()' in script
    assert 'localRank(query, focusShow)' in script


def test_catalog_returns_curated_daytime_shows_with_direct_wornontv_links():
    authed = sign_in(TestClient(main.app))
    response = authed.get('/api/catalog')
    assert response.status_code == 200
    payload = response.json()
    assert len(payload['shows']) == 17
    assert payload['catalogue']['count'] == 17
    assert payload['catalogue']['source_status'] == 'curated'
    assert all(show.get('wornontv_direct') for show in payload['shows'])
    assert {show['category'] for show in payload['shows']} <= {
        'Daytime soap', 'Daytime talk show', 'Morning show', 'Morning news',
        'Entertainment news', 'Daytime game show', 'Daytime news',
    }
    assert {'The View', 'Today', 'Good Morning America', 'General Hospital'} <= {
        show['name'] for show in payload['shows']
    }
    assert all(show.get('wornontv_url', '').startswith('https://wornontv.net/') for show in payload['shows'])
    assert not any(show['name'] in {'Wednesday', 'Stranger Things', 'Euphoria', 'The Bear'} for show in payload['shows'])
    assert len(payload['products']) == len(main.PRODUCTS)
    show_ids = {show['id'] for show in payload['shows']}
    assert all(set(product['shows']).issubset(show_ids) for product in payload['products'])


def test_general_tv_show_catalogue_endpoint_is_removed():
    authed = sign_in(TestClient(main.app))
    assert authed.get('/api/shows').status_code == 404


def test_profile_and_quiz_share_expanded_budget_choices():
    from pathlib import Path
    app_template = Path('styletv/templates/app.html').read_text()
    app_js = Path('public/assets/app.js').read_text()
    expected = ['25', '40', '50', '60', '75', '80', '100', '125', '150', '200', '250', '300', 'any']
    for amount in expected:
        assert f"['{amount}'," in app_js
        if amount != 'any':
            assert f'<option value="{amount}"' in app_template
    assert 'This budget also applies to the recommendations on Discover.' in app_template


def test_show_browse_has_search_and_favourite_filters_and_no_verbose_status_copy():
    from pathlib import Path
    app_template = Path('styletv/templates/app.html').read_text()
    app_js = Path('public/assets/app.js').read_text()
    assert 'id="show-search"' in app_template
    assert 'data-show-filter="all"' in app_template
    assert 'data-show-filter="favorites"' in app_template
    assert 'data-show-filter="recommended"' in app_template
    assert 'Find daytime shows to follow.' in app_template
    assert 'Shop outfits on WornOnTV' not in app_template  # rendered from each curated show card
    assert 'View outfits on WornOnTV' in app_js
    assert 'Only run an analysis when you\'re ready.' not in app_template
    assert "loadExpandedShowCatalogue" not in app_js
    assert "apiFetch('/api/catalog'" in app_js


def test_discovery_card_images_are_contained_not_cropped():
    from pathlib import Path
    css = Path('public/assets/style.css').read_text()
    assert '.product-photo img { width: 100%; height: 100%; object-fit: contain;' in css
    assert '.show-type-label' in css


def test_find_my_looks_is_enabled_after_local_catalogue_and_renders_local_first():
    from pathlib import Path
    app_template = Path('styletv/templates/app.html').read_text()
    app_js = Path('public/assets/app.js').read_text()
    main_source = Path('styletv/main.py').read_text()
    assert 'id="find-looks-button"' in app_template
    assert "requestRecommendations($('#style-search')?.value.trim() || '');" in app_js
    assert "const localProducts = localRank(query, focusShow);" in app_js
    assert 'Discovery never waits for an external show catalogue.' in app_js
    assert '@app.get("/api/shows")' not in main_source
    assert 'curated daytime shows and demo products' in main_source


def test_every_daytime_show_has_programme_image_and_source_credit():
    shows = main.SHOWS
    assert len(shows) == 17
    assert all(item.get('image_url', '').startswith('https://') for item in shows)
    assert all(item.get('image_source_url', '').startswith('https://') for item in shows)
    assert all(item.get('image_credit') for item in shows)


def test_show_card_image_markup_has_fallback_and_responsive_frames():
    from pathlib import Path
    js = Path('public/assets/app.js').read_text()
    css = Path('public/assets/style.css').read_text()
    assert 'function showImageMarkup(show)' in js
    assert 'data-show-card-image' in js
    assert "image.addEventListener('error'" in js
    assert 'show-card-image-fallback' in js
    assert '.show-card-media {' in css
    assert 'aspect-ratio: 16 / 9' in css
    assert 'object-fit: cover' in css
