// modules/window-open-hook.js
// Behavior & User-Activation Heuristic Shield against Ad Popunders & Tabunder Hijacking.
// Zero-Whitelist architecture: Uses browser security primitives (User Gestures & Intent Lock).

(function() {
    const currentUrl = window.location.href;

    // ─── 0. Skip Security & Captcha Verification Pages ─────────────────────────
    const isSecurityPage = 
        currentUrl.includes('cloudflare.com') || 
        currentUrl.includes('challenges.cloudflare.com') || 
        currentUrl.includes('turnstile.cloudflare.com') || 
        currentUrl.includes('hcaptcha.com') || 
        currentUrl.includes('recaptcha.net') ||
        currentUrl.includes('google.com/recaptcha') ||
        currentUrl.includes('turnstile') ||
        document.getElementById('cf-turnstile-response') ||
        window._cf_chl_opt;
    if (isSecurityPage) return;

    const isExtensionFrame = location.ancestorOrigins && location.ancestorOrigins.length > 0 && Array.from(location.ancestorOrigins).some(origin => origin.startsWith('chrome-extension://'));
    const isTopWindow = window.self === window.top;

    // ─── 1. State & Dynamic Settings Sync ─────────────────────────────────────
    let isTabunderEnabled = true;
    try {
        if (document.documentElement && document.documentElement.dataset && typeof document.documentElement.dataset.thanusTabunder !== 'undefined') {
            isTabunderEnabled = document.documentElement.dataset.thanusTabunder !== 'false';
        } else {
            const saved = localStorage.getItem('__thanusTabunder');
            if (saved !== null) isTabunderEnabled = saved !== 'false';
        }
    } catch (e) {}

    window.addEventListener('message', (e) => {
        if (e.source === window && e.data && e.data.type === '__THANUS_TABUNDER_SYNC__') {
            if (typeof e.data.enabled === 'boolean') {
                isTabunderEnabled = e.data.enabled;
                try { localStorage.setItem('__thanusTabunder', isTabunderEnabled.toString()); } catch (err) {}
            }
        }
    });

    // ─── 2. User Gesture & Intent Tracking ────────────────────────────────────
    let lastTrustedUserActionTime = 0;
    let lastNewWindowOpenedTime = 0;

    const recordUserAction = (e) => {
        if (e && e.isTrusted) {
            lastTrustedUserActionTime = Date.now();
        }
    };

    window.addEventListener('click', recordUserAction, true);
    window.addEventListener('keydown', recordUserAction, true);
    window.addEventListener('pointerdown', recordUserAction, true);

    function isCrossOrigin(targetUrl) {
        try {
            const targetHost = new URL(targetUrl, window.location.href).hostname;
            const currentHost = window.location.hostname;
            if (!targetHost || !currentHost) return false;
            if (targetHost === currentHost) return false;
            const getBase = h => h.split('.').slice(-2).join('.');
            return getBase(targetHost) !== getBase(currentHost);
        } catch(e) {
            return false;
        }
    }

    const AD_HOST_PATTERNS = [
        'tsyndicate', 'tsyndicads', 'adsterra', 'propellerads', 'popads', 'popcash',
        'monetag', 'clickadu', 'hilltopads', 'onclickads', 'trafficstars', 'exoclick',
        'juicyads', 'mgid', 'adnxs', 'criteo', 'adservice.google', 'doubleclick',
        'adkernel', 'inmobi', 'adcash', 'richpush', 'zeroredirect', 'admob', 'trafficjunky',
        'linkroyal', 'linkvertise', 'ouo.io', 'adf.ly', 'adbtc', 'shortlink',
        'admaven', 'popunder', 'directrev', 'vidoomy', 'clickaine', 'adx', 'adman',
        'trafficfactory', 'adplugg', 'bidvertiser', 'flyads', 'taboola', 'outbrain',
        '1xbet', 'bet365', 'dafabet', 'w88', 'fun88', 'kubet', 'thabet', 'jun88', 'shbet'
    ];

    const GAMBLING_KEYWORDS = [
        'hi88', 'shbet', 'jun88', '789bet', '789club', 'new88', 'f8bet', 'okvip', 'mb66',
        'kubet', 'thabet', 'bk8', 'fb88', 'm88', '188bet', 'dafabet', 'ae888', 'sv388',
        'sodo', 'sin88', 'debet', 'may88', 'red88', 'zbet', 'oxbet', 'five88', 'taixiu',
        'nohu', 'banca', 'gamebai', 'ku11', 'tj77', 'v9bet', 'bet365', '1xbet', '88bet',
        'w88', 'fun88', 'k8', 'cmd368', 'sbotop', 'bong88', 'viva88', 'sv88', 'mu9',
        'dabet', 'luck8', 'rikvip', 'sunwin', 'go88', 'b52', 'iwin', 'hitclub', 'yo88',
        'zo88', 'manclub', 'quayhu', 'lode', 'xoso', 'soicau', 'keonhadai', 'nhacai',
        'casinogame', 'slotgame', 'jackpot'
    ];

    function isKnownAdUrl(targetUrl) {
        if (!targetUrl || typeof targetUrl !== 'string') return false;
        try {
            const parsed = new URL(targetUrl, window.location.href);
            const host = parsed.hostname.toLowerCase();
            const fullUrl = parsed.href.toLowerCase();
            if (AD_HOST_PATTERNS.some(d => host.includes(d))) return true;
            if (GAMBLING_KEYWORDS.some(kw => host.includes(kw) || parsed.pathname.toLowerCase().includes(kw))) return true;
            if (host.endsWith('.workers.dev') || host.endsWith('.pages.dev') || host.endsWith('.r2.dev')) {
                if (host.includes('link') || host.includes('ad') || host.includes('short') || GAMBLING_KEYWORDS.some(kw => fullUrl.includes(kw))) return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    function isSuspiciousPopunderFeatures(features) {
        if (!features || typeof features !== 'string') return false;
        const lower = features.toLowerCase();
        if (lower.includes('width=1') || lower.includes('height=1') || lower.includes('width=0') || lower.includes('height=0')) {
            return true;
        }
        if (lower.includes('top=-') || lower.includes('left=-') || lower.includes('top=9999') || lower.includes('left=9999')) {
            return true;
        }
        return false;
    }

    const originalOpen = window.open;
    const fakeWindow = {
        closed: false,
        close: function() { this.closed = true; },
        focus: function() {},
        blur: function() {},
        postMessage: function() {},
        document: { write: function() {}, close: function() {} },
        location: { href: 'about:blank' }
    };

    // ─── 3. Intelligent window.open Handler ───────────────────────────────────
    window.open = function(targetUrl, target, features) {
        if (targetUrl && isKnownAdUrl(targetUrl)) {
            console.warn('[Anti-Tabunder Shield] Blocked ad/gambling window.open attempt:', targetUrl);
            return fakeWindow;
        }

        if (isExtensionFrame) {
            if (targetUrl && typeof targetUrl === 'string' && targetUrl !== 'about:blank') {
                window.postMessage({ 
                    type: 'WINDOW_OPEN_ATTEMPT', 
                    url: targetUrl,
                    target: target || '_blank'
                }, '*');
                return fakeWindow;
            }
            return originalOpen.apply(this, arguments);
        }

        if (!isTabunderEnabled) {
            return originalOpen.apply(this, arguments);
        }

        if (features && isSuspiciousPopunderFeatures(features)) {
            console.warn('[Anti-Tabunder Shield] Blocked suspicious micro-window/popunder:', targetUrl, features);
            return fakeWindow;
        }

        lastNewWindowOpenedTime = Date.now();
        const openedWin = originalOpen.apply(this, arguments);

        // Guard against delayed window.location mutation in returned window reference
        if (openedWin && typeof openedWin === 'object') {
            try {
                const origSetHref = Object.getOwnPropertyDescriptor(openedWin.location || {}, 'href')?.set;
                if (origSetHref) {
                    Object.defineProperty(openedWin.location, 'href', {
                        set: function(val) {
                            if (isTabunderEnabled && isKnownAdUrl(val)) {
                                console.warn('[Anti-Tabunder Shield] Blocked child window redirect to ad:', val);
                                return;
                            }
                            return origSetHref.call(this, val);
                        }
                    });
                }
            } catch (e) {}
        }

        return openedWin || fakeWindow;
    };

    // ─── 4. Intent-Lock Guard against Tabunder Hijacking ───────────────────────
    // Protects the CURRENT tab from being redirected when a popup opens or when an ad script hijacks location
    if (isTopWindow) {
        const originalReplace = window.location.replace;
        const originalAssign = window.location.assign;

        if (originalReplace) {
            window.location.replace = function(url) {
                if (isTabunderEnabled) {
                    const elapsedSinceNewTab = Date.now() - lastNewWindowOpenedTime;
                    if (isKnownAdUrl(url)) {
                        console.warn('[Anti-Tabunder Shield] Blocked ad redirect via location.replace:', url);
                        return;
                    }
                    if (elapsedSinceNewTab < 2500 && isCrossOrigin(url)) {
                        console.warn('[Anti-Tabunder Shield] Prevented background tab hijacking via location.replace:', url);
                        return;
                    }
                }
                return originalReplace.apply(window.location, arguments);
            };
        }

        if (originalAssign) {
            window.location.assign = function(url) {
                if (isTabunderEnabled) {
                    const elapsedSinceNewTab = Date.now() - lastNewWindowOpenedTime;
                    if (isKnownAdUrl(url)) {
                        console.warn('[Anti-Tabunder Shield] Blocked ad redirect via location.assign:', url);
                        return;
                    }
                    if (elapsedSinceNewTab < 2500 && isCrossOrigin(url)) {
                        console.warn('[Anti-Tabunder Shield] Prevented background tab hijacking via location.assign:', url);
                        return;
                    }
                }
                return originalAssign.apply(window.location, arguments);
            };
        }

        // Intercept Location.prototype.href setter
        try {
            const locProto = Object.getPrototypeOf(window.location) || window.Location?.prototype;
            if (locProto) {
                const hrefDesc = Object.getOwnPropertyDescriptor(locProto, 'href');
                if (hrefDesc && hrefDesc.set) {
                    const origHrefSet = hrefDesc.set;
                    Object.defineProperty(locProto, 'href', {
                        set: function(url) {
                            if (isTabunderEnabled) {
                                const elapsedSinceNewTab = Date.now() - lastNewWindowOpenedTime;
                                if (isKnownAdUrl(url)) {
                                    console.warn('[Anti-Tabunder Shield] Blocked ad navigation via location.href:', url);
                                    return;
                                }
                                if (elapsedSinceNewTab < 2500 && isCrossOrigin(url)) {
                                    console.warn('[Anti-Tabunder Shield] Prevented tabunder hijacking via location.href:', url);
                                    return;
                                }
                            }
                            return origHrefSet.call(this, url);
                        }
                    });
                }
            }
        } catch (err) {}

        // ─── 5. Intercept Click-Jacking Overlays & Hijacked Links ──────────────
        document.addEventListener('click', (e) => {
            if (!isTabunderEnabled) return;

            // 1. Check if clicked link is an ad / gambling popunder target
            const anchor = e.target.closest ? e.target.closest('a') : null;
            if (anchor && anchor.href && isKnownAdUrl(anchor.href)) {
                console.warn('[Anti-Tabunder Shield] Blocked click on ad anchor:', anchor.href);
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // 2. Detect & Neutralize Full-screen Transparent Clickjack Overlays
            const targetEl = e.target;
            if (targetEl && targetEl !== document.body && targetEl !== document.documentElement) {
                const style = window.getComputedStyle(targetEl);
                if (style.position === 'fixed' || style.position === 'absolute') {
                    const rect = targetEl.getBoundingClientRect();
                    const isFullScreen = rect.width >= window.innerWidth * 0.85 && rect.height >= window.innerHeight * 0.85;
                    const isTransparent = style.opacity === '0' || style.visibility === 'hidden' || style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent';
                    const isHighZIndex = parseInt(style.zIndex, 10) >= 999;

                    if (isFullScreen && (isTransparent || isHighZIndex) && !targetEl.querySelector('video, img, button')) {
                        console.warn('[Anti-Tabunder Shield] Neutralized transparent clickjacking overlay:', targetEl);
                        e.preventDefault();
                        e.stopPropagation();
                        targetEl.remove();
                    }
                }
            }
        }, true);
    }
})();

