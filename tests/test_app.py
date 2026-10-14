import asyncio
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from styletv import main


@pytest.fixture
def client():
    return TestClient(main.app)


def sign_in(client_instance):
    page = client_instance.get('/signin')
    assert page.status_code == 200
    csrf = re.search(r'name="csrf" value="([^"]+)"', page.text).group(1)
    response = client_instance.post(
        '/signin',
        data={'email': 'demo@styletv.app', 'password': 'styleTV2026', 'csrf': csrf},
        follow_redirects=False,
    )
    assert response.status_code == 303
    return client_instance


def csrf_for(client_instance):
    page = client_instance.get('/app').text
    return re.search(r'<meta name="csrf-token" content="([^"]+)"', page).group(1)


def test_landing_page_renders(client):
    response = client.get('/')
    assert response.status_code == 200
    assert 'styleTV' in response.text
    assert 'The looks you love.' in response.text


def test_app_requires_sign_in(client):
    response = client.get('/app', follow_redirects=False)
    assert response.status_code == 303
    assert response.headers['location'].startswith('/signin')


def test_catalog_contains_daytime_shows_and_no_random_garments(client):
    authed = sign_in(client)
    response = authed.get('/api/catalog')
    assert response.status_code == 200
    payload = response.json()
    assert len(payload['shows']) >= 15
    assert all(show['wornontv_url'].startswith('https://wornontv.net/') for show in payload['shows'])
    assert 'products' not in payload
    assert 'PRODUCTS' not in Path('styletv/catalog.py').read_text()


def test_recommendations_return_wardrobe_sources_not_fake_products(client, monkeypatch):
    authed = sign_in(client)
    monkeypatch.setattr(main, 'GEMINI_API_KEY', '')
    response = authed.post(
        '/api/recommendations',
        headers={'X-CSRF-Token': csrf_for(authed)},
        json={
            'query': 'The View',
            'profile': {'favoriteShows': ['the-view'], 'styleTags': ['tailoring', 'bold'], 'patterns': ['floral'], 'budget': 80},
            'limit': 4,
            'focus_show_id': 'the-view',
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['source'] == 'profile-ranker'
    assert payload['ai_status'] == 'not_configured'
    assert payload['recommendations'][0]['id'] == 'the-view'
    assert payload['recommendations'][0]['wardrobe_url'] == 'https://wornontv.net/the-view/'
    assert all(item['wardrobe_url'].startswith('https://wornontv.net/') for item in payload['recommendations'])
    assert 'products' not in payload
    assert payload['outfit_listing_mode'] == 'outbound-link'


def test_show_recommender_uses_profile_tags_and_excludes_favourites():
    shows = [
        {'id': 'a', 'name': 'Programme A', 'category': 'Talk show', 'description': 'A', 'tags': ['tailoring'], 'wornontv_url': 'https://wornontv.net/a/'},
        {'id': 'b', 'name': 'Programme B', 'category': 'Morning show', 'description': 'B', 'tags': ['punk'], 'wornontv_url': 'https://wornontv.net/b/'},
        {'id': 'c', 'name': 'Programme C', 'category': 'News', 'description': 'C', 'tags': ['tailoring', 'workwear'], 'wornontv_url': 'https://wornontv.net/c/'},
    ]
    ranked = main.rank_show_recommendations(
        {'favoriteShows': ['a'], 'styleTags': ['workwear'], 'patterns': []}, shows, limit=2
    )
    assert [show['id'] for show in ranked] == ['c', 'b']


def test_gemini_is_called_and_ranks_known_shows(client, monkeypatch):
    authed = sign_in(client)
    monkeypatch.setattr(main, 'GEMINI_API_KEY', 'test-gemini-key')
    called = {}

    async def fake_gemini(profile, query, candidates, shows=None):
        called['query'] = query
        called['candidate_ids'] = [item['id'] for item in candidates]
        wanted = 'the-jennifer-hudson-show'
        return {'show_ids': [wanted], 'explanation': 'Selected from the known daytime show directory.'}

    monkeypatch.setattr(main, 'gemini_recommendations', fake_gemini)
    response = authed.post(
        '/api/recommendations',
        headers={'X-CSRF-Token': csrf_for(authed)},
        json={'query': 'bold talk show', 'profile': {'favoriteShows': ['the-view'], 'styleTags': ['bold'], 'patterns': []}, 'limit': 3},
    )
    assert response.status_code == 200
    payload = response.json()
    assert called['query'] == 'bold talk show'
    assert payload['source'] == 'gemini'
    assert payload['ai_status'] == 'used'
    assert payload['recommendations'][0]['id'] == 'the-jennifer-hudson-show'
    assert all(item['id'] in called['candidate_ids'] for item in payload['recommendations'])


def test_gemini_failure_falls_back_to_profile_ranker(client, monkeypatch):
    authed = sign_in(client)
    monkeypatch.setattr(main, 'GEMINI_API_KEY', 'test-gemini-key')

    async def failed_gemini(*_args, **_kwargs):
        return None

    monkeypatch.setattr(main, 'gemini_recommendations', failed_gemini)
    response = authed.post(
        '/api/recommendations',
        headers={'X-CSRF-Token': csrf_for(authed)},
        json={'query': 'morning show', 'profile': {'favoriteShows': ['the-view'], 'styleTags': ['workwear'], 'patterns': []}, 'limit': 3},
    )
    assert response.status_code == 200
    assert response.json()['source'] == 'profile-ranker'
    assert response.json()['ai_status'] == 'fallback'




def test_gemini_empty_or_unknown_show_ids_trigger_profile_fallback(client, monkeypatch):
    authed = sign_in(client)
    monkeypatch.setattr(main, 'GEMINI_API_KEY', 'test-gemini-key')

    async def unusable_gemini(*_args, **_kwargs):
        return {'show_ids': [], 'explanation': 'No known shows'}

    monkeypatch.setattr(main, 'gemini_recommendations', unusable_gemini)
    response = authed.post(
        '/api/recommendations',
        headers={'X-CSRF-Token': csrf_for(authed)},
        json={'query': 'bold talk show', 'profile': {'styleTags': ['bold'], 'patterns': []}, 'limit': 3},
    )
    assert response.status_code == 200
    assert response.json()['source'] == 'profile-ranker'
    assert response.json()['ai_status'] == 'fallback'


def test_config_reports_whether_provider_keys_are_present(client, monkeypatch):
    authed = sign_in(client)
    monkeypatch.setattr(main, 'GEMINI_API_KEY', '')
    monkeypatch.setattr(main, 'YCE_API_KEY', '')
    payload = authed.get('/api/config').json()
    assert payload['gemini_configured'] is False
    assert payload['youcam_configured'] is False
    assert payload['gemini_model'] == main.GEMINI_MODEL


def test_try_on_without_youcam_key_fails_without_faking_success(client, monkeypatch):
    authed = sign_in(client)
    monkeypatch.setattr(main, 'YCE_API_KEY', '')
    response = authed.post(
        '/api/try-on',
        headers={'X-CSRF-Token': csrf_for(authed)},
        files={
            'photo': ('me.jpg', b'photo', 'image/jpeg'),
            'outfit_reference': ('outfit.jpg', b'outfit', 'image/jpeg'),
        },
        data={'consent': 'true', 'garment_category': 'auto'},
    )
    assert response.status_code == 503
    assert 'not configured' in response.json()['detail'].lower()


def test_try_on_sends_the_user_selected_outfit_reference_to_clothes_v4(client, monkeypatch):
    authed = sign_in(client)
    monkeypatch.setattr(main, 'YCE_API_KEY', 'test-youcam-key')
    uploaded = []
    called = {}

    async def fake_upload(image_bytes, filename, content_type):
        uploaded.append((filename, content_type, image_bytes))
        return 'uploaded-' + filename

    async def fake_create(path, body):
        called['path'] = path
        called['body'] = body
        return {'data': {'task_id': 'yce-task-123'}}

    monkeypatch.setattr(main, 'upload_image_to_yce', fake_upload)
    monkeypatch.setattr(main, 'create_yce_task', fake_create)
    response = authed.post(
        '/api/try-on',
        headers={'X-CSRF-Token': csrf_for(authed)},
        files={
            'photo': ('my-photo.jpg', b'my-photo-bytes', 'image/jpeg'),
            'outfit_reference': ('the-view-outfit.png', b'actual-outfit-bytes', 'image/png'),
        },
        data={'consent': 'true', 'garment_category': 'auto'},
    )
    assert response.status_code == 200
    assert response.json()['task_id'] == 'yce-task-123'
    assert response.json()['reference_mode'] == 'user-selected-outfit-image'
    assert {item[0] for item in uploaded} == {'my-photo.jpg', 'the-view-outfit.png'}
    assert called['path'] == '/s2s/v2.0/task/cloth-v4'
    assert called['body']['src_file_id'] == 'uploaded-my-photo.jpg'
    assert called['body']['ref_file_id'] == 'uploaded-the-view-outfit.png'
    assert called['body']['garment_category'] == 'auto'


def test_try_on_requires_consent_before_provider_upload(client, monkeypatch):
    authed = sign_in(client)
    monkeypatch.setattr(main, 'YCE_API_KEY', 'test-youcam-key')
    response = authed.post(
        '/api/try-on',
        headers={'X-CSRF-Token': csrf_for(authed)},
        files={
            'photo': ('me.jpg', b'my-photo', 'image/jpeg'),
            'outfit_reference': ('outfit.jpg', b'outfit', 'image/jpeg'),
        },
        data={'consent': 'false', 'garment_category': 'auto'},
    )
    assert response.status_code == 400
    assert 'consent' in response.json()['detail'].lower()


def test_try_on_requires_both_jpg_or_png_images(client):
    authed = sign_in(client)
    response = authed.post(
        '/api/try-on',
        headers={'X-CSRF-Token': csrf_for(authed)},
        files={
            'photo': ('me.gif', b'my-photo', 'image/gif'),
            'outfit_reference': ('outfit.jpg', b'outfit', 'image/jpeg'),
        },
        data={'consent': 'true', 'garment_category': 'auto'},
    )
    assert response.status_code == 415


def test_color_analysis_uses_youcam_skin_tone_task(client, monkeypatch):
    authed = sign_in(client)
    monkeypatch.setattr(main, 'YCE_API_KEY', 'test-youcam-key')
    uploads = []
    called = {}

    async def fake_upload(image_bytes, filename, content_type):
        uploads.append((filename, content_type))
        return 'face-file-id'

    async def fake_create(path, body):
        called['path'] = path
        called['body'] = body
        return {'data': {'task_id': 'color-task-123'}}

    monkeypatch.setattr(main, 'upload_image_to_yce', fake_upload)
    monkeypatch.setattr(main, 'create_yce_task', fake_create)
    response = authed.post(
        '/api/color-analysis',
        headers={'X-CSRF-Token': csrf_for(authed)},
        files={'photo': ('selfie.jpg', b'selfie-bytes', 'image/jpeg')},
        data={'consent': 'true'},
    )
    assert response.status_code == 200
    assert uploads == [('selfie.jpg', 'image/jpeg')]
    assert called['path'] == '/s2s/v2.0/task/skin-tone-analysis'
    assert called['body']['src_file_id'] == 'face-file-id'
    assert response.json()['task_id'] == 'color-task-123'


def test_yce_task_paths_and_jpeg_metadata_match_documented_contract():
    assert main.YCE_TASK_PATHS['try-on'] == '/s2s/v2.0/task/cloth-v4'
    assert main.YCE_TASK_PATHS['color'] == '/s2s/v2.0/task/skin-tone-analysis'
    assert main.normalize_yce_content_type('image/jpeg') == 'image/jpg'
    assert main.normalize_yce_content_type('image/png') == 'image/png'


def test_yce_result_url_and_task_status_are_recognized():
    payload = {'data': {'task_status': 'success', 'results': {'url': 'https://example.test/generated.jpg'}}}
    assert main.extract_output_url(payload) == 'https://example.test/generated.jpg'
    assert main.extract_task_status(payload) == 'success'
    assert main.extract_task_status({'data': {'task_status': 'error'}}) == 'error'
    assert main.find_color_payload({'data': {'results': {'color': {'skin_color': '#b9947c'}}}}) == {'skin_color': '#b9947c'}


def test_app_ui_has_no_demo_garment_grid_and_has_real_wardrobe_links():
    template = Path('styletv/templates/app.html').read_text()
    script = Path('public/assets/app.js').read_text()
    assert 'id="wardrobe-recommendation-grid"' in template
    assert 'id="product-grid"' not in template
    assert 'id="saved-product-grid"' not in template
    assert 'View actual outfits' in script
    assert 'WornOnTV' in template
    assert 'data-open-try-on' in script
    assert "apiFetch('/api/recommendations'" in script
    assert "apiFetch('/api/try-on'" in script
    assert "apiFetch(`/api/try-on/${encodeURIComponent" not in script


def test_try_on_dialog_has_two_images_and_explicit_consent():
    template = Path('styletv/templates/app.html').read_text()
    assert 'id="try-on-photo"' in template
    assert 'id="try-on-reference-photo"' in template
    assert 'I consent to sending both images to YouCam' in template
    assert 'Generate preview with YouCam Clothes V4' in template


def test_recommendations_never_claim_demo_garments_are_worn_on_screen():
    main_source = Path('styletv/main.py').read_text()
    template = Path('styletv/templates/app.html').read_text()
    assert 'Never invent outfits' in main_source
    assert 'outfit items stay on WornOnTV' in main_source
    assert 'generic sample garments' in template
    assert 'recommendation-reason' not in main_source  # reason is attached to response records, not copied source data


def test_daytime_show_cards_have_programme_images_and_source_attribution():
    for show in main.SHOWS:
        assert show.get('image_url', '').startswith('https://')
        assert show.get('image_source_url', '').startswith('https://')
        assert show.get('image_credit')
        assert show.get('wornontv_url', '').startswith('https://wornontv.net/')


def test_profile_budget_copy_does_not_claim_actual_prices_are_filtered():
    template = Path('styletv/templates/app.html').read_text()
    assert 'does not filter individual outfits yet' in template
    assert 'This budget also applies to the recommendations on Discover' not in template


def test_budget_is_not_misrepresented_as_an_applied_item_filter():
    template = Path('styletv/templates/app.html').read_text()
    readme = Path('README.md').read_text()
    assert 'Item-level budget filtering is not available in this version' in template
    assert 'cannot reliably filter individual WornOnTV outfits' in readme


def test_try_on_ui_respects_wornontv_material_permissions():
    template = Path('styletv/templates/app.html').read_text()
    script = Path('public/assets/app.js').read_text()
    assert 'have permission to submit to an AI service' in template
    assert 'do not copy or upload its material unless you have permission' in template
    assert 'only use a reference image you own or are authorized to submit' in script
