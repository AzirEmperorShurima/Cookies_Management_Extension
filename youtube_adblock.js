(function() {
    if (window._ytAdblockInitialized) return;
    window._ytAdblockInitialized = true;
    
    let isAdblockEnabled = true;
    try {
        chrome.storage.local.get(['appSettings'], (result) => {
            if (result && result.appSettings && result.appSettings.adblockEnabled === false) {
                isAdblockEnabled = false;
            }
        });
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.appSettings) {
                isAdblockEnabled = changes.appSettings.newValue ? (changes.appSettings.newValue.adblockEnabled !== false) : true;
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

    // Chạy thử một lần khi khởi tạo
    handleAds();

    // Lắng nghe sự thay đổi của DOM để phát hiện quảng cáo xuất hiện
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0 || mutation.attributeName === 'class') {
                shouldCheck = true;
                break;
            }
        }
        if (shouldCheck) {
            handleAds();
        }
    });

    const targetNode = document.body || document.documentElement;
    if (targetNode) {
        observer.observe(targetNode, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

})();
