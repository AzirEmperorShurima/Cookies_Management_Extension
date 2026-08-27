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

    function isUserInitiated() {
        // Modern browser API for user activation
        if (navigator.userActivation && typeof navigator.userActivation.isActive === 'boolean') {
            if (navigator.userActivation.isActive) return true;
        }
        // Fallback: Check if a trusted click/keypress occurred within the last 1500ms
        return (Date.now() - lastTrustedUserActionTime) < 1500;
    }

    function isCrossOrigin(targetUrl) {
        try {
            const targetHost = new URL(targetUrl, window.location.href).hostname;
            const currentHost = window.location.hostname;
            if (!targetHost || !currentHost) return false;
            if (targetHost === currentHost) return false;
            // Same base domain (e.g. sub.example.com and example.com)
            const getBase = h => h.split('.').slice(-2).join('.');
            return getBase(targetHost) !== getBase(currentHost);
        } catch(e) {
            return false;
        }
    }

    function isSuspiciousPopunderFeatures(features) {
        if (!features || typeof features !== 'string') return false;
        const lower = features.toLowerCase();
        // Suspicious micro-windows or offscreen coordinates designed to hide popunders
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
        // If extension player iframe, delegate to player manager
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

        // If shield is disabled by user, allow original behavior
        if (!isTabunderEnabled) {
            return originalOpen.apply(this, arguments);
        }

        // Detect suspicious background popunders (e.g. 1x1 micro-window or opened without user gesture)
        if (features && isSuspiciousPopunderFeatures(features)) {
            console.warn('[Anti-Tabunder Shield] Blocked suspicious micro-window/popunder:', targetUrl, features);
            return fakeWindow;
        }

        // Record timestamp of opened window to activate Tabunder Intent-Lock on current tab
        lastNewWindowOpenedTime = Date.now();
        return originalOpen.apply(this, arguments);
    };

    // ─── 4. Intent-Lock Guard against Tabunder Hijacking ───────────────────────
    // Protects the CURRENT tab from being silently navigated to ads when a new tab opens
    if (isTopWindow) {
        const originalReplace = window.location.replace;
        const originalAssign = window.location.assign;

        if (originalReplace) {
            window.location.replace = function(url) {
                if (isTabunderEnabled) {
                    const elapsedSinceNewTab = Date.now() - lastNewWindowOpenedTime;
                    // If a new tab was just opened (<1500ms) AND current tab is redirected cross-origin without user interaction
                    if (elapsedSinceNewTab < 1500 && isCrossOrigin(url) && !isUserInitiated()) {
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
                    if (elapsedSinceNewTab < 1500 && isCrossOrigin(url) && !isUserInitiated()) {
                        console.warn('[Anti-Tabunder Shield] Prevented background tab hijacking via location.assign:', url);
                        return;
                    }
                }
                return originalAssign.apply(window.location, arguments);
            };
        }
    }
})();
