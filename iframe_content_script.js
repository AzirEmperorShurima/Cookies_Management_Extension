// iframe_content_script.js
// This script runs inside all frames and handles Privacy Player navigation.

(function () {
    // Bỏ qua các frame ẩn hoàn toàn (tracking pixel, 0x0 beacon) để tiết kiệm tài nguyên
    if (window.self !== window.top && window.innerWidth === 0 && window.innerHeight === 0 && document.hidden) {
        return;
    }

    // ------------------ CSS Element Hiding Adblocker ------------------
    try {
        chrome.storage.local.get(['appSettings', 'adblockCssRules', 'userZappedCssRules'], (res) => {
            const settings = res.appSettings || {};
            if (settings.adblockEnabled === false) return;

            const cssRules = res.adblockCssRules || {};
            const zappedRules = res.userZappedCssRules || {};
            const host = window.location.hostname;
            const selectors = [];

            const mergeRules = (domain) => {
                if (Array.isArray(cssRules[domain])) selectors.push(...cssRules[domain]);
                if (Array.isArray(zappedRules[domain])) selectors.push(...zappedRules[domain]);
            };

            // 1. Lấy quy tắc CSS toàn cục (global)
            mergeRules('global');

            // 2. Lấy quy tắc CSS theo domain hiện tại
            if (host) {
                const parts = host.split('.');
                for (let i = 0; i < parts.length - 1; i++) {
                    const domain = parts.slice(i).join('.');
                    mergeRules(domain);
                }
            }

            // 3. Tiêm style ẩn phần tử quảng cáo
            if (selectors.length > 0) {
                const style = document.createElement('style');
                style.id = 'adblock-element-hiding-style';
                style.textContent = selectors.join(', ') + ' { display: none !important; }';
                
                const parent = document.head || document.documentElement;
                if (parent) {
                    parent.appendChild(style);
                } else {
                    document.addEventListener('DOMContentLoaded', () => {
                        (document.head || document.documentElement).appendChild(style);
                    });
                }
            }
        });
    } catch (e) {
        console.warn('[Adblock] CSS element hiding failed:', e);
    }
    // ------------------------------------------------------------------

    // Ensure we are inside a Privacy Player frame (by checking if the parent is our extension)
    const isExtensionFrame = location.ancestorOrigins && location.ancestorOrigins.length > 0 && Array.from(location.ancestorOrigins).some(origin => origin.startsWith('chrome-extension://'));
    if (window.self !== window.top && isExtensionFrame) {

        const currentUrl = window.location.href;

        // 0. Kiểm tra an toàn: Nếu là trang Cloudflare, hcaptcha hoặc bot-check
        const lowerUrl = (currentUrl || '').toLowerCase();
        const pathname = (window.location.pathname || '').toLowerCase();
        const search = (window.location.search || '').toLowerCase();
        const isSecurityPage =
            lowerUrl.includes('cloudflare.com') ||
            lowerUrl.includes('challenges.cloudflare.com') ||
            lowerUrl.includes('turnstile.cloudflare.com') ||
            lowerUrl.includes('hcaptcha.com') ||
            lowerUrl.includes('recaptcha.net') ||
            lowerUrl.includes('google.com/recaptcha') ||
            lowerUrl.includes('turnstile') ||
            lowerUrl.includes('__cf_chl_') ||
            lowerUrl.includes('cdn-cgi/challenge-platform') ||
            pathname.includes('cdn-cgi/challenge-platform') ||
            pathname.includes('__cf_chl_') ||
            search.includes('cf_chl_') ||
            search.includes('__cf_chl_') ||
            typeof window._cf_chl_opt !== 'undefined' ||
            typeof window.__cfRLUnblockHandlers !== 'undefined' ||
            typeof window.turnstile !== 'undefined' ||
            document.getElementById('challenge-form') !== null ||
            document.getElementById('challenge-running') !== null ||
            document.getElementById('challenge-stage') !== null ||
            document.getElementById('cf-turnstile-response') !== null ||
            document.querySelector('.cf-turnstile-wrapper') !== null ||
            document.querySelector('iframe[src*="challenges.cloudflare.com"]') !== null ||
            document.querySelector('iframe[src*="turnstile"]') !== null ||
            document.querySelector('.ch-title-zone') !== null ||
            document.querySelector('#cf-wrapper') !== null ||
            (document.title && (document.title.toLowerCase().includes('just a moment...') || document.title.toLowerCase().includes('attention required! | cloudflare')));

        if (isSecurityPage) {
            console.log('[Privacy Player] Safe verification iframe detected, skipping link interception');
            return;
        }

        // Notify the extension about the current URL of the iframe
        // ONLY if this is the direct child of the popup (the main Privacy Player iframe)
        // This prevents sub-iframes (like video embeds) from cluttering history/address bar
        if (window.parent === window.top) {
            chrome.runtime.sendMessage({
                type: 'iframeNavigated',
                url: window.location.href,
                frameId: 0, // In this context, it's the main frame of the player
                timestamp: Date.now()
            }).catch(() => { });
        }

        let settings = {
            linkClickBehavior: 'inside', // Default: inside | newTab | incognito | block | smart
            appliedLinkType: 'all',      // Default: all | externalOnly | targetBlankOnly
            adblockEnabled: true
        };

        function checkContextValidity() {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
                return false;
            }
            return true;
        }

        const AD_DOMAINS_LIST = [
            'tsyndicate', 'tsyndicads', 'adsterra', 'propellerads', 'popads', 'popcash',
            'monetag', 'clickadu', 'hilltopads', 'onclickads', 'trafficstars', 'exoclick',
            'juicyads', 'mgid', 'adnxs', 'criteo', 'doubleclick', 'adservice',
            'bet365', '1xbet', '88bet', 'w88', 'fun88', 'shope.ee', 's.lazada',
            '/pop?', 'adserver', 'banner', 'redirect', 'clickserv', 'affiliate'
        ];

        function isKnownAdUrl(targetUrl) {
            if (!targetUrl || typeof targetUrl !== 'string') return false;
            const lower = targetUrl.toLowerCase();
            return AD_DOMAINS_LIST.some(d => lower.includes(d));
        }

        function isExternalLink(targetUrl) {
            try {
                const targetHost = new URL(targetUrl).hostname;
                const currentHost = window.location.hostname;
                if (!targetHost || !currentHost) return false;
                if (targetHost === currentHost) return false;
                // Allow subdomains (e.g. m.youtube.com vs youtube.com)
                return !targetHost.endsWith('.' + currentHost) && !currentHost.endsWith('.' + targetHost);
            } catch(e) {
                return false;
            }
        }

        // Fetch extension settings from storage with backward compatibility
        chrome.storage.local.get(['appSettings'], (result) => {
            if (result.appSettings) {
                settings.linkClickBehavior = result.appSettings.linkClickBehavior || result.appSettings.playerLinkBehavior || 'inside';
                settings.appliedLinkType = result.appSettings.appliedLinkType || result.appSettings.playerLinkFilter || 'all';
                settings.adblockEnabled = result.appSettings.adblockEnabled !== false;
            }
        });

        // Listen for setting changes
        function storageListener(changes, areaName) {
            if (!checkContextValidity()) {
                try { chrome.storage.onChanged.removeListener(storageListener); } catch (e) {}
                return;
            }
            if (areaName === 'local' && changes.appSettings) {
                const newSettings = changes.appSettings.newValue || {};
                settings.linkClickBehavior = newSettings.linkClickBehavior || newSettings.playerLinkBehavior || 'inside';
                settings.appliedLinkType = newSettings.appliedLinkType || newSettings.playerLinkFilter || 'all';
                settings.adblockEnabled = newSettings.adblockEnabled !== false;
            }
        }
        chrome.storage.onChanged.addListener(storageListener);

        // ------------------ AUTO-SKIP VIDEO ADS & OVERLAYS ------------------
        function autoDismissVideoAds() {
            const skipSelectors = [
                '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern', '.ytp-skip-ad-button',
                '.videoAdUiSkipButton', '.skip-ad-btn', '.skip-ad', '[class*="skipAd"]',
                '.jw-ad-close', '.jw-skip', '[aria-label*="Skip" i]', '[aria-label*="Close Ad" i]',
                '.ad-close', '.close-ad', '.video-ad-overlay-close'
            ];

            for (const sel of skipSelectors) {
                const btn = document.querySelector(sel);
                if (btn && typeof btn.click === 'function' && btn.offsetParent !== null) {
                    try {
                        btn.click();
                        console.log('[Privacy Player Shield] Auto-skipped video ad element:', sel);
                    } catch(e) {}
                }
            }

            // Remove transparent ad overlays sitting on top of video players
            const adOverlays = document.querySelectorAll('div[class*="ad-overlay"], div[id*="ad_overlay"], a[href*="tsyndicate"], a[href*="adsterra"]');
            adOverlays.forEach(overlay => {
                try {
                    if (overlay && overlay.parentNode) {
                        overlay.style.display = 'none';
                        overlay.remove();
                    }
                } catch(e) {}
            });
        }

        // Run auto-dismiss periodically
        setInterval(autoDismissVideoAds, 1000);

        // ------------------ LINK CLICK INTERCEPTION ------------------
        document.addEventListener('click', (event) => {
            let target = event.target;

            while (target && target !== document) {
                const href = target.href || target.getAttribute('href') ||
                    target.getAttribute('data-href') || target.getAttribute('data-url');

                if (!href || href === '#' || href.startsWith('javascript:')) {
                    target = target.parentNode;
                    continue;
                }

                let finalUrl;
                try {
                    finalUrl = new URL(href, window.location.href).toString();
                } catch (e) {
                    finalUrl = href;
                }

                if (!finalUrl.startsWith('http')) {
                    target = target.parentNode;
                    continue;
                }

                // 1. Phân tích loại liên kết & quảng cáo
                const isAd = isKnownAdUrl(finalUrl);
                const isExternal = isExternalLink(finalUrl);
                const requiresNewTab = target.target === '_blank' ||
                    event.ctrlKey || event.metaKey ||
                    event.shiftKey || event.button === 1;

                // 2. Chặn quảng cáo click-trap tức thì
                if (isAd && settings.adblockEnabled) {
                    event.preventDefault();
                    event.stopPropagation();
                    console.log('[Privacy Player Shield] Blocked ad trap link click:', finalUrl);
                    return;
                }

                let behavior = settings.linkClickBehavior; // inside / newTab / incognito / block / smart
                let filterType = settings.appliedLinkType; // all / externalOnly / targetBlankOnly

                // Search engine override
                const hostname = window.location.hostname;
                const isSearchEngine = hostname.includes('google.') || hostname.includes('coccoc.') || hostname.includes('bing.') || hostname.includes('duckduckgo.');
                if (isSearchEngine) {
                    behavior = 'inside';
                    filterType = 'all';
                }

                // 3. Kiểm tra xem link này có thuộc phạm vi áp dụng (filterType) hay không
                let isFilterMatched = false;
                if (filterType === 'all') {
                    isFilterMatched = true;
                } else if (filterType === 'externalOnly') {
                    isFilterMatched = isExternal || requiresNewTab;
                } else if (filterType === 'targetBlankOnly') {
                    isFilterMatched = requiresNewTab;
                }

                // Nếu không thuộc filter, cho phép mở native inside bình thường
                if (!isFilterMatched) {
                    return;
                }

                // 4. Xử lý theo Hành Vi đã chọn
                if (behavior === 'block') {
                    event.preventDefault();
                    event.stopPropagation();
                    chrome.runtime.sendMessage({
                        type: 'privacyPlayerLinkClicked',
                        action: 'block',
                        url: finalUrl
                    }).catch(() => {});
                    return;
                }

                if (behavior === 'newTab') {
                    event.preventDefault();
                    event.stopPropagation();
                    chrome.runtime.sendMessage({
                        type: 'privacyPlayerLinkClicked',
                        action: 'newTab',
                        url: finalUrl
                    }).catch(() => {});
                    return;
                }

                if (behavior === 'incognito') {
                    event.preventDefault();
                    event.stopPropagation();
                    chrome.runtime.sendMessage({
                        type: 'privacyPlayerLinkClicked',
                        action: 'incognito',
                        url: finalUrl
                    }).catch(() => {});
                    return;
                }

                if (behavior === 'smart') {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!isExternal) {
                        window.location.href = finalUrl;
                    } else {
                        chrome.runtime.sendMessage({
                            type: 'privacyPlayerLinkClicked',
                            action: 'newTab',
                            url: finalUrl
                        }).catch(() => {});
                    }
                    return;
                }

                if (behavior === 'inside') {
                    if (requiresNewTab) {
                        event.preventDefault();
                        event.stopPropagation();
                        window.location.href = finalUrl;
                        return;
                    } else {
                        return;
                    }
                }
            }

            target = target.parentNode;
        }, true); // capture phase

        let isTheaterMode = false;
        let originalStyles = new Map();

        // Listen for messages from the extension popup or background
        function messageListener(message, sender, sendResponse) {
            if (!checkContextValidity()) {
                try { chrome.runtime.onMessage.removeListener(messageListener); } catch (e) {}
                return;
            }
            if (message.type === 'toggleTheaterMode') {
                toggleTheaterMode();
                sendResponse({ success: true, isTheaterMode });
            } else if (message.type === 'togglePip') {
                togglePip();
                sendResponse({ success: true });
            }
        }
        chrome.runtime.onMessage.addListener(messageListener);

        // Also listen for postMessage (for direct communication from popup iframe)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'toggleTheaterMode') {
                toggleTheaterMode();
            } else if (event.data && event.data.type === 'togglePip') {
                togglePip();
            } else if (event.data && event.data.type === 'WINDOW_OPEN_ATTEMPT') {
                const targetUrl = event.data.url;
                if (!targetUrl || targetUrl === 'about:blank') return;

                let finalUrl;
                try {
                    finalUrl = new URL(targetUrl, window.location.href).toString();
                } catch (e) {
                    finalUrl = targetUrl;
                }

                if (!finalUrl.startsWith('http')) return;

                const isAd = isKnownAdUrl(finalUrl);
                const isExternal = isExternalLink(finalUrl);

                if (isAd && settings.adblockEnabled) {
                    console.log('[Privacy Player Shield] Blocked window.open ad target:', finalUrl);
                    return;
                }

                const behavior = settings.linkClickBehavior;
                
                if (behavior === 'block') {
                    console.log('[Privacy Player Shield] Blocked window.open popup to:', finalUrl);
                    chrome.runtime.sendMessage({
                        type: 'privacyPlayerLinkClicked',
                        action: 'block',
                        url: finalUrl
                    }).catch(() => {});
                    return;
                }

                if (behavior === 'newTab' || behavior === 'incognito') {
                    chrome.runtime.sendMessage({
                        type: 'privacyPlayerLinkClicked',
                        action: behavior,
                        url: finalUrl
                    }).catch(() => {});
                    return;
                }

                if (behavior === 'smart') {
                    if (!isExternal) {
                        window.location.href = finalUrl;
                    } else {
                        chrome.runtime.sendMessage({
                            type: 'privacyPlayerLinkClicked',
                            action: 'newTab',
                            url: finalUrl
                        }).catch(() => {});
                    }
                    return;
                }

                // behavior === 'inside': Chỉ điều hướng nội bộ nếu là cùng domain gốc
                // Ngăn chặn việc popunder lạ đè mất trang video đang xem!
                if (!isExternal) {
                    window.location.href = finalUrl;
                } else {
                    console.log('[Privacy Player Shield] Prevented external popunder from overriding player view:', finalUrl);
                    chrome.runtime.sendMessage({
                        type: 'privacyPlayerLinkClicked',
                        action: 'newTab',
                        url: finalUrl
                    }).catch(() => {});
                }
            }
        });

        function togglePip() {
            const videos = Array.from(document.querySelectorAll('video'));
            if (videos.length === 0) {
                console.log('Privacy Player: No video element found for PiP.');
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    try {
                        const innerVideo = iframe.contentDocument.querySelector('video');
                        if (innerVideo) {
                            requestPip(innerVideo);
                        }
                    } catch (e) {
                    }
                });
                return;
            }

            const playingVideo = videos.find(v => !v.paused && !v.ended);
            const targetVideo = playingVideo || videos[0];

            requestPip(targetVideo);
        }

        function requestPip(video) {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture();
            } else {
                if (document.pictureInPictureEnabled) {
                    if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                        video.requestPictureInPicture().catch(error => {
                            console.error('Privacy Player: PiP failed', error);
                            if (error.name === 'InvalidStateError') {
                                video.addEventListener('loadedmetadata', () => {
                                    video.requestPictureInPicture();
                                }, { once: true });
                            }
                        });
                    } else {
                        video.addEventListener('loadedmetadata', () => {
                            video.requestPictureInPicture();
                        }, { once: true });
                    }
                } else {
                    console.warn('Privacy Player: PiP is not enabled in this browser.');
                }
            }
        }

        function toggleTheaterMode() {
            const video = findBestVideo();
            if (!video) {
                console.log('Privacy Player: No video found to expand.');
                return;
            }

            isTheaterMode = !isTheaterMode;

            if (isTheaterMode) {
                applyTheaterMode(video);
            } else {
                removeTheaterMode(video);
            }
        }

        function findBestVideo() {
            // 1. Specific Site Selectors (targeting the full player container)
            const sitePlayers = [
                '.html5-video-player', // YouTube Full Player
                '#movie_player',       // YouTube ID
                '.vimeo-video-player', // Vimeo
                '.jwplayer',           // JW Player
                '.vjs-tech',           // Video.js
                '.video-js',           // Video.js Container
                '.vjs-tech',           // Video.js internal
                '.plyr',               // Plyr
                '.mejs-container',     // MediaElement.js
                '.bitmovinplayer-container', // Bitmovin
                '.flowplayer',         // Flowplayer
                '.dplayer',            // DPlayer
                '.artplayer-container', // ArtPlayer
                '.video-player',       // Generic
                '#video-player',       // Generic ID
                '.player-wrapper',     // Generic
                '.video-container'     // Generic
            ];

            for (const selector of sitePlayers) {
                const el = document.querySelector(selector);
                if (!el) continue;
                const rect = el.getBoundingClientRect();
                if (rect.width > 100 && rect.height > 50) return el;
            }

            // 2. Find the largest visible video element or iframe with video-like properties
            const mediaElements = Array.from(document.querySelectorAll('video, iframe')).filter(el => {
                const rect = el.getBoundingClientRect();
                const isVisible = rect.width > 50 && rect.height > 50 && window.getComputedStyle(el).display !== 'none';

                if (!isVisible) return false;

                if (el.tagName === 'IFRAME') {
                    // If it's an iframe, check if it's likely a player
                    const src = (el.src || '').toLowerCase();
                    const isEmbed = src.includes('embed') || src.includes('player') || src.includes('stream') || src.includes('video');
                    const hasFullScreen = el.hasAttribute('allowfullscreen') || el.hasAttribute('webkitallowfullscreen') || el.hasAttribute('mozallowfullscreen');
                    return isEmbed || hasFullScreen;
                }

                return true;
            });

            if (mediaElements.length > 0) {
                // Pick the largest one
                const bestMedia = mediaElements.reduce((prev, curr) => {
                    const prevArea = prev.offsetWidth * prev.offsetHeight;
                    const currArea = curr.offsetWidth * curr.offsetHeight;
                    return currArea > prevArea ? curr : prev;
                });

                // Check if it's wrapped in a player container that we should target instead
                let parent = bestMedia.parentElement;
                let depth = 0;
                while (parent && depth < 10 && parent !== document.body) {
                    const className = (parent.className || '').toString().toLowerCase();
                    const id = (parent.id || '').toString().toLowerCase();

                    if (className.includes('player') ||
                        className.includes('video-container') ||
                        className.includes('movie') ||
                        className.includes('video-wrapper') ||
                        id.includes('player') ||
                        id.includes('video')) {
                        return parent;
                    }
                    parent = parent.parentElement;
                    depth++;
                }
                return bestMedia;
            }

            // 3. Iframe Embeds (fallback with specific patterns)
            const embeds = [
                'iframe[src*="youtube.com/embed"]',
                'iframe[src*="vimeo.com"]',
                'iframe[src*="dailymotion.com"]',
                'iframe[src*="twitch.tv"]',
                'iframe[src*="facebook.com/plugins/video"]',
                'iframe[src*="vlstream.net"]',
                'iframe[src*="ok.ru/videoembed"]'
            ];
            for (const selector of embeds) {
                const el = document.querySelector(selector);
                if (el) return el;
            }

            return null;
        }

        function applyTheaterMode(video) {
            // Create style element for theater mode
            let style = document.getElementById('privacy-player-theater-style');
            if (!style) {
                style = document.createElement('style');
                style.id = 'privacy-player-theater-style';
                document.head.appendChild(style);
            }

            // 1. Hide all body children that don't contain our video
            let topParent = video;
            while (topParent.parentElement && topParent.parentElement.tagName !== 'BODY') {
                topParent = topParent.parentElement;
            }

            const bodyChildren = Array.from(document.body.children);
            bodyChildren.forEach(child => {
                if (child !== topParent &&
                    !['SCRIPT', 'STYLE', 'LINK'].includes(child.tagName) &&
                    child.id !== 'privacy-player-theater-style') {
                    const currentDisplay = window.getComputedStyle(child).display;
                    if (currentDisplay !== 'none') {
                        originalStyles.set(child, child.style.display);
                        child.style.setProperty('display', 'none', 'important');
                    }
                }
            });

            // 2. Force all parents to show and fill screen
            let parent = video.parentElement;
            while (parent && parent !== document.body) {
                parent.classList.add('privacy-player-target-parent');
                parent = parent.parentElement;
            }

            // 3. Mark the video target
            video.classList.add('privacy-player-target');

            // 4. Force aggressive styles
            document.body.style.setProperty('background', 'black', 'important');
            document.body.style.setProperty('overflow', 'hidden', 'important');
            document.documentElement.style.setProperty('background', 'black', 'important');
            document.documentElement.style.setProperty('overflow', 'hidden', 'important');

            style.textContent = `
            body, html { 
                margin: 0 !important; 
                padding: 0 !important; 
                width: 100vw !important; 
                height: 100vh !important; 
                background: black !important;
                overflow: hidden !important;
            }
            
            /* Universal Player Target */
            .privacy-player-target {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                max-width: none !important;
                max-height: none !important;
                z-index: 2147483647 !important;
                background: black !important;
                margin: 0 !important;
                padding: 0 !important;
                transform: none !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            /* Parents must not clip or hide the target */
            .privacy-player-target-parent {
                display: block !important;
                visibility: visible !important;
                position: relative !important;
                width: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                transform: none !important;
                overflow: visible !important;
                z-index: auto !important;
                opacity: 1 !important;
                clip: auto !important;
                clip-path: none !important;
            }

            /* Force all internal elements to not restrict size */
            .privacy-player-target *, .privacy-player-target video {
                max-width: none !important;
                max-height: none !important;
            }

            /* Generic Video Element inside the target */
            .privacy-player-target video, 
            video.privacy-player-target {
                width: 100% !important;
                height: 100% !important;
                top: 0 !important;
                left: 0 !important;
                object-fit: contain !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                background: black !important;
            }

            /* YouTube Specific Overrides */
            .html5-video-container, .html5-main-video {
                width: 100% !important;
                height: 100% !important;
                top: 0 !important;
                left: 0 !important;
            }
            .ytp-chrome-top, .ytp-gradient-top, .ytp-pause-overlay, .ytp-ce-element { 
                display: none !important; 
            }

            /* Fix for players with aspect-ratio containers */
            [style*="padding-top"], [style*="padding-bottom"] {
                padding-top: 0 !important;
                padding-bottom: 0 !important;
            }
            /* JW Player Specific Overrides */
            .privacy-player-target.jwplayer,
            .privacy-player-target[id*="jwplayer"] {
                position: fixed !important;
                height: 100vh !important;
            }
            .privacy-player-target .jw-aspect,
            .privacy-player-target[id*="jwplayer"] .jw-aspect {
                padding-top: 0 !important;
                height: 100vh !important;
                position: static !important;
            }
            .privacy-player-target .jw-wrapper,
            .privacy-player-target[id*="jwplayer"] .jw-wrapper {
                position: absolute !important;
                top: 0 !important; left: 0 !important;
                width: 100% !important;
                height: 100% !important;
            }
            .privacy-player-target .jw-media,
            .privacy-player-target[id*="jwplayer"] .jw-media {
                position: absolute !important;
                width: 100% !important;
                height: 100% !important;
            }
            .privacy-player-target .jw-video,
            .privacy-player-target[id*="jwplayer"] video {
                position: absolute !important;
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
            }
            /* Ẩn controls bar và overlay của JW Player trong theater mode */
            .privacy-player-target .jw-controls,
            .privacy-player-target .jw-overlays,
            .privacy-player-target .jw-logo {
                z-index: 2147483646 !important;
            }
        `;
        }

        function removeTheaterMode(video) {
            const style = document.getElementById('privacy-player-theater-style');
            if (style) style.remove();

            if (video) {
                video.classList.remove('privacy-player-target');
                // Remove parent markers
                let parent = video.parentElement;
                while (parent && parent !== document.body) {
                    parent.classList.remove('privacy-player-target-parent');
                    parent = parent.parentElement;
                }
            }

            // Restore elements
            originalStyles.forEach((display, el) => {
                el.style.display = display;
            });
            originalStyles.clear();

            document.body.style.removeProperty('background');
            document.body.style.removeProperty('overflow');
            document.documentElement.style.removeProperty('background');
            document.documentElement.style.removeProperty('overflow');
        }

        // Video Speed & Volume Booster control listener via postMessage from Popup
        window.__privacyPlayerSpeed = 1.0;
        window.__privacyPlayerVolume = 1.0;
        window.__privacyPlayerVolumeBoostEnabled = false;

        window.addEventListener('message', (event) => {
            if (!event.data || !event.data.type) return;

            if (event.data.type === 'boostVideoSpeed') {
                const newSpeed = parseFloat(event.data.speed);
                if (window.__privacyPlayerSpeed === newSpeed) return;
                window.__privacyPlayerSpeed = newSpeed;
                
                // Broadcast to child iframes
                document.querySelectorAll('iframe').forEach(f => {
                    try { f.contentWindow?.postMessage(event.data, '*'); } catch(e) {}
                });
            } else if (event.data.type === 'boostVideoVolume') {
                const newVol = parseFloat(event.data.volume);
                if (window.__privacyPlayerVolume === newVol) return;
                window.__privacyPlayerVolume = newVol;
                window.__privacyPlayerVolumeBoostEnabled = window.__privacyPlayerVolume > 1.0;
                
                // Broadcast to child iframes
                document.querySelectorAll('iframe').forEach(f => {
                    try { f.contentWindow?.postMessage(event.data, '*'); } catch(e) {}
                });
            } else if (event.data.type === 'applyPlayerFilter') {
                const mode = event.data.filterMode || 'none';
                let style = document.getElementById('pm-player-filter-style');
                if (!style) {
                    style = document.createElement('style');
                    style.id = 'pm-player-filter-style';
                    (document.head || document.documentElement).appendChild(style);
                }

                if (mode === 'dark') {
                    style.textContent = `
                        html { filter: invert(1) hue-rotate(180deg) !important; background: #fff !important; }
                        img, video, iframe, canvas, picture, svg { filter: invert(1) hue-rotate(180deg) !important; }
                    `;
                } else if (mode === 'night') {
                    style.textContent = `
                        html { filter: sepia(0.35) saturate(1.15) brightness(0.95) !important; }
                    `;
                } else if (mode === 'contrast') {
                    style.textContent = `
                        html { filter: contrast(1.3) brightness(1.05) saturate(1.2) !important; }
                    `;
                } else if (mode === 'grayscale') {
                    style.textContent = `
                        html { filter: grayscale(1) !important; }
                    `;
                } else {
                    style.textContent = '';
                }

                // Broadcast to child iframes
                document.querySelectorAll('iframe').forEach(f => {
                    try { f.contentWindow?.postMessage(event.data, '*'); } catch(e) {}
                });
            }
        });

        // Continuously enforce speed and volume on all videos (handles dynamically added videos and player resets)
        setInterval(() => {
            // Broadcast current settings to any nested child iframes
            if (window.__privacyPlayerSpeed !== 1.0 || window.__privacyPlayerVolume !== 1.0) {
                document.querySelectorAll('iframe').forEach(f => {
                    try { 
                        f.contentWindow?.postMessage({ type: 'boostVideoSpeed', speed: window.__privacyPlayerSpeed }, '*');
                        f.contentWindow?.postMessage({ type: 'boostVideoVolume', volume: window.__privacyPlayerVolume }, '*');
                    } catch(e) {}
                });
            }

            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                // Enforce Speed
                if (window.__privacyPlayerSpeed !== 1.0 && v.playbackRate !== window.__privacyPlayerSpeed) {
                    v.playbackRate = window.__privacyPlayerSpeed;
                }

                // Enforce Volume
                if (window.__privacyPlayerVolumeBoostEnabled) {
                    try {
                        if (!v.__audioCtx) {
                            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                            v.__audioCtx = new AudioContextClass();
                            v.__gainNode = v.__audioCtx.createGain();
                            v.__sourceNode = v.__audioCtx.createMediaElementSource(v);
                            v.__sourceNode.connect(v.__gainNode);
                            v.__gainNode.connect(v.__audioCtx.destination);
                        }
                        if (v.__gainNode.gain.value !== window.__privacyPlayerVolume) {
                            v.__gainNode.gain.value = window.__privacyPlayerVolume;
                        }
                    } catch (e) {
                        // Silent fallback for cross-origin CORS errors
                        if (v.volume !== 1.0) v.volume = 1.0;
                    }
                } else {
                    // Normal volume (<= 100%)
                    if (v.volume !== window.__privacyPlayerVolume) {
                        v.volume = window.__privacyPlayerVolume;
                    }
                }
            });
        }, 500);
    }
})();
