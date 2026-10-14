(() => {
  'use strict';

  const DB_NAME = 'mystyle-db';
  const DB_VERSION = 1;
  const PROFILE_KEY = 'my-profile';
  const SETTINGS_KEY = 'display-settings';
  const DEFAULT_PROFILE = {
    displayName: 'myStyle Member', country: 'CA', city: 'Toronto', region: 'Ontario',
    season: 'auto', climate: 'variable', budget: 100, fitPreference: 'balanced',
    sizeTop: '', sizeBottom: '', sizeShoe: '', notes: '',
    styleTags: ['classic', 'casual'], occasions: ['everyday', 'work'],
    colorScheme: 'earth', customColors: '', colorPreferences: [], skinAnalysis: null,
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
    recommendations: [], lastQuery: '', requestId: 0, currentView: 'discover', colorPreviewUrl: null
  };
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const csrfToken = $('meta[name="csrf-token"]')?.content || '';
  const COUNTRY = () => state.profile.country === 'US' ? 'US' : 'CA';
  const CURRENCY = () => COUNTRY() === 'US' ? 'USD' : 'CAD';

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('Local browser storage is not available.'));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open your local profile.'));
    });
  }

  function dbRequest(storeName, method, value) {
    return new Promise((resolve, reject) => {
      if (!state.db) return reject(new Error('Local profile storage is not ready.'));
      const tx = state.db.transaction(storeName, method === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore(storeName);
      const request = method === 'get' ? store.get(value) : store.put(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('A local profile operation failed.'));
    });
  }

  async function loadLocalState() {
    const profileRow = await dbRequest('profile', 'get', PROFILE_KEY);
    if (profileRow?.value) state.profile = { ...structuredClone(DEFAULT_PROFILE), ...profileRow.value };
    const settingsRow = await dbRequest('settings', 'get', SETTINGS_KEY);
    if (settingsRow?.value) state.settings = { ...state.settings, ...settingsRow.value };
    // Keep saved/disliked IDs valid for this version of the curated style catalogue.
    if (!Array.isArray(state.profile.savedItemIds)) state.profile.savedItemIds = [];
    if (!Array.isArray(state.profile.notForMeItemIds)) state.profile.notForMeItemIds = [];
    applySettings();
  }

  async function persistProfile() {
    await dbRequest('profile', 'put', { key: PROFILE_KEY, value: state.profile, updatedAt: new Date().toISOString() });
  }
  async function saveSettings() { await dbRequest('settings', 'put', { key: SETTINGS_KEY, value: state.settings }); }

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
    const avatar = $('.user-avatar');
    if (avatar) avatar.textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
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
    if (heroLabel) heroLabel.textContent = `${seasonName} edit, considered for you`;
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
    black: '#202124', white: '#f8f7f2', cream: '#eee5d4', 'soft white': '#f5f3ec', oatmeal: '#c6b59b', grey: '#898e95', gray: '#898e95', charcoal: '#44474e', navy: '#27384f', 'ink blue': '#263c57', slate: '#7f8996', burgundy: '#743846', berry: '#a53d60', rust: '#b76340', olive: '#69724b', sage: '#9eae99', camel: '#b38b63', taupe: '#9a8a7b', sand: '#d2b995', ecru: '#e7dcc6', 'forest green': '#345745', 'light blue': '#9fb9cc', indigo: '#3e5479', 'washed black': '#343438', 'sky blue': '#91bad3', 'bright red': '#c93643', cobalt: '#255cc5', blush: '#e5bfc3', lavender: '#c5b6db', plum: '#663c63', emerald: '#246b54', teal: '#287f83', brown: '#76533d', chocolate: '#56382f', tan: '#ba9268', pink: '#d992a3', floral: '#c58b8e'
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
      <div class="style-card-media" data-image-state="loading"><img data-style-image src="${escapeHTML(item.image_url)}" alt="Editorial inspiration for ${escapeHTML(item.name)}" loading="lazy" decoding="async"><div class="style-image-fallback"><span>myStyle inspiration</span><strong>${escapeHTML(item.name)}</strong></div><span class="style-card-season">${escapeHTML(seasonBadge)}</span><button class="save-style-button" data-save-item="${escapeHTML(item.id)}" type="button" aria-pressed="${String(saved)}" aria-label="${saved ? 'Remove from' : 'Save to'} my saved pieces">${saved ? '♥' : '♡'}</button></div>
      <div class="style-card-content"><div class="style-card-kicker"><span>${escapeHTML(item.category)}</span><span class="budget-target">Budget guide ${escapeHTML(money(targetPrice, item.currency || CURRENCY()))}</span></div><h3>${escapeHTML(item.name)}</h3><p class="style-card-description">${escapeHTML(item.description)}</p><p class="style-match-reason">${escapeHTML(item.recommendation_reason || 'A versatile option for your edit.')}</p><div class="style-card-swatches" aria-label="Colour ideas">${swatches}<span>${escapeHTML((item.colors || []).slice(0, 3).join(' · '))}</span></div><div class="style-card-tags">${tags}</div><div class="style-card-actions"><a class="button button-primary" href="${escapeHTML(shop)}" target="_blank" rel="noopener noreferrer">Shop similar ↗</a>${savedView ? '' : `<button class="button button-outline" data-not-for-me="${escapeHTML(item.id)}" type="button">Not for me</button>`}</div><p class="style-card-disclosure">Inspiration image, not an exact retailer product. Search results, current price, stock and sizing are controlled by the retailer.</p></div>
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
      target.innerHTML = '<div class="skin-empty-state"><span class="skin-empty-mark">◌</span><strong>Your colour notes will appear here</strong><p>Run the analysis to add more colour context to your edit.</p></div>';
      $('#skin-insight-banner').hidden = true;
      return;
    }
    const order = ['skin_color', 'hair_color', 'eye_color', 'eyebrow_color', 'lip_color'];
    const labels = { skin_color: 'Skin colour', hair_color: 'Hair colour', eye_color: 'Eye colour', eyebrow_color: 'Eyebrow colour', lip_color: 'Lip colour' };
    const detected = order.filter(key => /^#[0-9a-f]{6}$/i.test(colors[key] || '')).map(key => `<div class="analysis-tone"><span style="background:${escapeHTML(colors[key])}"></span><div><strong>${escapeHTML(labels[key])}</strong><small>${escapeHTML(colors[key])}${colors[`${key}_name`] ? ` · ${escapeHTML(colors[`${key}_name`])}` : ''}</small></div></div>`).join('');
    const guide = skinPaletteGuide(colors);
    target.innerHTML = `<div class="skin-analysis-results"><div class="analysis-heading"><span class="eyebrow">Y O U C A M · DETECTED COLOUR TONES</span><h3>Colour notes for your edit</h3><p>These are detected facial colour values. Use them as styling inspiration—not as rules about what suits you.</p></div><div class="analysis-tone-grid">${detected || '<p>No recognized hex colour values were returned by the provider.</p>'}</div>${guide ? `<div class="analysis-palette-guide"><strong>${escapeHTML(guide.label)}</strong><div class="analysis-palette-swatches">${guide.colors.map(name => `<span>${escapeHTML(name)}</span>`).join('')}</div><p>${escapeHTML(guide.note)}</p></div>` : ''}</div>`;
    const banner = $('#skin-insight-banner');
    if (banner && guide) {
      banner.hidden = false;
      $('#skin-insight-title').textContent = guide.label;
      $('#skin-insight-copy').textContent = `Your edit now considers these optional palette cues: ${guide.colors.slice(0, 5).join(', ')}. You can still choose any colour scheme.`;
    }
  }

  function setSkinPhotoPreview() {
    const target = $('#skin-analysis-preview');
    const file = $('#skin-photo')?.files?.[0];
    if (!target || !file || !['image/jpeg', 'image/png'].includes(file.type)) return;
    if (state.colorPreviewUrl) URL.revokeObjectURL(state.colorPreviewUrl);
    state.colorPreviewUrl = URL.createObjectURL(file);
    target.innerHTML = `<div class="skin-local-preview"><img src="${state.colorPreviewUrl}" alt="Local preview of the selfie for colour analysis"><div><strong>Selfie selected</strong><p>This preview stays in this page. The image is sent only when you start analysis and consent.</p></div></div>`;
  }

  async function pollColorTask(taskId, maxAttempts = 48) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => window.setTimeout(resolve, 5000));
      const result = await apiFetch(`/api/tasks/color/${encodeURIComponent(taskId)}`, { method: 'GET' });
      if (result.status === 'success' || result.status === 'error') return result;
      const button = $('#run-skin-analysis');
      if (button) button.textContent = 'Analyzing colour tones…';
    }
    throw new Error('Analysis is taking longer than expected. Please try again in a moment.');
  }

  async function runSkinAnalysis() {
    const photo = $('#skin-photo')?.files?.[0];
    if (!photo) { showAlert('Choose a front-facing JPG or PNG selfie first.', 'error'); return; }
    if (!$('#skin-consent')?.checked) { showAlert('Consent is required before sending the selfie to YouCam.', 'error'); return; }
    if (!state.config.youcam_configured) { showAlert('YouCam skin analysis is not configured on this deployment. Add YCE_API_KEY in environment variables. Your selfie has not been uploaded.', 'error'); return; }
    if (!['image/jpeg', 'image/png'].includes(photo.type)) { showAlert('Use a JPG or PNG selfie.', 'error'); return; }
    if (!photo.size || photo.size > 9_500_000) { showAlert('Choose a non-empty image smaller than 9.5 MB.', 'error'); return; }
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
      const recognizedTone = Object.values(colors).some(value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value));
      if (!recognizedTone) throw new Error('YouCam completed the task but did not return recognizable colour values. Try a clearer front-facing selfie.');
      state.profile.skinAnalysis = colors;
      await persistProfile();
      renderSkinAnalysis(state.profile.skinAnalysis);
      renderPaletteSelect();
      await requestRecommendations(state.lastQuery);
      $('#skin-photo').value = '';
      if (state.colorPreviewUrl) URL.revokeObjectURL(state.colorPreviewUrl);
      state.colorPreviewUrl = null;
      showAlert('Colour analysis complete. The detected colour values have been saved and used to refine your edit.', 'good');
    } catch (error) {
      showAlert(error.message || 'YouCam could not complete colour analysis.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Analyze my colours';
    }
  }

  async function requestRecommendations(query = '') {
    const id = ++state.requestId;
    state.lastQuery = query;
    const status = $('#recommendation-status');
    if (status) status.textContent = 'Curating pieces around your profile…';
    const grid = $('#recommendation-grid');
    if (grid && !grid.children.length) grid.innerHTML = '<div class="loading-style-card"><span class="loading-spinner"></span><strong>Building your edit</strong><p>Matching colours, season, budget and lifestyle.</p></div>';
    try {
      const result = await apiFetch('/api/recommendations', { method: 'POST', body: JSON.stringify({ profile: state.profile, query, limit: 8 }) });
      if (id !== state.requestId) return;
      state.recommendations = result.recommendations || [];
      updateSeasonDetails(result);
      const summary = $('#edit-summary');
      if (summary) summary.textContent = `${result.count} style concepts selected for ${result.season_label.toLowerCase()} · ${result.climate_label.toLowerCase()} · ${result.currency}`;
      if (status) status.textContent = state.recommendations.length ? `${state.recommendations.length} pieces in your edit` : 'No matches found';
      const source = $('#recommendation-source');
      if (source) source.textContent = state.profile.colorScheme === 'selfie' && !state.profile.skinAnalysis
        ? 'You selected skin-guided colour ideas. Run the optional colour analysis in Style profile to personalize this signal; no selfie has been uploaded.'
        : result.ai_status === 'used'
          ? `Gemini ranking used (${result.model}). All results remain from the known style catalogue.`
          : result.ai_status === 'fallback'
            ? 'Using the profile-based matcher because Gemini was not available for this request.'
            : 'Ranked by your style profile, palette, season, climate, budget, fit preference and feedback.';
      renderRecommendations(state.recommendations);
      renderSaved();
      renderSkinAnalysis(state.profile.skinAnalysis);
    } catch (error) {
      if (id !== state.requestId) return;
      if (status) status.textContent = 'Could not update your edit';
      if (grid) grid.innerHTML = `<div class="no-results"><strong>We couldn't build your edit.</strong><p>${escapeHTML(error.message)}</p><button class="button button-outline" type="button" id="retry-edit">Try again</button></div>`;
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
    if (view === 'profile') { renderProfileChoices(); renderSkinAnalysis(state.profile.skinAnalysis); }
    if (view === 'saved') renderSaved();
    if (view === 'discover') renderSaved();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveProfile(event) {
    event?.preventDefault?.();
    try {
      state.profile.displayName = $('#display-name')?.value.trim() || 'myStyle Member';
      state.profile.country = $('#profile-country')?.value || 'CA';
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
      showAlert('Style profile updated. Your edit is being refreshed.', 'good');
      await requestRecommendations(state.lastQuery);
    } catch (error) { showAlert(`Could not save your profile: ${error.message}`, 'error'); }
  }

  async function submitQuiz(event) {
    event.preventDefault();
    state.profile.styleTags = selectedValues('#quiz-style-choices input');
    state.profile.occasions = selectedValues('#quiz-occasion-choices input');
    state.profile.colorScheme = selectedValues('#quiz-palette-choices input')[0] || 'earth';
    state.profile.customColors = $('#quiz-custom-colors')?.value.trim() || '';
    const budget = $('#quiz-budget')?.value || 'any';
    state.profile.budget = budget === 'any' ? 'any' : Number(budget);
    try {
      await persistProfile();
      renderProfileChoices();
      await requestRecommendations('');
      showAlert('Your style quiz is saved. Your seasonal edit has been updated.', 'good');
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
      showAlert('Colour scheme applied to your edit.', 'good');
    } catch (error) { showAlert(`Could not apply the colour scheme: ${error.message}`, 'error'); }
  }

  async function toggleSaved(itemId) {
    const saved = new Set(state.profile.savedItemIds || []);
    const wasSaved = saved.has(itemId);
    if (wasSaved) saved.delete(itemId); else saved.add(itemId);
    state.profile.savedItemIds = [...saved];
    try {
      await persistProfile();
      renderRecommendations(state.recommendations); renderSaved();
      showAlert(wasSaved ? 'Removed from your saved pieces.' : 'Piece saved to your shortlist.', 'good');
    } catch (error) { showAlert(`Could not update saved pieces: ${error.message}`, 'error'); }
  }

  async function markNotForMe(itemId) {
    state.profile.notForMeItemIds = [...new Set([...(state.profile.notForMeItemIds || []), itemId])];
    state.profile.savedItemIds = (state.profile.savedItemIds || []).filter(id => id !== itemId);
    try {
      await persistProfile();
      showAlert('Got it. This piece will be left out of future edits.', 'good');
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
      const saveButton = event.target.closest('[data-save-item]');
      if (saveButton) { await toggleSaved(saveButton.dataset.saveItem); return; }
      const notForMe = event.target.closest('[data-not-for-me]');
      if (notForMe) { await markNotForMe(notForMe.dataset.notForMe); return; }
      if (event.target.closest('[data-reset-dislikes]')) { await resetDislikes(); return; }
      if (event.target.closest('#retry-edit')) { await requestRecommendations(state.lastQuery); }
    });
    $('.theme-toggle')?.addEventListener('click', async () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; applySettings(); try { await saveSettings(); } catch (_) { /* display setting is still applied */ } });
    $$('[data-font]').forEach(button => button.addEventListener('click', async () => { state.settings.fontSize = button.dataset.font; applySettings(); try { await saveSettings(); } catch (_) { /* display setting is still applied */ } }));
    $('#profile-form')?.addEventListener('submit', saveProfile);
    $('#save-profile-top')?.addEventListener('click', () => saveProfile());
    $('#quiz-form')?.addEventListener('submit', submitQuiz);
    $('#quick-palette-form')?.addEventListener('submit', applyQuickPalette);
    $('#profile-country')?.addEventListener('change', () => { renderBudgetOptions(); });
    $('#refresh-edit')?.addEventListener('click', () => requestRecommendations(state.lastQuery));
    $('#style-search-form')?.addEventListener('submit', event => { event.preventDefault(); requestRecommendations($('#style-search')?.value.trim() || ''); });
    $('#clear-style-search')?.addEventListener('click', () => { $('#style-search').value = ''; requestRecommendations(''); });
    $('#skin-photo')?.addEventListener('change', setSkinPhotoPreview);
    $('#run-skin-analysis')?.addEventListener('click', runSkinAnalysis);
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
      renderProfileChoices();
      renderSkinAnalysis(state.profile.skinAnalysis);
      updateSeasonDetails();
      renderSaved();
      await requestRecommendations('');
      if (!state.config.youcam_configured) {
        const note = $('#skin-photo-help');
        if (note) note.innerHTML = '<strong>Colour analysis is not configured on this deployment</strong><p>Add YCE_API_KEY to the server environment to enable live YouCam analysis. Your selfie will not be uploaded unless the app has the key and you provide consent.</p>';
      }
    } catch (error) {
      showAlert(`${error.message} Refresh the page to retry loading your profile.`, 'error');
      const status = $('#recommendation-status');
      if (status) status.textContent = 'The style catalogue could not be loaded.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
