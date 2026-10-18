(() => {
  'use strict';

  const DB_NAME = 'mystyle-db';
  const DB_VERSION = 3;
  const PROFILE_KEY = 'my-profile';
  const SETTINGS_KEY = 'display-settings';
  const DEFAULT_PROFILE = {
    displayName: 'myStyle Member', country: 'CA', city: 'Toronto', region: 'Ontario', genderPreference: 'all', hasCompletedQuiz: false,
    season: 'auto', climate: 'variable', budget: 100, fitPreference: 'balanced',
    sizeTop: '', sizeBottom: '', sizeShoe: '', notes: '',
    styleTags: ['classic', 'casual'], occasions: ['everyday', 'work'],
    colorScheme: 'earth', customColors: '', colorPreferences: [], skinAnalysis: null, skinAnalysisApplied: false,
    savedItemIds: [], notForMeItemIds: []
  };
  const BUDGETS = [
    ['25', 'Up to 25'], ['40', 'Up to 40'], ['50', 'Up to 50'], ['60', 'Up to 60'],
    ['75', 'Up to 75'], ['80', 'Up to 80'], ['100', 'Up to 100'], ['125', 'Up to 125'],
    ['150', 'Up to 150'], ['200', 'Up to 200'], ['250', 'Up to 250'], ['300', 'Up to 300'],
    ['any', 'No fixed budget']
  ];
  const state = {
    db: null, profile: structuredClone(DEFAULT_PROFILE), settings: { theme: 'light', fontSize: 'medium' },
    catalog: { items: [], palettes: [], styles: [], occasions: [] }, config: {},
    recommendations: [], accessoryRecommendations: [], lastQuery: '', requestId: 0, currentView: 'discover', recommendationsLoading: false, queuedRecommendation: null, activeEnsembleTab: 'clothing', cachedImages: { skinAnalysis: null, tryOn: null }, photoPreviewUrls: { skinAnalysis: null, tryOn: null }, wardrobeItems: [], wardrobeFilter: 'all', wardrobeObjectUrls: [], walkthroughStep: 0
  };
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const csrfToken = $('meta[name="csrf-token"]')?.content || '';
  const COUNTRY = () => state.profile.country === 'US' ? 'US' : 'CA';
  const CURRENCY = () => COUNTRY() === 'US' ? 'USD' : 'CAD';

  function normalizeGenderPreference(value) {
    const gender = String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (['men', 'male', 'man', 'mens', "men's", 'masculine'].includes(gender)) return 'men';
    if (['women', 'female', 'woman', 'womens', "women's", 'feminine'].includes(gender)) return 'women';
    if (['unisex', 'gender neutral', 'gender-neutral', 'nonbinary', 'non-binary'].includes(gender)) return 'unisex';
    return 'all';
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('Local browser storage is not available.'));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('wardrobe')) db.createObjectStore('wardrobe', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open your local profile.'));
    });
  }

  function dbRequest(storeName, method, value) {
    return new Promise((resolve, reject) => {
      if (!state.db) return reject(new Error('Local profile storage is not ready.'));
      const readOnly = method === 'get' || method === 'getAll';
      const tx = state.db.transaction(storeName, readOnly ? 'readonly' : 'readwrite');
      const store = tx.objectStore(storeName);
      const request = method === 'get' ? store.get(value) : method === 'getAll' ? store.getAll() : method === 'delete' ? store.delete(value) : store.put(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('A local profile operation failed.'));
    });
  }

  async function loadLocalState() {
    const profileRow = await dbRequest('profile', 'get', PROFILE_KEY);
    if (profileRow?.value) {
      state.profile = { ...structuredClone(DEFAULT_PROFILE), ...profileRow.value };
      const stored = profileRow.value;
      // Old local profiles may store "male" / "female" while the current controls
      // use "men" / "women". Normalize and persist so the UI and ranker agree.
      const normalizedGender = normalizeGenderPreference(state.profile.genderPreference);
      if (state.profile.genderPreference !== normalizedGender) {
        state.profile.genderPreference = normalizedGender;
        await persistProfile();
      }
      // Existing local profiles belong to returning users. New profiles have no row and
      // remain routed through the quiz until they submit it.
      if (stored.hasCompletedQuiz === undefined) {
        state.profile.hasCompletedQuiz = true;
        await persistProfile();
      }
      const hasSavedSkinColour = typeof state.profile.skinAnalysis?.skin_color === 'string'
        && /^#[0-9a-f]{6}$/i.test(state.profile.skinAnalysis.skin_color);
      // Migrate profiles created before skin analysis was wired into the palette choice.
      // Only migrate the old default palette; preserve explicit non-default choices.
      if (hasSavedSkinColour && stored.skinAnalysisApplied === undefined && state.profile.colorScheme === 'earth') {
        state.profile.colorScheme = 'selfie';
        state.profile.skinAnalysisApplied = true;
        await persistProfile();
      }
    }
    const settingsRow = await dbRequest('settings', 'get', SETTINGS_KEY);
    if (settingsRow?.value) state.settings = { ...state.settings, ...settingsRow.value };
    state.wardrobeItems = await dbRequest('wardrobe', 'getAll');
    state.wardrobeItems.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    // Keep saved/disliked IDs valid for this version of the curated style catalogue.
    if (!Array.isArray(state.profile.savedItemIds)) state.profile.savedItemIds = [];
    if (!Array.isArray(state.profile.notForMeItemIds)) state.profile.notForMeItemIds = [];
    applySettings();
  }

  async function persistProfile() {
    await dbRequest('profile', 'put', { key: PROFILE_KEY, value: state.profile, updatedAt: new Date().toISOString() });
  }
  async function saveSettings() { await dbRequest('settings', 'put', { key: SETTINGS_KEY, value: state.settings }); }

  async function rememberPhoto(key, file) {
    if (!file || !['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose a JPG or PNG image.');
    if (!file.size || file.size > 9_500_000) throw new Error('Choose an image smaller than 9.5 MB.');
    const blob = file.slice(0, file.size, file.type);
    await dbRequest('images', 'put', { key, blob, name: file.name || `${key}.jpg`, type: file.type, lastModified: file.lastModified || Date.now(), updatedAt: new Date().toISOString() });
    state.cachedImages[key] = file;
    renderStoredPhoto(key);
  }

  async function loadCachedPhotos() {
    for (const key of ['skinAnalysis', 'tryOn']) {
      const row = await dbRequest('images', 'get', key);
      if (row?.blob) state.cachedImages[key] = new File([row.blob], row.name || `${key}.jpg`, { type: row.type || row.blob.type || 'image/jpeg', lastModified: row.lastModified || Date.now() });
      renderStoredPhoto(key);
    }
  }

  function renderStoredPhoto(key) {
    const target = $(`#${key === 'skinAnalysis' ? 'skin-photo-memory' : 'try-on-photo-memory'}`);
    const file = state.cachedImages[key];
    if (!target) return;
    if (state.photoPreviewUrls[key]) URL.revokeObjectURL(state.photoPreviewUrls[key]);
    state.photoPreviewUrls[key] = null;
    if (!file) { target.replaceChildren(); return; }
    const url = URL.createObjectURL(file);
    state.photoPreviewUrls[key] = url;
    const alt = key === 'skinAnalysis' ? 'Previously selected selfie' : 'Previously selected virtual try-on photo';
    const message = key === 'skinAnalysis' ? 'Saved selfie ready for skin analysis. It will be reused unless you choose another image.' : 'Saved try-on photo ready. It will be reused unless you choose another image.';
    target.innerHTML = `<div class="stored-photo-row"><img src="${url}" alt="${alt}"><p><strong>${escapeHTML(file.name || 'Saved photo')}</strong><span>${escapeHTML(message)}</span></p></div>`;
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
    el.focus?.({ preventScroll: true });
    window.clearTimeout(showAlert.timeout);
    showAlert.timeout = window.setTimeout(() => { el.hidden = true; }, 7500);
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

  function selectedValues(selector) { return $$(selector).filter(input => input.checked).map(input => input.value); }

  function makeChoiceInputs(containerSelector, options, name, selected, multiple = true) {
    const container = $(containerSelector);
    if (!container) return;
    const selectedSet = new Set((selected || []).map(String));
    container.innerHTML = options.map(([value, label]) => {
      const checked = selectedSet.has(String(value)) ? ' checked' : '';
      const type = multiple ? 'checkbox' : 'radio';
      const id = `${name}-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      return `<label class="choice-chip" for="${escapeHTML(id)}"><input id="${escapeHTML(id)}" name="${escapeHTML(name)}" value="${escapeHTML(value)}" type="${type}"${checked}><span>${escapeHTML(label)}</span></label>`;
    }).join('');
  }

  function currencyLabel() { return COUNTRY() === 'US' ? '$ USD' : '$ CAD'; }
  function renderBudgetOptions() {
    const options = BUDGETS.map(([value, label]) => `<option value="${value}">${value === 'any' ? label : `${label} ${CURRENCY()}`}</option>`).join('');
    ['#profile-budget', '#quiz-budget'].forEach(selector => {
      const el = $(selector);
      if (!el) return;
      const old = selector === '#profile-budget' ? String(state.profile.budget ?? 'any') : el.value;
      el.innerHTML = options;
      el.value = BUDGETS.some(([v]) => v === old) ? old : (BUDGETS.some(([v]) => v === String(state.profile.budget)) ? String(state.profile.budget) : 'any');
    });
  }

  function renderPaletteSelect() {
    const paletteChoices = state.catalog.palettes.map(p => [p.id, p.label]);
    const paletteOptions = state.catalog.palettes.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.label)}</option>`).join('');
    const quick = $('#quick-color-scheme');
    if (quick) { quick.innerHTML = paletteOptions; quick.value = state.profile.colorScheme || 'earth'; }
    makeChoiceInputs('#profile-palette-choices', paletteChoices, 'profilePalette', [state.profile.colorScheme || 'earth'], false);
    makeChoiceInputs('#quiz-palette-choices', paletteChoices, 'quizPalette', [state.profile.colorScheme || 'earth'], false);
  }

  function renderProfileChoices() {
    makeChoiceInputs('#profile-style-choices', state.catalog.styles, 'profileStyle', state.profile.styleTags || []);
    makeChoiceInputs('#quiz-style-choices', state.catalog.styles, 'quizStyle', state.profile.styleTags || []);
    makeChoiceInputs('#profile-occasion-choices', state.catalog.occasions, 'profileOccasion', state.profile.occasions || []);
    makeChoiceInputs('#quiz-occasion-choices', state.catalog.occasions, 'quizOccasion', state.profile.occasions || []);
    renderPaletteSelect();
    renderBudgetOptions();
    const setValue = (selector, value, fallback = '') => { const el = $(selector); if (el) el.value = value ?? fallback; };
    setValue('#display-name', state.profile.displayName, 'myStyle Member');
    setValue('#profile-country', state.profile.country, 'CA');
    setValue('#profile-gender-preference', state.profile.genderPreference, 'all');
    setValue('#quiz-gender-preference', state.profile.genderPreference, 'all');
    setValue('#profile-city', state.profile.city);
    setValue('#profile-region', state.profile.region);
    setValue('#profile-season', state.profile.season, 'auto');
    setValue('#profile-climate', state.profile.climate, 'variable');
    setValue('#profile-budget', String(state.profile.budget ?? 'any'), 'any');
    setValue('#profile-fit', state.profile.fitPreference, 'balanced');
    setValue('#size-top', state.profile.sizeTop);
    setValue('#size-bottom', state.profile.sizeBottom);
    setValue('#size-shoe', state.profile.sizeShoe);
    setValue('#fit-notes', state.profile.notes);
    setValue('#profile-custom-colors', state.profile.customColors);
    setValue('#profile-colour-notes', state.profile.colourNotes);
    setValue('#quick-color-scheme', state.profile.colorScheme || 'earth');
    setValue('#quick-custom-colors', state.profile.customColors);
    setValue('#quiz-custom-colors', state.profile.customColors);
    updateUserIdentity();
  }

  function updateUserIdentity() {
    const name = (state.profile.displayName || 'myStyle Member').trim();
    const userName = $('.user-name');
    if (userName) userName.textContent = name;
  }

  function seasonForNow() {
    const month = new Date().getMonth() + 1;
    if ([12, 1, 2].includes(month)) return 'winter';
    if ([3, 4, 5].includes(month)) return 'spring';
    if ([6, 7, 8].includes(month)) return 'summer';
    return 'fall';
  }
  function activeSeason() { return state.profile.season && state.profile.season !== 'auto' ? state.profile.season : seasonForNow(); }
  const SEASON_NAMES = { spring: 'Spring', summer: 'Summer', fall: 'Fall / autumn', winter: 'Winter' };
  function updateSeasonDetails(meta = {}) {
    const season = meta.season || activeSeason();
    const seasonName = meta.season_label || SEASON_NAMES[season] || 'Seasonal';
    const climateName = meta.climate_label || ({ cold: 'Cold-weather layers', variable: 'Variable-weather layers', mild: 'Mild-climate dressing', warm: 'Warm-weather pieces' }[state.profile.climate] || 'Season-aware');
    const location = [state.profile.city, state.profile.region, COUNTRY() === 'CA' ? 'Canada' : 'United States'].filter(Boolean).join(', ');
    const heroLabel = $('#hero-season-label');
    if (heroLabel) heroLabel.textContent = `${seasonName} recommendations for you`;
    const seasonPill = $('#season-weather-pill');
    if (seasonPill) seasonPill.textContent = `${seasonName} · ${climateName}`;
    const regionCopy = $('#region-season-copy');
    if (regionCopy) regionCopy.textContent = location || 'United States and Canada';
    const sidebarSeason = $('#sidebar-season');
    if (sidebarSeason) sidebarSeason.textContent = seasonName;
    const sidebarNote = $('#sidebar-season-note');
    if (sidebarNote) sidebarNote.textContent = climateName;
    const palette = state.catalog.palettes.find(p => p.id === state.profile.colorScheme);
    const paletteLabel = $('#hero-palette-label');
    if (paletteLabel) paletteLabel.textContent = palette?.label || state.profile.customColors || 'Your palette, your rules';
    const swatches = $('#hero-palette-swatches');
    if (swatches) {
      const custom = (state.profile.customColors || '').split(/[;,/]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const family = state.profile.colorScheme === 'cool' ? ['#24354c', '#d2d9e2', '#6f8196', '#eef0ed', '#728a9c']
        : state.profile.colorScheme === 'jewel' ? ['#183f37', '#243f76', '#7e3048', '#613e78', '#dabf76']
          : state.profile.colorScheme === 'pastel' ? ['#ead5d5', '#cad9e8', '#ddd5ef', '#d0e0d6', '#f4eee0']
            : state.profile.colorScheme === 'bright' ? ['#ce384b', '#215db4', '#e4b524', '#df71a7', '#186f66']
              : state.profile.colorScheme === 'monochrome' ? ['#111318', '#555960', '#aeb1b7', '#e5e4df', '#ffffff']
                : ['#f0e3cc', '#b96a46', '#66734c', '#9b7d61', '#353a38'];
      swatches.innerHTML = family.map(hex => `<i style="background:${hex}"></i>`).join('');
      if (custom.length) paletteLabel.textContent = `Your colours: ${custom.slice(0, 4).join(', ')}`;
    }
  }

  function findItem(id) { return state.catalog.items.find(item => item.id === id); }
  function money(amount, currency = CURRENCY()) {
    if (amount === null || amount === undefined) return 'No fixed target';
    return new Intl.NumberFormat(COUNTRY() === 'US' ? 'en-US' : 'en-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  }
  const COLOR_HEX = {
    black: '#202124', stone: '#bcb4a6', white: '#f8f7f2', cream: '#eee5d4', 'soft white': '#f5f3ec', oatmeal: '#c6b59b', grey: '#898e95', gray: '#898e95', charcoal: '#44474e', navy: '#27384f', 'ink blue': '#263c57', slate: '#7f8996', burgundy: '#743846', berry: '#a53d60', rust: '#b76340', olive: '#69724b', sage: '#9eae99', camel: '#b38b63', taupe: '#9a8a7b', sand: '#d2b995', ecru: '#e7dcc6', 'forest green': '#345745', 'light blue': '#9fb9cc', indigo: '#3e5479', 'washed black': '#343438', 'sky blue': '#91bad3', 'bright red': '#c93643', cobalt: '#255cc5', blush: '#e5bfc3', lavender: '#c5b6db', plum: '#663c63', emerald: '#246b54', teal: '#287f83', brown: '#76533d', chocolate: '#56382f', tan: '#ba9268', pink: '#d992a3', floral: '#c58b8e', ivory: '#f5f0e2', silver: '#a6aaae', gold: '#c4a05e', 'soft white': '#f5f3ec', 'denim blue': '#587794', 'warm cream': '#eee4d1', terracotta: '#b76340', 'icy blue': '#c7e1f0', 'cool grey': '#a5a8ad'
  };
  function colorHex(color) { const key = String(color).toLowerCase(); return COLOR_HEX[key] || '#b4b5b0'; }

  function shopUrl(item) {
    const host = COUNTRY() === 'CA' ? 'https://www.google.ca/search' : 'https://www.google.com/search';
    const url = new URL(host);
    url.searchParams.set('tbm', 'shop');
    url.searchParams.set('q', `${item.shop_query} ${CURRENCY()}`);
    url.searchParams.set('gl', COUNTRY() === 'CA' ? 'ca' : 'us');
    url.searchParams.set('hl', 'en');
    return url.toString();
  }

  function renderStyleCard(item, savedView = false) {
    const saved = (state.profile.savedItemIds || []).includes(item.id);
    const swatches = (item.colors || []).slice(0, 5).map(color => `<span class="style-color-swatch" style="background:${colorHex(color)}" title="${escapeHTML(color)}" aria-label="${escapeHTML(color)}"></span>`).join('');
    const seasonBadge = item.season_match ? `${SEASON_NAMES[activeSeason()] || 'Seasonal'} pick` : 'Versatile piece';
    const targetPrice = item.target_price ?? (COUNTRY() === 'US' ? item.target_usd : item.target_cad);
    const shop = shopUrl(item);
    const tags = [...(item.style_tags || []).slice(0, 3), item.category].map(tag => `<span>${escapeHTML(tag)}</span>`).join('');
    return `<article class="style-card" data-item-card="${escapeHTML(item.id)}">
      <div class="style-card-media" data-image-state="loading"><img data-style-image src="${escapeHTML(item.image_url)}" alt="Illustration of ${escapeHTML(item.name)}, shown in ${(item.colors || []).slice(0, 3).map(escapeHTML).join(" and ")}" loading="lazy" decoding="async"><div class="style-image-fallback"><span>myStyle inspiration</span><strong>${escapeHTML(item.name)}</strong></div><span class="style-card-season">${escapeHTML(seasonBadge)}</span><button class="save-style-button" data-save-item="${escapeHTML(item.id)}" type="button" aria-pressed="${String(saved)}" aria-label="${saved ? 'Remove from' : 'Save to'} my saved pieces">${saved ? '♥' : '♡'}</button></div>
      <div class="style-card-content"><div class="style-card-kicker"><span>${escapeHTML(item.category)}</span><span class="budget-target">Budget guide ${escapeHTML(money(targetPrice, item.currency || CURRENCY()))}</span></div><h3>${escapeHTML(item.name)}</h3><p class="style-card-description">${escapeHTML(item.description)}</p><p class="style-match-reason">${escapeHTML(item.recommendation_reason || 'A versatile option for your wardrobe.')}</p><div class="style-card-swatches" aria-label="Colour ideas">${swatches}<span>${escapeHTML((item.colors || []).slice(0, 3).join(' · '))}</span></div><div class="style-card-tags">${tags}</div><div class="style-card-actions"><a class="button button-primary" href="${escapeHTML(shop)}" target="_blank" rel="noopener noreferrer">Shop similar ↗</a>${`<button class="button button-outline" data-view="wardrobe" type="button">Add your item in My wardrobe</button>`}${savedView ? '' : `<button class="button button-outline" data-not-for-me="${escapeHTML(item.id)}" type="button">Not for me</button>`}</div></div>
    </article>`;
  }

  function bindStyleImages(root = document) {
    $$('img[data-style-image]', root).forEach(img => {
      if (img.dataset.bound === '1') return;
      img.dataset.bound = '1';
      const parent = img.closest('.style-card-media');
      const setState = stateName => parent?.setAttribute('data-image-state', stateName);
      img.addEventListener('load', () => setState('loaded'), { once: true });
      img.addEventListener('error', () => setState('error'), { once: true });
      if (img.complete) setState(img.naturalWidth ? 'loaded' : 'error');
    });
  }

  function renderRecommendations(items) {
    const grid = $('#recommendation-grid');
    if (!grid) return;
    if (!items.length) {
      const budget = state.profile.budget === 'any' ? 'your current filters' : `a ${money(Number(state.profile.budget))} per-piece target`;
      grid.innerHTML = `<div class="no-results mystyle-no-results"><strong>No pieces matched ${escapeHTML(budget)}.</strong><p>Try widening your budget, changing the colour scheme, or removing a “Not for me” response.</p><button class="button button-outline" type="button" data-reset-dislikes="true">Reset hidden feedback</button></div>`;
      return;
    }
    grid.innerHTML = items.map(item => renderStyleCard(item, false)).join('');
    bindStyleImages(grid);
  }

  function renderAccessories(items) {
    const grid = $('#accessory-grid');
    const empty = $('#accessory-empty-state');
    const status = $('#accessory-status');
    const summary = $('#accessory-palette-summary');
    const guide = skinPaletteGuide(state.profile.skinAnalysis);
    if (!grid || !empty) return;
    if (!guide) {
      empty.hidden = false;
      grid.hidden = true;
      grid.replaceChildren();
      if (summary) summary.hidden = true;
      if (status) status.textContent = 'Complete skin analysis to personalise accessories.';
      return;
    }
    empty.hidden = true;
    grid.hidden = false;
    if (summary) {
      const colour = state.profile.skinAnalysis?.skin_color || '';
      summary.hidden = false;
      summary.innerHTML = `<span class="accessory-skin-swatch" style="background:${escapeHTML(colour)}"></span><div><strong>${escapeHTML(guide.label)}</strong><p>Skin colour detected: ${escapeHTML(colour)}. Suggested accent colours: ${escapeHTML(guide.colors.join(', '))}.</p><small>Colour suggestions are approximate styling inspiration, not rules.</small></div>`;
    }
    if (status) status.textContent = items.length ? `${items.length} accessory ideas matched to your skin-analysis colour cues` : 'No accessories match the current season or budget. Adjust your profile and refresh.';
    if (!items.length) {
      grid.innerHTML = '<div class="no-results"><strong>No accessory matches found.</strong><p>Try adjusting your budget or season in Style profile.</p></div>';
      return;
    }
    grid.innerHTML = items.map(item => renderStyleCard(item, false)).join('');
    bindStyleImages(grid);
  }

  function switchEnsembleTab(tab) {
    state.activeEnsembleTab = tab === 'accessories' ? 'accessories' : 'clothing';
    $$('[data-ensemble-tab]').forEach(button => {
      const active = button.dataset.ensembleTab === state.activeEnsembleTab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $$('[data-ensemble-panel]').forEach(panel => { panel.hidden = panel.dataset.ensemblePanel !== state.activeEnsembleTab; });
    if (state.activeEnsembleTab === 'accessories') renderAccessories(state.accessoryRecommendations);
  }

  function renderSaved() {
    const grid = $('#saved-grid');
    if (!grid) return;
    const savedIds = state.profile.savedItemIds || [];
    const items = savedIds.map(findItem).filter(Boolean).map(item => {
      const fromRec = state.recommendations.find(x => x.id === item.id);
      if (fromRec) return fromRec;
      return { ...item, target_price: COUNTRY() === 'US' ? item.target_usd : item.target_cad, currency: CURRENCY(), recommendation_reason: 'Saved to your personal shortlist.', season_match: (item.seasons || []).includes(activeSeason()) };
    });
    grid.innerHTML = items.map(item => renderStyleCard(item, true)).join('');
    bindStyleImages(grid);
    $('#saved-empty').hidden = items.length > 0;
    $('#saved-count').textContent = String(items.length);
  }


  function updateWardrobeCategoryOptions() {
    const type = $('#wardrobe-item-type')?.value || 'clothing';
    const select = $('#wardrobe-category');
    if (!select) return;
    const options = $$('option[data-wardrobe-type]', select);
    options.forEach(option => {
      const allowed = option.dataset.wardrobeType === type;
      option.hidden = !allowed;
      option.disabled = !allowed;
    });
    if (select.selectedOptions[0]?.disabled || select.selectedOptions[0]?.hidden) {
      select.value = options.find(option => option.dataset.wardrobeType === type)?.value || '';
    }
  }

  function wardrobeTryOnKind(item) {
    if (item.item_type === 'clothing') return 'clothing';
    const category = String(item.category || '').toLowerCase();
    if (category.includes('bag') || category.includes('leather goods')) return 'bag';
    if (category.includes('hat')) return 'hat';
    if (category.includes('scarf')) return 'scarf';
    if (category.includes('shoe')) return 'shoes';
    return '';
  }

  function updateWardrobeCount() {
    const count = $('#wardrobe-count');
    if (count) count.textContent = String(state.wardrobeItems.length);
    const status = $('#wardrobe-count-copy');
    if (status) status.textContent = `${state.wardrobeItems.length} ${state.wardrobeItems.length === 1 ? 'piece' : 'pieces'} in your wardrobe`;
  }

  function renderWardrobe() {
    const grid = $('#wardrobe-grid');
    const empty = $('#wardrobe-empty');
    if (!grid || !empty) return;
    state.wardrobeObjectUrls.forEach(url => URL.revokeObjectURL(url));
    state.wardrobeObjectUrls = [];
    updateWardrobeCount();
    const items = state.wardrobeItems.filter(item => state.wardrobeFilter === 'all' || item.item_type === state.wardrobeFilter);
    $$('[data-wardrobe-filter]').forEach(button => {
      const active = button.dataset.wardrobeFilter === state.wardrobeFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    empty.hidden = items.length > 0;
    grid.hidden = items.length === 0;
    if (!items.length) { grid.replaceChildren(); return; }
    grid.innerHTML = items.map(item => {
      const url = URL.createObjectURL(item.imageBlob);
      state.wardrobeObjectUrls.push(url);
      const colours = (item.colors || []).map(colour => escapeHTML(colour)).join(' · ');
      const season = item.season && item.season !== 'all' ? item.season[0].toUpperCase() + item.season.slice(1) : 'All seasons';
      const canTry = Boolean(wardrobeTryOnKind(item));
      return `<article class="wardrobe-card" data-wardrobe-card="${escapeHTML(item.id)}">
        <div class="wardrobe-card-media"><img src="${url}" alt="Your photo of ${escapeHTML(item.name)}" loading="lazy" decoding="async"><span class="wardrobe-type-label">${item.item_type === 'accessory' ? 'Accessory' : 'Clothing'}</span></div>
        <div class="wardrobe-card-content"><p class="wardrobe-card-category">${escapeHTML(item.category)} · ${escapeHTML(season)}</p><h3>${escapeHTML(item.name)}</h3>${colours ? `<p class="wardrobe-colours">${colours}</p>` : ''}${item.notes ? `<p class="wardrobe-notes">${escapeHTML(item.notes)}</p>` : ''}
          <div class="wardrobe-card-actions">${canTry ? `<button class="button button-primary" data-try-on="${escapeHTML(item.id)}" type="button">Try on</button>` : '<span class="small-note">Virtual try-on is not available for this accessory type yet.</span>'}<button class="button button-outline" data-delete-wardrobe-item="${escapeHTML(item.id)}" type="button">Remove</button></div>
        </div></article>`;
    }).join('');
  }

  async function addWardrobeItem(event) {
    event?.preventDefault?.();
    const form = $('#wardrobe-form');
    const file = $('#wardrobe-photo')?.files?.[0];
    if (!file) { showAlert('Choose a photo of the clothing or accessory you want to add.', 'error'); return; }
    if (!['image/jpeg', 'image/png'].includes(file.type)) { showAlert('Use a JPG or PNG photo.', 'error'); return; }
    if (!file.size || file.size > 9_500_000) { showAlert('Choose a photo smaller than 9.5 MB.', 'error'); return; }
    const submit = $('#wardrobe-add-button');
    if (submit?.disabled) return;
    if (submit) { submit.disabled = true; submit.textContent = 'Adding item…'; }
    try {
      const dimensions = await getImageDimensions(file);
      if (dimensions.width < 160 || dimensions.height < 160) throw new Error('Choose a clearer photo at least 160 × 160 pixels.');
      const name = $('#wardrobe-item-name')?.value.trim();
      if (!name) throw new Error('Give this item a name.');
      const itemType = $('#wardrobe-item-type')?.value === 'accessory' ? 'accessory' : 'clothing';
      const category = $('#wardrobe-category')?.value || (itemType === 'accessory' ? 'Other accessories' : 'Tops');
      const colors = String($('#wardrobe-colours')?.value || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 8);
      const id = globalThis.crypto?.randomUUID?.() || `wardrobe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const item = {
        id, name, item_type: itemType, category, colors,
        season: $('#wardrobe-season')?.value || 'all',
        notes: $('#wardrobe-notes')?.value.trim().slice(0, 400) || '',
        imageBlob: file.slice(0, file.size, file.type), imageType: file.type,
        imageName: file.name || `${id}.jpg`, createdAt: new Date().toISOString(),
      };
      await dbRequest('wardrobe', 'put', item);
      state.wardrobeItems.unshift(item);
      form.reset();
      updateWardrobeCategoryOptions();
      renderWardrobe();
      showAlert('Added to My wardrobe. The photo stays in this browser.', 'good');
    } catch (error) {
      showAlert(error.message || 'Could not add this item to My wardrobe.', 'error');
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = 'Add to My wardrobe'; }
    }
  }

  async function removeWardrobeItem(itemId) {
    const item = state.wardrobeItems.find(entry => entry.id === itemId);
    if (!item) return;
    if (!window.confirm(`Remove “${item.name}” from My wardrobe?`)) return;
    try {
      await dbRequest('wardrobe', 'delete', itemId);
      state.wardrobeItems = state.wardrobeItems.filter(entry => entry.id !== itemId);
      renderWardrobe();
      showAlert('Item removed from My wardrobe.', 'good');
    } catch (error) {
      showAlert(`Could not remove this item: ${error.message}`, 'error');
    }
  }

  function skinPaletteGuide(colors) {
    if (!colors || !/^#[0-9a-f]{6}$/i.test(colors.skin_color || '')) return null;
    const r = parseInt(colors.skin_color.slice(1, 3), 16);
    const b = parseInt(colors.skin_color.slice(5, 7), 16);
    if (r - b >= 16) return { label: 'Warm-leaning colour ideas', family: 'warm', colors: ['olive', 'rust', 'camel', 'warm cream', 'terracotta', 'teal'], note: 'An approximate palette prompt from the detected image colours, not a definitive undertone analysis.' };
    if (b - r >= 10) return { label: 'Cool-leaning colour ideas', family: 'cool', colors: ['navy', 'berry', 'cobalt', 'cool grey', 'plum', 'icy blue'], note: 'An approximate palette prompt from the detected image colours, not a definitive undertone analysis.' };
    return { label: 'Balanced colour ideas', family: 'balanced', colors: ['soft white', 'denim blue', 'sage', 'burgundy', 'taupe', 'charcoal'], note: 'An approximate palette prompt from the detected image colours, not a definitive undertone analysis.' };
  }

  function renderSkinAnalysis(colors) {
    const target = $('#skin-analysis-preview');
    if (!target) return;
    if (!colors || !Object.keys(colors).length) {
      target.innerHTML = '<div class="skin-empty-state"><strong>Your colour notes will appear here</strong><p>Run the analysis to add more colour context to Ensemble.</p></div>';
      $('#skin-insight-banner').hidden = true;
      return;
    }
    const order = ['skin_color', 'hair_color', 'eye_color', 'eyebrow_color', 'lip_color'];
    const labels = { skin_color: 'Skin colour', hair_color: 'Hair colour', eye_color: 'Eye colour', eyebrow_color: 'Eyebrow colour', lip_color: 'Lip colour' };
    const detected = order.filter(key => /^#[0-9a-f]{6}$/i.test(colors[key] || '')).map(key => `<div class="analysis-tone"><span style="background:${escapeHTML(colors[key])}"></span><div><strong>${escapeHTML(labels[key])}</strong><small>${escapeHTML(colors[key])}${colors[`${key}_name`] ? ` · ${escapeHTML(colors[`${key}_name`])}` : ''}</small></div></div>`).join('');
    const guide = skinPaletteGuide(colors);
    const applicationCopy = state.profile.colorScheme === 'selfie'
      ? 'Applied to Ensemble: these colour cues now guide recommendation ranking. You can choose another palette in Style profile at any time.'
      : 'These colour cues are also considered alongside your selected palette.';
    target.innerHTML = `<div class="skin-analysis-results"><div class="analysis-heading"><h3>Your colour notes</h3><p>These are detected facial colour values. Use them as styling inspiration—not as rules about what suits you.</p></div><div class="analysis-tone-grid">${detected || '<p>No recognized hex colour values were returned by the provider.</p>'}</div>${guide ? `<div class="analysis-palette-guide"><strong>${escapeHTML(guide.label)}</strong><div class="analysis-palette-swatches">${guide.colors.map(name => `<span>${escapeHTML(name)}</span>`).join('')}</div><p>${escapeHTML(guide.note)}</p></div>` : ''}<p class="analysis-applied-note">${escapeHTML(applicationCopy)}</p></div>`;
    const banner = $('#skin-insight-banner');
    if (banner) {
      if (!guide) {
        banner.hidden = true;
      } else {
        banner.hidden = false;
        $('#skin-insight-title').textContent = guide.label;
        const cues = guide.colors.slice(0, 5).join(', ');
        $('#skin-insight-copy').textContent = state.profile.colorScheme === 'selfie'
          ? `Your skin analysis is guiding Ensemble’s colour ranking. Current colour cues: ${cues}. Recommendations still reflect your style, season, fit and budget. You can choose another palette in Style profile at any time.`
          : `Ensemble also considers colour cues from your skin analysis alongside your selected palette: ${cues}. Choose another palette in Style profile at any time.`;
      }
    }
  }

  async function validateImageDimensions(file) {
    const dimensions = await getImageDimensions(file);
    if (dimensions.width < 320 || dimensions.height < 320) throw new Error('The image must be at least 320 × 320 pixels. Choose a larger photo.');
    if (Math.max(dimensions.width, dimensions.height) > 4096) throw new Error('The longest side of the image must not exceed 4,096 pixels. Choose a smaller image.');
    return dimensions;
  }

  async function setSkinPhotoPreview() {
    const file = $('#skin-photo')?.files?.[0];
    if (!file) return;
    try {
      await validateImageDimensions(file);
      await rememberPhoto('skinAnalysis', file);
    } catch (error) {
      showAlert(error.message, 'error');
      $('#skin-photo').value = '';
    }
  }

  async function setTryOnPhotoPreview() {
    const file = $('#try-on-photo')?.files?.[0];
    if (!file) return;
    try {
      await validateImageDimensions(file);
      await rememberPhoto('tryOn', file);
    } catch (error) {
      showAlert(error.message, 'error');
      $('#try-on-photo').value = '';
    }
  }


  function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('This image could not be read. Choose a valid JPG or PNG file.'));
      };
      image.src = objectUrl;
    });
  }

  async function pollColorTask(taskId, maxAttempts = 30) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => window.setTimeout(resolve, 3000));
      const result = await apiFetch(`/api/tasks/color/${encodeURIComponent(taskId)}`, { method: 'GET' });
      if (result.status === 'success' || result.status === 'error') return result;
      const button = $('#run-skin-analysis');
      if (button) button.textContent = 'Analyzing colour tones…';
    }
    throw new Error('Analysis is taking longer than expected. Please try again in a moment.');
  }

  function applySkinAnalysisToProfile(colors) {
    state.profile.skinAnalysis = colors;
    state.profile.skinAnalysisApplied = true;
    // Applying an analysis should have an immediate, visible effect on the recommendations.
    // Users can later choose any palette in the quiz or Style profile.
    state.profile.colorScheme = 'selfie';
  }

  async function runSkinAnalysis() {
    const selectedPhoto = $('#skin-photo')?.files?.[0];
    const photo = selectedPhoto || state.cachedImages.skinAnalysis;
    if (!photo) { showAlert('Choose a front-facing JPG or PNG selfie first.', 'error'); return; }
    if (!$('#skin-consent')?.checked) { showAlert('Consent is required before sending the selfie to YouCam.', 'error'); return; }
    if (!state.config.youcam_configured) { showAlert('YouCam skin analysis is not configured on this deployment. Add YCE_API_KEY in environment variables. Your selfie has not been uploaded.', 'error'); return; }
    if (!['image/jpeg', 'image/png'].includes(photo.type)) { showAlert('Use a JPG or PNG selfie.', 'error'); return; }
    if (!photo.size || photo.size > 9_500_000) { showAlert('Choose a non-empty image smaller than 9.5 MB.', 'error'); return; }
    let dimensions;
    try { dimensions = await getImageDimensions(photo); }
    catch (error) { showAlert(error.message, 'error'); return; }
    if (dimensions.width < 320 || dimensions.height < 320) {
      showAlert('The image must be at least 320 × 320 pixels. Choose a larger photo.', 'error');
      return;
    }
    if (Math.max(dimensions.width, dimensions.height) > 4096) {
      showAlert('The longest side of the image must not exceed 4,096 pixels. Choose a smaller image.', 'error');
      return;
    }
    if (selectedPhoto) { try { await rememberPhoto('skinAnalysis', selectedPhoto); } catch (error) { showAlert(error.message, 'error'); return; } }
    const button = $('#run-skin-analysis');
    button.disabled = true;
    button.textContent = 'Starting analysis…';
    try {
      const form = new FormData();
      form.append('photo', photo);
      form.append('consent', 'true');
      const task = await apiFetch('/api/color-analysis', { method: 'POST', body: form });
      button.textContent = 'Analyzing colour tones…';
      const result = await pollColorTask(task.task_id);
      if (result.status === 'error') throw new Error(result.message || 'Skin colour analysis could not be completed.');
      const colors = result.colors || {};
      const hasSkinColour = typeof colors.skin_color === 'string' && /^#[0-9a-f]{6}$/i.test(colors.skin_color);
      if (!hasSkinColour) throw new Error('YouCam completed the task but did not return a usable skin colour value. Try a clearer, evenly lit front-facing selfie.');
      applySkinAnalysisToProfile(colors);
      await persistProfile();
      renderSkinAnalysis(state.profile.skinAnalysis);
      renderPaletteSelect();
      const recommendationsUpdated = await requestRecommendations(state.lastQuery);
      if (recommendationsUpdated) {
        showAlert('Colour analysis complete. Its colour cues are now guiding Ensemble recommendations.', 'good');
      } else {
        showAlert('Colour analysis was saved, but Ensemble could not refresh. Return to Ensemble and select Refresh recommendations.', 'error');
      }
    } catch (error) {
      showAlert(error.message || 'YouCam could not complete colour analysis.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Analyze my colours';
    }
  }

  function openTryOn(itemId) {
    const wardrobeItem = state.wardrobeItems.find(entry => entry.id === itemId);
    const item = wardrobeItem || state.catalog.items.find(entry => entry.id === itemId) || state.recommendations.find(entry => entry.id === itemId) || state.accessoryRecommendations.find(entry => entry.id === itemId);
    if (!item) { showAlert('Could not find that item. Open My wardrobe and choose it again.', 'error'); return; }
    if (!wardrobeItem || item.image_kind === 'illustration') {
      showAlert('Built-in recommendations are style illustrations, not product photographs. Add a photo of your own item in My wardrobe to use virtual try-on.', 'error');
      return;
    }
    const itemType = item.item_type || 'clothing';
    const tryOnKind = wardrobeTryOnKind(item);
    if (!tryOnKind) { showAlert('Virtual try-on is not available for this accessory type yet.', 'error'); return; }
    const dialog = $('#try-on-dialog');
    if (dialog.dataset.referenceObjectUrl) URL.revokeObjectURL(dialog.dataset.referenceObjectUrl);
    const referenceUrl = URL.createObjectURL(item.imageBlob);
    dialog.dataset.referenceObjectUrl = referenceUrl;
    $('#try-on-item-name').textContent = item.name;
    $('#try-on-item-image').src = referenceUrl;
    $('#try-on-item-image').alt = `Photo of ${item.name}`;
    $('#try-on-photo').value = '';
    $('#try-on-consent').checked = false;
    $('#try-on-result').replaceChildren();
    const photoLabel = $('#try-on-photo-label');
    const guidance = $('#try-on-reference-guidance');
    const genderField = $('#try-on-gender-field');
    const fitGender = state.profile.genderPreference === 'women' ? 'female' : state.profile.genderPreference === 'men' ? 'male' : '';
    const guidanceByKind = {
      clothing: ['Use a clear front-facing photo showing the body area this clothing covers.', 'For best results, use a front-facing photo showing the body area this piece covers.'],
      bag: ['Use a front-facing upper-body or full-length photo with your torso visible.', 'The reference should show the bag clearly without obstruction.'],
      hat: ['Use a front-facing photo with your entire head and shoulders visible.', 'The reference should show the hat clearly from the front.'],
      scarf: ['Use a front-facing photo with your neck and shoulders visible.', 'The reference should show the scarf clearly.'],
      shoes: ['Use a full-length or lower-body photo with both feet visible.', 'The reference should show the shoes clearly.']
    };
    const guidancePair = guidanceByKind[tryOnKind] || guidanceByKind.clothing;
    if (photoLabel) photoLabel.innerHTML = `${escapeHTML(guidancePair[0])} <span class="required-marker">*</span>`;
    if (guidance) guidance.textContent = guidancePair[1];
    if (genderField) genderField.hidden = itemType !== 'accessory';
    const genderSelect = $('#try-on-gender');
    if (genderSelect) genderSelect.value = fitGender;
    dialog.dataset.itemImage = '';
    dialog.dataset.itemName = item.name;
    dialog.dataset.itemType = itemType;
    dialog.dataset.tryOnKind = tryOnKind;
    dialog.dataset.itemSource = 'wardrobe';
    dialog.dataset.wardrobeItemId = item.id;
    renderStoredPhoto('tryOn');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  async function pollTryOnTask(taskId, providerKind = 'cloth-v4') {
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => window.setTimeout(resolve, 3500));
      const result = await apiFetch(`/api/tasks/try-on/${encodeURIComponent(taskId)}?kind=${encodeURIComponent(providerKind)}`, { method: 'GET' });
      if (result.status === 'success' || result.status === 'error') return result;
    }
    throw new Error('The try-on is taking longer than expected. You can retry without selecting your photo again.');
  }

  async function runTryOn() {
    const dialog = $('#try-on-dialog');
    const selectedPhoto = $('#try-on-photo')?.files?.[0];
    const photo = selectedPhoto || state.cachedImages.tryOn;
    if (!photo) { showAlert('Choose a JPG or PNG photo first. Your last try-on photo will be reused automatically after the first upload.', 'error'); return; }
    if (!$('#try-on-consent')?.checked) { showAlert('Consent is required before sending photos to YouCam.', 'error'); return; }
    if (!state.config.youcam_configured) { showAlert('Virtual try-on is not configured on this deployment. Add YCE_API_KEY to enable it.', 'error'); return; }
    if (!['image/jpeg', 'image/png'].includes(photo.type) || !photo.size || photo.size > 9_500_000) { showAlert('Choose a JPG or PNG image smaller than 9.5 MB.', 'error'); return; }
    let dimensions;
    try { dimensions = await getImageDimensions(photo); }
    catch (error) { showAlert(error.message, 'error'); return; }
    if (dimensions.width < 320 || dimensions.height < 320 || Math.max(dimensions.width, dimensions.height) > 4096) {
      showAlert('Use a photo with both sides at least 320 px and a longest side no greater than 4,096 px.', 'error'); return;
    }
    if (selectedPhoto) { try { await rememberPhoto('tryOn', selectedPhoto); } catch (error) { showAlert(error.message, 'error'); return; } }
    const itemType = dialog.dataset.itemType || 'clothing';
    const accessoryKind = dialog.dataset.tryOnKind || '';
    const gender = $('#try-on-gender')?.value || '';
    if (itemType === 'accessory' && !gender) { showAlert('Choose a gender option for this accessory try-on. You can use a different choice from your style profile.', 'error'); return; }
    const button = $('#run-try-on');
    const resultPanel = $('#try-on-result');
    button.disabled = true; button.textContent = 'Preparing try-on…';
    resultPanel.textContent = 'Uploading your photo and reference image…';
    try {
      const form = new FormData();
      form.append('photo', photo, photo.name || 'mystyle-try-on.jpg');
      const wardrobeReference = state.wardrobeItems.find(entry => entry.id === dialog.dataset.wardrobeItemId);
      if (!wardrobeReference?.imageBlob) throw new Error('That wardrobe photo is no longer available. Open My wardrobe and choose the item again.');
      form.append('item_image', wardrobeReference.imageBlob, wardrobeReference.imageName || 'mystyle-wardrobe-reference.jpg');
      form.append('item_image_url', '');
      form.append('item_type', itemType);
      form.append('accessory_kind', accessoryKind);
      form.append('gender', gender);
      form.append('consent', 'true');
      const task = await apiFetch('/api/try-on', { method: 'POST', body: form });
      button.textContent = 'Generating…';
      resultPanel.textContent = 'YouCam is processing the try-on. You can keep this window open; your photo is saved locally for reuse.';
      const completed = await pollTryOnTask(task.task_id, task.provider_task_kind || 'cloth-v4');
      if (completed.status === 'error') throw new Error(completed.message || 'YouCam could not complete this try-on.');
      resultPanel.replaceChildren();
      const message = document.createElement('p');
      message.textContent = 'Your virtual try-on is ready.';
      resultPanel.append(message);
      if (completed.image_url) {
        const image = document.createElement('img'); image.src = completed.image_url; image.alt = `Virtual try-on result for ${dialog.dataset.itemName || 'selected style'}`;
        resultPanel.append(image);
      } else {
        const note = document.createElement('p'); note.textContent = 'YouCam completed the task but did not return a displayable result image.'; resultPanel.append(note);
      }
    } catch (error) {
      resultPanel.textContent = error.message || 'Could not complete the virtual try-on.';
      showAlert(resultPanel.textContent, 'error');
    } finally { button.disabled = false; button.textContent = 'Generate try-on'; }
  }

  const WALKTHROUGH_STEPS = [
    { title: 'Welcome to myStyle', copy: 'Use this walkthrough to learn the main parts of the app. You can move back, skip, or finish at any time.', view: 'discover' },
    { title: 'Style quiz', copy: 'Choose a style direction, occasions, colour palette, gender preference and budget. The answers create your starting recommendations.', view: 'quiz' },
    { title: 'Ensemble: clothing', copy: 'Browse the Clothing tab, search for concepts, open similar-shopping searches, try on an item or save it for later.', view: 'discover', tab: 'clothing' },
    { title: 'Ensemble: accessories', copy: 'After skin analysis, the Accessories tab shows bags, scarves, headwear and shoes ranked against detected colour cues.', view: 'discover', tab: 'accessories' },
    { title: 'Skin analysis', copy: 'Upload a front-facing selfie and consent to YouCam processing. Detected colour values become visible here and guide accessories.', view: 'skin-analysis' },
    { title: 'Style profile', copy: 'Adjust gender preference, region, season, fit, sizes, colour scheme and budget. Save changes to refresh recommendations.', view: 'profile' },
    { title: 'Saved pieces', copy: 'Use the heart to keep catalogue concepts in a shortlist for later.', view: 'saved' },
    { title: 'My wardrobe', copy: 'Add photos of clothes and accessories you already own. They stay in this browser, and supported pieces can be used for virtual try-on.', view: 'wardrobe' },
    { title: 'Virtual try-on', copy: 'Try on your own clothing photo or supported accessory with your saved try-on photo. Processing requires consent and a configured service key.', view: 'wardrobe' }
  ];

  function showWalkthroughStep(index) {
    state.walkthroughStep = Math.max(0, Math.min(index, WALKTHROUGH_STEPS.length - 1));
    const step = WALKTHROUGH_STEPS[state.walkthroughStep];
    $('#walkthrough-title').textContent = step.title;
    $('#walkthrough-copy').textContent = step.copy;
    $('#walkthrough-step-count').textContent = `Step ${state.walkthroughStep + 1} of ${WALKTHROUGH_STEPS.length}`;
    $('#walkthrough-previous').disabled = state.walkthroughStep === 0;
    $('#walkthrough-next').textContent = state.walkthroughStep === WALKTHROUGH_STEPS.length - 1 ? 'Finish' : 'Next';
    if (step.view) switchView(step.view);
    if (step.tab) switchEnsembleTab(step.tab);
  }

  function openWalkthrough() {
    const dialog = $('#mystyle-walkthrough-dialog');
    showWalkthroughStep(0);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeWalkthrough() {
    const dialog = $('#mystyle-walkthrough-dialog');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }


  async function requestRecommendations(query = '') {
    if (state.recommendationsLoading) {
      return new Promise(resolve => {
        if (state.queuedRecommendation) {
          state.queuedRecommendation.query = query;
          state.queuedRecommendation.resolvers.push(resolve);
        } else {
          state.queuedRecommendation = { query, resolvers: [resolve] };
        }
      });
    }
    state.recommendationsLoading = true;
    const id = ++state.requestId;
    state.lastQuery = query;
    const status = $('#recommendation-status');
    if (status) status.textContent = 'Loading recommendations…';
    const grid = $('#recommendation-grid');
    if (grid) {
      grid.setAttribute('aria-busy', 'true');
      if (!grid.children.length) grid.innerHTML = '<div class="loading-style-card"><span class="loading-spinner"></span><strong>Loading recommendations</strong><p>Matching your style, colours, season and budget.</p></div>';
    }
    const triggers = [$('#refresh-edit'), $('#style-search-form button[type="submit"]'), $('#clear-style-search'), $('#quick-palette-form button[type="submit"]'), $('#quiz-form button[type="submit"]'), $('#profile-form button[type="submit"]'), $('#save-profile-top')].filter(Boolean);
    const originalLabels = new Map();
    triggers.forEach(button => {
      originalLabels.set(button, button.innerHTML);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      if (button.id === 'refresh-edit') button.textContent = 'Loading recommendations…';
      else if (button.type === 'submit') button.textContent = 'Please wait…';
    });
    try {
      const result = await apiFetch('/api/recommendations', { method: 'POST', body: JSON.stringify({ profile: state.profile, query, limit: 8 }) });
      if (id !== state.requestId) return false;
      state.recommendations = result.recommendations || [];
      state.accessoryRecommendations = result.accessories || [];
      updateSeasonDetails(result);
      if (status) status.textContent = state.recommendations.length ? `${state.recommendations.length} recommendations` : 'No matches found';
      renderRecommendations(state.recommendations);
      renderAccessories(state.accessoryRecommendations);
      renderSaved();
      renderSkinAnalysis(state.profile.skinAnalysis);
      return true;
    } catch (error) {
      if (id !== state.requestId) return false;
      if (status) status.textContent = 'Could not load recommendations';
      if (grid) grid.innerHTML = `<div class="no-results"><strong>We couldn't load recommendations.</strong><p>${escapeHTML(error.message)}</p><button class="button button-outline" type="button" id="retry-edit">Try again</button></div>`;
      if (state.profile.skinAnalysis) renderAccessories(state.accessoryRecommendations);
      return false;
    } finally {
      state.recommendationsLoading = false;
      if (grid) grid.removeAttribute('aria-busy');
      triggers.forEach(button => {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        if (originalLabels.has(button)) button.innerHTML = originalLabels.get(button);
      });
      const queued = state.queuedRecommendation;
      if (queued) {
        state.queuedRecommendation = null;
        const succeeded = await requestRecommendations(queued.query);
        queued.resolvers.forEach(resolve => resolve(succeeded));
      }
    }
  }

  function switchView(view) {
    state.currentView = view;
    $$('.app-view').forEach(panel => {
      const active = panel.dataset.viewPanel === view;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    $$('.side-nav-link[data-view]').forEach(button => button.classList.toggle('is-active', button.dataset.view === view));
    if (view === 'profile') { renderProfileChoices(); }
    if (view === 'skin-analysis') renderSkinAnalysis(state.profile.skinAnalysis);
    if (view === 'saved') renderSaved();
    if (view === 'discover') renderSaved();
    if (view === 'wardrobe') renderWardrobe();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveProfile(event) {
    event?.preventDefault?.();
    try {
      state.profile.displayName = $('#display-name')?.value.trim() || 'myStyle Member';
      state.profile.country = $('#profile-country')?.value || 'CA';
      state.profile.genderPreference = normalizeGenderPreference($('#profile-gender-preference')?.value || state.profile.genderPreference || 'all');
      state.profile.city = $('#profile-city')?.value.trim() || '';
      state.profile.region = $('#profile-region')?.value.trim() || '';
      state.profile.season = $('#profile-season')?.value || 'auto';
      state.profile.climate = $('#profile-climate')?.value || 'variable';
      const budget = $('#profile-budget')?.value || 'any';
      state.profile.budget = budget === 'any' ? 'any' : Number(budget);
      state.profile.fitPreference = $('#profile-fit')?.value || 'balanced';
      state.profile.sizeTop = $('#size-top')?.value.trim() || '';
      state.profile.sizeBottom = $('#size-bottom')?.value.trim() || '';
      state.profile.sizeShoe = $('#size-shoe')?.value.trim() || '';
      state.profile.notes = $('#fit-notes')?.value.trim() || '';
      state.profile.styleTags = selectedValues('#profile-style-choices input');
      state.profile.occasions = selectedValues('#profile-occasion-choices input');
      state.profile.colorScheme = selectedValues('#profile-palette-choices input')[0] || 'earth';
      state.profile.customColors = $('#profile-custom-colors')?.value.trim() || '';
      state.profile.colourNotes = $('#profile-colour-notes')?.value.trim() || '';
      await persistProfile();
      updateUserIdentity(); renderProfileChoices(); updateSeasonDetails();
      const saveStatus = $('#profile-save-status');
      if (saveStatus) saveStatus.textContent = 'Your profile has been saved.';
      showAlert('Style profile updated. Recommendations are being refreshed.', 'good');
      await requestRecommendations(state.lastQuery);
    } catch (error) { showAlert(`Could not save your profile: ${error.message}`, 'error'); }
  }

  async function submitQuiz(event) {
    event.preventDefault();
    state.profile.genderPreference = normalizeGenderPreference($('#quiz-gender-preference')?.value || state.profile.genderPreference || 'all');
    state.profile.styleTags = selectedValues('#quiz-style-choices input');
    state.profile.occasions = selectedValues('#quiz-occasion-choices input');
    state.profile.colorScheme = selectedValues('#quiz-palette-choices input')[0] || 'earth';
    state.profile.customColors = $('#quiz-custom-colors')?.value.trim() || '';
    const budget = $('#quiz-budget')?.value || 'any';
    state.profile.budget = budget === 'any' ? 'any' : Number(budget);
    state.profile.hasCompletedQuiz = true;
    try {
      await persistProfile();
      renderProfileChoices();
      await requestRecommendations('');
      showAlert('Your style quiz is saved. Ensemble recommendations have been updated.', 'good');
      switchView('discover');
    } catch (error) { showAlert(`Could not save quiz answers: ${error.message}`, 'error'); }
  }

  async function applyQuickPalette(event) {
    event.preventDefault();
    state.profile.colorScheme = $('#quick-color-scheme')?.value || 'earth';
    state.profile.customColors = $('#quick-custom-colors')?.value.trim() || '';
    try {
      await persistProfile();
      renderPaletteSelect(); updateSeasonDetails();
      await requestRecommendations(state.lastQuery);
      showAlert('Colour scheme applied to Ensemble.', 'good');
    } catch (error) { showAlert(`Could not apply the colour scheme: ${error.message}`, 'error'); }
  }

  function updateSaveControls(itemId) {
    const saved = (state.profile.savedItemIds || []).includes(itemId);
    $$('[data-save-item]').filter(button => button.dataset.saveItem === itemId).forEach(button => {
      button.textContent = saved ? '♥' : '♡';
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', `${saved ? 'Remove from' : 'Save to'} my saved pieces`);
    });
  }

  async function toggleSaved(itemId) {
    const saved = new Set(state.profile.savedItemIds || []);
    const wasSaved = saved.has(itemId);
    if (wasSaved) saved.delete(itemId); else saved.add(itemId);
    state.profile.savedItemIds = [...saved];
    try {
      await persistProfile();
      updateSaveControls(itemId);
      renderSaved();
      showAlert(wasSaved ? 'Removed from your saved pieces.' : 'Piece saved to your shortlist.', 'good');
    } catch (error) { showAlert(`Could not update saved pieces: ${error.message}`, 'error'); }
  }


  async function markNotForMe(itemId) {
    state.profile.notForMeItemIds = [...new Set([...(state.profile.notForMeItemIds || []), itemId])];
    state.profile.savedItemIds = (state.profile.savedItemIds || []).filter(id => id !== itemId);
    try {
      await persistProfile();
      showAlert('Got it. This piece will be excluded from future recommendations.', 'good');
      await requestRecommendations(state.lastQuery);
    } catch (error) { showAlert(`Could not save your feedback: ${error.message}`, 'error'); }
  }

  async function resetDislikes() {
    state.profile.notForMeItemIds = [];
    await persistProfile();
    await requestRecommendations(state.lastQuery);
  }

  function attachEvents() {
    document.addEventListener('click', async event => {
      const viewButton = event.target.closest('[data-view]');
      if (viewButton) { switchView(viewButton.dataset.view); return; }
      const tryOnButton = event.target.closest('[data-try-on]');
      if (tryOnButton) { openTryOn(tryOnButton.dataset.tryOn); return; }
      const saveButton = event.target.closest('[data-save-item]');
      if (saveButton) { await toggleSaved(saveButton.dataset.saveItem); return; }
      const notForMe = event.target.closest('[data-not-for-me]');
      if (notForMe) { await markNotForMe(notForMe.dataset.notForMe); return; }
      const deleteWardrobe = event.target.closest('[data-delete-wardrobe-item]');
      if (deleteWardrobe) { await removeWardrobeItem(deleteWardrobe.dataset.deleteWardrobeItem); return; }
      const wardrobeFilter = event.target.closest('[data-wardrobe-filter]');
      if (wardrobeFilter) { state.wardrobeFilter = wardrobeFilter.dataset.wardrobeFilter; renderWardrobe(); return; }
      if (event.target.closest('[data-reset-dislikes]')) { await resetDislikes(); return; }
      if (event.target.closest('#retry-edit')) { await requestRecommendations(state.lastQuery); }
      const tabButton = event.target.closest('[data-ensemble-tab]');
      if (tabButton) { switchEnsembleTab(tabButton.dataset.ensembleTab); return; }
      if (event.target.closest('#open-mystyle-walkthrough')) { openWalkthrough(); return; }
      if (event.target.closest('#walkthrough-skip') || event.target.closest('#walkthrough-close')) { closeWalkthrough(); return; }
      if (event.target.closest('#walkthrough-previous')) { showWalkthroughStep(state.walkthroughStep - 1); return; }
      if (event.target.closest('#walkthrough-next')) {
        if (state.walkthroughStep >= WALKTHROUGH_STEPS.length - 1) closeWalkthrough();
        else showWalkthroughStep(state.walkthroughStep + 1);
        return;
      }
    });
    $('.theme-toggle')?.addEventListener('click', async () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; applySettings(); try { await saveSettings(); } catch (_) { /* display setting is still applied */ } });
    $$('[data-font]').forEach(button => button.addEventListener('click', async () => { state.settings.fontSize = button.dataset.font; applySettings(); try { await saveSettings(); } catch (_) { /* display setting is still applied */ } }));
    $('#profile-form')?.addEventListener('submit', saveProfile);
    $('#wardrobe-form')?.addEventListener('submit', addWardrobeItem);
    $('#wardrobe-item-type')?.addEventListener('change', updateWardrobeCategoryOptions);
    $('#try-on-dialog')?.addEventListener('close', () => {
      const dialog = $('#try-on-dialog');
      if (dialog.dataset.referenceObjectUrl) URL.revokeObjectURL(dialog.dataset.referenceObjectUrl);
      delete dialog.dataset.referenceObjectUrl;
    });
    $('#save-profile-top')?.addEventListener('click', () => saveProfile());
    $('#quiz-form')?.addEventListener('submit', submitQuiz);
    $('#quick-palette-form')?.addEventListener('submit', applyQuickPalette);
    $('#profile-country')?.addEventListener('change', () => { renderBudgetOptions(); });
    $('#refresh-edit')?.addEventListener('click', () => requestRecommendations(state.lastQuery));
    $('#style-search-form')?.addEventListener('submit', event => { event.preventDefault(); requestRecommendations($('#style-search')?.value.trim() || ''); });
    $('#clear-style-search')?.addEventListener('click', () => { $('#style-search').value = ''; requestRecommendations(''); });
    $('#skin-photo')?.addEventListener('change', setSkinPhotoPreview);
    $('#try-on-photo')?.addEventListener('change', setTryOnPhotoPreview);
    $('#run-skin-analysis')?.addEventListener('click', runSkinAnalysis);
    $('#run-try-on')?.addEventListener('click', runTryOn);
  }

  async function init() {
    attachEvents();
    try {
      const [catalog, config] = await Promise.all([
        apiFetch('/api/catalog', { method: 'GET' }), apiFetch('/api/config', { method: 'GET' })
      ]);
      state.catalog = catalog;
      state.config = config;
      state.db = await openDatabase();
      await loadLocalState();
      await loadCachedPhotos();
      renderWardrobe();
      updateWardrobeCategoryOptions();
      renderProfileChoices();
      renderSkinAnalysis(state.profile.skinAnalysis);
      updateSeasonDetails();
      renderSaved();
      switchView(state.profile.hasCompletedQuiz ? 'discover' : 'quiz');
      $('.mystyle-shell')?.classList.remove('is-booting');
      await requestRecommendations('');
      if (!state.config.youcam_configured) {
        const note = $('#skin-photo-help');
        if (note) note.innerHTML = '<strong>Colour analysis is not configured on this deployment</strong><p>Add YCE_API_KEY to the server environment to enable live YouCam analysis. Your selfie will not be uploaded unless the app has the key and you provide consent.</p>';
      }
    } catch (error) {
      showAlert(`${error.message} Refresh the page to retry loading your profile.`, 'error');
      const status = $('#recommendation-status');
      if (status) status.textContent = 'The style catalogue could not be loaded.';
      $('.mystyle-shell')?.classList.remove('is-booting');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
