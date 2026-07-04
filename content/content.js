// Style tag reference
let focaStyleElement = null;
let focaMotivationCards = [];

// Instagram listener references
let instagramObserver = null;
let instagramInterval = null;
let linkedinInterval = null;

// Instagram block overlay reference
let igBlockOverlay = null;

// Loaded quotes array
let quotes = [];

// ==========================================
// QUOTE LOADER
// ==========================================
/**
 * Fetches the local quotes.json and stores the array.
 */
async function loadQuotes() {
  try {
    const url = chrome.runtime.getURL('assets/quotes.json');
    const response = await fetch(url);
    quotes = await response.json();
  } catch (err) {
    quotes = [
      'Your future self is watching. Make them proud.',
      'Deep work is the superpower of the 21st century.',
      'Discipline beats motivation every single time.'
    ];
  }
}

/**
 * Returns a random quote string.
 */
function randomQuote() {
  if (!quotes.length) return 'Stay focused.';
  return quotes[Math.floor(Math.random() * quotes.length)];
}

// ==========================================
// MOTIVATION CARD INJECTOR
// ==========================================
/**
 * Creates and injects a motivation card after a target element.
 */
function injectMotivationCard(afterElement, quote) {
  const card = document.createElement('div');
  card.className = 'foca-motivation-card';
  card.setAttribute('data-foca-card', 'true');
  card.innerHTML = `
    <div class="foca-card-inner">
      <div class="foca-card-eyebrow">Foca &middot; Stay Focused</div>
      <p class="foca-quote">${quote}</p>
      <button class="foca-refresh-btn" title="New quote">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        New Quote
      </button>
    </div>
  `;
  // Wire up refresh button
  const refreshBtn = card.querySelector('.foca-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const quoteEl = card.querySelector('.foca-quote');
      if (quoteEl) {
        quoteEl.style.opacity = '0';
        setTimeout(() => {
          quoteEl.textContent = randomQuote();
          quoteEl.style.opacity = '1';
        }, 200);
      }
    });
  }
  afterElement.parentNode.insertBefore(card, afterElement.nextSibling);
  focaMotivationCards.push(card);
}

/**
 * Removes all previously injected motivation cards.
 */
function removeMotivationCards() {
  focaMotivationCards.forEach(card => card.remove());
  focaMotivationCards = [];
  // Also clean up any orphaned cards from previous runs
  document.querySelectorAll('[data-foca-card="true"]').forEach(el => el.remove());
}

/**
 * Injects motivation cards on the current page if the feature is enabled.
 */
function injectMotivationCards() {
  removeMotivationCards();
  const hostname = window.location.hostname;

  if (hostname.includes('youtube.com')) {
    // Inject after the hidden home feed area
    const homeGrid = document.querySelector('ytd-browse[page-subtype="home"]');
    if (homeGrid) {
      injectMotivationCard(homeGrid, randomQuote());
    }
    // Inject after the hidden sidebar
    const sidebar = document.querySelector('ytd-watch-next-secondary-results-renderer');
    if (sidebar) {
      injectMotivationCard(sidebar, randomQuote());
    }
  } else if (hostname.includes('instagram.com')) {
    const main = document.querySelector('main[role="main"]');
    if (main) {
      injectMotivationCard(main, randomQuote());
    }
  } else if (hostname.includes('linkedin.com')) {
    const feed = document.querySelector('div.scaffold-finite-scroll');
    if (feed) {
      injectMotivationCard(feed, randomQuote());
    }
  }
}

// ==========================================
// MOTIVATION CARD STYLES
// ==========================================
const MOTIVATION_CARD_CSS = `
  .foca-motivation-card {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 60px 40px;
    margin: 24px 0;
    font-family: 'Georgia', serif;
  }

  .foca-card-inner {
    max-width: 480px;
    width: 100%;
    text-align: center;
    padding: 48px 40px;
    background: linear-gradient(135deg, rgba(18, 18, 17, 0.95), rgba(10, 10, 10, 0.98));
    border: 1px solid rgba(197, 168, 128, 0.25);
    border-radius: 16px;
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(197, 168, 128, 0.1);
    animation: foca-card-fade-in 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .foca-card-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(197, 168, 128, 0.65);
    margin-bottom: 20px;
  }

  .foca-quote {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 18px;
    line-height: 1.7;
    font-style: italic;
    color: rgba(245, 242, 235, 0.92);
    margin: 0 0 24px 0;
    letter-spacing: 0.01em;
    transition: opacity 0.2s ease;
  }

  .foca-refresh-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    border: 1px solid rgba(197, 168, 128, 0.25);
    border-radius: 20px;
    background: transparent;
    color: rgba(197, 168, 128, 0.7);
    font-family: 'Arial', sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  .foca-refresh-btn:hover {
    background: rgba(197, 168, 128, 0.08);
    color: rgba(245, 242, 235, 0.95);
    border-color: rgba(197, 168, 128, 0.5);
  }

  @keyframes foca-card-fade-in {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  
  /* ========================================== */
  /* FOCA BLOCK OVERLAY                         */
  /* ========================================== */
  #foca-block-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    font-family: 'Georgia', 'Times New Roman', serif;
    color: #f5f2eb;
    text-align: center;
    padding: 40px;
  }
  
  #foca-block-overlay .foca-overlay-icon {
    font-size: 40px;
    margin-bottom: 4px;
  }
  
  #foca-block-overlay .foca-overlay-title {
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: #c5a880;
  }
  
  #foca-block-overlay .foca-overlay-subtitle {
    font-size: 14px;
    color: #9c968a;
    max-width: 320px;
    line-height: 1.6;
  }
  
  #foca-block-overlay .foca-overlay-divider {
    width: 40px;
    height: 1px;
    background: #262421;
    margin: 4px 0;
  }
  
  #foca-block-overlay .foca-overlay-meta-label {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(197, 168, 128, 0.6);
    margin-bottom: 2px;
  }
  
  #foca-block-overlay .foca-overlay-meta-value {
    font-size: 18px;
    font-weight: 500;
    color: #f5f2eb;
  }
  
  #foca-block-overlay .foca-overlay-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }
  
  #foca-block-overlay .foca-overlay-btn {
    padding: 9px 20px;
    border-radius: 6px;
    font-family: 'Plus Jakarta Sans', 'Arial', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: opacity 0.2s ease;
    border: none;
    outline: none;
  }
  
  #foca-block-overlay .foca-overlay-btn:hover {
    opacity: 0.82;
  }
  
  #foca-block-overlay .foca-overlay-btn-primary {
    background: #c5a880;
    color: #0a0a0a;
  }
  
  #foca-block-overlay .foca-overlay-btn-secondary {
    background: transparent;
    color: #9c968a;
    border: 1px solid #262421 !important;
  }

  /* ========================================== */
  /* INSTAGRAM MESSAGES ONLY MODE              */
  /* ========================================== */
  html.foca-ig-blocked main[role="main"] > * {
    display: none !important;
  }
  
  html.foca-ig-blocked main[role="main"]::before {
    content: "Study Mode Active. Instagram is in Messages Only mode.";
    display: flex;
    justify-content: center;
    align-items: center;
    height: 80vh;
    font-size: 20px;
    font-family: 'Georgia', 'Times New Roman', serif;
    color: rgba(245, 242, 235, 0.92);
    text-align: center;
    padding: 40px;
    background: transparent;
  }
  
  /* Hide sidebar tempting links */
  html.foca-ig-blocked a[href="/"],
  html.foca-ig-blocked a[href="/explore/"],
  html.foca-ig-blocked a[href*="/reels/"] {
    display: none !important;
  }

  /* ========================================== */
  /* LINKEDIN STRICT JOBS MODE                 */
  /* ========================================== */
  html.foca-li-blocked .scaffold-layout__main > * {
    display: none !important;
  }
  
  html.foca-li-blocked .scaffold-layout__main::before {
    content: "Strict Focus Active. LinkedIn is in Jobs & Messaging Only mode.";
    display: flex;
    justify-content: center;
    align-items: center;
    height: 80vh;
    font-size: 20px;
    font-family: 'Georgia', 'Times New Roman', serif;
    color: rgba(245, 242, 235, 0.92);
    text-align: center;
    padding: 40px;
    background: transparent;
  }
`;

// ==========================================
// SELECTORS CONFIGURATION GROUPS
// ==========================================
const YT_LOCK_HOMEPAGE_SELECTORS = [
  // Homepage & Recommendations
  'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer',
  'ytd-browse[page-subtype="home"] #primary',
  'ytd-browse[page-subtype="home"] #contents',
  'ytd-watch-next-secondary-results-renderer',
  '.html5-endscreen',
  '.ytp-ce-element',
  // Shorts
  'ytd-guide-entry-renderer:has(a[href*="/shorts"])',
  'ytd-mini-guide-entry-renderer:has(a[href*="/shorts"])',
  'ytd-rich-shelf-renderer[is-shorts]',
  'ytd-reel-shelf-renderer',
  'ytd-rich-item-renderer:has(ytd-rich-grid-slim-media)'
];

const YT_COMMENTS_SELECTORS = [
  'ytd-comments'
];

// Placeholder architecture for future channel/playlist approval system
// Do not implement logic yet, only design the constants.
const YT_APPROVED_CHANNELS = []; // e.g. ['@mitocw', '@stanfordonline']
const YT_APPROVED_PLAYLISTS = []; // e.g. ['PLyQSN7X0ro203puVhQsmDpISw95HuL81f']

const LINKEDIN_FEED_SELECTORS = [
  'html.foca-li-feed div.scaffold-finite-scroll',
  'html.foca-li-feed .feed-shared-update-v2'
];

const LINKEDIN_NEWS_SELECTORS = [
  'html.foca-li-feed #feed-news-card',
  'html.foca-li-feed aside.scaffold-layout__aside'
];

// ==========================================
// DYNAMIC CSS GENERATOR
// ==========================================
function generateCSSWithSettings(settings, isStrict) {
  const selectors = [];
  const hostname = window.location.hostname;

  const lockHomepage = isStrict || settings.ytLockHomepage !== false;
  const hideComments = isStrict || settings.ytHideComments !== false;
  
  const liHideFeed = isStrict || settings.liHideFeed !== false;
  const liHideNews = isStrict || settings.liHideNews !== false;

  if (hostname.includes('youtube.com')) {
    if (lockHomepage) selectors.push(...YT_LOCK_HOMEPAGE_SELECTORS);
    if (hideComments) selectors.push(...YT_COMMENTS_SELECTORS);
    if (isStrict) selectors.push('ytd-search'); // Hide YT search results in strict mode
  } else if (hostname.includes('linkedin.com')) {
    if (liHideFeed) selectors.push(...LINKEDIN_FEED_SELECTORS);
    if (liHideNews) selectors.push(...LINKEDIN_NEWS_SELECTORS);
  }

  if (selectors.length === 0) return MOTIVATION_CARD_CSS;
  return `${MOTIVATION_CARD_CSS}\n${selectors.join(',\n')} { display: none !important; }`;
}

// ==========================================
// SPA URL HANDLERS
// ==========================================
function handleInstagramURL(isEnabled, messagesOnly) {
  if (!window.location.hostname.includes('instagram.com')) return;

  if (!isEnabled || !messagesOnly) {
    document.documentElement.classList.remove('foca-ig-blocked');
    return;
  }

  const path = window.location.pathname;
  // Allowed paths for Messages Only Mode:
  // /direct/*, /notifications/*, /accounts/*, or any specific profile page /[username]/*
  // Blocked paths: /, /explore/*, /reels/*, /stories/*
  const isAllowed = path.startsWith('/direct') || 
                    path.startsWith('/notifications') || 
                    path.startsWith('/accounts') || 
                    (path !== '/' && !path.startsWith('/explore') && !path.startsWith('/reels') && !path.startsWith('/stories'));
  
  document.documentElement.classList.toggle('foca-ig-blocked', !isAllowed);
}

let focaBlockOverlay = null;
let focaOverlayInterval = null;

function removeBlockOverlay() {
  const existing = document.getElementById('foca-block-overlay');
  if (existing) {
    existing.remove();
  }
  if (focaBlockOverlay) {
    focaBlockOverlay.remove();
    focaBlockOverlay = null;
  }
  if (focaOverlayInterval) {
    clearInterval(focaOverlayInterval);
    focaOverlayInterval = null;
  }
  document.documentElement.classList.remove('foca-ig-blocked');
  document.documentElement.classList.remove('foca-li-blocked');
}

function handleInstagramBlock(settings, isEnabled) {
  if (!window.location.hostname.includes('instagram.com')) return;

  const mode = settings.igMode || 'messages';

  if (!isEnabled || mode === 'off') {
    removeBlockOverlay();
    if (instagramInterval) {
      clearInterval(instagramInterval);
      instagramInterval = null;
    }
    return;
  }

  if (mode === 'messages') {
    removeBlockOverlay();
    handleInstagramURL(true, true);
    if (!instagramInterval) {
      instagramInterval = setInterval(() => handleInstagramURL(true, true), 500);
    }
    return;
  }

  if (mode === 'block') {
    if (instagramInterval) {
      clearInterval(instagramInterval);
      instagramInterval = null;
    }
    document.documentElement.classList.remove('foca-ig-blocked');

    injectBlockOverlay(settings, 'Instagram');
    if (!focaOverlayInterval) {
      focaOverlayInterval = setInterval(() => {
        if (!document.getElementById('foca-block-overlay')) {
          injectBlockOverlay(settings, 'Instagram');
        } else {
          updateBlockCountdown(settings.timerEndTime);
        }
      }, 500);
    }
  }
}

function injectBlockOverlay(settings, siteName) {
  if (document.getElementById('foca-block-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'foca-block-overlay';
  focaBlockOverlay = overlay;

  const goal = settings.currentSessionGoal || 'No goal set';
  const quote = randomQuote();

  overlay.innerHTML = `
    <div class="foca-overlay-icon">📚</div>
    <div class="foca-overlay-title">Focus Time</div>
    <div class="foca-overlay-subtitle">${siteName} is paused.</div>
    <div class="foca-overlay-divider"></div>
    <div class="foca-overlay-meta-label">Current Goal</div>
    <div class="foca-overlay-meta-value">${goal}</div>
    <div class="foca-overlay-divider"></div>
    <div class="foca-overlay-meta-label">Remaining Time</div>
    <div class="foca-overlay-meta-value" id="foca-overlay-timer">--:--</div>
    <div class="foca-overlay-divider"></div>
    <div class="foca-overlay-meta-label">Motivation</div>
    <div class="foca-overlay-meta-value" style="font-size:13px; font-style:italic; max-width:320px; line-height:1.5; color:var(--text-muted); font-family:var(--font-body); font-weight:normal; margin:0 auto;">"${quote}"</div>
    <div class="foca-overlay-actions" style="display:flex; flex-direction:column; align-items:center; gap:8px; justify-content:center; margin-top:8px;">
      <button class="foca-overlay-btn foca-overlay-btn-secondary" id="foca-overlay-break-btn">Quick Break</button>
      <div id="foca-cooldown-text" style="font-size:12px; color:#9c968a; font-family:'Plus Jakarta Sans', sans-serif; display:none;"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  const breakBtn = overlay.querySelector('#foca-overlay-break-btn');
  if (breakBtn) {
    // Initialise cooldown state
    chrome.storage.local.get(['lastQuickBreak'], result => {
      const last = result.lastQuickBreak || 0;
      const now = Date.now();
      const elapsed = now - last;
      const cooldown = 60 * 60 * 1000; // 60 minutes
      if (elapsed < cooldown) {
        const remaining = cooldown - elapsed;
        updateBreakButtonCooldown(breakBtn, remaining);
      }
    });

    breakBtn.addEventListener('click', () => {
      const now = Date.now();
      const breakEnd = now + 5 * 60 * 1000; // 5‑minute quick break
      chrome.storage.local.set({ quickBreakEndTime: breakEnd, lastQuickBreak: now }, () => {
        updateBreakButtonCooldown(breakBtn, 60 * 60 * 1000);
      });
    });
  }

  updateBlockCountdown(settings.timerEndTime);
}

// Helper to show remaining cooldown on the button.
function updateBreakButtonCooldown(button, remainingMs) {
  button.disabled = true;
  button.textContent = 'Quick Break (Used)';

  const cooldownText = document.getElementById('foca-cooldown-text');
  if (cooldownText) {
    cooldownText.style.display = 'block';
    const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
    cooldownText.textContent = `Available again in ${minutes} minutes.`;
  }

  const interval = setInterval(() => {
    if (!document.body.contains(button)) {
      clearInterval(interval);
      return;
    }
    remainingMs -= 1000;
    if (remainingMs <= 0) {
      clearInterval(interval);
      button.disabled = false;
      button.textContent = 'Quick Break';
      if (cooldownText) {
        cooldownText.style.display = 'none';
        cooldownText.textContent = '';
      }
    } else {
      const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
      if (cooldownText) {
        cooldownText.textContent = `Available again in ${minutes} minutes.`;
      }
    }
  }, 1000);
}

function updateBlockCountdown(endTime) {
  const timerVal = document.getElementById('foca-overlay-timer');
  if (!timerVal) return;

  if (!endTime) {
    timerVal.textContent = '00:00';
    return;
  }

  const timeLeft = endTime - Date.now();
  if (timeLeft <= 0) {
    timerVal.textContent = '00:00';
    return;
  }

  const minutes = Math.floor(timeLeft / 1000 / 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);
  timerVal.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function handleLinkedInBlock(settings, isEnabled) {
  if (!window.location.hostname.includes('linkedin.com')) return;

  const mode = settings.focaMode || 'off';
  const isStrict = mode === 'strict';

  const path = window.location.pathname;
  const isAllowed = path.startsWith('/jobs') || path.startsWith('/messaging');

  const isOnFeed = path === '/' || path === '/feed' || path.startsWith('/feed/');
  document.documentElement.classList.toggle('foca-li-feed', isEnabled && isOnFeed);

  if (!isEnabled || !isStrict || isAllowed) {
    removeBlockOverlay();
    return;
  }

  // Strict mode: Block all other pages
  document.documentElement.classList.add('foca-li-blocked');
  injectBlockOverlay(settings, 'LinkedIn');
  if (!focaOverlayInterval) {
    focaOverlayInterval = setInterval(() => {
      if (!document.getElementById('foca-block-overlay')) {
        injectBlockOverlay(settings, 'LinkedIn');
      } else {
        updateBlockCountdown(settings.timerEndTime);
      }
    }, 500);
  }
}

// ==========================================
// MAIN COORDINATOR
// ==========================================
function updateStylesWithSettings(settings) {
  const mode = settings.focaMode || 'off';
  let isEnabled = mode !== 'off';
  const isStrict = mode === 'strict';

  const breakEndTime = settings.quickBreakEndTime;
  if (breakEndTime && breakEndTime > Date.now()) {
    isEnabled = false; // Disable all restrictions during a quick break
  }

  const showQuotes = settings.showQuotes !== false;

  // Always remove old style block
  if (focaStyleElement) {
    focaStyleElement.remove();
    focaStyleElement = null;
  }

  // Always remove old motivation cards
  removeMotivationCards();

  // Handle Instagram listeners
  if (window.location.hostname.includes('instagram.com')) {
    handleInstagramBlock(settings, isEnabled);
  }

  // Handle LinkedIn listeners
  if (window.location.hostname.includes('linkedin.com')) {
    handleLinkedInBlock(settings, isEnabled);
    if (isEnabled) {
      if (!linkedinInterval) linkedinInterval = setInterval(() => handleLinkedInBlock(settings, true), 500);
    } else {
      if (linkedinInterval) { clearInterval(linkedinInterval); linkedinInterval = null; }
    }
  }

  // Inject styles and motivation cards when enabled
  if (isEnabled) {
    const css = generateCSSWithSettings(settings, isStrict);
    if (css) {
      focaStyleElement = document.createElement('style');
      focaStyleElement.id = 'foca-injected-styles';
      document.documentElement.appendChild(focaStyleElement);
      focaStyleElement.textContent = css;
    }

    // Inject motivation cards after a brief delay (let page elements paint first)
    if (showQuotes && quotes.length > 0) {
      setTimeout(() => injectMotivationCards(), 1200);
    }
  }
}

// Keys we fetch from Storage
const STORAGE_KEYS = [
  'focaMode',
  'quickBreakEndTime',
  'igMode',
  'ytLockHomepage',
  'ytHideComments',
  'liHideFeed',
  'liHideNews',
  'showQuotes',
  'currentSessionGoal',
  'timerEndTime'
];

// YouTube-specific setting keys — changes to these require a page re-render
const YT_SETTING_KEYS = ['ytLockHomepage', 'ytHideComments', 'focaMode'];

// ==========================================
// YOUTUBE SPA RE-NAVIGATION
// ==========================================
/**
 * Forces YouTube's SPA to re-render the current page.
 * Tries YouTube's own yt-navigate router first; falls back to location.reload().
 * This makes the page look exactly as it does after a manual refresh.
 */
function reloadYouTubePage() {
  if (!window.location.hostname.includes('youtube.com')) return;

  // Attempt 1: Use YouTube's internal SPA router event
  // YouTube listens for 'yt-navigate' on document to handle page transitions
  const currentUrl = window.location.href;
  const navigated = document.dispatchEvent(
    new CustomEvent('yt-navigate', {
      bubbles: true,
      detail: { endpoint: { commandMetadata: { webCommandMetadata: { url: window.location.pathname + window.location.search } } } }
    })
  );

  // Attempt 2: history trick — pushState then popstate makes YouTube re-fetch the page
  // We push the same URL then immediately pop, triggering YouTube's popstate handler
  try {
    history.pushState(null, '', currentUrl);
    history.back();
    // Give the router 300ms to respond; if the page hasn't changed, hard-reload
    setTimeout(() => {
      if (window.location.href === currentUrl) {
        // Attempt 3: Hard reload — guaranteed to work
        location.reload();
      }
    }, 300);
  } catch (_) {
    location.reload();
  }
}

// ==========================================
// BOOT SEQUENCE
// ==========================================
// 1. Load quotes first, then initialize styles
loadQuotes().then(() => {
  chrome.storage.local.get(STORAGE_KEYS, (result) => {
    updateStylesWithSettings(result);
  });
});

// 2. Listen for any setting or study mode change and re-apply rules
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    const hasChange = STORAGE_KEYS.some(key => changes[key] !== undefined);
    if (!hasChange) return;

    // Check whether a YouTube-specific setting was the trigger
    const isYouTube = window.location.hostname.includes('youtube.com');
    const ytSettingChanged = YT_SETTING_KEYS.some(key => changes[key] !== undefined);

    chrome.storage.local.get(STORAGE_KEYS, (result) => {
      updateStylesWithSettings(result);

      // Re-navigate the YouTube SPA so DOM nodes are rebuilt with the new CSS applied
      if (isYouTube && ytSettingChanged) {
        reloadYouTubePage();
      }
    });
  }
});
