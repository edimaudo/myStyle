(() => {
  'use strict';

  const DB_NAME = 'styletv-db';
  const DB_VERSION = 1;
  const PROFILE_KEY = 'demo-profile';
  const SETTINGS_KEY = 'display-settings';
  const DEFAULT_PROFILE = {
    displayName: 'Demo stylist',
    favoriteShows: ['wednesday', 'stranger-things'],
    styleTags: ['punk', 'alternative', 'layering'],
    patterns: ['plaid', 'graphic print'],
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
    products: [],
    savedIds: new Set(),
    currentView: 'discover',
    currentProduct: null,
    recommendationRequestId: 0,
    config: { gemini_configured: false, youcam_configured: false },
    filteredShows: null,
    catalogueMeta: null,
    showResultLimit: 24,
    lastShowFilter: '',
    showListMode: 'all',
    expandedShowsLoading: false
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
    const savedRows = await dbRequest('saved', 'getAll');
    state.savedIds = new Set((savedRows || []).map(item => item.productId));
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
  function findProduct(id) { return state.products.find(product => product.id === id); }



  function showArtwork(show) {
    if (show.image) {
      return `<div class="show-card-image"><img src="${escapeHTML(show.image)}" alt="${escapeHTML(show.name)} show poster" loading="lazy"></div>`;
    }
    return `<div class="show-card-image image-unavailable"><div class="show-artwork-fallback"><strong>${escapeHTML(show.name)}</strong><span>Show artwork unavailable</span></div></div>`;
  }

  function wardrobeSource(show) {
    return show?.wornontv_url || 'https://wornontv.net/shows/';
  }

  function wardrobeSourceLabel(show) {
    return show?.wornontv_direct ? 'View wardrobe on WornOnTV ↗' : 'Browse WornOnTV directory ↗';
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

  function renderFavoriteShows() {
    const target = $('#favorite-shows');
    if (!target) return;
    const favorites = state.profile.favoriteShows || [];
    const chosen = state.shows.filter(show => favorites.includes(show.id));
    if (!chosen.length) {
      target.innerHTML = '<div class="no-results">Choose a few favourite shows to personalize this row. <button class="text-link" data-go-view="shows">Find shows →</button></div>';
      return;
    }
    target.innerHTML = chosen.slice(0, 5).map(show => `
      <article class="show-card">
        ${showArtwork(show)}
        <div class="show-card-content"><h3>${escapeHTML(show.name)}</h3><p>${escapeHTML(show.description)}</p><button class="show-card-action" data-browse-show="${escapeHTML(show.id)}">Explore style matches</button><a class="show-card-action wardrobe-link" href="${escapeHTML(wardrobeSource(show))}" target="_blank" rel="noopener noreferrer">${escapeHTML(wardrobeSourceLabel(show))}</a></div>
      </article>`).join('');
    bindShowArtworkFallbacks(target);
  }

  function renderShowCard(show, isFavorite, showAction = true) {
    const hasInferredCues = show.tags_source === 'inferred';
    const visibleTags = (show.tags && show.tags.length ? show.tags : (show.genres || []));
    const tags = visibleTags.slice(0, 3).map(tag => `<span>${escapeHTML(tag)}</span>`).join('');
    const cueLabel = hasInferredCues ? (show.tags && show.tags.length ? 'Inferred style cues' : 'Genres') : 'Style cues';
    return `<article class="show-card" data-show-card="${escapeHTML(show.id)}">
      ${showArtwork(show)}
      <div class="show-card-content"><h3>${escapeHTML(show.name)}</h3><p>${escapeHTML(show.description)}</p>${tags ? `<p class="show-cue-label">${cueLabel}</p><div class="show-aesthetic-tags">${tags}</div>` : ''}
      <div class="show-action-row">${showAction ? `<button class="show-card-action" data-toggle-show="${escapeHTML(show.id)}" aria-pressed="${isFavorite}">${isFavorite ? 'Added to my shows ✓' : 'Add to my shows +'}</button>` : ''}<button class="show-card-action" data-browse-show="${escapeHTML(show.id)}">Explore looks</button></div>
      <a class="show-card-action wardrobe-link" href="${escapeHTML(wardrobeSource(show))}" target="_blank" rel="noopener noreferrer">${escapeHTML(wardrobeSourceLabel(show))}</a></div></article>`;
  }

  function bindShowArtworkFallbacks(target) {
    if (!target) return;
    $$('.show-card-image img', target).forEach(img => img.addEventListener('error', () => {
      const card = img.closest('.show-card-image');
      const showName = img.alt.replace(/ show poster$/, '');
      if (card) {
        card.classList.add('image-unavailable');
        card.innerHTML = `<div class="show-artwork-fallback"><strong>${escapeHTML(showName)}</strong><span>Show artwork unavailable</span></div>`;
      }
    }, { once: true }));
  }

  function showRecommendationScore(show) {
    const favoriteShows = state.shows.filter(item => (state.profile.favoriteShows || []).includes(item.id));
    const profileTags = new Set((state.profile.styleTags || []).map(x => String(x).toLowerCase()));
    const profilePatterns = new Set((state.profile.patterns || []).map(x => String(x).toLowerCase()));
    const favoriteGenres = new Set(favoriteShows.flatMap(item => item.genres || []).map(x => String(x).toLowerCase()));
    const tags = new Set((show.tags || []).map(x => String(x).toLowerCase()));
    const genres = new Set((show.genres || []).map(x => String(x).toLowerCase()));
    return [...profileTags].filter(tag => tags.has(tag)).length * 3
      + [...profilePatterns].filter(tag => tags.has(tag)).length * 1.5
      + [...favoriteGenres].filter(genre => genres.has(genre)).length * 1.7
      + Number(show.rating || 0) * 0.05;
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
      const searchable = [show.name, show.description, show.style_note, ...(show.tags || []), ...(show.genres || []), show.network, show.language]
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
      : state.showListMode === 'recommended' ? 'Recommended for me' : 'All shows';
    if (countTarget) {
      const modeLabel = state.showListMode === 'favorites' ? 'favourite show' : state.showListMode === 'recommended' ? 'recommendation' : 'show';
      countTarget.textContent = `${visible.length} ${modeLabel}${visible.length === 1 ? '' : 's'}${q ? ` match “${filter.trim()}”` : ''}.`;
    }
    if (allTarget) {
      const emptyMessage = state.showListMode === 'favorites'
        ? 'You have not added any favourite shows yet. Search for a show and select “Add to my shows”.'
        : state.expandedShowsLoading && state.showListMode === 'all'
          ? 'Loading more shows. Your search results will update automatically.'
          : state.showListMode === 'recommended'
            ? 'No new show recommendations match this search. Try another style or title.'
            : 'No shows matched that search. Try a show title, genre or style.';
      allTarget.innerHTML = shownFiltered.length
        ? shownFiltered.map(show => renderShowCard(show, favorites.has(show.id))).join('')
        : `<div class="no-results">${escapeHTML(emptyMessage)}</div>`;
      bindShowArtworkFallbacks(allTarget);
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
        : '<div class="no-results">You have selected every show in this catalogue. Remove a favourite or explore a different style.</div>';
      bindShowArtworkFallbacks(newTarget);
    }
    if ($('#favorite-shows')) renderFavoriteShows();
  }

  function suggestedRetailerSearch(product, color) {
    const query = `${color || ''} ${product.name}`.trim().replace(/\s+/g, ' ');
    const retailer = (product.retailer || '').toLowerCase();
    const encoded = encodeURIComponent(query);
    if (retailer === 'zara') return `https://www.zara.com/us/en/search?searchTerm=${encoded}`;
    if (retailer === 'urban outfitters') return `https://www.urbanoutfitters.com/search?q=${encoded}`;
    if (retailer === 'etsy') return `https://www.etsy.com/search?q=${encoded}`;
    if (retailer === "levi's") return `https://www.levi.com/US/en_US/search?q=${encoded}`;
    if (retailer === 'h&m') return `https://www2.hm.com/en_us/search-results.html?q=${encoded}`;
    return `https://www.asos.com/search/?q=${encoded}`;
  }

  function renderProduct(product) {
    const saved = state.savedIds.has(product.id);
    const showNames = (product.shows || []).map(id => findShow(id)?.name).filter(Boolean);
    const wardrobeShow = wardrobeLinkForProduct(product);
    const swatches = (product.swatches || []).map((color, index) => {
      const label = product.colors?.[index] || `Colour ${index + 1}`;
      return `<button type="button" class="color-swatch" data-color-select="${escapeHTML(product.id)}" data-color="${escapeHTML(label)}" style="background:${escapeHTML(color)}" aria-label="Search for ${escapeHTML(label)} alternatives to ${escapeHTML(product.name)}" title="Search ${escapeHTML(label)} alternatives" aria-pressed="${index === 0}"></button>`;
    }).join('');
    const canTryOn = Boolean(product.try_on_reference_url) && product.try_on_eligible !== false;
    const tryOnButton = canTryOn
      ? `<button type="button" class="button button-primary" data-try-on="${escapeHTML(product.id)}">Try this look</button>`
      : `<button type="button" class="button button-primary" disabled aria-label="Virtual try-on is unavailable for ${escapeHTML(product.name)}">Try-on unavailable</button>`;
    return `<article class="product-card" data-product-card="${escapeHTML(product.id)}">
      <div class="product-photo"><img src="${escapeHTML(product.image)}" alt="Style reference for ${escapeHTML(product.name)}" loading="lazy" onerror="this.style.display='none'"><span class="product-tag">${escapeHTML(product.category)}</span><button type="button" class="save-look" data-save-product="${escapeHTML(product.id)}" aria-label="${saved ? 'Remove' : 'Save'} ${escapeHTML(product.name)}" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button></div>
      <div class="product-content"><h3>${escapeHTML(product.name)}</h3><p class="product-description">${escapeHTML(product.reason)}</p>
      <p class="product-showline">Style cues from ${escapeHTML(showNames.join(' · ') || 'your style profile')}</p>
      ${wardrobeShow ? `<a class="product-wardrobe-link" href="${escapeHTML(wardrobeSource(wardrobeShow))}" target="_blank" rel="noopener noreferrer">Explore ${escapeHTML(wardrobeShow.name)} wardrobe on WornOnTV ↗</a>` : ''}
      <div class="product-price-row"><span class="product-price">Around $${Number(product.price).toFixed(0)}</span><span class="product-price-note">${escapeHTML(product.price_note || 'sample price')}</span></div>
      <div class="swatch-row" aria-label="Colour ideas to explore">${swatches}</div>
      <div class="product-actions">${tryOnButton}<a class="button button-outline" data-shop-product="${escapeHTML(product.id)}" href="${escapeHTML(product.shop_url)}" target="_blank" rel="noopener noreferrer">Shop similar ↗</a></div>
      <p class="disclosure">Demo catalogue: colour ideas and sample prices are illustrative. Colour chips search for similar retailer listings; try-on uses the base reference image until verified variant images are added. Links do not confirm the exact garment or stock.</p></div></article>`;
  }

  function renderProducts(products = state.products, targetSelector = '#product-grid') {
    const target = $(targetSelector);
    if (!target) return;
    if (!products.length) {
      target.innerHTML = '<div class="no-results">No looks matched those preferences. Try a different search or update your profile.</div>';
      return;
    }
    target.innerHTML = products.map(renderProduct).join('');
    // If a photo fails, preserve the card's layout and show a styled fallback.
    $$('img', target).forEach(img => img.addEventListener('error', () => { img.parentElement.classList.add('image-unavailable'); }, { once: true }));
  }

  async function requestRecommendations(query = '', focusShow = null) {
    const requestId = ++state.recommendationRequestId;
    const subtitle = $('#recommendation-subtitle');
    const status = $('#recommendation-status');
    if (focusShow && subtitle) {
      subtitle.textContent = `Style matches inspired by ${focusShow.name}. These are aesthetic matches, not verified outfits worn on the show.`;
    } else if (subtitle) {
      subtitle.textContent = query
        ? `Matches for “${query}” and your current style profile.`
        : 'A starting point based on your current preferences.';
    }

    // Render local matches first so the button always produces immediate feedback,
    // even if Gemini or the recommendation endpoint is slow.
    const localProducts = localRank(query, focusShow);
    if (state.products.length) renderProducts(localProducts);
    if (status) status.textContent = state.config.gemini_configured
      ? 'Showing initial matches while checking for personalized ranking…'
      : 'Showing matches from your style profile and catalogue…';

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
      const products = Array.isArray(result.products) ? result.products : [];
      // Empty API results should not erase useful local matches. If the user's
      // explicit budget excludes everything, preserve the empty result only when
      // local ranking also finds nothing.
      const finalProducts = products.length ? products : localProducts;
      renderProducts(finalProducts);
      if (status) {
        if (products.length) {
          const source = result.source === 'gemini' ? `Recommendations refined with ${result.model}.` : 'Catalogue matches.';
          status.textContent = `${source} ${result.explanation || 'Based on your current preferences.'}`;
        } else {
          status.textContent = finalProducts.length
            ? 'Showing local catalogue matches; no additional server matches were returned.'
            : 'No items match this budget and request. Increase your budget or try different style terms.';
        }
      }
    } catch (error) {
      if (requestId !== state.recommendationRequestId) return;
      renderProducts(localProducts);
      if (status) {
        status.textContent = error.name === 'AbortError'
          ? 'The recommendation service took too long. Showing local catalogue matches instead.'
          : 'The recommendation service is unavailable. Showing local catalogue matches instead.';
      }
      if (error.name !== 'AbortError') showAlert(error.message || 'Could not contact recommendations; local matching is available.', 'error');
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function GEMINI_STATUS() { return state.config.gemini_configured ? 'Gemini personalization is available.' : 'Using the built-in catalogue matcher until Gemini is configured.'; }

  function localRank(query = '', focusShow = null) {
    const q = query.toLowerCase();
    const profile = state.profile;
    const focusTags = new Set((focusShow?.tags || []).map(tag => String(tag).toLowerCase()));
    const favored = new Set(profile.favoriteShows || []);
    const queryShows = state.shows
      .filter(show => show.name && q.includes(show.name.toLowerCase()))
      .sort((a, b) => b.name.length - a.name.length);
    const queryShowIds = new Set(queryShows.map(show => show.id));
    const queryShowTags = new Set(queryShows.flatMap(show => show.tags || []).map(tag => String(tag).toLowerCase()));
    const style = new Set((profile.styleTags || []).map(x => x.toLowerCase()));
    const patterns = new Set((profile.patterns || []).map(x => x.toLowerCase()));
    const colors = new Set((profile.colorPreferences || []).map(x => x.toLowerCase()));
    const budgetMatch = q.match(/\b(?:under|below|less than|up to|max(?:imum)?)\s*\$?\s*(\d+(?:\.\d+)?)/i);
    const budget = budgetMatch ? Number(budgetMatch[1]) : (profile.budget === 'any' ? null : Number(profile.budget));
    const candidates = state.products.filter(product => budget == null || !Number.isFinite(budget) || Number(product.price) <= budget);
    return candidates.sort((a, b) => {
      const score = p =>
        (p.tags || []).filter(t => style.has(t.toLowerCase()) || q.includes(t.toLowerCase())).length * 3 +
        (p.tags || []).filter(t => focusTags.has(t.toLowerCase()) || queryShowTags.has(t.toLowerCase())).length * 4 +
        (p.patterns || []).filter(t => patterns.has(t.toLowerCase()) || q.includes(t.toLowerCase()) || focusTags.has(t.toLowerCase()) || queryShowTags.has(t.toLowerCase())).length * 2 +
        (p.colors || []).filter(t => colors.has(t.toLowerCase()) || q.includes(t.toLowerCase())).length +
        (p.shows || []).filter(t => favored.has(t) || queryShowIds.has(t) || (focusShow && focusShow.id === t)).length * 3;
      return score(b) - score(a);
    }).slice(0, 6);
  }

  async function toggleSaved(productId) {
    if (state.savedIds.has(productId)) {
      state.savedIds.delete(productId);
      await dbRequest('saved', 'delete', productId);
      showAlert('Removed from saved looks.', 'good');
    } else {
      state.savedIds.add(productId);
      await dbRequest('saved', 'put', { productId, savedAt: new Date().toISOString() });
      showAlert('Saved to your looks on this browser.', 'good');
    }
    renderProducts(state.products);
    if (state.currentView === 'saved') renderSaved();
  }

  function renderSaved() {
    const products = state.products.filter(product => state.savedIds.has(product.id));
    renderProducts(products, '#saved-product-grid');
    $('#saved-empty').hidden = products.length > 0;
    $('#saved-product-grid').hidden = products.length === 0;
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

  function openTryOn(productId) {
    const product = findProduct(productId);
    if (!product) return;
    state.currentProduct = product;
    $('#try-on-title').textContent = 'Try this look on.';
    $('#try-on-product').innerHTML = `<img src="${escapeHTML(product.image)}" alt="Selected style reference"><div><strong>${escapeHTML(product.name)}</strong><p>${escapeHTML(product.category)} · ${escapeHTML(product.retailer)} search available</p></div>`;
    $('#try-on-form').hidden = false;
    $('#try-on-status').hidden = true;
    $('#try-on-result').hidden = true;
    $('#try-on-result').innerHTML = '';
    $('#try-on-photo').value = '';
    $('#try-on-consent').checked = false;
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
    const product = state.currentProduct;
    const photo = $('#try-on-photo').files?.[0];
    if (!product || !photo) {
      setTryOnStatus('Choose a JPG or PNG photo first.', true);
      return;
    }
    if (!$('#try-on-consent').checked) {
      setTryOnStatus('Consent is required before your photo is sent to YouCam.', true);
      return;
    }
    if (!state.config.youcam_configured) {
      setTryOnStatus('Live YouCam is not configured on this deployment. Add YCE_API_KEY to Vercel environment variables, redeploy, and try again. Your photo has not been uploaded.', true);
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(photo.type)) {
      setTryOnStatus('Please use a JPG or PNG image.', true);
      return;
    }
    if (photo.size > 9_500_000) {
      setTryOnStatus('Choose an image smaller than 9.5 MB.', true);
      return;
    }
    $('#try-on-form').querySelector('button[type="submit"]').disabled = true;
    setTryOnStatus('Preparing your image for YouCam…');
    try {
      const form = new FormData();
      form.append('photo', photo);
      form.append('consent', 'true');
      const task = await apiFetch(`/api/try-on/${encodeURIComponent(product.id)}`, { method: 'POST', body: form });
      const result = await pollTask('try-on', task.task_id);
      if (result.status === 'error') throw new Error(result.message || 'The try-on could not be completed. Try another photo.');
      if (!result.result_url) throw new Error(result.message || 'The try-on completed without a recognized result image.');
      $('#try-on-result').hidden = false;
      $('#try-on-result').innerHTML = `<img src="${escapeHTML(result.result_url)}" alt="AI-generated virtual try-on result"><p>${escapeHTML(result.message || 'Visual preview only. Actual fit and colour may differ.')}</p>`;
      setTryOnStatus('Your virtual try-on is ready.');
    } catch (error) {
      setTryOnStatus(error.message || 'Something went wrong. Try again.', true);
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
    target.innerHTML = `<div class="color-palette-results"><h3>Your colour notes</h3><p>These are the facial colour cues detected by YouCam. Use them to explore outfits; there is no single correct palette.</p><div class="detected-colors">${items || '<p>Analysis completed, but no recognized hex colour values were returned.</p>'}</div><button type="button" class="button button-outline" id="use-colour-notes" style="margin-top:14px">Refresh recommendations with colour notes</button></div>`;
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
      const browseButton = event.target.closest('[data-browse-show]');
      if (browseButton) {
        const show = findShow(browseButton.dataset.browseShow);
        if (!show) {
          showAlert('This show is no longer in the loaded catalogue. Refresh the page and try again.', 'error');
          return;
        }
        switchView('discover');
        const query = show.name;
        const searchInput = $('#style-search');
        if (searchInput) searchInput.value = query;
        // Pass the selected show explicitly. This prevents the generic discover
        // request from racing and overwriting the requested show matches.
        await requestRecommendations(query, show);
        return;
      }
      const toggleButton = event.target.closest('[data-toggle-show]');
      if (toggleButton) { await changeFavorite(toggleButton.dataset.toggleShow); return; }
      const saveButton = event.target.closest('[data-save-product]');
      if (saveButton) { await toggleSaved(saveButton.dataset.saveProduct); return; }
      const tryOnButton = event.target.closest('[data-try-on]');
      if (tryOnButton) { openTryOn(tryOnButton.dataset.tryOn); return; }
      const colorButton = event.target.closest('[data-color-select]');
      if (colorButton) {
        const product = findProduct(colorButton.dataset.colorSelect);
        if (!product) return;
        const card = colorButton.closest('.product-card');
        $$('.color-swatch', card).forEach(button => button.setAttribute('aria-pressed', String(button === colorButton)));
        const shopLink = $('[data-shop-product]', card);
        if (shopLink) shopLink.href = suggestedRetailerSearch(product, colorButton.dataset.color);
        if (shopLink) shopLink.textContent = `Shop ${colorButton.dataset.color} ↗`;
        return;
      }
      if (event.target.closest('.dialog-close')) closeTryOn();
      if (event.target.id === 'use-colour-notes') {
        await requestRecommendations('Use my facial colour notes as optional inspiration for clothing colour combinations.');
        showAlert('Recommendations refreshed. Your colour analysis is an optional input, not a rule.', 'good');
        switchView('discover');
      }
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

  async function loadExpandedShowCatalogue() {
    if (state.expandedShowsLoading) return;
    state.expandedShowsLoading = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    try {
      const expanded = await apiFetch('/api/shows', { method: 'GET', signal: controller.signal });
      if (Array.isArray(expanded.shows) && expanded.shows.length) {
        // Keep profile-stable seed IDs where possible; the API normalizes starter shows
        // to those same IDs and supplies expanded metadata for all other shows.
        state.shows = expanded.shows;
        state.catalogueMeta = expanded.catalogue || state.catalogueMeta;
        renderFavoriteShows();
        renderShows($('#show-search')?.value || '');
      }
    } catch (error) {
      // The six starter shows remain usable; do not impair the garment search UI.
      const status = $('#show-results-count');
      if (status && !state.shows.length) status.textContent = 'Show catalogue is temporarily unavailable. You can still search the starter shows.';
    } finally {
      window.clearTimeout(timeoutId);
      state.expandedShowsLoading = false;
    }
  }

  async function init() {
    // Wire interactions immediately and load IndexedDB independently from the
    // product catalogue. A browser storage stall must never disable garment search.
    attachEvents();
    const localStatePromise = (async () => {
      try {
        state.db = await openDatabase();
        await loadLocalState();
        // If the catalogue has already loaded, apply stored preferences and refresh
        // the current result set after IndexedDB resolves.
        if (state.products.length) {
          renderProfileChoices();
          renderFavoriteShows();
          renderShows($('#show-search')?.value || '');
          requestRecommendations($('#style-search')?.value.trim() || '');
        }
      } catch (error) {
        showAlert(`${error.message} Local preferences may not persist in this browser.`, 'error');
      }
    })();

    try {
      // /api/catalog is intentionally local and fast. Expanded TVmaze discovery is
      // requested later so network/API latency cannot block Find my looks.
      const [catalog, config] = await Promise.all([
        apiFetch('/api/catalog', { method: 'GET' }),
        apiFetch('/api/config', { method: 'GET' })
      ]);
      state.shows = catalog.shows || [];
      state.products = catalog.products || [];
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
      // Results render locally immediately; API-based ranking runs in the background.
      requestRecommendations($('#style-search')?.value.trim() || '');
      buildQuizFromProfile();
      if (!state.settings.walkthroughSeen) openWalkthrough();
      loadExpandedShowCatalogue();
    } catch (error) {
      const findButton = $('#find-looks-button');
      if (findButton) {
        findButton.disabled = false;
        findButton.textContent = 'Find my looks →';
      }
      showAlert(error.message || 'Could not load styleTV data.', 'error');
    }
    // Do not await storage before enabling search. Storage can finish after the
    // first render and refresh preferences once available.
    void localStatePromise;
  }

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
