(() => {
  'use strict';

  const DB_NAME = 'styletv-db';
  const DB_VERSION = 1;
  const PROFILE_KEY = 'demo-profile';
  const SETTINGS_KEY = 'display-settings';
  const DEFAULT_PROFILE = {
    displayName: 'Demo stylist',
    favoriteShows: ['the-view', 'today'],
    styleTags: ['tailoring', 'bold', 'layering'],
    patterns: ['plaid', 'floral'],
    colorPreferences: ['Black', 'Burgundy', 'Forest green'],
    budget: 80,
    boldness: 'medium',
    notes: '',
    colorAnalysis: null
  };
  const STYLE_TAGS = [
    ['alternative', 'Alternative'], ['punk', 'Punk-inspired'], ['retro', 'Retro'],
    ['streetwear', 'Streetwear'], ['tailoring', 'Tailoring'], ['utility', 'Utility'],
    ['layering', 'Layering'], ['experimental', 'Experimental'], ['minimal', 'Minimal'],
    ['workwear', 'Workwear'], ['preppy', 'Preppy'], ['bold', 'Bold statements']
  ];
  const PATTERNS = [
    ['plaid', 'Plaid / checks'], ['graphic print', 'Graphic prints'], ['geometric', 'Geometric'],
    ['abstract', 'Abstract'], ['stripes', 'Stripes'], ['floral', 'Floral'], ['solid', 'Mostly solid'], ['subtle check', 'Subtle checks']
  ];
  const COLORS = [
    ['Black', 'Black'], ['Burgundy', 'Burgundy'], ['Forest green', 'Forest green'],
    ['Navy', 'Navy'], ['Cream', 'Cream'], ['Charcoal', 'Charcoal'], ['Rust', 'Rust'], ['Brighter colours', 'Brighter colours']
  ];
  const BOLDNESS = [
    ['subtle', 'Keep it subtle'], ['medium', 'A bit of a statement'], ['bold', 'Bold and experimental']
  ];
  const BUDGETS = [
    ['25', 'Up to $25'], ['40', 'Up to $40'], ['50', 'Up to $50'], ['60', 'Up to $60'], ['75', 'Up to $75'], ['80', 'Up to $80'], ['100', 'Up to $100'], ['125', 'Up to $125'], ['150', 'Up to $150'], ['200', 'Up to $200'], ['250', 'Up to $250'], ['300', 'Up to $300'], ['any', 'No fixed budget']
  ];

  const state = {
    db: null,
    profile: structuredClone(DEFAULT_PROFILE),
    settings: { theme: 'light', fontSize: 'medium', walkthroughSeen: false },
    shows: [],
    currentView: 'discover',
    currentShowId: null,
    recommendationRequestId: 0,
    config: { gemini_configured: false, youcam_configured: false },
    filteredShows: null,
    catalogueMeta: null,
    showResultLimit: 24,
    lastShowFilter: '',
    showListMode: 'all'
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const csrfToken = $('meta[name="csrf-token"]')?.content || '';

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported by this browser.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('saved')) db.createObjectStore('saved', { keyPath: 'productId' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open the local profile database.'));
    });
  }

  function dbRequest(storeName, method, value) {
    return new Promise((resolve, reject) => {
      if (!state.db) return reject(new Error('The local database is not ready.'));
      const transaction = state.db.transaction(storeName, method === 'getAll' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore(storeName);
      let request;
      if (method === 'get') request = store.get(value);
      else if (method === 'getAll') request = store.getAll();
      else if (method === 'put') request = store.put(value);
      else if (method === 'delete') request = store.delete(value);
      else return reject(new Error('Unsupported database operation.'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('A local database operation failed.'));
    });
  }

  async function loadLocalState() {
    const profileRow = await dbRequest('profile', 'get', PROFILE_KEY);
    if (profileRow?.value) state.profile = { ...structuredClone(DEFAULT_PROFILE), ...profileRow.value };
    const settingsRow = await dbRequest('settings', 'get', SETTINGS_KEY);
    if (settingsRow?.value) state.settings = { ...state.settings, ...settingsRow.value };
    // Legacy saved-product rows from earlier prototypes are ignored; show favourites live in the profile.
    if (migrateFavoriteShows()) await persistProfile();
    applySettings();
  }

  async function persistProfile() {
    await dbRequest('profile', 'put', { key: PROFILE_KEY, value: state.profile, updatedAt: new Date().toISOString() });
  }

  async function saveSettings() {
    await dbRequest('settings', 'put', { key: SETTINGS_KEY, value: state.settings });
  }

  function applySettings() {
    document.documentElement.dataset.theme = state.settings.theme || 'light';
    document.documentElement.dataset.fontSize = state.settings.fontSize || 'medium';
    $$('[data-font]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.font === document.documentElement.dataset.fontSize)));
    const dark = document.documentElement.dataset.theme === 'dark';
    const toggle = $('.theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      const label = $('.theme-label', toggle);
      if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
    }
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function showAlert(message, type = 'info') {
    const el = $('#app-alert');
    if (!el) return;
    el.textContent = message;
    el.className = `app-alert${type === 'error' ? ' is-error' : type === 'good' ? ' is-good' : ''}`;
    el.hidden = false;
    el.focus?.();
    window.clearTimeout(showAlert.timeout);
    showAlert.timeout = window.setTimeout(() => { el.hidden = true; }, 8000);
  }

  async function apiFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (csrfToken && options.method && options.method.toUpperCase() !== 'GET') headers.set('X-CSRF-Token', csrfToken);
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...options, headers, credentials: 'same-origin' });
    if (response.status === 401) {
      window.location.href = '/signin?next=/app';
      throw new Error('Your demo session ended. Please sign in again.');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || body.error || `Request failed (${response.status}).`);
    return body;
  }

  function selectedValues(selector) {
    return $$(selector).filter(input => input.checked).map(input => input.value);
  }

  function makeChoiceInputs(container, options, name, selected, multiple = true) {
    const el = typeof container === 'string' ? $(container) : container;
    if (!el) return;
    el.innerHTML = options.map(([value, label]) => {
      const checked = selected.includes(value) ? ' checked' : '';
      const type = multiple ? 'checkbox' : 'radio';
      const id = `${name}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      return `<label class="choice-chip" for="${escapeHTML(id)}"><input id="${escapeHTML(id)}" name="${escapeHTML(name)}" value="${escapeHTML(value)}" type="${type}"${checked}><span>${escapeHTML(label)}</span></label>`;
    }).join('');
  }

  function renderProfileChoices() {
    makeChoiceInputs('#style-tag-choices', STYLE_TAGS, 'styleTags', state.profile.styleTags || []);
    makeChoiceInputs('#pattern-choices', PATTERNS, 'patterns', state.profile.patterns || []);
    makeChoiceInputs('#color-choices', COLORS, 'colorPreferences', state.profile.colorPreferences || []);
    makeChoiceInputs('#quiz-style-choices', STYLE_TAGS, 'quizStyleTags', state.profile.styleTags || []);
    makeChoiceInputs('#quiz-pattern-choices', PATTERNS, 'quizPatterns', state.profile.patterns || []);
    makeChoiceInputs('#quiz-color-choices', COLORS, 'quizColors', state.profile.colorPreferences || []);
    makeChoiceInputs('#quiz-boldness-choices', BOLDNESS, 'quizBoldness', [state.profile.boldness || 'medium'], false);
    makeChoiceInputs('#quiz-budget-choices', BUDGETS, 'quizBudget', [String(state.profile.budget || '80')], false);
    $('#display-name').value = state.profile.displayName || 'Demo stylist';
    const displayName = state.profile.displayName || 'Demo stylist';
    const userName = $('.user-name');
    const userAvatar = $('.user-avatar');
    if (userName) userName.textContent = displayName;
    if (userAvatar) userAvatar.textContent = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
    $('#budget').value = String(state.profile.budget ?? 80);
    $('#boldness').value = state.profile.boldness || 'medium';
    $('#fit-notes').value = state.profile.notes || '';
    renderColorAnalysis(state.profile.colorAnalysis);
  }

  function findShow(id) { return state.shows.find(show => show.id === id); }

  function migrateFavoriteShows() {
    if (!state.shows.length) return false;
    const validIds = new Set(state.shows.map(show => show.id));
    const current = Array.isArray(state.profile.favoriteShows) ? state.profile.favoriteShows : [];
    const migrated = current.filter(id => validIds.has(id));
    const previousGeneralTvIds = new Set(['wednesday', 'stranger-things', 'euphoria', 'the-bear', 'heartstopper', 'the-last-of-us']);
    if (!migrated.length && current.some(id => previousGeneralTvIds.has(id))) {
      migrated.push('the-view', 'today');
    }
    const changed = JSON.stringify(current) !== JSON.stringify(migrated);
    state.profile.favoriteShows = migrated;
    return changed;
  }



  function wardrobeSource(show) {
    return show?.wornontv_url || 'https://wornontv.net/';
  }

  function wardrobeSourceLabel(show) {
    return show?.wornontv_direct ? 'View outfits on WornOnTV ↗' : 'Search WornOnTV ↗';
  }

  function wardrobeLinkForProduct(product) {
    const linkedShows = (product.shows || []).map(findShow).filter(Boolean);
    return linkedShows.find(show => show.wornontv_direct) || linkedShows[0] || null;
  }

  let walkthroughIndex = 0;
  function renderWalkthroughStep() {
    const panels = $$('.walkthrough-panel');
    panels.forEach((panel, index) => { panel.hidden = index !== walkthroughIndex; });
    const back = $('#walkthrough-back');
    const next = $('#walkthrough-next');
    if (back) back.hidden = walkthroughIndex === 0;
    if (next) next.textContent = walkthroughIndex === panels.length - 1 ? 'Start exploring' : 'Continue';
  }

  function openWalkthrough() {
    const dialog = $('#walkthrough-dialog');
    if (!dialog) return;
    walkthroughIndex = 0;
    renderWalkthroughStep();
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  async function closeWalkthrough(markSeen = true) {
    const dialog = $('#walkthrough-dialog');
    if (markSeen) {
      state.settings.walkthroughSeen = true;
      try { await saveSettings(); } catch (_) { /* the walkthrough can still close without local persistence */ }
    }
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
  }

  function showImageMarkup(show) {
    const image = show.image_url;
    const credit = show.image_credit || 'Image source';
    const sourceUrl = show.image_source_url;
    const fallback = `<div class="show-card-image-fallback" aria-hidden="true"><span class="show-card-image-kicker">Daytime style</span><span class="show-card-image-name">${escapeHTML(show.name)}</span></div>`;
    const media = image
      ? `<div class="show-card-media" data-image-state="loading"><img data-show-card-image src="${escapeHTML(image)}" alt="Promotional image for ${escapeHTML(show.name)}" loading="lazy" decoding="async">${fallback}</div>`
      : `<div class="show-card-media" data-image-state="error">${fallback}</div>`;
    const attribution = sourceUrl
      ? `<div class="show-card-image-credit">Image: <a href="${escapeHTML(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(credit)}</a></div>`
      : `<div class="show-card-image-credit">${escapeHTML(credit)}</div>`;
    return `<div class="show-card-visual">${media}${attribution}</div>`;
  }

  function bindShowCardImages(root = document) {
    root.querySelectorAll('img[data-show-card-image]').forEach(image => {
      if (image.dataset.imageHandlers === 'bound') return;
      image.dataset.imageHandlers = 'bound';
      const update = stateName => image.closest('.show-card-media')?.setAttribute('data-image-state', stateName);
      image.addEventListener('load', () => update('loaded'), { once: true });
      image.addEventListener('error', () => update('error'), { once: true });
      if (image.complete) update(image.naturalWidth > 0 ? 'loaded' : 'error');
    });
  }

  function renderFavoriteShows() {
    const target = $('#favorite-shows');
    if (!target) return;
    const favorites = state.profile.favoriteShows || [];
    const chosen = state.shows.filter(show => favorites.includes(show.id));
    if (!chosen.length) {
      target.innerHTML = '<div class="no-results">Choose a daytime show to personalize this row. <button class="text-link" data-go-view="shows">Find daytime shows →</button></div>';
      return;
    }
    target.innerHTML = chosen.slice(0, 5).map(show => `
      <article class="show-card">
        ${showImageMarkup(show)}
        <div class="show-card-content">
          <span class="show-type-label">${escapeHTML(show.category || 'Daytime show')}</span>
          <h3>${escapeHTML(show.name)}</h3><p>${escapeHTML(show.description)}</p>
          <div class="show-action-row"><button class="show-card-action" data-open-try-on="${escapeHTML(show.id)}">Try on an outfit</button></div>
          <a class="show-card-action wardrobe-link" href="${escapeHTML(wardrobeSource(show))}" target="_blank" rel="noopener noreferrer">View actual outfits on WornOnTV ↗</a>
        </div>
      </article>`).join('');
    bindShowCardImages(target);
  }

  function renderShowCard(show, isFavorite, showAction = true) {
    const visibleTags = show.tags || [];
    const tags = visibleTags.slice(0, 4).map(tag => `<span>${escapeHTML(tag)}</span>`).join('');
    return `<article class="show-card" data-show-card="${escapeHTML(show.id)}">
      ${showImageMarkup(show)}
      <div class="show-card-content">
        <span class="show-type-label">${escapeHTML(show.category || 'Daytime show')}</span>
        <h3>${escapeHTML(show.name)}</h3><p>${escapeHTML(show.description)}</p>
        ${tags ? `<p class="show-cue-label">Style cues</p><div class="show-aesthetic-tags">${tags}</div>` : ''}
        <div class="show-action-row">${showAction ? `<button class="show-card-action" data-toggle-show="${escapeHTML(show.id)}" aria-pressed="${isFavorite}">${isFavorite ? 'Added to my shows ✓' : 'Add to my shows +'}</button>` : ''}<button class="show-card-action" data-open-try-on="${escapeHTML(show.id)}">Try on an outfit</button></div>
        <a class="show-card-action wardrobe-link" href="${escapeHTML(wardrobeSource(show))}" target="_blank" rel="noopener noreferrer">View actual outfits on WornOnTV ↗</a>
      </div></article>`;
  }

  function showRecommendationScore(show) {
    const favoriteShows = state.shows.filter(item => (state.profile.favoriteShows || []).includes(item.id));
    const profileTags = new Set((state.profile.styleTags || []).map(x => String(x).toLowerCase()));
    const profilePatterns = new Set((state.profile.patterns || []).map(x => String(x).toLowerCase()));
    const favoriteCues = new Set(favoriteShows.flatMap(item => item.tags || []).map(x => String(x).toLowerCase()));
    const tags = new Set((show.tags || []).map(x => String(x).toLowerCase()));
    return [...profileTags].filter(tag => tags.has(tag)).length * 3
      + [...profilePatterns].filter(tag => tags.has(tag)).length * 1.5
      + [...favoriteCues].filter(cue => tags.has(cue)).length * 0.75;
  }

  function renderShows(filter = '') {
    const q = filter.trim().toLowerCase();
    if (q !== state.lastShowFilter) {
      state.lastShowFilter = q;
      state.showResultLimit = 24;
    }
    const favorites = new Set(state.profile.favoriteShows || []);
    const visible = [];
    const allTarget = $('#all-shows-grid');
    const newTarget = $('#new-shows-grid');
    const countTarget = $('#show-results-count');
    const loadMore = $('#load-more-shows');
    const filterButtons = $$('[data-show-filter]');
    filterButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.showFilter === state.showListMode)));
    const matchingShows = state.shows.filter(show => {
      const searchable = [show.name, show.category, show.description, ...(show.tags || [])]
        .filter(Boolean).join(' ').toLowerCase();
      return !q || searchable.includes(q);
    });
    const favoriteIds = new Set(state.profile.favoriteShows || []);
    const matchedFavorites = matchingShows.filter(show => favoriteIds.has(show.id));
    const matchedRecommendations = matchingShows.filter(show => !favoriteIds.has(show.id)).sort((a, b) => showRecommendationScore(b) - showRecommendationScore(a));
    visible.length = 0;
    const modeShows = state.showListMode === 'favorites'
      ? matchedFavorites
      : state.showListMode === 'recommended'
        ? matchedRecommendations
        : matchingShows;
    visible.push(...modeShows);
    const shownFiltered = visible.slice(0, state.showResultLimit);
    const heading = $('#show-list-heading');
    if (heading) heading.textContent = state.showListMode === 'favorites'
      ? 'My favourites'
      : state.showListMode === 'recommended' ? 'Recommended for me' : 'All daytime shows';
    if (countTarget) {
      const modeLabel = state.showListMode === 'favorites' ? 'favourite daytime show' : state.showListMode === 'recommended' ? 'daytime-show recommendation' : 'daytime show';
      countTarget.textContent = `${visible.length} ${modeLabel}${visible.length === 1 ? '' : 's'}${q ? ` match “${filter.trim()}”` : ''}.`;
    }
    if (allTarget) {
      const emptyMessage = state.showListMode === 'favorites'
        ? 'You have not added any favourite shows yet. Search for a show and select “Add to my shows”.'
        : state.showListMode === 'recommended'
          ? 'No new daytime-show recommendations match this search. Try another style or title.'
          : 'No daytime shows matched that search. Try a show title, programme type or style.';
      allTarget.innerHTML = shownFiltered.length
        ? shownFiltered.map(show => renderShowCard(show, favorites.has(show.id))).join('')
        : `<div class="no-results">${escapeHTML(emptyMessage)}</div>`;
    }
    if (loadMore) {
      loadMore.hidden = visible.length <= state.showResultLimit;
      loadMore.textContent = `Load more shows (${Math.max(0, visible.length - state.showResultLimit)} remaining)`;
    }
    const newSection = $('#new-shows-section');
    if (newSection) newSection.hidden = state.showListMode !== 'all';
    if (newTarget) {
      const recommendations = state.shows.filter(show => !favorites.has(show.id));
      recommendations.sort((a, b) => showRecommendationScore(b) - showRecommendationScore(a));
      newTarget.innerHTML = recommendations.length
        ? recommendations.slice(0, 4).map(show => renderShowCard(show, false)).join('')
        : '<div class="no-results">You have added every daytime show. Remove a favourite to see more options.</div>';
    }
    bindShowCardImages(allTarget || document);
    bindShowCardImages(newTarget || document);
    if ($('#favorite-shows')) renderFavoriteShows();
  }

  function localShowRecommendations(query = '', focusShow = null) {
    const q = query.trim().toLocaleLowerCase();
    const favoriteIds = new Set(state.profile.favoriteShows || []);
    const profileTags = new Set((state.profile.styleTags || []).map(value => String(value).toLocaleLowerCase()));
    const patterns = new Set((state.profile.patterns || []).map(value => String(value).toLocaleLowerCase()));
    const favoriteCues = new Set(state.shows.filter(show => favoriteIds.has(show.id)).flatMap(show => show.tags || []).map(value => String(value).toLocaleLowerCase()));
    const queryWords = new Set(q.split(/[^a-z0-9]+/).filter(word => word.length > 2 && !['the','and','for','with','show','outfit','outfits','style','styles','looks','look','find','under','below','less','than','budget'].includes(word)));
    const ranked = state.shows.filter(show => focusShow?.id === show.id || !favoriteIds.has(show.id)).map(show => {
      const tags = new Set((show.tags || []).map(value => String(value).toLocaleLowerCase()));
      const searchable = [show.name, show.category, show.description, ...(show.tags || [])].join(' ').toLocaleLowerCase();
      let score = [...profileTags].filter(tag => tags.has(tag)).length * 4
        + [...patterns].filter(tag => tags.has(tag)).length * 2.5
        + [...favoriteCues].filter(tag => tags.has(tag)).length * 1.25
        + [...queryWords].filter(word => tags.has(word) || searchable.includes(word)).length * 2;
      if (q && show.name.toLocaleLowerCase() === q) score += 100;
      else if (q && show.name.toLocaleLowerCase().includes(q)) score += 70;
      if (focusShow?.id === show.id) score += 1000;
      return { show, score };
    }).sort((a, b) => b.score - a.score || a.show.name.localeCompare(b.show.name));
    return ranked.slice(0, 6).map(({ show }) => ({
      ...show,
      wardrobe_url: wardrobeSource(show),
      recommendation_reason: focusShow?.id === show.id
        ? 'You selected this programme. Open its wardrobe page to see documented outfits worn on screen.'
        : 'Selected from your style directions and favourite-show cues. Open WornOnTV for actual outfit records.'
    }));
  }

  function renderWardrobeRecommendations(shows = []) {
    const target = $('#wardrobe-recommendation-grid');
    if (!target) return;
    if (!shows.length) {
      target.innerHTML = '<div class="no-results">No daytime wardrobe sources matched this search. Try a show title or a different style direction.</div>';
      return;
    }
    const favorites = new Set(state.profile.favoriteShows || []);
    target.innerHTML = shows.map(show => {
      const tags = (show.tags || []).slice(0, 4).map(tag => `<span>${escapeHTML(tag)}</span>`).join('');
      const wardrobeUrl = show.wardrobe_url || wardrobeSource(show);
      return `<article class="show-card recommendation-card" data-recommended-show="${escapeHTML(show.id)}">
        ${showImageMarkup(show)}
        <div class="show-card-content">
          <span class="show-type-label">${escapeHTML(show.category || 'Daytime show')}</span>
          <h3>${escapeHTML(show.name)}</h3>
          <p>${escapeHTML(show.recommendation_reason || show.description || 'Explore this programme’s wardrobe.')}</p>
          ${tags ? `<div class="show-aesthetic-tags">${tags}</div>` : ''}
          <div class="show-action-row">
            ${favorites.has(show.id) ? '<span class="show-type-label">In My shows</span>' : `<button class="show-card-action" data-toggle-show="${escapeHTML(show.id)}" aria-pressed="false">Add to My shows +</button>`}
            <button class="show-card-action" data-open-try-on="${escapeHTML(show.id)}">Try on an outfit</button>
          </div>
          <a class="button button-primary wardrobe-primary-link" href="${escapeHTML(wardrobeUrl)}" target="_blank" rel="noopener noreferrer">View actual outfits ↗</a>
          <p class="outfit-source-note">The original outfit records, images, and shopping links open on WornOnTV.</p>
        </div>
      </article>`;
    }).join('');
    bindShowCardImages(target);
  }

  async function requestRecommendations(query = '', focusShow = null) {
    const requestId = ++state.recommendationRequestId;
    const subtitle = $('#recommendation-subtitle');
    const status = $('#recommendation-status');
    const integrationStatus = $('#integration-status');
    if (focusShow && subtitle) {
      subtitle.textContent = `Actual outfit listings for ${focusShow.name}, with related daytime wardrobe sources below.`;
    } else if (subtitle) {
      subtitle.textContent = query
        ? `Daytime wardrobe sources matching “${query}” and your profile.`
        : 'Daytime programmes ranked from your style profile and favourite-show influences.';
    }

    const localResults = localShowRecommendations(query, focusShow);
    renderWardrobeRecommendations(localResults);
    if (status) status.textContent = 'Matching daytime wardrobe sources…';

    const requestBody = {
      query,
      profile: state.profile,
      limit: 6,
      focus_show_id: focusShow?.id || null,
      focus_show_name: focusShow?.name || null,
      focus_show_tags: Array.isArray(focusShow?.tags) ? focusShow.tags : []
    };
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    try {
      const result = await apiFetch('/api/recommendations', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      if (requestId !== state.recommendationRequestId) return;
      const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
      renderWardrobeRecommendations(recommendations.length ? recommendations : localResults);
      if (status) {
        if (result.source === 'gemini') {
          status.textContent = `Gemini (${result.model}) ranked these daytime wardrobe sources. ${result.explanation || ''}`.trim();
        } else if (result.ai_status === 'fallback') {
          status.textContent = `Gemini did not return a usable ranking; profile-based recommendations are shown instead. ${result.explanation || ''}`.trim();
        } else {
          status.textContent = `Profile-based recommendations. ${result.explanation || ''}`.trim();
        }
      }
      if (integrationStatus) {
        const geminiState = result.ai_status === 'used' ? 'Gemini API was used for this result.'
          : result.ai_status === 'fallback' ? 'Gemini is configured, but this result used the profile fallback.'
            : 'Gemini key is not configured; this result uses profile matching.';
        integrationStatus.textContent = `${geminiState} YouCam is used only when you explicitly run virtual try-on or colour analysis; photos are not sent during recommendations.`;
      }
    } catch (error) {
      if (requestId !== state.recommendationRequestId) return;
      renderWardrobeRecommendations(localResults);
      if (status) status.textContent = error.name === 'AbortError'
        ? 'The recommendation endpoint timed out. Showing local profile matches; actual outfit listings are still available through WornOnTV.'
        : 'The recommendation endpoint is unavailable. Showing local profile matches; actual outfit listings are still available through WornOnTV.';
      if (integrationStatus && error.name !== 'AbortError') integrationStatus.textContent = `Recommendation request failed: ${error.message}. YouCam is separate and is only called when you run a photo-based tool.`;
      if (error.name !== 'AbortError') showAlert(error.message || 'Could not contact recommendations; local show matching is available.', 'error');
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function renderSaved() {
    const target = $('#saved-wardrobe-grid');
    const empty = $('#saved-empty');
    if (!target || !empty) return;
    const favoriteIds = new Set(state.profile.favoriteShows || []);
    const savedShows = state.shows.filter(show => favoriteIds.has(show.id));
    target.innerHTML = savedShows.length ? savedShows.map(show => renderShowCard(show, true, false)).join('') : '';
    target.hidden = !savedShows.length;
    empty.hidden = savedShows.length > 0;
    bindShowCardImages(target);
  }

  function switchView(view) {
    if (!$(`[data-view-panel="${view}"]`)) return;
    state.currentView = view;
    $$('.app-view').forEach(panel => {
      const isActive = panel.dataset.viewPanel === view;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
    $$('.side-nav-link').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (view === 'shows') renderShows($('#show-search')?.value || '');
    if (view === 'profile') renderProfileChoices();
    if (view === 'saved') renderSaved();
    if (view === 'discover') {
      renderFavoriteShows();
    }
    $('#app-main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function saveProfileFromForm() {
    const budgetValue = $('#budget').value;
    state.profile = {
      ...state.profile,
      displayName: $('#display-name').value.trim() || 'Demo stylist',
      budget: budgetValue === 'any' ? 'any' : Number(budgetValue),
      boldness: $('#boldness').value,
      notes: $('#fit-notes').value.trim(),
      styleTags: selectedValues('#style-tag-choices input'),
      patterns: selectedValues('#pattern-choices input'),
      colorPreferences: selectedValues('#color-choices input')
    };
  }

  async function saveProfile(e) {
    e?.preventDefault();
    saveProfileFromForm();
    try {
      await persistProfile();
      $('#profile-save-status').textContent = 'Saved to this browser.';
      showAlert('Your style profile has been updated. Recommendations will use your new preferences.', 'good');
      renderProfileChoices();
      renderFavoriteShows();
      renderShows($('#show-search')?.value || '');
      await requestRecommendations('');
    } catch (error) {
      showAlert(`Could not save the profile: ${error.message}`, 'error');
    }
  }

  function runQuizSubmit(event) {
    event.preventDefault();
    state.profile.styleTags = selectedValues('#quiz-style-choices input');
    state.profile.patterns = selectedValues('#quiz-pattern-choices input');
    state.profile.colorPreferences = selectedValues('#quiz-color-choices input');
    state.profile.boldness = selectedValues('#quiz-boldness-choices input')[0] || 'medium';
    const budget = selectedValues('#quiz-budget-choices input')[0] || '80';
    state.profile.budget = budget === 'any' ? 'any' : Number(budget);
    persistProfile().then(async () => {
      renderProfileChoices();
      await requestRecommendations('');
      showAlert('Your quiz answers are saved. Your recommendations have been updated.', 'good');
      switchView('discover');
    }).catch(error => showAlert(`Could not save quiz answers: ${error.message}`, 'error'));
  }

  function changeFavorite(showId) {
    const favorites = new Set(state.profile.favoriteShows || []);
    if (favorites.has(showId)) favorites.delete(showId);
    else favorites.add(showId);
    state.profile.favoriteShows = [...favorites];
    persistProfile().then(async () => {
      renderFavoriteShows();
      renderShows($('#show-search')?.value || '');
      await requestRecommendations('');
      showAlert(favorites.has(showId) ? 'Added to your shows.' : 'Removed from your shows. Your profile has been updated.', 'good');
    }).catch(error => showAlert(`Could not update shows: ${error.message}`, 'error'));
  }

  function openTryOn(showId = null) {
    const show = findShow(showId);
    state.currentShowId = show?.id || null;
    $('#try-on-title').textContent = show ? `Try on an outfit from ${show.name}.` : 'Try on a specific outfit.';
    $('#try-on-product').innerHTML = show
      ? `<div><strong>${escapeHTML(show.name)}</strong><p>Open the official wardrobe page to inspect the documented outfit. For try-on, only use a reference image you own or are authorized to submit for AI processing.</p><a href="${escapeHTML(wardrobeSource(show))}" target="_blank" rel="noopener noreferrer">Open ${escapeHTML(show.name)} outfits on WornOnTV ↗</a></div>`
      : '<div><strong>Use an actual outfit image</strong><p>Choose an image from the wardrobe page for the specific look you want to preview.</p></div>';
    $('#try-on-form').hidden = false;
    $('#try-on-status').hidden = true;
    $('#try-on-result').hidden = true;
    $('#try-on-result').innerHTML = '';
    $('#try-on-photo').value = '';
    $('#try-on-reference-photo').value = '';
    $('#try-on-consent').checked = false;
    const keyNote = $('#try-on-api-note');
    if (keyNote) keyNote.textContent = state.config.youcam_configured
      ? 'YouCam API key is configured. A live Clothes V4 task starts after you submit both images and consent.'
      : 'YouCam is not configured on this deployment. No image will be uploaded until YCE_API_KEY is set on the server and the app is redeployed.';
    const dialog = $('#try-on-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeTryOn() {
    const dialog = $('#try-on-dialog');
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function setTryOnStatus(message, isError = false) {
    const status = $('#try-on-status');
    status.hidden = false;
    status.textContent = message;
    status.style.color = isError ? 'var(--bad)' : 'var(--ink-soft)';
  }

  async function pollTask(kind, taskId, maxAttempts = 24) {
    // Poll at a moderate interval; status requests are idempotent and the user can retry if processing takes longer.
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // YouCam recommends regular task polling; use a 10-second interval to reduce needless requests.
      await new Promise(resolve => window.setTimeout(resolve, 10000));
      const url = `/api/tasks/${kind}/${encodeURIComponent(taskId)}`;
      const result = await apiFetch(url, { method: 'GET' });
      if (result.status === 'success' || result.status === 'error') return result;
      setTryOnStatus(kind === 'try-on' ? 'YouCam is generating your preview. This can take a little while…' : 'YouCam is checking your colour tones…');
    }
    throw new Error('This is taking longer than expected. Close this window and retry the task in a moment.');
  }

  async function submitTryOn(event) {
    event.preventDefault();
    const photo = $('#try-on-photo').files?.[0];
    const outfitReference = $('#try-on-reference-photo').files?.[0];
    if (!photo || !outfitReference) {
      setTryOnStatus('Choose both your photo and the actual outfit reference image.', true);
      return;
    }
    if (!$('#try-on-consent').checked) {
      setTryOnStatus('Consent is required before either image is sent to YouCam.', true);
      return;
    }
    if (!state.config.youcam_configured) {
      setTryOnStatus('Live YouCam is not configured on this deployment. Add YCE_API_KEY to Vercel environment variables and redeploy. Neither image has been uploaded.', true);
      return;
    }
    if (![photo, outfitReference].every(file => ['image/jpeg', 'image/png'].includes(file.type))) {
      setTryOnStatus('Please use JPG or PNG files for both images.', true);
      return;
    }
    if ([photo, outfitReference].some(file => !file.size || file.size > 9_500_000)) {
      setTryOnStatus('Both images must be non-empty and smaller than 9.5 MB each.', true);
      return;
    }
    $('#try-on-form').querySelector('button[type="submit"]').disabled = true;
    setTryOnStatus('Uploading both images to YouCam…');
    try {
      const form = new FormData();
      form.append('photo', photo);
      form.append('outfit_reference', outfitReference);
      form.append('garment_category', 'auto');
      form.append('consent', 'true');
      const task = await apiFetch('/api/try-on', { method: 'POST', body: form });
      const result = await pollTask('try-on', task.task_id);
      if (result.status === 'error') throw new Error(result.message || 'YouCam could not process this outfit. Try images with a clearer view of the clothing.');
      if (!result.result_url) throw new Error(result.message || 'YouCam completed the task without a recognized result image.');
      $('#try-on-result').hidden = false;
      $('#try-on-result').innerHTML = `<img src="${escapeHTML(result.result_url)}" alt="YouCam virtual try-on result using the outfit image you selected"><p>${escapeHTML(result.message || 'Visual preview only. Actual fit and colour may differ.')}</p>`;
      setTryOnStatus('YouCam Clothes V4 completed your virtual try-on.');
    } catch (error) {
      setTryOnStatus(error.message || 'YouCam could not complete the task. Try again.', true);
    } finally {
      $('#try-on-form').querySelector('button[type="submit"]').disabled = false;
    }
  }

  function renderColorAnalysis(colors) {
    const target = $('#color-result');
    if (!target) return;
    if (!colors || typeof colors !== 'object' || !Object.keys(colors).length) {
      target.innerHTML = '<div class="empty-analysis"><span aria-hidden="true">◌</span><strong>Your colour notes will appear here</strong><p>Use these results as inspiration, not rules.</p></div>';
      return;
    }
    const order = ['skin_color', 'hair_color', 'eye_color', 'eyebrow_color', 'lip_color'];
    const labels = { skin_color: 'Skin tone', hair_color: 'Hair colour', eye_color: 'Eye colour', eyebrow_color: 'Eyebrow colour', lip_color: 'Lip colour' };
    const items = order.filter(key => /^#[0-9a-f]{6}$/i.test(colors[key] || '')).map(key => `<div class="detected-color"><span class="detected-color-swatch" style="background:${escapeHTML(colors[key])}"></span><span><strong>${escapeHTML(labels[key])}</strong><small>${escapeHTML(colors[key])}${colors[`${key}_name`] ? ` · ${escapeHTML(colors[`${key}_name`])}` : ''}</small></span></div>`).join('');
    target.innerHTML = `<div class="color-palette-results"><h3>Your colour notes</h3><p>These are the facial colour cues detected by YouCam. Use them as optional styling inspiration; actual on-screen outfits are listed on each show's WornOnTV page.</p><div class="detected-colors">${items || '<p>Analysis completed, but no recognized hex colour values were returned.</p>'}</div></div>`;
  }

  async function runColorAnalysis() {
    const photo = $('#color-photo').files?.[0];
    if (!photo) { showAlert('Choose a front-facing JPG or PNG selfie first.', 'error'); return; }
    if (!$('#color-consent').checked) { showAlert('Please consent before sending your selfie to YouCam.', 'error'); return; }
    if (!state.config.youcam_configured) { showAlert('Live YouCam is not configured. Add YCE_API_KEY in Vercel settings. Your photo has not been uploaded.', 'error'); return; }
    if (!['image/jpeg', 'image/png'].includes(photo.type)) { showAlert('Please use a JPG or PNG image.', 'error'); return; }
    if (photo.size > 9_500_000) { showAlert('Choose an image smaller than 9.5 MB.', 'error'); return; }
    const button = $('#run-color-analysis');
    button.disabled = true;
    button.textContent = 'Analyzing…';
    const target = $('#color-result');
    target.innerHTML = '<div class="empty-analysis"><span aria-hidden="true">◌</span><strong>Analysis in progress</strong><p>Keep this page open while YouCam processes the photo.</p></div>';
    try {
      const form = new FormData();
      form.append('photo', photo);
      form.append('consent', 'true');
      const task = await apiFetch('/api/color-analysis', { method: 'POST', body: form });
      const result = await pollTask('color', task.task_id);
      if (result.status === 'error') throw new Error(result.message || 'Colour analysis could not be completed.');
      state.profile.colorAnalysis = result.colors || {};
      await persistProfile();
      renderColorAnalysis(state.profile.colorAnalysis);
      showAlert('Colour analysis completed. Your colour notes are saved in this browser; the photo is not.', 'good');
    } catch (error) {
      target.innerHTML = `<div class="empty-analysis"><span aria-hidden="true">!</span><strong>We couldn't complete the analysis</strong><p>${escapeHTML(error.message)}</p></div>`;
    } finally {
      button.disabled = false;
      button.textContent = 'Analyze my colour tones';
    }
  }

  function buildQuizFromProfile() {
    renderProfileChoices();
  }

  function attachEvents() {
    document.addEventListener('click', async event => {
      const viewButton = event.target.closest('[data-view], [data-go-view]');
      if (viewButton) {
        const view = viewButton.dataset.view || viewButton.dataset.goView;
        if (view) switchView(view);
        if (viewButton.dataset.focusNewShows === 'true') {
          state.showListMode = 'recommended';
          renderShows($('#show-search')?.value || '');
          $('#all-shows-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
      const tryOnButton = event.target.closest('[data-open-try-on]');
      if (tryOnButton) { openTryOn(tryOnButton.dataset.openTryOn || null); return; }
      const toggleButton = event.target.closest('[data-toggle-show]');
      if (toggleButton) { await changeFavorite(toggleButton.dataset.toggleShow); return; }
      if (event.target.closest('.dialog-close')) closeTryOn();
    });

    $('.theme-toggle')?.addEventListener('click', async () => {
      state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
      applySettings();
      await saveSettings();
    });
    $$('[data-font]').forEach(button => button.addEventListener('click', async () => {
      state.settings.fontSize = button.dataset.font;
      applySettings();
      await saveSettings();
    }));

    $('#style-search-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const query = $('#style-search').value.trim();
      const normalizedQuery = query.toLocaleLowerCase();
      const focusShow = state.shows
        .filter(show => show.name && normalizedQuery.includes(show.name.toLocaleLowerCase()))
        .sort((a, b) => b.name.length - a.name.length)[0] || null;
      await requestRecommendations(query, focusShow);
    });
    $$('[data-show-filter]').forEach(button => button.addEventListener('click', () => {
      state.showListMode = button.dataset.showFilter || 'all';
      state.showResultLimit = 24;
      renderShows($('#show-search')?.value || '');
    }));
    $('#show-search')?.addEventListener('input', event => renderShows(event.target.value));
    $('#clear-show-search')?.addEventListener('click', () => { $('#show-search').value = ''; renderShows(''); $('#show-search').focus(); });
    $('#load-more-shows')?.addEventListener('click', () => {
      state.showResultLimit += 24;
      // Preserve the current query and render the next page of matching shows.
      const q = $('#show-search')?.value || '';
      state.lastShowFilter = q.trim().toLowerCase();
      renderShows(q);
    });
    $('#profile-form')?.addEventListener('submit', saveProfile);
    $('#save-profile-top')?.addEventListener('click', saveProfile);
    $('#quiz-form')?.addEventListener('submit', runQuizSubmit);
    $('#try-on-form')?.addEventListener('submit', submitTryOn);
    $('#run-color-analysis')?.addEventListener('click', runColorAnalysis);
    $('#open-walkthrough')?.addEventListener('click', openWalkthrough);
    $('#walkthrough-back')?.addEventListener('click', () => { walkthroughIndex = Math.max(0, walkthroughIndex - 1); renderWalkthroughStep(); });
    $('#walkthrough-next')?.addEventListener('click', async () => {
      const count = $$('.walkthrough-panel').length;
      if (walkthroughIndex >= count - 1) await closeWalkthrough(true);
      else { walkthroughIndex += 1; renderWalkthroughStep(); }
    });
    $('#walkthrough-skip')?.addEventListener('click', () => closeWalkthrough(true));
    $('#close-walkthrough')?.addEventListener('click', () => closeWalkthrough(true));
    $('#try-on-dialog')?.addEventListener('click', event => { if (event.target === $('#try-on-dialog')) closeTryOn(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('#try-on-dialog')?.open) closeTryOn(); });
  }

  function renderProviderStatus() {
    const target = $('#integration-status');
    if (!target) return;
    const geminiText = state.config.gemini_configured
      ? `Gemini key configured (${state.config.gemini_model || 'configured model'}); each search reports whether the Gemini ranker returned a valid result.`
      : 'Gemini key is not configured; show recommendations use the local profile matcher.';
    const youcamText = state.config.youcam_configured
      ? 'YouCam key is configured; Clothes V4 and facial colour-tone analysis run only when you submit a photo task and consent.'
      : 'YouCam key is not configured; photo-based tools will not upload images or return mock results.';
    target.textContent = `${geminiText} ${youcamText}`;
  }

  async function init() {
    // Wire interactions immediately and load IndexedDB independently from the show directory.
    attachEvents();
    const localStatePromise = (async () => {
      try {
        state.db = await openDatabase();
        await loadLocalState();
        // Apply saved preferences and refresh the current show recommendations after storage resolves.
        if (state.shows.length) {
          migrateFavoriteShows();
          renderProfileChoices();
          renderFavoriteShows();
          renderShows($('#show-search')?.value || '');
          renderSaved();
          requestRecommendations($('#style-search')?.value.trim() || '');
        }
      } catch (error) {
        showAlert(`${error.message} Local preferences may not persist in this browser.`, 'error');
      }
    })();

    try {
      // The daytime-show directory is curated locally and links out to WornOnTV.
      // Discovery never waits for an external show catalogue.
      const [catalog, config] = await Promise.all([
        apiFetch('/api/catalog', { method: 'GET' }),
        apiFetch('/api/config', { method: 'GET' })
      ]);
      state.shows = catalog.shows || [];
      if (migrateFavoriteShows() && state.db) await persistProfile();
      state.catalogueMeta = catalog.catalogue || null;
      state.config = config;
      const findButton = $('#find-looks-button');
      if (findButton) {
        findButton.disabled = false;
        findButton.textContent = 'Find my looks →';
      }
      renderProfileChoices();
      renderFavoriteShows();
      renderShows($('#show-search')?.value || '');
      renderSaved();
      renderProviderStatus();
      requestRecommendations($('#style-search')?.value.trim() || '');
      buildQuizFromProfile();
      if (!state.settings.walkthroughSeen) openWalkthrough();
    } catch (error) {
      const findButton = $('#find-looks-button');
      if (findButton) {
        findButton.disabled = false;
        findButton.textContent = 'Find my looks →';
      }
      renderProviderStatus();
      showAlert(error.message || 'Could not load styleTV data.', 'error');
    }
    // Do not await storage before enabling search. Storage can finish after the
    // first render and refresh preferences once available.
    void localStatePromise;
  }

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
