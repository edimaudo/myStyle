(() => {
  'use strict';

  const DB_NAME = 'mystyle-db';
  const DB_VERSION = 3;
  const PROFILE_KEY = 'my-profile';
  const SETTINGS_KEY = 'display-settings';
  const DEFAULT_PROFILE = {
    displayName: 'James', country: 'CA', city: 'Toronto', region: 'Ontario', genderPreference: 'all', hasCompletedQuiz: false,
    season: 'auto', climate: 'variable', budget: 100, fitPreference: 'balanced',
    sizeTop: '', sizeBottom: '', sizeShoe: '', notes: '',
    styleTags: ['classic', 'casual'], occasions: ['everyday', 'work'],
    colorScheme: 'earth', customColors: '', colorPreferences: [], skinAnalysis: null, skinAnalysisUpdatedAt: null, skinAnalysisApplied: false,
    skinHealthAnalysis: null, skinHealthAnalysisUpdatedAt: null, skincarePreferences: { sensitivity: 'unknown', budget: 'any' },
    savedItemIds: [], notForMeItemIds: []
  };
  const BUDGETS = [
    ['25', 'Up to 25'], ['40', 'Up to 40'], ['50', 'Up to 50'], ['60', 'Up to 60'],
    ['75', 'Up to 75'], ['80', 'Up to 80'], ['100', 'Up to 100'], ['125', 'Up to 125'],
    ['150', 'Up to 150'], ['200', 'Up to 200'], ['250', 'Up to 250'], ['300', 'Up to 300'],
    ['any', 'No fixed budget']
  ];
  const REGIONS = {
    CA: [
      ['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'], ['NB', 'New Brunswick'],
      ['NL', 'Newfoundland and Labrador'], ['NT', 'Northwest Territories'], ['NS', 'Nova Scotia'],
      ['NU', 'Nunavut'], ['ON', 'Ontario'], ['PE', 'Prince Edward Island'], ['QC', 'Quebec'],
      ['SK', 'Saskatchewan'], ['YT', 'Yukon']
    ],
    US: [
      ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
      ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['FL', 'Florida'], ['GA', 'Georgia'],
      ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
      ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
      ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'],
      ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
      ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
      ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
      ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
      ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming']
    ]
  };
  const state = {
    db: null, profile: structuredClone(DEFAULT_PROFILE), settings: { theme: 'light', fontSize: 'medium' },
    catalog: { items: [], palettes: [], styles: [], occasions: [] }, config: {},
    recommendations: [], accessoryRecommendations: [], lastQuery: '', requestId: 0, currentView: 'discover', recommendationsLoading: false, recommendationController: null, activeEnsembleTab: 'clothing', activeStyleWorkspaceTab: 'ensemble', cachedImages: { skinAnalysis: null, tryOn: null }, skinPhotoChangePromise: null, skinPhotoGeneration: 0, photoPreviewUrls: { skinAnalysis: null, tryOn: null }, wardrobeItems: [], wardrobeFilter: 'all', wardrobeObjectUrls: [], ensembleWardrobeObjectUrls: [], walkthroughStep: 0
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
      state.profile.skincarePreferences = { ...DEFAULT_PROFILE.skincarePreferences, ...(profileRow.value.skincarePreferences || {}) };
      const stored = profileRow.value;
      // Backward compatibility: earlier builds and provider responses may store
      // skin-health data under different keys or wrap it in `metrics`, `results`,
      // or `data`. Normalize those saved results once so Ensemble reuses them.
      const migratedHealth = getSavedSkinHealthMetricsFromProfile(state.profile);
      if (migratedHealth && JSON.stringify(state.profile.skinHealthAnalysis) !== JSON.stringify(migratedHealth)) {
        state.profile.skinHealthAnalysis = migratedHealth;
        state.profile.skinHealthAnalysisUpdatedAt = state.profile.skinHealthAnalysisUpdatedAt
          || state.profile.skincareAnalysisUpdatedAt || state.profile.skinHealthUpdatedAt
          || state.profile.skinAnalysisUpdatedAt || null;
        await persistProfile();
      }
      if (state.profile.displayName === 'myStyle Member') {
        state.profile.displayName = 'James';
        await persistProfile();
      }
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

  function supportedPhotoMimeType(file) {
    if (!file) return '';
    const declaredType = String(file.type || '').toLowerCase().split(';')[0].trim();
    const extension = String(file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
    const extensionType = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' })[extension] || '';
    const declaredSupported = ({ 'image/jpeg': 'image/jpeg', 'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg', 'image/png': 'image/png' })[declaredType] || '';
    if (declaredType && declaredType !== 'application/octet-stream' && !declaredSupported) return '';
    if (declaredSupported && extensionType && declaredSupported !== extensionType) return '';
    return declaredSupported || extensionType;
  }

  function normalizedPhotoBlob(file) {
    const mimeType = supportedPhotoMimeType(file);
    if (!mimeType) throw new Error('Choose a JPG, JPEG or PNG image.');
    return file.slice(0, file.size, mimeType);
  }

  // The two YouCam analysis endpoints can handle uploaded formats differently.
  // Re-encode the selected image as real JPEG bytes (not just a changed MIME label)
  // so the shared file is consistently accepted by both tasks.
  async function encodePhotoAsJpeg(file) {
    const supportedType = supportedPhotoMimeType(file);
    if (!supportedType) throw new Error('Choose a JPG, JPEG or PNG image.');
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('This selfie could not be decoded. Save it as a standard JPG or PNG and try again.'));
        element.src = objectUrl;
      });
      const maxSide = 4096;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Your browser could not prepare the selfie. Try another browser or save the image as a JPG.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of [0.94, 0.9, 0.86, 0.82, 0.78, 0.72]) {
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(result => result ? resolve(result) : reject(new Error('Your browser could not convert the selfie to JPEG. Try saving it as a JPG and upload it again.')), 'image/jpeg', quality);
        });
        if (blob.type === 'image/jpeg' && blob.size > 0 && blob.size <= 9_500_000) return blob;
      }
      throw new Error('The selfie is still too large after preparing it for analysis. Choose a smaller image under 9.5 MB.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function rememberPhoto(key, file) {
    const mimeType = supportedPhotoMimeType(file);
    if (!mimeType) throw new Error('Choose a JPG, JPEG or PNG image.');
    if (!file.size || file.size > 9_500_000) throw new Error('Choose an image smaller than 9.5 MB.');
    const blob = file.slice(0, file.size, mimeType);
    const name = file.name || `${key}.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
    await dbRequest('images', 'put', { key, blob, name, type: mimeType, lastModified: file.lastModified || Date.now(), updatedAt: new Date().toISOString() });
    state.cachedImages[key] = new File([blob], name, { type: mimeType, lastModified: file.lastModified || Date.now() });
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
  function renderRegionOptions(preferredRegion = state.profile.region || '') {
    const select = $('#profile-region');
    if (!select) return;
    const regions = REGIONS[COUNTRY()] || REGIONS.CA;
    const preferred = String(preferredRegion || '').trim().toLowerCase();
    const matchingRegion = regions.find(([code, name]) => code.toLowerCase() === preferred || name.toLowerCase() === preferred);
    const selectedName = matchingRegion?.[1] || '';
    select.innerHTML = `<option value="">Select a province or state</option>${regions.map(([code, name]) => `<option value="${escapeHTML(name)}" data-region-code="${code}">${escapeHTML(name)}</option>`).join('')}`;
    select.value = selectedName;
    state.profile.region = selectedName;
  }

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
    setValue('#display-name', state.profile.displayName, 'James');
    setValue('#profile-country', state.profile.country, 'CA');
    renderRegionOptions(state.profile.region);
    setValue('#profile-gender-preference', state.profile.genderPreference, 'all');
    setValue('#quiz-gender-preference', state.profile.genderPreference, 'all');
    setValue('#profile-city', state.profile.city);
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
    hydrateSkincarePreferences();
    renderQuizSkinInfo();
    updateUserIdentity();
    renderProfileSkinSummary(state.profile.skinAnalysis);
  }


  function renderQuizSkinInfo() {
    const target = $('#quiz-skin-info');
    if (!target) return;
    const colours = state.profile.skinAnalysis || {};
    const health = getSavedSkinHealthMetrics() || {};
    const colourKeys = [
      ['skin_color', 'Skin'], ['hair_color', 'Hair'], ['eye_color', 'Eyes'],
      ['eyebrow_color', 'Brows'], ['lip_color', 'Lips']
    ];
    const colourChips = colourKeys.filter(([key]) => /^#[0-9a-f]{6}$/i.test(colours[key] || '')).map(([key, label]) =>
      `<span class="quiz-skin-chip"><i style="background:${escapeHTML(colours[key])}"></i><span>${label}</span></span>`).join('');
    const metricKeys = [
      ['skin_type', 'Skin type', true], ['moisture', 'Moisture'], ['oiliness', 'Oiliness'],
      ['redness', 'Redness'], ['pore', 'Pores'], ['acne', 'Breakout indicator'],
      ['texture', 'Texture'], ['radiance', 'Radiance']
    ];
    const metricChips = metricKeys.filter(([key]) => key in health).map(([key, label, isType]) => {
      const value = isType
        ? [...new Set(getNestedSkinWords(health[key]).filter(word => /normal|oily|dry|combination/.test(word)))].map(word => word.replace(/^./, char => char.toUpperCase())).join(' · ')
        : (() => { const score = getNestedSkinScore(health[key]); return score === null ? '' : `${Math.round(score)} / 100`; })();
      return value ? `<span class="quiz-skin-metric"><strong>${escapeHTML(label)}</strong><small>${escapeHTML(value)}</small></span>` : '';
    }).filter(Boolean).join('');
    const hasColours = Boolean(colourChips);
    const hasHealth = Boolean(metricChips);
    if (!hasColours && !hasHealth) {
      target.innerHTML = '<p class="quiz-skin-empty">No skin analysis is saved yet. You can still finish the quiz; run Skin analysis when you want to add detected colour and skin-health information.</p>';
      return;
    }
    const colourStamp = state.profile.skinAnalysisUpdatedAt ? new Date(state.profile.skinAnalysisUpdatedAt).toLocaleString() : '';
    const healthStamp = state.profile.skinHealthAnalysisUpdatedAt ? new Date(state.profile.skinHealthAnalysisUpdatedAt).toLocaleString() : '';
    target.innerHTML = `${hasColours ? `<div class="quiz-skin-group"><strong>Facial colour notes</strong>${colourStamp ? `<small>Updated ${escapeHTML(colourStamp)}</small>` : ''}<div class="quiz-skin-chip-row">${colourChips}</div></div>` : ''}${hasHealth ? `<div class="quiz-skin-group"><strong>Skin-health indicators</strong>${healthStamp ? `<small>Updated ${escapeHTML(healthStamp)}</small>` : ''}<div class="quiz-skin-metric-row">${metricChips}</div></div>` : ''}<p class="quiz-skin-footnote">Saved results are reused; choosing this section does not run another analysis.</p>`;
  }

  function updateUserIdentity() {
    const rawName = String(state.profile.displayName || '').trim();
    const name = !rawName || rawName === 'myStyle Member' ? 'James' : rawName;
    const userName = $('.user-name');
    if (userName) userName.textContent = `Welcome! ${name}`;
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
    const location = [state.profile.region, state.profile.city, COUNTRY() === 'CA' ? 'Canada' : 'United States'].filter(Boolean).join(', ');
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
    black: '#202124', stone: '#bcb4a6', white: '#f8f7f2', neutral: '#c9c1b5', beige: '#d4c1a7', blue: '#416c9f', green: '#477653', red: '#bf3f47', yellow: '#d8b84e', orange: '#d97936', multicolour: '#9b719d', multicolor: '#9b719d', dark: '#34343b', cream: '#eee5d4', 'soft white': '#f5f3ec', oatmeal: '#c6b59b', grey: '#898e95', gray: '#898e95', charcoal: '#44474e', navy: '#27384f', 'ink blue': '#263c57', slate: '#7f8996', burgundy: '#743846', berry: '#a53d60', rust: '#b76340', olive: '#69724b', sage: '#9eae99', camel: '#b38b63', taupe: '#9a8a7b', sand: '#d2b995', ecru: '#e7dcc6', 'forest green': '#345745', 'light blue': '#9fb9cc', indigo: '#3e5479', 'washed black': '#343438', 'sky blue': '#91bad3', 'bright red': '#c93643', cobalt: '#255cc5', blush: '#e5bfc3', lavender: '#c5b6db', plum: '#663c63', emerald: '#246b54', teal: '#287f83', brown: '#76533d', chocolate: '#56382f', tan: '#ba9268', pink: '#d992a3', floral: '#c58b8e', ivory: '#f5f0e2', silver: '#a6aaae', gold: '#c4a05e', 'soft white': '#f5f3ec', 'denim blue': '#587794', 'warm cream': '#eee4d1', terracotta: '#b76340', 'icy blue': '#c7e1f0', 'cool grey': '#a5a8ad'
  };
  function colorHex(color) { const key = String(color).toLowerCase(); return COLOR_HEX[key] || '#b4b5b0'; }

  function productFocus(item) {
    const name = String(item.name || '').trim();
    const category = String(item.category || '').trim().toLowerCase();
    const patterns = {
      outerwear: /\b(?:[\w-]+\s+){0,2}(?:coat|jacket|blazer|parka|trench|windbreaker)\b/i,
      layering: /\b(?:[\w-]+\s+){0,2}(?:overshirt|shacket|cardigan|sweater|knit|jacket|scarf|shirt)\b/i,
      tops: /\b(?:[\w-]+\s+){0,2}(?:t-shirt|tshirt|tee|shirt|blouse|polo|top)\b/i,
      knitwear: /\b(?:[\w-]+\s+){0,2}(?:sweater|cardigan|knit|jumper)\b/i,
      denim: /\b(?:[\w-]+\s+){0,2}(?:denim jacket|jeans|denim)\b/i,
      bottoms: /\b(?:[\w-]+\s+){0,2}(?:trousers|pants|jeans|shorts|skirt)\b/i,
      skirts: /\b(?:[\w-]+\s+){0,2}(?:skirt)\b/i,
      'one-piece': /\b(?:[\w-]+\s+){0,2}(?:jumpsuit|romper|dress)\b/i,
      workwear: /\b(?:[\w-]+\s+){0,2}(?:blazer|trousers|shirt|pants)\b/i,
      sport: /\b(?:[\w-]+\s+){0,2}(?:jacket|leggings|joggers|track pants|sportswear|shorts)\b/i,
      evening: /\b(?:[\w-]+\s+){0,2}(?:dress|top|heels)\b/i,
      bags: /\b(?:[\w-]+\s+){0,2}(?:crossbody|messenger|briefcase|bag)\b/i,
      scarves: /\b(?:[\w-]+\s+){0,2}(?:scarf)\b/i,
      hats: /\b(?:[\w-]+\s+){0,2}(?:hat|cap)\b/i,
      shoes: /\b(?:[\w-]+\s+){0,2}(?:boots|shoes|sneakers)\b/i,
      accessories: /\b(?:[\w-]+\s+){0,2}(?:watch|glasses|sunglasses|accessories)\b/i
    };
    let pattern = patterns[category];
    if (!pattern) pattern = /\b(?:[\w-]+\s+){0,2}(?:coat|jacket|blazer|overshirt|sweater|cardigan|t-shirt|tee|shirt|blouse|trousers|pants|jeans|shorts|skirt|dress|jumpsuit|boots|shoes|bag|scarf|hat|cap)\b/i;
    const match = name.match(pattern);
    if (match?.[0]) return match[0].replace(/\s+/g, ' ').trim();
    const fallbacks = {
      outerwear: 'jacket', layering: 'layering piece', tops: 'shirt', knitwear: 'sweater', denim: 'denim clothing',
      bottoms: 'trousers', skirts: 'skirt', 'one-piece': 'jumpsuit', workwear: 'workwear clothing', sport: 'sportswear',
      evening: 'evening clothing', bags: 'bag', scarves: 'scarf', hats: 'hat', shoes: 'shoes', accessories: 'accessories'
    };
    return fallbacks[category] || 'clothing';
  }

  function productSearchQuery(item) {
    const focus = productFocus(item);
    const focusKey = focus.toLowerCase();
    const neutralColours = new Set(['neutral', 'earth', 'dark', 'multicolour', 'multicolor']);
    const colours = (item.colors || []).filter(colour => {
      const value = String(colour).toLowerCase();
      return !neutralColours.has(value) && !focusKey.includes(value);
    }).slice(0, 2);
    const preference = normalizeGenderPreference(state.profile.genderPreference);
    const itemGender = (item.gender_tags || []).find(value => ['men', 'women'].includes(value));
    const audience = preference === 'men' || preference === 'women' ? preference : itemGender;
    const audienceTerm = audience === 'men' ? "men's" : audience === 'women' ? "women's" : '';
    const budget = state.profile.budget;
    const budgetTerm = budget !== undefined && budget !== null && budget !== '' && budget !== 'any' && Number.isFinite(Number(budget))
      ? `under ${CURRENCY() === 'CAD' ? 'CAD' : 'USD'} ${Math.round(Number(budget))}` : '';
    return [audienceTerm, focus, ...colours, budgetTerm, COUNTRY() === 'CA' ? 'Canada' : 'United States'].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function retailerChoices(item) {
    const query = productSearchQuery(item);
    const q = encodeURIComponent(query);
    const shoppingCountry = COUNTRY() === 'CA' ? 'ca' : 'us';
    const choices = [{
      name: 'Compare live product listings',
      url: `https://www.google.com/search?tbm=shop&gl=${shoppingCountry}&hl=en&q=${q}`,
      detail: `Compare current ${shoppingCountry === 'ca' ? 'Canadian' : 'US'} products, prices and retailers`
    }];
    if (COUNTRY() === 'CA') {
      choices.push({
        name: 'Amazon Canada',
        url: `https://www.amazon.ca/s?k=${q}`,
        detail: 'Search Canadian product listings'
      });
    }
    return choices;
  }

  function openBuyDialog(itemId) {
    const wardrobeItem = state.wardrobeItems.find(entry => entry.id === itemId);
    const item = wardrobeItem || findItem(itemId) || state.recommendations.find(entry => entry.id === itemId) || state.accessoryRecommendations.find(entry => entry.id === itemId);
    if (!item) { showAlert('Could not find the selected item. Refresh Ensemble and try again.', 'error'); return; }
    const title = $('#buy-dialog-title');
    const subtitle = $('#buy-dialog-subtitle');
    const container = $('#buy-retailer-links');
    if (!container) return;
    if (title) title.textContent = 'Shop similar items';
    const searchQuery = productSearchQuery(item);
    if (subtitle) subtitle.textContent = `${item.name} · ${COUNTRY() === 'US' ? 'United States' : 'Canada'}`;
    const choices = retailerChoices(item);
    container.innerHTML = choices.map(store => `<a class="buy-retailer-link" href="${escapeHTML(store.url)}" target="_blank" rel="noopener noreferrer"><span><strong>${escapeHTML(store.name)}</strong><small>${escapeHTML(store.detail)}</small></span><span aria-hidden="true">↗</span></a>`).join('');
    const disclaimer = $('.buy-disclaimer');
    if (disclaimer) disclaimer.textContent = `Search terms: ${searchQuery}. These are live store or shopping searches, not an exact SKU match. Confirm the product, price, stock and sizing on the retailer's site.`;
    const dialog = $('#buy-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function renderStyleCard(item, savedView = false) {
    const saved = (state.profile.savedItemIds || []).includes(item.id);
    const swatches = (item.colors || []).slice(0, 5).map(color => `<span class="style-color-swatch" style="background:${colorHex(color)}" title="${escapeHTML(color)}" aria-label="${escapeHTML(color)}"></span>`).join('');
    const seasonBadge = item.season_match ? `${SEASON_NAMES[activeSeason()] || 'Seasonal'} pick` : 'Versatile piece';
    const targetPrice = item.target_price ?? (COUNTRY() === 'US' ? item.target_usd : item.target_cad);
    const tags = [...(item.style_tags || []).slice(0, 3), item.category].map(tag => `<span>${escapeHTML(tag)}</span>`).join('');
    const photoCredit = item.image_source_url ? `<a class="style-photo-credit" href="${escapeHTML(item.image_source_url)}" target="_blank" rel="noopener noreferrer">Photo via Pexels</a>` : '';
    const accessoryKind = item.try_on_kind || item.accessory_kind || '';
    const tryOnTypeSupported = item.item_type === 'clothing' || (item.item_type === 'accessory' && ['bag', 'hat', 'scarf', 'shoes'].includes(accessoryKind));
    const canTry = Boolean(item.try_on_supported && item.image_kind === 'photo' && tryOnTypeSupported);
    const actions = `<button class="button button-primary" data-buy-item="${escapeHTML(item.id)}" type="button">Buy / find similar</button>${canTry ? `<button class="button button-outline" data-try-on="${escapeHTML(item.id)}" type="button">Virtual try-on</button>` : ''}${savedView ? '' : `<button class="button button-outline" data-not-for-me="${escapeHTML(item.id)}" type="button">Not for me</button>`}`;
    return `<article class="style-card" data-item-card="${escapeHTML(item.id)}">
      <div class="style-card-media" data-image-state="loading"><img data-style-image src="${escapeHTML(item.image_url)}" alt="Fashion photograph showing ${escapeHTML(item.name)}; listed colours: ${(item.colors || []).slice(0, 3).map(escapeHTML).join(', ')}" loading="lazy" decoding="async"><span class="style-card-season">${escapeHTML(seasonBadge)}</span><button class="save-style-button" data-save-item="${escapeHTML(item.id)}" type="button" aria-pressed="${String(saved)}" aria-label="${saved ? 'Remove from' : 'Save to'} my saved pieces">${saved ? '♥' : '♡'}</button></div>
      <div class="style-card-content"><div class="style-card-kicker"><span>${escapeHTML(item.category)}</span><span class="budget-target">Budget guide ${escapeHTML(money(targetPrice, item.currency || CURRENCY()))}</span></div><h3>${escapeHTML(item.name)}</h3><p class="style-card-description">${escapeHTML(item.description)}</p><p class="style-match-reason">${escapeHTML(item.recommendation_reason || 'A style reference to consider for your wardrobe.')}</p><div class="style-card-swatches" aria-label="Colour ideas">${swatches}<span>${escapeHTML((item.colors || []).slice(0, 3).join(' · '))}</span></div><div class="style-card-tags">${tags}</div>${photoCredit}<div class="style-card-actions">${actions}</div></div>
    </article>`;
  }

  function stylePhotoRetryUrls(source) {
    try {
      const original = new URL(source, window.location.href);
      if (original.hostname !== 'images.pexels.com') return [];
      return [960, 640, 1440].map(width => {
        const candidate = new URL(original.href);
        candidate.searchParams.set('w', String(width));
        return candidate.href;
      }).filter((url, index, list) => url !== original.href && list.indexOf(url) === index);
    } catch (_) {
      return [];
    }
  }

  function bindStyleImages(root = document) {
    $$('img[data-style-image]', root).forEach(img => {
      if (img.dataset.bound === '1') return;
      img.dataset.bound = '1';
      const parent = img.closest('.style-card-media');
      const setState = stateName => parent?.setAttribute('data-image-state', stateName);
      const candidates = [img.currentSrc || img.src, ...stylePhotoRetryUrls(img.src)];
      let candidateIndex = 0;
      img.addEventListener('load', () => setState('loaded'));
      img.addEventListener('error', () => {
        candidateIndex += 1;
        if (candidateIndex < candidates.length) {
          setState('loading');
          img.src = candidates[candidateIndex];
          return;
        }
        // Never leave a recommendation card on screen with a missing-photo tile.
        const card = img.closest('.style-card');
        card?.remove();
        const grid = root.matches?.('#recommendation-grid') ? root : root.closest?.('#recommendation-grid');
        if (grid && !grid.querySelector('.style-card') && !grid.querySelector('.photo-retry-state')) {
          grid.innerHTML = '<div class="no-results photo-retry-state"><strong>Fashion photos could not be loaded.</strong><p>Check your connection and refresh recommendations to try again.</p><button class="button button-primary" type="button" id="retry-edit">Refresh recommendations</button></div>';
        }
      });
      if (img.complete) {
        if (img.naturalWidth) setState('loaded');
        else {
          candidateIndex = 1;
          if (candidateIndex < candidates.length) img.src = candidates[candidateIndex];
          else img.dispatchEvent(new Event('error'));
        }
      }
    });
  }

  function renderRecommendations(items) {
    const grid = $('#recommendation-grid');
    if (!grid) return;
    if (!items.length) {
      if (state.lastQuery) {
        grid.innerHTML = `<div class="no-results mystyle-no-results"><strong>No styles matched “${escapeHTML(state.lastQuery)}”.</strong><p>Try another garment, colour or style, or adjust your season and budget in Style profile.</p><button class="button button-outline" type="button" data-clear-style-search>Clear search</button></div>`;
      } else {
        const budget = state.profile.budget === 'any' ? 'your current filters' : `a ${money(Number(state.profile.budget))} per-piece target`;
        grid.innerHTML = `<div class="no-results mystyle-no-results"><strong>No pieces matched ${escapeHTML(budget)}.</strong><p>Try widening your budget, changing the colour scheme, or removing a “Not for me” response.</p><button class="button button-outline" type="button" data-reset-dislikes="true">Reset hidden feedback</button></div>`;
      }
      return;
    }
    grid.innerHTML = items.map(item => renderStyleCard(item, false)).join('');
    bindStyleImages(grid);
    renderEnsembleWardrobeMatches();
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
      summary.innerHTML = `<span class="accessory-skin-swatch" style="background:${escapeHTML(colour)}"></span><div><strong>${escapeHTML(guide.label)}</strong><p>Skin colour detected: ${escapeHTML(colour)}. Suggested accent colours: ${escapeHTML(guide.colors.join(', '))}.</p></div>`;
    }
    if (status) status.textContent = items.length ? `${items.length} accessory ideas matched to your skin-analysis colour cues` : (state.lastQuery ? `No accessory matches for “${state.lastQuery}”.` : 'No accessories match the current season or budget. Adjust your profile and refresh.');
    if (!items.length) {
      grid.innerHTML = state.lastQuery
        ? `<div class="no-results"><strong>No accessories matched “${escapeHTML(state.lastQuery)}”.</strong><p>Try another term or clear the search.</p></div>`
        : '<div class="no-results"><strong>No accessory matches found.</strong><p>Try adjusting your budget or season in Style profile.</p></div>';
      return;
    }
    grid.innerHTML = items.map(item => renderStyleCard(item, false)).join('');
    bindStyleImages(grid);
    renderEnsembleWardrobeMatches();
  }

  function switchStyleWorkspaceTab(tab) {
    state.activeStyleWorkspaceTab = tab === 'profile' ? 'profile' : 'ensemble';
    $$('[data-linked-tab]').forEach(button => {
      const active = button.dataset.linkedTab === state.activeStyleWorkspaceTab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $$('[data-linked-panel]').forEach(panel => { panel.hidden = panel.dataset.linkedPanel !== state.activeStyleWorkspaceTab; });
    if (state.activeStyleWorkspaceTab === 'profile') renderProfileChoices();
    else renderEnsembleWardrobeMatches();
  }

  function switchEnsembleTab(tab) {
    state.activeEnsembleTab = ['accessories', 'skincare'].includes(tab) ? tab : 'clothing';
    $$('[data-ensemble-tab]').forEach(button => {
      const active = button.dataset.ensembleTab === state.activeEnsembleTab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $$('[data-ensemble-panel]').forEach(panel => { panel.hidden = panel.dataset.ensemblePanel !== state.activeEnsembleTab; });
    if (state.activeEnsembleTab === 'accessories') renderAccessories(state.accessoryRecommendations);
    if (state.activeEnsembleTab === 'skincare') renderSkincareRecommendations();
    renderEnsembleWardrobeMatches();
  }

  function normalizeMatchValue(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function wardrobeCategoryFamily(item) {
    const category = normalizeMatchValue(item.category || item.subcategory || '');
    const name = normalizeMatchValue(item.name || '');
    const combined = `${category} ${name}`;
    if (/shoe|sneaker|boot|loafer|footwear/.test(combined)) return 'shoes';
    if (/bag|backpack|tote|crossbody|purse|briefcase/.test(combined)) return 'bags';
    if (/scarf|headscarf/.test(combined)) return 'scarves';
    if (/hat|cap|beanie/.test(combined)) return 'hats';
    if (/jewel|necklace|earring|bracelet|ring|watch|eyewear|sunglasses|belt/.test(combined)) return 'accessories';
    if (/outerwear|jacket|coat|blazer|shell|overshirt|vest/.test(combined)) return 'outerwear';
    if (/bottom|trouser|jean|denim|skirt|shorts|pants/.test(combined)) return 'bottoms';
    if (/dress|jumpsuit/.test(combined)) return 'one-piece';
    if (/top|shirt|tee|blouse|knit|sweater|hoodie|cardigan/.test(combined)) return 'tops';
    return category;
  }

  function renderEnsembleWardrobeMatches() {
    const section = $('#ensemble-wardrobe-matches');
    const grid = $('#ensemble-wardrobe-grid');
    if (!section || !grid) return;
    if (state.activeEnsembleTab === 'skincare') {
      section.hidden = true;
      grid.replaceChildren();
      state.ensembleWardrobeObjectUrls.forEach(url => URL.revokeObjectURL(url));
      state.ensembleWardrobeObjectUrls = [];
      return;
    }
    state.ensembleWardrobeObjectUrls.forEach(url => URL.revokeObjectURL(url));
    state.ensembleWardrobeObjectUrls = [];
    const recommendations = state.activeEnsembleTab === 'accessories'
      ? state.accessoryRecommendations
      : state.recommendations;
    if (!state.wardrobeItems.length || !recommendations.length) {
      section.hidden = true;
      grid.replaceChildren();
      return;
    }
    const season = activeSeason();
    const recommendationsForMatches = recommendations.map(item => ({
      item,
      category: wardrobeCategoryFamily(item),
      colors: new Set((item.colors || []).map(normalizeMatchValue)),
      itemType: item.item_type === 'accessory' ? 'accessory' : 'clothing'
    }));
    const matches = state.wardrobeItems.map(wardrobe => {
      if (wardrobe.item_type === 'skincare') return null;
      if (state.activeEnsembleTab === 'accessories' && wardrobe.item_type !== 'accessory') return null;
      if (state.activeEnsembleTab === 'clothing' && wardrobe.item_type !== 'clothing') return null;
      if (wardrobe.season && wardrobe.season !== 'all' && wardrobe.season !== season) return null;
      const colors = new Set((wardrobe.colors || []).map(normalizeMatchValue));
      let best = { score: 0, recommendation: null, colourOverlap: 0, categoryMatch: false };
      for (const candidate of recommendationsForMatches) {
        if (candidate.itemType !== wardrobe.item_type) continue;
        const overlap = [...colors].filter(color => [...candidate.colors].some(recommendedColor => {
          if (color === recommendedColor) return true;
          if (color.length >= 4 && recommendedColor.includes(color)) return true;
          if (recommendedColor.length >= 4 && color.includes(recommendedColor)) return true;
          const leftTokens = new Set(color.split(' '));
          const rightTokens = recommendedColor.split(' ');
          return rightTokens.some(token => token.length >= 4 && leftTokens.has(token));
        })).length;
        const categoryMatch = wardrobeCategoryFamily(wardrobe) === candidate.category;
        const score = overlap * 3 + (categoryMatch ? 4 : 0);
        if (score > best.score) best = { score, recommendation: candidate.item, colourOverlap: overlap, categoryMatch };
      }
      // Only show a wardrobe item when there is a concrete colour or category link
      // to an item in the current Ensemble recommendations.
      if (!best.recommendation || (!best.colourOverlap && !best.categoryMatch)) return null;
      return { ...wardrobe, matchScore: best.score, matchedRecommendation: best.recommendation, colourOverlap: best.colourOverlap, categoryMatch: best.categoryMatch };
    }).filter(Boolean).sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
    section.hidden = !matches.length;
    if (!matches.length) { grid.replaceChildren(); return; }
    grid.innerHTML = matches.map(item => {
      const url = URL.createObjectURL(item.imageBlob);
      state.ensembleWardrobeObjectUrls.push(url);
      const reason = item.colourOverlap ? `Shares ${item.colors.filter(color => (item.matchedRecommendation.colors || []).map(normalizeMatchValue).includes(normalizeMatchValue(color))).join(', ')} with ${item.matchedRecommendation.name}` : `Same category as ${item.matchedRecommendation.name}`;
      const tryOnAction = wardrobeTryOnKind(item)
        ? `<button class="button button-primary" data-try-on="${escapeHTML(item.id)}" type="button">Try on</button>`
        : '';
      return `<article class="wardrobe-match-card"><img src="${url}" alt="Your closet item ${escapeHTML(item.name)}"><div><p class="wardrobe-match-kicker">Already in your closet</p><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(reason)}</p><div class="wardrobe-match-actions">${tryOnAction}<button class="button button-outline" data-buy-item="${escapeHTML(item.id)}" type="button">Buy similar</button></div></div></article>`;
    }).join('');
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
    const skincare = type === 'skincare';
    const coloursField = $('#wardrobe-colours-field');
    const seasonField = $('#wardrobe-season-field');
    const notesLabel = $('#wardrobe-notes-label');
    const notes = $('#wardrobe-notes');
    if (coloursField) coloursField.hidden = skincare;
    if (seasonField) seasonField.hidden = skincare;
    if (notesLabel) notesLabel.innerHTML = `${skincare ? 'Product details' : 'Notes'} <span class="optional-label">optional</span>`;
    if (notes) notes.placeholder = skincare ? 'e.g. ingredients, skin goals, routine notes…' : 'Fit, material, outfit ideas…';
    const itemName = $('#wardrobe-item-name');
    if (itemName) itemName.placeholder = skincare ? 'e.g. Daily hydrating moisturizer' : 'e.g. Navy wool coat';
    const photoLabel = $('#wardrobe-photo')?.closest('.form-field')?.querySelector('label');
    if (photoLabel) photoLabel.innerHTML = `${skincare ? 'Product photo' : 'Item photo'} <span class="required-marker">*</span>`;
    const photoHelp = $('#wardrobe-photo-help');
    if (photoHelp) photoHelp.textContent = skincare
      ? 'Add a clear photo of the product or its packaging. JPG, JPEG or PNG under 9.5 MB; the image stays in this browser.'
      : 'JPG, JPEG or PNG, under 9.5 MB and at least 160 × 160 pixels. The image stays in this browser.';
    const submit = $('#wardrobe-add-button');
    if (submit && !submit.disabled) submit.textContent = 'Add to My closet';
  }

  function wardrobeTryOnKind(item) {
    if (item.item_type === 'skincare') return '';
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
    if (status) status.textContent = `${state.wardrobeItems.length} ${state.wardrobeItems.length === 1 ? 'item' : 'items'} in your closet`;
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
    if (!items.length) {
      const title = $('#wardrobe-empty h2');
      const copy = $('#wardrobe-empty p');
      if (!state.wardrobeItems.length) {
        if (title) title.textContent = 'Your closet is empty.';
        if (copy) copy.textContent = 'Add clothing, accessories or skincare products to keep your personal items together.';
      } else {
        const emptyLabels = { clothing: ['No clothing items yet.', 'Add clothing to keep it in your closet.'], accessory: ['No accessories yet.', 'Add accessories to keep them in your closet.'], skincare: ['No skincare products yet.', 'Add products you already use to keep your routine together.'] };
        const message = emptyLabels[state.wardrobeFilter] || ['No items in this filter.', 'Choose another filter or add a new item.'];
        if (title) title.textContent = message[0];
        if (copy) copy.textContent = message[1];
      }
      grid.replaceChildren();
      return;
    }
    grid.innerHTML = items.map(item => {
      const url = URL.createObjectURL(item.imageBlob);
      state.wardrobeObjectUrls.push(url);
      const colours = (item.colors || []).map(colour => escapeHTML(colour)).join(' · ');
      const season = item.season && item.season !== 'all' ? item.season[0].toUpperCase() + item.season.slice(1) : 'All seasons';
      const canTry = Boolean(wardrobeTryOnKind(item));
      const typeLabel = item.item_type === 'accessory' ? 'Accessory' : item.item_type === 'skincare' ? 'Skincare' : 'Clothing';
      const actionMarkup = canTry ? `<button class="button button-primary" data-try-on="${escapeHTML(item.id)}" type="button">Try on</button>` : '';
      return `<article class="wardrobe-card" data-wardrobe-card="${escapeHTML(item.id)}">
        <div class="wardrobe-card-media"><img src="${url}" alt="Your photo of ${escapeHTML(item.name)}" loading="lazy" decoding="async"><span class="wardrobe-type-label">${typeLabel}</span></div>
        <div class="wardrobe-card-content"><p class="wardrobe-card-category">${escapeHTML(item.category)}${item.item_type === 'skincare' ? '' : ` · ${escapeHTML(season)}`}</p><h3>${escapeHTML(item.name)}</h3>${colours ? `<p class="wardrobe-colours">${colours}</p>` : ''}${item.notes ? `<p class="wardrobe-notes">${escapeHTML(item.notes)}</p>` : ''}
          <div class="wardrobe-card-actions">${actionMarkup}<button class="button button-outline" data-delete-wardrobe-item="${escapeHTML(item.id)}" type="button">Remove</button></div>
        </div></article>`;
    }).join('');
  }

  async function addWardrobeItem(event) {
    event?.preventDefault?.();
    const form = $('#wardrobe-form');
    const file = $('#wardrobe-photo')?.files?.[0];
    if (!file) { showAlert('Choose a photo of the item or product you want to add.', 'error'); return; }
    const photoMimeType = supportedPhotoMimeType(file);
    if (!photoMimeType) { showAlert('Use a JPG, JPEG or PNG photo.', 'error'); return; }
    if (!file.size || file.size > 9_500_000) { showAlert('Choose a photo smaller than 9.5 MB.', 'error'); return; }
    const submit = $('#wardrobe-add-button');
    if (submit?.disabled) return;
    if (submit) { submit.disabled = true; submit.textContent = 'Adding item…'; }
    try {
      const dimensions = await getImageDimensions(file);
      if (dimensions.width < 160 || dimensions.height < 160) throw new Error('Choose a clearer photo at least 160 × 160 pixels.');
      const name = $('#wardrobe-item-name')?.value.trim();
      if (!name) throw new Error('Give this item a name.');
      const rawType = $('#wardrobe-item-type')?.value || 'clothing';
      const itemType = ['clothing', 'accessory', 'skincare'].includes(rawType) ? rawType : 'clothing';
      const category = $('#wardrobe-category')?.value || (itemType === 'accessory' ? 'Other accessories' : itemType === 'skincare' ? 'Other skincare' : 'Tops');
      const colors = itemType === 'skincare' ? [] : String($('#wardrobe-colours')?.value || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 8);
      const id = globalThis.crypto?.randomUUID?.() || `wardrobe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const item = {
        id, name, item_type: itemType, category, colors,
        season: itemType === 'skincare' ? 'all' : ($('#wardrobe-season')?.value || 'all'),
        notes: $('#wardrobe-notes')?.value.trim().slice(0, 400) || '',
        imageBlob: file.slice(0, file.size, photoMimeType), imageType: photoMimeType,
        imageName: file.name || `${id}.jpg`, createdAt: new Date().toISOString(),
      };
      await dbRequest('wardrobe', 'put', item);
      state.wardrobeItems.unshift(item);
      state.wardrobeFilter = 'all';
      form.reset();
      updateWardrobeCategoryOptions();
      renderWardrobe();
      renderEnsembleWardrobeMatches();
      showAlert('Added to My closet. The photo stays in this browser.', 'good');
    } catch (error) {
      showAlert(error.message || 'Could not add this item to My closet.', 'error');
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = 'Add to My closet'; }
    }
  }

  async function removeWardrobeItem(itemId) {
    const item = state.wardrobeItems.find(entry => entry.id === itemId);
    if (!item) return;
    if (!window.confirm(`Remove “${item.name}” from My closet?`)) return;
    try {
      await dbRequest('wardrobe', 'delete', itemId);
      state.wardrobeItems = state.wardrobeItems.filter(entry => entry.id !== itemId);
      renderWardrobe();
      renderEnsembleWardrobeMatches();
      showAlert('Item removed from My closet.', 'good');
    } catch (error) {
      showAlert(`Could not remove this item: ${error.message}`, 'error');
    }
  }

  function skinPaletteGuide(colors) {
    if (!colors || !/^#[0-9a-f]{6}$/i.test(colors.skin_color || '')) return null;
    const r = parseInt(colors.skin_color.slice(1, 3), 16);
    const b = parseInt(colors.skin_color.slice(5, 7), 16);
    if (r - b >= 16) return { label: 'Suggested accent palette', family: 'warm', colors: ['olive', 'rust', 'camel', 'warm cream', 'terracotta', 'teal'], note: 'An approximate palette prompt from the detected image colours, not a definitive undertone analysis.' };
    if (b - r >= 10) return { label: 'Suggested accent palette', family: 'cool', colors: ['navy', 'berry', 'cobalt', 'cool grey', 'plum', 'icy blue'], note: 'An approximate palette prompt from the detected image colours, not a definitive undertone analysis.' };
    return { label: 'Suggested accent palette', family: 'balanced', colors: ['soft white', 'denim blue', 'sage', 'burgundy', 'taupe', 'charcoal'], note: 'An approximate palette prompt from the detected image colours, not a definitive undertone analysis.' };
  }

  function renderProfileSkinSummary(colors = state.profile.skinAnalysis) {
    const panel = $('#profile-skin-summary');
    const status = $('#profile-skin-status');
    const swatches = $('#profile-skin-swatches');
    if (!panel || !status || !swatches) return;
    const keys = [
      ['skin_color', 'Skin'], ['hair_color', 'Hair'], ['eye_color', 'Eyes'],
      ['eyebrow_color', 'Brows'], ['lip_color', 'Lips']
    ];
    const found = keys.filter(([key]) => /^#[0-9a-f]{6}$/i.test(colors?.[key] || ''));
    const available = found.some(([key]) => key === 'skin_color');
    panel.dataset.available = String(available);
    panel.setAttribute('aria-disabled', String(!available));
    if (!available) {
      status.textContent = 'No completed skin analysis yet. Run analysis to enable these colour notes.';
      swatches.replaceChildren();
      return;
    }
    const stamp = state.profile.skinAnalysisUpdatedAt ? new Date(state.profile.skinAnalysisUpdatedAt).toLocaleString() : 'Saved analysis';
    status.textContent = `Detected colour notes · Updated ${stamp}`;
    swatches.innerHTML = found.map(([key, label]) => `<span class="profile-skin-swatch-chip"><i style="background:${escapeHTML(colors[key])}"></i><strong>${label}</strong><small>${escapeHTML(colors[key])}</small></span>`).join('');
  }

  function renderSkinAnalysis(colors) {
    renderQuizSkinInfo();
    const target = $('#skin-analysis-preview');
    if (!target) return;
    renderProfileSkinSummary(colors);
    renderSkinHealthAnalysis(state.profile.skinHealthAnalysis);
    if (!colors || !Object.keys(colors).length) {
      target.innerHTML = '<div class="skin-empty-state"><strong>Your colour notes will appear here</strong><p>Run the analysis to add more colour context to Ensemble.</p></div>';
      return;
    }
    const order = ['skin_color', 'hair_color', 'eye_color', 'eyebrow_color', 'lip_color'];
    const labels = { skin_color: 'Skin colour', hair_color: 'Hair colour', eye_color: 'Eye colour', eyebrow_color: 'Eyebrow colour', lip_color: 'Lip colour' };
    const detected = order.filter(key => /^#[0-9a-f]{6}$/i.test(colors[key] || '')).map(key => `<div class="analysis-tone"><span style="background:${escapeHTML(colors[key])}"></span><div><strong>${escapeHTML(labels[key])}</strong><small>${escapeHTML(colors[key])}${colors[`${key}_name`] ? ` · ${escapeHTML(colors[`${key}_name`])}` : ''}</small></div></div>`).join('');
    const applicationCopy = 'Detected colour values are saved in your profile and can be used as styling context.';
    target.innerHTML = `<div class="skin-analysis-results"><div class="analysis-heading"><h3>Your colour notes</h3><p>These are detected facial colour values. Use them as styling inspiration.</p></div><div class="analysis-tone-grid">${detected || '<p>No recognized hex colour values were returned by the provider.</p>'}</div><p class="analysis-applied-note">${escapeHTML(applicationCopy)}</p></div>`;
    renderQuizSkinInfo();
  }

  function readSkincarePreferencesFromUI() {
    return {
      sensitivity: $('#skincare-sensitivity')?.value || state.profile.skincarePreferences?.sensitivity || 'unknown',
      budget: $('#skincare-budget')?.value || state.profile.skincarePreferences?.budget || 'any',
    };
  }

  function hydrateSkincarePreferences() {
    const preferences = { ...DEFAULT_PROFILE.skincarePreferences, ...(state.profile.skincarePreferences || {}) };
    if ($('#skincare-sensitivity')) $('#skincare-sensitivity').value = preferences.sensitivity;
    if ($('#quiz-skincare-sensitivity')) $('#quiz-skincare-sensitivity').value = preferences.sensitivity;
    const budget = $('#skincare-budget');
    if (budget) {
      const currency = state.profile.country === 'US' ? 'US$' : 'CA$';
      const budgetLabels = {
        any: 'No set budget',
        under25: `Under ${currency}25`,
        '25to50': `${currency}25–50`,
        '50to100': `${currency}50–100`,
        over100: `Over ${currency}100`,
      };
      Array.from(budget.options).forEach(option => {
        if (budgetLabels[option.value]) option.textContent = budgetLabels[option.value];
      });
      budget.value = preferences.budget;
    }
  }

  function getNestedSkinScore(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object') return null;
    if (typeof value.ui_score === 'number') return value.ui_score;
    if (typeof value.score === 'number') return value.score;
    if (typeof value.raw_score === 'number') return value.raw_score;
    for (const child of Object.values(value)) {
      const score = getNestedSkinScore(child);
      if (score !== null) return score;
    }
    return null;
  }

  function getNestedSkinWords(value) {
    if (typeof value === 'string') return [value.toLowerCase()];
    if (!value || typeof value !== 'object') return [];
    return Object.values(value).flatMap(getNestedSkinWords);
  }

  function normalizeSkinHealthMetrics(value, depth = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 5) return null;
    const metricKeys = ['skin_type', 'skinType', 'moisture', 'oiliness', 'redness', 'pore', 'pores', 'acne', 'radiance', 'texture', 'skin_age'];
    if (metricKeys.some(key => Object.prototype.hasOwnProperty.call(value, key))) return value;
    const wrappers = ['metrics', 'results', 'result', 'data', 'analysis', 'skinHealthAnalysis', 'skin_health_analysis', 'skinHealth', 'skin_health', 'skincareAnalysis', 'skinAnalysis'];
    for (const key of wrappers) {
      const nested = normalizeSkinHealthMetrics(value[key], depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  function getSavedSkinHealthMetricsFromProfile(profile = state.profile) {
    if (!profile || typeof profile !== 'object') return null;
    const candidates = [
      profile.skinHealthAnalysis, profile.skincareAnalysis, profile.skinHealthResults,
      profile.skin_health_analysis, profile.skinHealth, profile.skinAnalysis,
      profile.analysis, profile.skinAnalysisResults
    ];
    for (const candidate of candidates) {
      const metrics = normalizeSkinHealthMetrics(candidate);
      if (metrics && Object.keys(metrics).length) return metrics;
    }
    return null;
  }

  function getSavedSkinHealthMetrics() {
    return getSavedSkinHealthMetricsFromProfile(state.profile);
  }

  function hasSavedColourAnalysis() {
    const colours = state.profile?.skinAnalysis;
    return Boolean(colours && typeof colours === 'object' &&
      ['skin_color', 'hair_color', 'eye_color', 'eyebrow_color', 'lip_color']
        .some(key => /^#[0-9a-f]{6}$/i.test(String(colours[key] || ''))));
  }

  function hasAnySavedSkinAnalysis() {
    const health = getSavedSkinHealthMetrics();
    return Boolean((health && Object.keys(health).length) || hasSavedColourAnalysis());
  }

  function skincareProductSuggestions(metrics, preferences = state.profile.skincarePreferences || {}) {
    metrics = metrics && typeof metrics === 'object' ? metrics : {};
    const hasHealthMetrics = ['skin_type', 'skinType', 'moisture', 'oiliness', 'redness', 'pore', 'pores', 'acne', 'radiance', 'texture', 'skin_age']
      .some(key => Object.prototype.hasOwnProperty.call(metrics, key));
    const skinTypeText = getNestedSkinWords(metrics.skin_type || metrics.skinType).join(' ');
    const moisture = getNestedSkinScore(metrics.moisture);
    const oiliness = getNestedSkinScore(metrics.oiliness);
    const redness = getNestedSkinScore(metrics.redness);
    const pores = getNestedSkinScore(metrics.pore);
    const acne = getNestedSkinScore(metrics.acne);
    const texture = getNestedSkinScore(metrics.texture);
    const radiance = getNestedSkinScore(metrics.radiance);
    const sensitive = preferences.sensitivity === 'sensitive' || /redness|sensitive/.test(skinTypeText) || (redness !== null && redness < 65);
    const dry = /dry/.test(skinTypeText) || (moisture !== null && moisture < 68);
    const oilyOrCombination = /oily|combination/.test(skinTypeText);
    const poreOrBlemishFocus = (pores !== null && pores < 65) || (acne !== null && acne < 65);
    const textureFocus = (texture !== null && texture < 65) || (radiance !== null && radiance < 65);
    const currencyLabel = state.profile.country === 'US' ? 'USD' : 'CAD';
    const queryBudget = ({
      under25: `under ${currencyLabel} 25`,
      '25to50': `${currencyLabel} 25 to 50`,
      '50to100': `${currencyLabel} 50 to 100`,
      over100: `over ${currencyLabel} 100`,
    })[preferences.budget] || '';
    const products = [];
    const add = (id, title, query, reason, category) => {
      if (products.some(product => product.id === id)) return;
      const tailoredQuery = [query, sensitive ? 'fragrance free' : '', queryBudget].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      products.push({ id, title, query: tailoredQuery, reason, category });
    };

    if (dry || (hasHealthMetrics && moisture === null)) {
      add('hydration', 'Hydration support', 'hydrating facial moisturizer', 'Your saved skin-health result suggests hydration is worth exploring.', 'Moisturizers');
    }
    if (sensitive) {
      add('gentle-care', 'Gentle, fragrance-free care', 'gentle fragrance free facial cleanser and moisturizer', 'The results or your sensitivity preference support starting with a gentle, fragrance-free routine.', 'Cleansers and moisturizers');
    }
    if (oilyOrCombination || poreOrBlemishFocus || (oiliness !== null && oiliness < 65)) {
      add('lightweight-care', 'Lightweight cleansing and moisture', 'lightweight non-comedogenic facial cleanser moisturizer', 'Your skin-type or pore/breakout indicators suggest exploring lightweight, non-stripping products.', 'Cleansers and moisturizers');
    }
    if (textureFocus) {
      add('texture-radiance', 'Texture and radiance products', 'gentle facial serum for texture and radiance', 'The results suggest you may want to explore products marketed for skin texture or radiance.', 'Serums');
    }
    if (!products.length) {
      add('daily-basics', 'Simple daily routine', 'gentle facial cleanser moisturizer', 'Start with a straightforward cleanser and moisturizer; use your personal preferences to choose a formula.', 'Cleansers and moisturizers');
    }
    add('daily-sunscreen', 'Daily facial sunscreen', 'broad spectrum SPF 30 facial sunscreen', 'Daily broad-spectrum sun protection is a useful routine step regardless of the analysis result.', 'Sunscreen');
    const sunscreen = products.find(product => product.id === 'daily-sunscreen');
    const tailored = products.filter(product => product.id !== 'daily-sunscreen').slice(0, 3);
    return [...tailored, ...(sunscreen ? [sunscreen] : [])];
  }

  function skincareRetailerLinks(product) {
    const query = encodeURIComponent(product.query);
    if (state.profile.country === 'US') {
      return [
        { label: 'Sephora US', action: 'Search', url: `https://www.sephora.com/search?keyword=${query}` },
        { label: 'Lancôme US', action: 'Browse', url: 'https://www.lancome-usa.com/skincare/' },
        { label: 'Clinique US', action: 'Browse', url: 'https://www.clinique.com/skincare-all' },
        { label: 'Amazon US', action: 'Search', url: `https://www.amazon.com/s?k=${query}` },
      ];
    }
    return [
      { label: 'Sephora Canada', action: 'Search', url: `https://www.sephora.com/ca/en/search?keyword=${query}` },
      { label: 'Lancôme Canada', action: 'Browse', url: 'https://www.lancome.ca/en/skincare/' },
      { label: 'Clinique Canada', action: 'Browse', url: 'https://www.clinique.ca/skincare-all' },
      { label: 'Amazon Canada', action: 'Search', url: `https://www.amazon.ca/s?k=${query}` },
    ];
  }

  function renderSkincareRecommendations() {
    const grid = $('#skincare-recommendation-grid');
    const empty = $('#skincare-empty-state');
    const status = $('#skincare-status');
    if (!grid || !empty || !status) return;
    const metrics = getSavedSkinHealthMetrics();
    const hasHealthResults = Boolean(metrics && Object.keys(metrics).length);
    const hasColourResults = hasSavedColourAnalysis();
    if (!hasHealthResults && !hasColourResults) {
      status.textContent = '';
      status.hidden = true;
      grid.replaceChildren();
      grid.hidden = true;
      empty.hidden = false;
      return;
    }
    const preferences = state.profile.skincarePreferences || DEFAULT_PROFILE.skincarePreferences;
    const products = skincareProductSuggestions(metrics || {}, preferences);
    const stamp = state.profile.skinHealthAnalysisUpdatedAt || state.profile.skincareAnalysisUpdatedAt || state.profile.skinHealthUpdatedAt;
    status.textContent = hasHealthResults
      ? `Using your saved skin-health analysis${stamp ? ` · Updated ${new Date(stamp).toLocaleString()}` : ''}.`
      : 'Using your saved profile and skincare preferences. Your existing colour analysis is retained; a skin-health scan can further tailor these suggestions.';
    status.hidden = false;
    empty.hidden = true;
    grid.hidden = false;
    grid.innerHTML = products.map(product => {
      const links = skincareRetailerLinks(product).map(link => `<a class="button button-outline skincare-retailer-link" href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.action)} ${escapeHTML(link.label)} <span aria-hidden="true">↗</span></a>`).join('');
      return `<article class="skincare-product-card"><p class="skincare-product-category">${escapeHTML(product.category)}</p><h3>${escapeHTML(product.title)}</h3><p>${escapeHTML(product.reason)}</p><div class="skincare-retailer-grid">${links}</div><p class="skincare-query-note">Search focus: ${escapeHTML(product.query)}</p></article>`;
    }).join('');
  }

  function renderSkinHealthAnalysis(metrics = state.profile.skinHealthAnalysis) {
    renderQuizSkinInfo();
    const target = $('#skin-health-analysis-preview');
    if (!target) { renderSkincareRecommendations(); return; }
    metrics = normalizeSkinHealthMetrics(metrics) || getSavedSkinHealthMetrics();
    if (!metrics || !Object.keys(metrics).length) {
      const hasColourResults = hasSavedColourAnalysis();
      target.innerHTML = hasColourResults
        ? '<div class="skin-empty-state"><strong>Your saved scan includes colour tones only</strong><p>The earlier scan did not request skin-health metrics. Select Analyze my skin once to refresh colour tones and add skin-health results using the same selfie.</p></div>'
        : '<div class="skin-empty-state"><strong>No skin-health results yet</strong><p>Analyze your selfie once to view facial colour tones and skin-health indicators together.</p></div>';
      renderSkincareRecommendations();
      return;
    }
    const entries = [
      ['skin_type', 'Skin type', true], ['moisture', 'Moisture', false], ['oiliness', 'Oiliness', false],
      ['redness', 'Redness', false], ['pore', 'Pores', false], ['acne', 'Breakout indicator', false],
      ['texture', 'Texture', false], ['radiance', 'Radiance', false],
    ];
    const cards = entries.map(([key, label, isType]) => {
      if (!(key in metrics)) return '';
      if (isType) {
        const value = getNestedSkinWords(metrics[key]).filter(word => /normal|oily|dry|combination|redness/.test(word)).map(word => word.replace(/^./, char => char.toUpperCase()));
        const unique = [...new Set(value)];
        return unique.length ? `<div class="skin-health-metric"><strong>${escapeHTML(label)}</strong><span>${escapeHTML(unique.join(' · '))}</span></div>` : '';
      }
      const score = getNestedSkinScore(metrics[key]);
      return score === null ? '' : `<div class="skin-health-metric"><strong>${escapeHTML(label)}</strong><span>${Math.round(score)} / 100</span></div>`;
    }).filter(Boolean).join('');
    const stamp = state.profile.skinHealthAnalysisUpdatedAt ? new Date(state.profile.skinHealthAnalysisUpdatedAt).toLocaleString() : 'Saved result';
    target.innerHTML = `<div class="skin-health-results"><div class="skin-health-results-heading"><div><h3>Skin-health results</h3><p>Provider-generated cosmetic indicators · Updated ${escapeHTML(stamp)}</p></div></div><div class="skin-health-metrics-grid">${cards || '<p>The provider returned results, but no recognized metric values were available to display.</p>'}</div><p class="small-note">Scores are provider ratings; higher values generally indicate a stronger result. These cosmetic indicators are not a medical diagnosis. Product suggestions are category-level starting points; check ingredients, suitability and current prices with the retailer.</p><button class="button button-primary" type="button" id="show-skincare-recommendations">View skincare recommendations <span aria-hidden="true">→</span></button></div>`;
    renderSkincareRecommendations();
  }

  async function persistSkincarePreferences() {
    state.profile.skincarePreferences = readSkincarePreferencesFromUI();
    try {
      await persistProfile();
      renderSkincareRecommendations();
    } catch (error) {
      showAlert(`Could not save skincare preferences: ${error.message}`, 'error');
    }
  }

  async function validateImageDimensions(file, minimumSide = 320) {
    const dimensions = await getImageDimensions(file);
    if (dimensions.width < minimumSide || dimensions.height < minimumSide) {
      const guidance = minimumSide >= 480
        ? 'For both skin analyses, the shorter side must be at least 480 pixels. A 720 × 1,080 pixel photo works well.'
        : 'The image must be at least 320 × 320 pixels. Choose a larger photo.';
      throw new Error(guidance);
    }
    if (Math.max(dimensions.width, dimensions.height) > 4096) throw new Error('The longest side of the image must not exceed 4,096 pixels. Choose a smaller image.');
    return dimensions;
  }

  function isSamePhotoFile(previous, next) {
    if (!previous || !next) return false;
    return previous.name === next.name
      && previous.size === next.size
      && Number(previous.lastModified || 0) === Number(next.lastModified || 0);
  }

  function isCurrentSkinPhoto(photo, generation) {
    if (generation !== state.skinPhotoGeneration) return false;
    const selected = $('#skin-photo')?.files?.[0];
    const current = selected || state.cachedImages.skinAnalysis;
    return isSamePhotoFile(photo, current);
  }

  async function clearAnalysesForReplacedPhoto() {
    const hadColourResults = Boolean(state.profile.skinAnalysis);
    const hadResults = Boolean(state.profile.skinAnalysis || state.profile.skinHealthAnalysis);
    const usedDetectedPalette = state.profile.colorScheme === 'selfie';
    if (!hadResults && !usedDetectedPalette) return false;
    state.profile.skinAnalysis = null;
    state.profile.skinAnalysisUpdatedAt = null;
    state.profile.skinAnalysisApplied = false;
    state.profile.skinHealthAnalysis = null;
    state.profile.skinHealthAnalysisUpdatedAt = null;
    if (usedDetectedPalette) state.profile.colorScheme = 'earth';
    renderSkinAnalysis(null);
    renderSkinHealthAnalysis(null);
    renderPaletteSelect();
    renderAccessories(state.accessoryRecommendations);
    renderSkincareRecommendations();
    let persisted = true;
    try { await persistProfile(); } catch (error) {
      persisted = false;
      showAlert(`Previous analysis results were cleared in this session, but could not be saved: ${error.message}`, 'error');
    }
    if (hadColourResults || usedDetectedPalette) await requestRecommendations(state.lastQuery);
    if (hadResults && persisted) {
      showAlert('New selfie selected. Previous results were cleared. Run both analyses together to use this photo.', 'info');
    }
    return true;
  }

  async function setSkinPhotoPreview() {
    const file = $('#skin-photo')?.files?.[0];
    if (!file) return;
    setSkinAnalysisStatus('', 'info');
    const pending = (async () => {
      if (!supportedPhotoMimeType(file)) throw new Error('Choose a JPG, JPEG or PNG photo.');
      if (!file.size || file.size > 9_500_000) throw new Error('Choose a non-empty photo smaller than 9.5 MB.');
      await validateImageDimensions(file, 480);
      const previous = state.cachedImages.skinAnalysis;
      const replaced = !isSamePhotoFile(previous, file);
      await rememberPhoto('skinAnalysis', file);
      if (replaced) {
        state.skinPhotoGeneration += 1;
        if ($('#skin-analysis-consent')) $('#skin-analysis-consent').checked = false;
        await clearAnalysesForReplacedPhoto();
      }
    })();
    state.skinPhotoChangePromise = pending;
    try {
      await pending;
    } catch (error) {
      reportSkinAnalysisError(error.message);
      $('#skin-photo').value = '';
    } finally {
      if (state.skinPhotoChangePromise === pending) state.skinPhotoChangePromise = null;
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
        reject(new Error('This image could not be read. Choose a valid JPG, JPEG or PNG file.'));
      };
      image.src = objectUrl;
    });
  }

  async function pollColorTask(taskId, maxAttempts = 30) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => window.setTimeout(resolve, 3000));
      const result = await apiFetch(`/api/tasks/color/${encodeURIComponent(taskId)}`, { method: 'GET' });
      if (result.status === 'success' || result.status === 'error') return result;
    }
    throw new Error('Facial colour-tone analysis is taking longer than expected. Please try again in a moment.');
  }

  async function pollSkincareTask(taskId, maxAttempts = 30) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => window.setTimeout(resolve, 3000));
      const result = await apiFetch(`/api/tasks/skincare/${encodeURIComponent(taskId)}`, { method: 'GET' });
      if (result.status === 'success' || result.status === 'error') return result;
    }
    throw new Error('Skin-health analysis is taking longer than expected. Please try again in a moment.');
  }

  function applySkinAnalysisToProfile(colors) {
    state.profile.skinAnalysis = colors;
    state.profile.skinAnalysisUpdatedAt = new Date().toISOString();
    state.profile.skinAnalysisApplied = true;
    // Applying an analysis should have an immediate, visible effect on the recommendations.
    // Users can later choose any palette in the quiz or Style profile.
    state.profile.colorScheme = 'selfie';
  }

  function setSkinAnalysisStatus(message, type = 'info') {
    const status = $('#skin-analysis-run-status');
    if (!status) return;
    status.textContent = String(message || '');
    status.hidden = !message;
    status.className = `skin-analysis-run-status${type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : type === 'loading' ? ' is-loading' : ''}`;
    status.setAttribute('role', type === 'error' ? 'alert' : 'status');
    status.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    if (type === 'error') {
      status.focus({ preventScroll: true });
      status.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function formatSkinAnalysisError(message, dimensions = null) {
    const raw = String(message || 'The combined skin analysis could not be completed.');
    const flattened = raw.replace(/Facial colour tones:\s*/gi, '').replace(/Skin health:\s*/gi, '');
    const faceIsTooSmall = /face.{0,120}(too small|60%|small enough)|(?:too small|60%).{0,120}face/i.test(flattened);
    const unsupportedImageType = /unsupported image type|unsupported file type|unsupported image format|invalid image type/i.test(flattened);
    if (unsupportedImageType) {
      return 'YouCam rejected the photo format for facial colour-tone analysis. myStyle now converts the selfie to a standard JPG before sending it to both analyses. Please try again; if this message continues, check that your YouCam account supports the colour-tone endpoint and contact Perfect Corp. support with the task error.';
    }
    if (faceIsTooSmall) {
      const sizeNote = dimensions?.width && dimensions?.height
        ? `Your image is ${dimensions.width.toLocaleString()} × ${dimensions.height.toLocaleString()} px, which meets the pixel-size rules, but the face itself is too small in the frame. `
        : 'The image may meet the pixel-size rules, but the face itself is too small in the frame. ';
      return `${sizeNote}YouCam requires the face to occupy more than 60% of the image width. Move closer to the camera or crop in from the sides, keeping your full face centred and visible, then select the updated photo and try again.`;
    }
    return raw;
  }

  function reportSkinAnalysisError(message, dimensions = null) {
    const friendly = formatSkinAnalysisError(message, dimensions);
    setSkinAnalysisStatus(friendly, 'error');
    showAlert(friendly, 'error');
  }

  async function runCombinedSkinAnalysis() {
    if (state.skinPhotoChangePromise) {
      try { await state.skinPhotoChangePromise; } catch (_) { return; }
    }
    const selectedPhoto = $('#skin-photo')?.files?.[0];
    const photo = selectedPhoto || state.cachedImages.skinAnalysis;
    const photoGeneration = state.skinPhotoGeneration;
    setSkinAnalysisStatus('', 'info');
    if (!photo) { reportSkinAnalysisError('Choose a front-facing JPG, JPEG or PNG selfie first.'); return; }
    if (!$('#skin-analysis-consent')?.checked) { reportSkinAnalysisError('Consent is required before sending your selfie for both analyses.'); return; }
    if (!state.config.youcam_configured) { reportSkinAnalysisError('YouCam is not configured for this deployment. Your selfie has not been uploaded.'); return; }
    const photoMimeType = supportedPhotoMimeType(photo);
    if (!photoMimeType) { reportSkinAnalysisError('Use a JPG, JPEG or PNG selfie.'); return; }
    if (!photo.size || photo.size > 9_500_000) { reportSkinAnalysisError('Choose a non-empty image smaller than 9.5 MB.'); return; }
    let dimensions = null;
    try { dimensions = await getImageDimensions(photo); }
    catch (error) { reportSkinAnalysisError(error.message); return; }
    if (Math.min(dimensions.width, dimensions.height) < 480) {
      reportSkinAnalysisError('Both sides of the image must be at least 480 pixels. Around 720 × 1,080 pixels works well.', dimensions); return;
    }
    if (Math.max(dimensions.width, dimensions.height) > 4096) {
      reportSkinAnalysisError('The longest side of the image must not exceed 4,096 pixels. Choose a smaller image.', dimensions); return;
    }
    if (!isCurrentSkinPhoto(photo, photoGeneration)) {
      reportSkinAnalysisError('The selected selfie changed during validation. Please start the combined analysis again for the current photo.', dimensions); return;
    }
    if (selectedPhoto) {
      try { await rememberPhoto('skinAnalysis', selectedPhoto); }
      catch (error) { reportSkinAnalysisError(error.message, dimensions); return; }
    }
    state.profile.skincarePreferences = readSkincarePreferencesFromUI();
    try { await persistProfile(); }
    catch (error) { reportSkinAnalysisError(`Could not save skincare preferences: ${error.message}`, dimensions); return; }

    const button = $('#run-combined-skin-analysis');
    if (!button || button.disabled) return;
    button.disabled = true;
    button.textContent = 'Analyzing…';
    setSkinAnalysisStatus('Analyzing facial colour tones and skin health from the same selfie…', 'loading');
    try {
      setSkinAnalysisStatus('Preparing your selfie in a consistent format…', 'loading');
      const analysisJpeg = await encodePhotoAsJpeg(photo);
      const form = new FormData();
      form.append('photo', analysisJpeg, 'mystyle-selfie.jpg');
      form.append('consent', 'true');
      setSkinAnalysisStatus('Analyzing facial colour tones and skin health from the same selfie…', 'loading');
      const tasks = await apiFetch('/api/skin-analysis', { method: 'POST', body: form });
      const [colourResult, healthResult] = await Promise.all([
        tasks.color_task_id
          ? pollColorTask(tasks.color_task_id).catch(error => ({ status: 'error', message: error.message }))
          : Promise.resolve({ status: 'error', message: tasks.color_error || 'YouCam could not start facial colour-tone analysis.' }),
        tasks.skin_health_task_id
          ? pollSkincareTask(tasks.skin_health_task_id).catch(error => ({ status: 'error', message: error.message }))
          : Promise.resolve({ status: 'error', message: tasks.skin_health_error || 'YouCam could not start skin-health analysis.' })
      ]);
      if (!isCurrentSkinPhoto(photo, photoGeneration)) {
        throw new Error('The selfie changed while analysis was running. The results were discarded; run both analyses again for the current photo.');
      }

      const issues = [];
      let colourCompleted = false;
      let healthCompleted = false;
      if (colourResult.status === 'success') {
        const colors = colourResult.colors || {};
        const hasSkinColour = typeof colors.skin_color === 'string' && /^#[0-9a-f]{6}$/i.test(colors.skin_color);
        if (hasSkinColour) {
          applySkinAnalysisToProfile(colors);
          colourCompleted = true;
        } else {
          issues.push('Facial colour-tone analysis did not return a usable skin colour value.');
        }
      } else {
        issues.push(`Facial colour tones: ${colourResult.message || tasks.color_error || 'analysis could not be completed.'}`);
      }

      if (healthResult.status === 'success') {
        const metrics = normalizeSkinHealthMetrics(healthResult.metrics || healthResult) || {};
        if (Object.keys(metrics).length) {
          state.profile.skinHealthAnalysis = metrics;
          state.profile.skinHealthAnalysisUpdatedAt = new Date().toISOString();
          healthCompleted = true;
        } else {
          issues.push('Skin-health analysis completed without recognizable metrics. Check that Skin Analysis v2.1 is enabled for your account.');
        }
      } else {
        issues.push(`Skin health: ${healthResult.message || tasks.skin_health_error || 'analysis could not be completed.'}`);
      }

      if (!colourCompleted && !healthCompleted) throw new Error(issues.join(' '));
      await persistProfile();
      renderSkinAnalysis(state.profile.skinAnalysis);
      renderSkinHealthAnalysis(state.profile.skinHealthAnalysis);
      renderPaletteSelect();
      renderAccessories(state.accessoryRecommendations);
      if (colourCompleted) await requestRecommendations(state.lastQuery);

      if (colourCompleted && healthCompleted) {
        setSkinAnalysisStatus('Both analyses are saved. Ensemble Style and Skincare now use the updated results.', 'success');
        showAlert('Both analyses are complete. Your colour notes and skin-health results have been saved.', 'good');
      } else {
        const message = `Partial results saved. ${issues.join(' ')}`;
        reportSkinAnalysisError(message, dimensions);
      }
    } catch (error) {
      reportSkinAnalysisError(error.message || 'YouCam could not complete the combined analysis.', dimensions);
    } finally {
      button.disabled = false;
      button.innerHTML = 'Analyze my skin <span aria-hidden="true">→</span>';
    }
  }

  function resolveAccessoryTryOnGender(item) {
    // The provider's accessory endpoints require a binary processing parameter.
    // Reuse the Style Profile preference first, then the catalogue item's own tag.
    // Gender-neutral/no-preference items use a stable provider fallback so no extra
    // gender question is introduced into the virtual try-on modal.
    const preference = normalizeGenderPreference(state.profile.genderPreference);
    if (preference === 'women') return 'female';
    if (preference === 'men') return 'male';
    const tags = Array.isArray(item?.gender_tags) ? item.gender_tags.map(tag => String(tag).toLowerCase()) : [];
    if (tags.includes('women') && !tags.includes('men')) return 'female';
    if (tags.includes('men') && !tags.includes('women')) return 'male';
    return '';
  }

  function openTryOn(itemId) {
    const wardrobeItem = state.wardrobeItems.find(entry => entry.id === itemId);
    const item = wardrobeItem || findItem(itemId) || state.recommendations.find(entry => entry.id === itemId) || state.accessoryRecommendations.find(entry => entry.id === itemId);
    if (!item) { showAlert('Could not find the selected look. Refresh Ensemble and try again.', 'error'); return; }
    const isWardrobeItem = Boolean(wardrobeItem);
    if (!isWardrobeItem && !(item.try_on_supported && item.image_kind === 'photo')) {
      showAlert('Virtual try-on is not available for this reference photo. Add a clear photo of your own item to My closet to try it on.', 'error');
      return;
    }
    const itemType = item.item_type || 'clothing';
    const tryOnKind = isWardrobeItem ? wardrobeTryOnKind(item) : (item.try_on_kind || 'clothing');
    if (!tryOnKind) { showAlert('Virtual try-on is not available for this item type yet.', 'error'); return; }
    const accessoryGender = itemType === 'accessory' ? resolveAccessoryTryOnGender(item) : '';
    if (itemType === 'accessory' && !accessoryGender) {
      showAlert('This accessory needs a fit preference for virtual try-on. Set Women’s styles or Men’s styles in Style profile, then try again. Your recommendation preferences can remain unchanged for other items.', 'error');
      return;
    }
    const dialog = $('#try-on-dialog');
    if (dialog.dataset.referenceObjectUrl) URL.revokeObjectURL(dialog.dataset.referenceObjectUrl);
    const referenceUrl = isWardrobeItem ? URL.createObjectURL(item.imageBlob) : item.image_url;
    dialog.dataset.referenceObjectUrl = isWardrobeItem ? referenceUrl : '';
    $('#try-on-item-name').textContent = item.name;
    $('#try-on-item-image').src = referenceUrl;
    $('#try-on-item-image').alt = `${isWardrobeItem ? 'Photo of' : 'Fashion photo reference for'} ${item.name}`;
    $('#try-on-photo').value = '';
    $('#try-on-consent').checked = false;
    const resultPanel = $('#try-on-result');
    resultPanel.replaceChildren();
    resultPanel.hidden = true;
    resultPanel.classList.remove('has-result');
    const photoLabel = $('#try-on-photo-label');
    const guidance = $('#try-on-reference-guidance');
    const guidanceByKind = {
      clothing: ['Use a clear front-facing photo showing the body area this clothing covers.', 'A full-body photo gives more context for outfit try-on. Keep the garment reference visible and upright.'],
      bag: ['Use a front-facing upper-body or full-length photo with your torso visible.', 'The reference should show the bag clearly without obstruction.'],
      hat: ['Use a front-facing photo with your entire head and shoulders visible.', 'The reference should show the hat clearly from the front.'],
      scarf: ['Use a front-facing photo with your neck and shoulders visible.', 'The reference should show the scarf clearly.'],
      shoes: ['Use a full-length or lower-body photo with both feet visible.', 'The reference should show the shoes clearly.']
    };
    const guidancePair = guidanceByKind[tryOnKind] || guidanceByKind.clothing;
    if (photoLabel) photoLabel.innerHTML = `${escapeHTML(guidancePair[0])} <span class="required-marker">*</span>`;
    if (guidance) guidance.textContent = guidancePair[1];
    dialog.dataset.itemImage = isWardrobeItem ? '' : item.image_url;
    dialog.dataset.itemName = item.name;
    dialog.dataset.itemType = itemType;
    dialog.dataset.tryOnKind = tryOnKind;
    dialog.dataset.tryOnGender = accessoryGender;
    dialog.dataset.itemSource = isWardrobeItem ? 'wardrobe' : 'catalog';
    dialog.dataset.wardrobeItemId = isWardrobeItem ? item.id : '';
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
    if (!photo) { showAlert('Choose a JPG, JPEG or PNG photo first. Your last try-on photo will be reused automatically after the first upload.', 'error'); return; }
    if (!$('#try-on-consent')?.checked) { showAlert('Consent is required before sending photos to YouCam.', 'error'); return; }
    if (!state.config.youcam_configured) { showAlert('Virtual try-on is not configured on this deployment. Add YCE_API_KEY to enable it.', 'error'); return; }
    const photoMimeType = supportedPhotoMimeType(photo);
    if (!photoMimeType || !photo.size || photo.size > 9_500_000) { showAlert('Choose a JPG, JPEG or PNG image smaller than 9.5 MB.', 'error'); return; }
    let dimensions;
    try { dimensions = await getImageDimensions(photo); }
    catch (error) { showAlert(error.message, 'error'); return; }
    if (dimensions.width < 320 || dimensions.height < 320 || Math.max(dimensions.width, dimensions.height) > 4096) {
      showAlert('Use a photo with both sides at least 320 px and a longest side no greater than 4,096 px.', 'error'); return;
    }
    if (selectedPhoto) { try { await rememberPhoto('tryOn', selectedPhoto); } catch (error) { showAlert(error.message, 'error'); return; } }
    const itemType = dialog.dataset.itemType || 'clothing';
    const accessoryKind = dialog.dataset.tryOnKind || '';
    const gender = itemType === 'accessory' ? (dialog.dataset.tryOnGender || '') : '';
    const button = $('#run-try-on');
    const resultPanel = $('#try-on-result');
    button.disabled = true; button.textContent = 'Preparing try-on…';
    resultPanel.hidden = false;
    resultPanel.classList.remove('has-result');
    resultPanel.textContent = 'Uploading your photo and reference image…';
    dialog.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const form = new FormData();
      form.append('photo', normalizedPhotoBlob(photo), photo.name || `mystyle-try-on.${photoMimeType === 'image/png' ? 'png' : 'jpg'}`);
      if (dialog.dataset.itemSource === 'wardrobe') {
        const wardrobeReference = state.wardrobeItems.find(entry => entry.id === dialog.dataset.wardrobeItemId);
        if (!wardrobeReference?.imageBlob) throw new Error('That closet photo is no longer available. Open My closet and choose the item again.');
        form.append('item_image', wardrobeReference.imageBlob, wardrobeReference.imageName || 'mystyle-wardrobe-reference.jpg');
        form.append('item_image_url', '');
      } else {
        if (!dialog.dataset.itemImage) throw new Error('The selected look has no valid photo reference. Choose another look.');
        form.append('item_image_url', dialog.dataset.itemImage);
      }
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
      resultPanel.classList.add('has-result');
      const message = document.createElement('h3');
      message.textContent = 'Your virtual try-on is ready';
      resultPanel.append(message);
      if (completed.image_url) {
        const image = document.createElement('img');
        image.className = 'try-on-result-image';
        image.alt = `Virtual try-on result for ${dialog.dataset.itemName || 'selected style'}`;
        image.addEventListener('load', () => dialog.scrollTo({ top: 0, behavior: 'smooth' }), { once: true });
        image.src = completed.image_url;
        resultPanel.append(image);
        if (image.complete && image.naturalWidth > 0) dialog.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const note = document.createElement('p'); note.textContent = 'YouCam completed the task but did not return a displayable result image.'; resultPanel.append(note);
      }
      dialog.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      resultPanel.hidden = false;
      resultPanel.classList.remove('has-result');
      resultPanel.textContent = error.message || 'Could not complete the virtual try-on.';
      dialog.scrollTo({ top: 0, behavior: 'smooth' });
      showAlert(resultPanel.textContent, 'error');
    } finally { button.disabled = false; button.textContent = 'Generate try-on'; }
  }

  const WALKTHROUGH_STEPS = [
    { title: 'Welcome to myStyle', copy: 'Use this walkthrough to learn the main parts of the app. You can move back, skip, or finish at any time.', view: 'discover', linkedTab: 'ensemble' },
    { title: 'Style quiz', copy: 'Choose a style direction, occasions, colour palette, gender preference and budget. The answers create your starting recommendations.', view: 'quiz' },
    { title: 'Ensemble: clothing', copy: 'Browse the Clothing tab, search for concepts, open similar-shopping searches, try on an item or save it for later.', view: 'discover', linkedTab: 'ensemble', tab: 'clothing' },
    { title: 'Ensemble: accessories', copy: 'After skin analysis, the Accessories tab shows bags, scarves, headwear and shoes ranked against detected colour cues.', view: 'discover', linkedTab: 'ensemble', tab: 'accessories' },
    { title: 'Skin analysis', copy: 'Upload a front-facing selfie and consent to YouCam processing. Detected colour values become visible here and guide accessories.', view: 'skin-analysis' },
    { title: 'Style profile', copy: 'Adjust country and province or state, season, fit, sizes, colour scheme and budget. Save changes to refresh recommendations.', view: 'discover', linkedTab: 'profile' },
    { title: 'Saved pieces', copy: 'Use the heart to keep catalogue concepts in a shortlist for later.', view: 'saved' },
    { title: 'My closet', copy: 'Add photos of clothing, accessories and skincare products. They stay in this browser; supported clothing and accessories can be used for virtual try-on.', view: 'wardrobe' },
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
    if (step.linkedTab) switchStyleWorkspaceTab(step.linkedTab);
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
    const cleanQuery = String(query || '').trim();
    if (state.recommendationController) state.recommendationController.abort();
    const controller = new AbortController();
    state.recommendationController = controller;
    state.recommendationsLoading = true;
    const id = ++state.requestId;
    state.lastQuery = cleanQuery;

    const status = $('#recommendation-status');
    if (status) status.textContent = cleanQuery ? 'Searching styles…' : 'Refreshing recommendations…';
    const grid = $('#recommendation-grid');
    if (grid) {
      grid.setAttribute('aria-busy', 'true');
      grid.innerHTML = `<div class="loading-style-card"><span class="loading-spinner"></span><strong>${cleanQuery ? 'Searching the style catalogue' : 'Refreshing your style edit'}</strong><p>${cleanQuery ? 'Finding pieces that match your search and profile.' : 'Matching your style, colours, season and budget.'}</p></div>`;
    }
    const accessoryGrid = $('#accessory-grid');
    if (state.activeEnsembleTab === 'accessories' && accessoryGrid) {
      accessoryGrid.setAttribute('aria-busy', 'true');
      accessoryGrid.innerHTML = '<div class="loading-style-card"><span class="loading-spinner"></span><strong>Updating accessories</strong></div>';
    }
    const statusNote = $('#accessory-status');
    if (state.activeEnsembleTab === 'accessories' && statusNote) statusNote.textContent = 'Updating accessory ideas…';

    // Keep search/clear available while a request is running. A newer request aborts
    // the previous request rather than waiting behind a potentially slow response.
    const triggers = [$('#refresh-edit'), $('#quick-palette-form button[type="submit"]'), $('#quiz-form button[type="submit"]'), $('#profile-form button[type="submit"]'), $('#save-profile-top')].filter(Boolean);
    const originalLabels = new Map();
    triggers.forEach(button => {
      originalLabels.set(button, button.innerHTML);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      if (button.id === 'refresh-edit') button.textContent = 'Refreshing…';
      else if (button.type === 'submit') button.textContent = 'Please wait…';
    });
    try {
      const result = await apiFetch('/api/recommendations', {
        method: 'POST',
        body: JSON.stringify({ profile: state.profile, query: cleanQuery, limit: 8 }),
        signal: controller.signal
      });
      if (id !== state.requestId) return false;
      state.recommendations = result.recommendations || [];
      state.accessoryRecommendations = result.accessories || [];
      updateSeasonDetails(result);
      if (status) {
        status.textContent = cleanQuery
          ? `${state.recommendations.length} search matches`
          : `${state.recommendations.length} recommendations`;
      }
      renderRecommendations(state.recommendations);
      renderAccessories(state.accessoryRecommendations);
      renderEnsembleWardrobeMatches();
      renderSaved();
      renderSkinAnalysis(state.profile.skinAnalysis);
      return true;
    } catch (error) {
      if (error.name === 'AbortError' || id !== state.requestId) return false;
      if (status) status.textContent = 'Could not load recommendations';
      if (grid) grid.innerHTML = `<div class="no-results"><strong>We couldn't load recommendations.</strong><p>${escapeHTML(error.message)}</p><button class="button button-outline" type="button" id="retry-edit">Try again</button></div>`;
      if (state.profile.skinAnalysis) renderAccessories(state.accessoryRecommendations);
      return false;
    } finally {
      if (id === state.requestId) {
        state.recommendationsLoading = false;
        state.recommendationController = null;
        if (grid) grid.removeAttribute('aria-busy');
        if (accessoryGrid) accessoryGrid.removeAttribute('aria-busy');
        triggers.forEach(button => {
          button.disabled = false;
          button.removeAttribute('aria-busy');
          if (originalLabels.has(button)) button.innerHTML = originalLabels.get(button);
        });
      }
    }
  }

  function switchView(view) {
    if (view === 'profile') { view = 'discover'; state.activeStyleWorkspaceTab = 'profile'; }
    // The completion message confirms the immediate save only. Saved results remain
    // in the profile, so do not show the old success banner after leaving this view.
    if (state.currentView === 'skin-analysis' && view !== 'skin-analysis') {
      const status = $('#skin-analysis-run-status');
      if (status?.classList.contains('is-success')) setSkinAnalysisStatus('', 'info');
    }
    state.currentView = view;
    $$('.app-view').forEach(panel => {
      const active = panel.dataset.viewPanel === view;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    $$('.side-nav-link[data-view]').forEach(button => button.classList.toggle('is-active', button.dataset.view === view));
    if (view === 'discover') switchStyleWorkspaceTab(state.activeStyleWorkspaceTab || 'ensemble');
    if (view === 'skin-analysis') renderSkinAnalysis(state.profile.skinAnalysis);
    if (view === 'saved') renderSaved();
    if (view === 'wardrobe') renderWardrobe();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveProfile(event) {
    event?.preventDefault?.();
    try {
      state.profile.displayName = $('#display-name')?.value.trim() || 'James';
      state.profile.country = $('#profile-country')?.value || 'CA';
      renderRegionOptions($('#profile-region')?.value || state.profile.region);
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
    state.profile.skincarePreferences = { ...(state.profile.skincarePreferences || DEFAULT_PROFILE.skincarePreferences), sensitivity: $('#quiz-skincare-sensitivity')?.value || 'unknown' };
    state.profile.hasCompletedQuiz = true;
    try {
      await persistProfile();
      renderProfileChoices();
      await requestRecommendations('');
      showAlert('Your style quiz is saved. Ensemble recommendations have been updated.', 'good');
      switchView('discover');
      switchStyleWorkspaceTab('ensemble');
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
      const linkedTabButton = event.target.closest('[data-linked-tab]');
      if (linkedTabButton) { switchView('discover'); switchStyleWorkspaceTab(linkedTabButton.dataset.linkedTab); return; }
      const viewButton = event.target.closest('[data-view]');
      if (viewButton) { switchView(viewButton.dataset.view); return; }
      const buyButton = event.target.closest('[data-buy-item]');
      if (buyButton) { openBuyDialog(buyButton.dataset.buyItem); return; }
      if (event.target.closest('#buy-dialog-close')) { $('#buy-dialog')?.close(); return; }
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
      if (event.target.closest('[data-clear-style-search]')) {
        const searchInput = $('#style-search');
        if (searchInput) searchInput.value = '';
        await requestRecommendations('');
        return;
      }
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
    $('#profile-country')?.addEventListener('change', () => {
      state.profile.country = $('#profile-country')?.value || 'CA';
      state.profile.region = '';
      renderRegionOptions('');
      const city = $('#profile-city');
      if (city) city.value = '';
      state.profile.city = '';
      renderBudgetOptions();
      hydrateSkincarePreferences();
    });
    $('#refresh-edit')?.addEventListener('click', () => requestRecommendations(state.lastQuery));
    $('#style-search-form')?.addEventListener('submit', event => { event.preventDefault(); requestRecommendations($('#style-search')?.value.trim() || ''); });
    $('#clear-style-search')?.addEventListener('click', () => { $('#style-search').value = ''; requestRecommendations(''); });
    $('#skin-photo')?.addEventListener('change', setSkinPhotoPreview);
    $('#try-on-photo')?.addEventListener('change', setTryOnPhotoPreview);
    $('#run-combined-skin-analysis')?.addEventListener('click', runCombinedSkinAnalysis);
    document.addEventListener('click', event => {
      if (event.target.closest('#show-skincare-recommendations')) {
        state.activeStyleWorkspaceTab = 'ensemble';
        switchView('discover');
        switchStyleWorkspaceTab('ensemble');
        switchEnsembleTab('skincare');
      }
    });
    $('#skincare-sensitivity')?.addEventListener('change', () => {
      if ($('#quiz-skincare-sensitivity')) $('#quiz-skincare-sensitivity').value = $('#skincare-sensitivity').value;
      persistSkincarePreferences();
    });
    $('#quiz-skincare-sensitivity')?.addEventListener('change', () => {
      if ($('#skincare-sensitivity')) $('#skincare-sensitivity').value = $('#quiz-skincare-sensitivity').value;
      persistSkincarePreferences();
    });
    $('#skincare-budget')?.addEventListener('change', persistSkincarePreferences);
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
      hydrateSkincarePreferences();
      await loadCachedPhotos();
      renderWardrobe();
      updateWardrobeCategoryOptions();
      renderProfileChoices();
      renderSkinAnalysis(state.profile.skinAnalysis);
      renderSkinHealthAnalysis(state.profile.skinHealthAnalysis);
      updateSeasonDetails();
      renderSaved();
      switchView(state.profile.hasCompletedQuiz ? 'discover' : 'quiz');
      $('.mystyle-shell')?.classList.remove('is-booting');
      await requestRecommendations('');
      if (!state.config.youcam_configured) {
        const note = $('#skin-photo-help');
        if (note) note.innerHTML = '<strong>YouCam analysis is not configured on this deployment</strong><p>Add YCE_API_KEY to the server environment to enable live colour-tone and skin-health analysis. Your selfie is not uploaded until you start the combined analysis and provide consent.</p>';
        const skincareStatus = $('#skincare-status');
        if (skincareStatus && state.profile.skinHealthAnalysis && Object.keys(state.profile.skinHealthAnalysis).length) skincareStatus.textContent = 'Your saved skin-health analysis is available, but new scans require YouCam access.';
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
