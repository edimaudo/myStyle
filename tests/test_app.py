import re

from fastapi.testclient import TestClient

from styletv import main


client = TestClient(main.app)


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


def test_demo_signin_catalog_and_signout_flow():
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


def test_recommendations_are_grounded_in_catalogue():
    authed = sign_in(TestClient(main.app))
    csrf = authed.get('/app').text
    token = re.search(r'<meta name="csrf-token" content="([^"]+)"', csrf).group(1)
    main.GEMINI_API_KEY = ''
    response = authed.post(
        '/api/recommendations',
        headers={'X-CSRF-Token': token},
        json={
            'query': 'punk plaid jacket under 100',
            'profile': {'favoriteShows': ['wednesday'], 'styleTags': ['punk', 'alternative'], 'patterns': ['plaid'], 'budget': 100},
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


def test_explore_looks_query_prioritizes_selected_show():
    ranked = main.deterministic_rank({"favoriteShows": [], "budget": "any"}, "The Last of Us")
    assert ranked
    assert ranked[0]["id"] == "black-utility-jacket"


def test_yce_result_url_schema_is_recognized():
    payload = {"data": {"task_status": "success", "results": {"url": "https://example.test/generated.jpg"}}}
    assert main.extract_output_url(payload) == "https://example.test/generated.jpg"
