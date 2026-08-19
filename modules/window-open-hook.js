// modules/window-open-hook.js
// Runs in MAIN world to securely protect both Extension Player and Regular Tabs from Ad Popunders & Tabunder Hijacking.

(function() {
    const currentUrl = window.location.href;

    // Safe security verification pages shouldn't be hooked aggressively
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

    const AD_DOMAINS = [
        'tsyndicate', 'tsyndicads', 'adsterra', 'propellerads', 'popads', 'popcash',
        'monetag', 'clickadu', 'hilltopads', 'onclickads', 'trafficstars', 'exoclick',
        'juicyads', 'mgid', 'adnxs', 'criteo', 'doubleclick', 'adservice',
        'bet365', '1xbet', '88bet', 'w88', 'fun88', 'shope.ee', 's.lazada',
        '/pop?', 'adserver', 'banner', 'redirect', 'clickserv', 'affiliate'
    ];

    function isAdTarget(urlStr) {
        if (!urlStr || typeof urlStr !== 'string') return false;
        const lower = urlStr.toLowerCase();
        return AD_DOMAINS.some(domain => lower.includes(domain));
    }

    function isCrossOriginUrl(targetUrl) {
        try {
            const targetHost = new URL(targetUrl, window.location.href).hostname;
            const currentHost = window.location.hostname;
            if (!targetHost || !currentHost) return false;
            if (targetHost === currentHost) return false;
            return !targetHost.endsWith('.' + currentHost) && !currentHost.endsWith('.' + targetHost);
        } catch(e) {
            return false;
        }
    }

    const isExtensionFrame = location.ancestorOrigins && location.ancestorOrigins.length > 0 && Array.from(location.ancestorOrigins).some(origin => origin.startsWith('chrome-extension://'));
    const isTopWindow = window.self === window.top;

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

    let lastNewTabOpenedTime = 0;

    // ─── 1. Hook window.open ───────────────────────────────────────────────────
    window.open = function(targetUrl, target, features) {
        if (!targetUrl || typeof targetUrl !== 'string' || targetUrl === 'about:blank') {
            return isExtensionFrame ? fakeWindow : originalOpen.apply(this, arguments);
        }

        // 1.1. Chặn nếu đích mở là ad network đã biết
        if (isAdTarget(targetUrl)) {
            console.log('[Anti-Ad Shield] Blocked ad popunder/tabunder:', targetUrl);
            return fakeWindow;
        }

        // 1.2. Nếu là Privacy Player Iframe
        if (isExtensionFrame) {
            window.postMessage({ 
                type: 'WINDOW_OPEN_ATTEMPT', 
                url: targetUrl,
                target: target || '_blank'
            }, '*');
            return fakeWindow;
        }

        // 1.3. Nếu là Tab Trình Duyệt Chính (Top Window)
        // Đánh dấu thời điểm vừa mở tab mới để kích hoạt Anti-Tabunder Lock
        lastNewTabOpenedTime = Date.now();
        return originalOpen.apply(this, arguments);
    };

    // ─── 2. Anti-Tabunder Guard (Chống cướp tab cũ khi mở tab mới trên Top Window) ───
    if (isTopWindow) {
        // Hook location.replace và location.assign
        const originalReplace = window.location.replace;
        const originalAssign = window.location.assign;

        if (originalReplace) {
            window.location.replace = function(url) {
                const now = Date.now();
                if (now - lastNewTabOpenedTime < 2500) {
                    if (isAdTarget(url) || isCrossOriginUrl(url)) {
                        console.warn('[Anti-Tabunder Shield] Blocked background tab hijacking via location.replace:', url);
                        return;
                    }
                }
                return originalReplace.apply(window.location, arguments);
            };
        }

        if (originalAssign) {
            window.location.assign = function(url) {
                const now = Date.now();
                if (now - lastNewTabOpenedTime < 2500) {
                    if (isAdTarget(url) || isCrossOriginUrl(url)) {
                        console.warn('[Anti-Tabunder Shield] Blocked background tab hijacking via location.assign:', url);
                        return;
                    }
                }
                return originalAssign.apply(window.location, arguments);
            };
        }

        // Giám sát các trap click vô tình kích hoạt chuyển hướng tab cũ
        document.addEventListener('click', (e) => {
            const now = Date.now();
            if (now - lastNewTabOpenedTime < 1500) {
                const target = e.target;
                if (target && target.tagName === 'A' && target.target !== '_blank') {
                    const href = target.href || '';
                    if (isAdTarget(href) || isCrossOriginUrl(href)) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.warn('[Anti-Tabunder Shield] Blocked background click redirect:', href);
                    }
                }
            }
        }, true);
    }
})();


