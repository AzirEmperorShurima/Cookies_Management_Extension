(function() {
    if (window._ytAdblockInitialized) return;
    window._ytAdblockInitialized = true;
    
    let isAdblockEnabled = localStorage.getItem('__ytAdblockEnabled') !== 'false';
    let isSponsorBlockEnabled = localStorage.getItem('__ytSponsorBlockEnabled') !== 'false';
    
    // Kiểm tra dataset ban đầu nếu bridge đã gán
    if (document.documentElement && document.documentElement.dataset) {
        if (document.documentElement.dataset.thanusAdblock) {
            isAdblockEnabled = document.documentElement.dataset.thanusAdblock !== 'false';
            try { localStorage.setItem('__ytAdblockEnabled', isAdblockEnabled.toString()); } catch (e) {}
        }
        if (document.documentElement.dataset.thanusSponsorBlock) {
            isSponsorBlockEnabled = document.documentElement.dataset.thanusSponsorBlock !== 'false';
            try { localStorage.setItem('__ytSponsorBlockEnabled', isSponsorBlockEnabled.toString()); } catch (e) {}
        }
    }

    // Lắng nghe sự kiện đồng bộ từ Extension Bridge (chạy ở ISOLATED World)
    window.addEventListener('message', (e) => {
        if (e.source === window && e.data) {
            if (e.data.type === '__THANUS_ADBLOCK_SYNC__' && typeof e.data.enabled === 'boolean') {
                if (isAdblockEnabled !== e.data.enabled) {
                    isAdblockEnabled = e.data.enabled;
                    try { localStorage.setItem('__ytAdblockEnabled', isAdblockEnabled.toString()); } catch (err) {}
                }
            } else if (e.data.type === '__THANUS_SPONSORBLOCK_SYNC__' && typeof e.data.enabled === 'boolean') {
                if (isSponsorBlockEnabled !== e.data.enabled) {
                    isSponsorBlockEnabled = e.data.enabled;
                    try { localStorage.setItem('__ytSponsorBlockEnabled', isSponsorBlockEnabled.toString()); } catch (err) {}
                }
            }
        }
    });
    
    console.log('[YouTube Adblocker] Initializing advanced protection...');

    // Pattern nhận diện các cấu trúc dữ liệu quảng cáo của YouTube (tương thích linh hoạt với mọi phiên bản API & schema)
    const AD_KEY_REGEX = /^(adPlacements|playerAds|playbackTracking|adBreak.*|adSlot.*|adInfo|preroll.*|midroll.*|postroll.*|.*[Aa]dPlacement.*|.*[Aa]dSlotRenderer.*)$/;

    /**
     * Hàm đệ quy xóa các object chứa thông tin quảng cáo
     */
    function removeAdsFromJson(obj) {
        if (!obj || typeof obj !== 'object') return false;
        
        let isModified = false;

        function deepRemoveAds(target) {
            if (Array.isArray(target)) {
                for (let i = target.length - 1; i >= 0; i--) {
                    if (target[i] !== null && typeof target[i] === 'object') {
                        deepRemoveAds(target[i]);
                    }
                }
            } else if (target !== null && typeof target === 'object') {
                const keys = Object.keys(target);
                for (let i = 0; i < keys.length; i++) {
                    const k = keys[i];
                    if (AD_KEY_REGEX.test(k)) {
                        delete target[k];
                        isModified = true;
                    }
                }
                Object.values(target).forEach(val => deepRemoveAds(val));
            }
        }
        
        try {
            deepRemoveAds(obj);
        } catch (e) {}
        
        return isModified;
    }

    // 1. Chặn biến toàn cục ytInitialPlayerResponse
    let originalYtInitialPlayerResponse = window.ytInitialPlayerResponse;
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
        get: function() {
            return originalYtInitialPlayerResponse;
        },
        set: function(val) {
            if (val && isAdblockEnabled) {
                removeAdsFromJson(val);
            }
            originalYtInitialPlayerResponse = val;
        }
    });

    // 2. Chặn bắt hàm Fetch API
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const request = args[0];
        const url = request instanceof Request ? request.url : typeof request === 'string' ? request : null;
        
        if (isAdblockEnabled && url && (url.includes('/youtubei/v1/player') || url.includes('/youtubei/v1/next'))) {
            try {
                const response = await originalFetch.apply(this, args);
                // Chỉ xử lý response JSON
                const clonedResponse = response.clone();
                const json = await clonedResponse.json();
                
                if (removeAdsFromJson(json)) {
                    console.log('[YouTube Adblocker] Stripped ads from fetch response:', url);
                    return new Response(JSON.stringify(json), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                }
                return response;
            } catch (e) {
                // Nếu có lỗi parse hoặc mạng, cứ trả về response gốc
            }
        }
        
        return originalFetch.apply(this, args);
    };

    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._isYouTubeAdApi = isAdblockEnabled && typeof url === 'string' && (url.includes('/youtubei/v1/player') || url.includes('/youtubei/v1/next'));
        return originalXhrOpen.call(this, method, url, ...rest);
    };

    const originalXhrGetters = Object.getOwnPropertyDescriptors(XMLHttpRequest.prototype);
    
    // Tạo property giả để đánh lừa player YouTube nếu nó dùng property trực tiếp
    const originalXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
        if (this._isYouTubeAdApi) {
            const originalOnReadyStateChange = this.onreadystatechange;
            this.onreadystatechange = function(e) {
                if (this.readyState === 4 && this.status === 200) {
                    try {
                        // Parse thử response
                        let text = originalXhrGetters.responseText.get.call(this);
                        let json = JSON.parse(text);
                        if (removeAdsFromJson(json)) {
                            console.log('[YouTube Adblocker] Stripped ads from XHR response');
                            const modifiedText = JSON.stringify(json);
                            // Ghi đè getter của request này
                            Object.defineProperty(this, 'responseText', { get: () => modifiedText });
                            Object.defineProperty(this, 'response', { get: () => modifiedText });
                        }
                    } catch (err) {}
                }
                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.apply(this, arguments);
                }
            };
        }
        return originalXhrSend.apply(this, args);
    };

    // 4. Giải pháp nâng cao: Tự động tua nhanh 16x, skip quảng cáo và bypass popup anti-adblock
    let _wasAdShowing = false;
    let _originalPlaybackRate = 1.0;
    let _adCheckDebounce = null;

    const handleAds = () => {
        if (!isAdblockEnabled) return;

        // A. Xóa modal / popup cảnh báo chặn Adblock của YouTube (Anti-Adblock Enforcement)
        const enforcementModal = document.querySelector('ytd-enforcement-message-view-model, ytd-popup-container tp-yt-paper-dialog:has(#feedback), tp-yt-iron-overlay-backdrop');
        if (enforcementModal) {
            enforcementModal.remove();
            const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
            if (backdrop) backdrop.remove();
            const video = document.querySelector('video');
            if (video && video.paused) {
                video.play().catch(() => {});
            }
        }

        // B. Nút Skip (chỉ match đúng nút skip quảng cáo chính xác của YouTube)
        const skipButtons = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
        skipButtons.forEach(btn => {
            try { btn.click(); } catch(e) {}
        });

        // C. Popup & Overlays trong khung hình video
        const adOverlay = document.querySelector('.ytp-ad-overlay-close-button');
        if (adOverlay) {
            try { adOverlay.click(); } catch(e) {}
        }

        // D. Xóa các banner / slot quảng cáo tĩnh & quảng cáo Shorts
        const staticAdSlots = document.querySelectorAll('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer, #player-ads, .ytp-ad-overlay-container, ytd-promoted-video-renderer, ytd-reel-video-renderer:has(.ytd-ad-slot-renderer)');
        staticAdSlots.forEach(el => {
            el.style.display = 'none';
        });

        // E. Tự động click nút "Tiếp tục xem" khi video bị YouTube tạm dừng (Confirm Dialog)
        const confirmDialog = document.querySelector('yt-confirm-dialog-renderer, ytd-popup-container tp-yt-paper-dialog:has(#confirm-button)');
        if (confirmDialog) {
            const confirmBtn = confirmDialog.querySelector('#confirm-button, tp-yt-paper-button#confirm-button');
            if (confirmBtn) {
                confirmBtn.click();
                const video = document.querySelector('video');
                if (video && video.paused) video.play().catch(() => {});
            }
        }

        // F. Tua nhanh video quảng cáo với tốc độ 16x + Mute
        const video = document.querySelector('video');
        const adShowing = document.querySelector('.ad-showing, .ad-interrupting, .ytp-ad-player-overlay');
        
        if (video) {
            if (adShowing) {
                if (!_wasAdShowing) {
                    _wasAdShowing = true;
                    _originalPlaybackRate = video.playbackRate || 1.0;
                }
                video.muted = true;
                video.playbackRate = 16.0;
                if (video.duration && !isNaN(video.duration) && isFinite(video.duration) && video.currentTime < video.duration - 0.1) {
                    video.currentTime = video.duration - 0.05;
                }
            } else if (_wasAdShowing) {
                // Phục hồi playback rate sau khi hết quảng cáo
                _wasAdShowing = false;
                if (video.playbackRate === 16.0) {
                    video.playbackRate = _originalPlaybackRate || 1.0;
                }
                video.muted = false;
            }
        }
    };

    function triggerDebouncedAdCheck() {
        if (_adCheckDebounce) cancelAnimationFrame(_adCheckDebounce);
        _adCheckDebounce = requestAnimationFrame(handleAds);
    }

    // Attach Event-Driven Scoped Observer for Auto-Skip (Zero CPU overhead when idle)
    try {
        let playerObserver = null;
        function setupPlayerObserver() {
            const playerContainer = document.querySelector('#movie_player, .html5-video-player, ytd-player');
            if (playerContainer && !playerContainer._hasAdObserver) {
                playerContainer._hasAdObserver = true;
                if (playerObserver) playerObserver.disconnect();
                playerObserver = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        if (m.type === 'attributes' && m.attributeName === 'class') {
                            triggerDebouncedAdCheck();
                            break;
                        } else if (m.addedNodes && m.addedNodes.length > 0) {
                            triggerDebouncedAdCheck();
                            break;
                        }
                    }
                });
                playerObserver.observe(playerContainer, {
                    attributes: true,
                    attributeFilter: ['class'],
                    childList: true,
                    subtree: true
                });
            }
        }

        // Setup observer on load and SPA navigation
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setupPlayerObserver();
                handleAds();
            });
        } else {
            setupPlayerObserver();
            handleAds();
        }

        // Global DOM observer with coarse scope for anti-adblock modals
        const bodyObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.addedNodes && m.addedNodes.length > 0) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            const tagName = node.tagName?.toLowerCase() || '';
                            if (tagName.startsWith('ytd-enforcement') || tagName.startsWith('ytd-popup') || tagName.startsWith('tp-yt-paper-dialog')) {
                                triggerDebouncedAdCheck();
                                break;
                            }
                        }
                    }
                }
            }
        });
        if (document.body) {
            bodyObserver.observe(document.body, { childList: true });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.body) bodyObserver.observe(document.body, { childList: true });
            });
        }
    } catch (e) {}

    // 5. SponsorBlock Integration: Visual Markers trên Seekbar & Tự động bỏ qua đoạn tài trợ
    let currentVideoId = null;
    let currentSponsorSegments = [];
    const _sponsorCache = new Map(); // In-memory LRU Cache for Video Segments (max 50)

    function getVideoIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('v')) return urlParams.get('v');
        const match = window.location.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
        if (match) return match[1];
        return null;
    }

    function getCategoryColor(category) {
        switch (category) {
            case 'sponsor': return '#00d26a';      // Xanh lá
            case 'selfpromo': return '#f5a623';    // Cam
            case 'interaction': return '#ff4757';  // Hồng đỏ
            case 'intro':
            case 'outro': return '#00f2fe';        // Cyan
            case 'preview': return '#9b59b6';      // Tím
            default: return '#00d26a';
        }
    }

    function renderSponsorMarkers(segments) {
        const progressBar = document.querySelector('.ytp-progress-bar');
        const video = document.querySelector('video');
        if (!progressBar || !video || !video.duration || isNaN(video.duration) || !isFinite(video.duration)) return;

        let markerContainer = document.getElementById('__ytp_sponsor_markers');
        if (!markerContainer) {
            markerContainer = document.createElement('div');
            markerContainer.id = '__ytp_sponsor_markers';
            markerContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 35;
            `;
            progressBar.appendChild(markerContainer);
        }

        // Safe Trusted Types DOM clearance
        markerContainer.replaceChildren();
        const duration = video.duration;

        segments.forEach(seg => {
            if (!seg.segment || seg.segment.length < 2) return;
            const [start, end] = seg.segment;
            const leftPct = (start / duration) * 100;
            const widthPct = Math.max(((end - start) / duration) * 100, 0.5);

            const marker = document.createElement('div');
            marker.style.cssText = `
                position: absolute;
                left: ${leftPct}%;
                width: ${widthPct}%;
                top: 0;
                bottom: 0;
                background-color: ${getCategoryColor(seg.category)};
                opacity: 0.85;
                border-radius: 1px;
            `;
            marker.title = `SponsorBlock: ${seg.category} (${Math.round(end - start)}s)`;
            markerContainer.appendChild(marker);
        });
    }

    async function fetchSponsorSegments(videoId) {
        if (!videoId || !isSponsorBlockEnabled) return [];
        if (_sponsorCache.has(videoId)) {
            return _sponsorCache.get(videoId);
        }
        try {
            const categories = encodeURIComponent(JSON.stringify(['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview']));
            const apiUrl = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${categories}`;
            const res = await fetch(apiUrl);
            if (res.ok) {
                const data = await res.json();
                console.log(`[SponsorBlock] Loaded ${data.length} segments for video ${videoId}`);
                if (_sponsorCache.size >= 50) {
                    const oldestKey = _sponsorCache.keys().next().value;
                    _sponsorCache.delete(oldestKey);
                }
                _sponsorCache.set(videoId, data);
                return data;
            }
        } catch (e) {
            // Offline or rate-limited
        }
        return [];
    }

    function showSponsorToast(category, duration) {
        let toast = document.getElementById('__sponsor_toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = '__sponsor_toast';
            toast.style.cssText = `
                position: absolute;
                bottom: 80px;
                left: 20px;
                background: rgba(0, 0, 0, 0.88);
                color: #00f2fe;
                border: 1px solid rgba(0, 242, 254, 0.4);
                padding: 8px 14px;
                border-radius: 8px;
                font-size: 13px;
                font-family: sans-serif;
                font-weight: bold;
                z-index: 99999;
                pointer-events: none;
                transition: opacity 0.3s ease;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            `;
            const player = document.querySelector('#movie_player, .html5-video-player, .player-container');
            if (player) player.appendChild(toast);
        }
        toast.textContent = `⏩ Đã bỏ qua phân đoạn ${category} (${duration}s)`;
        toast.style.opacity = '1';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

    function setupVideoSponsorListener(video) {
        if (!video || video._hasSponsorListener) return;
        video._hasSponsorListener = true;

        video.addEventListener('timeupdate', () => {
            if (!isSponsorBlockEnabled || currentSponsorSegments.length === 0) return;
            const currentTime = video.currentTime;
            for (const seg of currentSponsorSegments) {
                if (seg.segment && seg.segment.length >= 2) {
                    const [start, end] = seg.segment;
                    if (currentTime >= start && currentTime < end - 0.3) {
                        const skippedDuration = Math.round(end - start);
                        video.currentTime = end;
                        showSponsorToast(seg.category || 'tài trợ', skippedDuration);
                        break;
                    }
                }
            }
        });

        video.addEventListener('loadedmetadata', () => {
            if (currentSponsorSegments.length > 0) {
                renderSponsorMarkers(currentSponsorSegments);
            }
        });
    }

    function initSponsorBlock() {
        const videoId = getVideoIdFromUrl();
        if (videoId && videoId !== currentVideoId) {
            currentVideoId = videoId;
            currentSponsorSegments = [];
            fetchSponsorSegments(videoId).then(segments => {
                currentSponsorSegments = segments;
                renderSponsorMarkers(segments);
            });
        }

        const video = document.querySelector('video');
        if (video) {
            setupVideoSponsorListener(video);
            if (currentSponsorSegments.length > 0) {
                renderSponsorMarkers(currentSponsorSegments);
            }
        }
    }

    // Event-Driven SPA Navigation listeners for YouTube (yt-navigate-finish, popstate)
    window.addEventListener('yt-navigate-finish', () => {
        triggerDebouncedAdCheck();
        initSponsorBlock();
    });
    window.addEventListener('popstate', () => {
        triggerDebouncedAdCheck();
        initSponsorBlock();
    });
    window.addEventListener('hashchange', () => {
        triggerDebouncedAdCheck();
        initSponsorBlock();
    });

    // Initial check
    initSponsorBlock();

})();
