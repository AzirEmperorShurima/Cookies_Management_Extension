(function() {
    if (window._ytAdblockInitialized) return;
    window._ytAdblockInitialized = true;
    
    let isAdblockEnabled = localStorage.getItem('__ytAdblockEnabled') !== 'false';
    try {
        chrome.storage.local.get(['appSettings'], (result) => {
            if (result && result.appSettings) {
                const enabled = result.appSettings.adblockEnabled !== false;
                if (isAdblockEnabled !== enabled) {
                    isAdblockEnabled = enabled;
                    localStorage.setItem('__ytAdblockEnabled', enabled.toString());
                }
            }
        });
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.appSettings) {
                const enabled = changes.appSettings.newValue ? (changes.appSettings.newValue.adblockEnabled !== false) : true;
                isAdblockEnabled = enabled;
                localStorage.setItem('__ytAdblockEnabled', enabled.toString());
            }
        });
    } catch (e) {}
    
    console.log('[YouTube Adblocker] Initializing advanced protection...');

    // Các key liên quan đến quảng cáo trong dữ liệu JSON của YouTube
    const adKeys = [
        'adPlacements', 
        'playerAds', 
        'playbackTracking', 
        'adBreakHeartbeatParams', 
        'adSlotLoggingData',
        'adInfo'
    ];

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
                adKeys.forEach(k => {
                    if (target[k] !== undefined) {
                        delete target[k];
                        isModified = true;
                    }
                });
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

    // 4. Giải pháp dự phòng: Tự động skip quảng cáo bằng MutationObserver (Tối ưu hiệu suất)
    const handleAds = () => {
        if (!isAdblockEnabled) return;

        // Nút Skip
        const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-text[class*="skip"]');
        if (skipButton) {
            skipButton.click();
            console.log('[YouTube Adblocker] Auto-clicked skip button');
        }
        
        // Popup giữa màn hình
        const adOverlay = document.querySelector('.ytp-ad-overlay-close-button');
        if (adOverlay) {
            adOverlay.click();
        }

        // Tua nhanh qua video quảng cáo
        const video = document.querySelector('video');
        const adShowing = document.querySelector('.ad-showing, .ad-interrupting');
        if (video && adShowing) {
            if (video.duration && video.currentTime < video.duration - 0.5) {
                video.currentTime = video.duration - 0.5; // Tua đến sát cuối
                console.log('[YouTube Adblocker] Fast-forwarded video ad');
            }
        }
    };

    // 5. SponsorBlock Integration: Tự động bỏ qua đoạn tài trợ / quảng cáo trong video
    let currentVideoId = null;
    let currentSponsorSegments = [];
    let isSponsorBlockEnabled = true;

    try {
        chrome.storage.local.get(['appSettings'], (result) => {
            if (result && result.appSettings) {
                isSponsorBlockEnabled = result.appSettings.sponsorBlockEnabled !== false;
            }
        });
    } catch(e) {}

    function getVideoIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('v')) return urlParams.get('v');
        const match = window.location.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
        if (match) return match[1];
        return null;
    }

    async function fetchSponsorSegments(videoId) {
        if (!videoId || !isSponsorBlockEnabled) return [];
        try {
            const categories = encodeURIComponent(JSON.stringify(['sponsor', 'selfpromo', 'interaction', 'intro', 'outro']));
            const apiUrl = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${categories}`;
            const res = await fetch(apiUrl);
            if (res.ok) {
                const data = await res.json();
                console.log(`[SponsorBlock] Loaded ${data.length} segments for video ${videoId}`);
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
                background: rgba(0, 0, 0, 0.85);
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

    function initSponsorBlock() {
        const videoId = getVideoIdFromUrl();
        if (videoId && videoId !== currentVideoId) {
            currentVideoId = videoId;
            currentSponsorSegments = [];
            fetchSponsorSegments(videoId).then(segments => {
                currentSponsorSegments = segments;
            });
        }

        const video = document.querySelector('video');
        if (video && !video._hasSponsorListener) {
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
            video._hasSponsorListener = true;
        }
    }

    // Monitor URL changes for single-page app navigation
    setInterval(initSponsorBlock, 1500);

})();
