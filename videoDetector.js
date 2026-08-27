(function() {
    let videoDetectionEnabled = false;



    // Lấy cài đặt ban đầu
    chrome.storage.local.get(['appSettings'], (result) => {
        const settings = result.appSettings || {};
        videoDetectionEnabled = settings.videoDownloaderEnabled || false;
        
        // Luôn báo cáo URL hiện tại để đồng bộ thanh địa chỉ Privacy Player
        reportNavigation();

        if (videoDetectionEnabled) {
            scanForVideos();
            startObserver();
        }
    });

    // Theo dõi thay đổi URL trong SPA (YouTube, v.v.)
    window.addEventListener('popstate', reportNavigation);
    window.addEventListener('hashchange', reportNavigation);
    
    // Lắng nghe sự kiện SPA Navigation từ Background Service Worker
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'SPA_NAVIGATION_DETECTED') {
                reportNavigation();
                if (videoDetectionEnabled) {
                    setTimeout(() => { scanForVideos(); }, 400);
                }
            }
        });
    }

    // Kiểm tra và giải phóng tài nguyên khi extension bị reload
    function checkContextValidity() {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
            window.removeEventListener('popstate', reportNavigation);
            window.removeEventListener('hashchange', reportNavigation);
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            return false;
        }
        return true;
    }

    /**
     * Báo cáo URL hiện tại của frame
     */
    function reportNavigation() {
        if (!checkContextValidity()) return;
        if (window.parent === window.top) {
            chrome.runtime.sendMessage({
                type: 'pageNavigatedInFrame',
                url: window.location.href,
                title: document.title
            }).catch(() => {});
        }
    }

    // Lắng nghe thay đổi cài đặt
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(function storageListener(changes, area) {
            if (!checkContextValidity()) {
                try {
                    chrome.storage.onChanged.removeListener(storageListener);
                } catch (e) {}
                return;
            }
            if (area === 'local' && changes.appSettings) {
                const newSettings = changes.appSettings.newValue || {};
                videoDetectionEnabled = newSettings.videoDownloaderEnabled || false;
                if (videoDetectionEnabled) {
                    scanForVideos();
                    startObserver();
                } else if (observer) {
                    observer.disconnect();
                }
            }
        });
    }

    /**
     * Quét các thẻ video hiện có
     */
    function scanForVideos() {
        if (!videoDetectionEnabled) return;

        const videos = document.querySelectorAll('video');
        videos.forEach((video, index) => {
            processVideoElement(video, `Auto Video #${index + 1}`);
        });

        // Hỗ trợ JW Player và các trình phát khác qua iframes
        if (window.jwplayer) {
            try {
                for (let i = 0; i < 10; i++) {
                    const player = window.jwplayer(i);
                    if (player && player.getPlaylist) {
                        const playlist = player.getPlaylist();
                        if (playlist && playlist[0] && playlist[0].sources) {
                            playlist[0].sources.forEach((source, si) => {
                                reportVideo(source.file, source.type || 'JWPlayer Stream', `JWPlayer Video #${i+1}`);
                            });
                        }
                    }
                }
            } catch (e) {}
        }

        function scanTelegramStreamVideos_ADDITION() {
            // Telegram Web dùng src dạng: stream/{JSON encoded}
            // Cần resolve relative URL thành absolute
            const allVideos = document.querySelectorAll('video[src]');
            allVideos.forEach((video, idx) => {
                const rawSrc = video.src; // Đã được browser resolve thành absolute
                // Kiểm tra nếu là Telegram stream URL
                if (rawSrc && (rawSrc.includes('/stream/') || rawSrc.includes('stream/%7B'))) {
                    try {
                        // Decode URL để lấy JSON metadata
                        const encoded = rawSrc.split('/stream/')[1];
                        const meta = JSON.parse(decodeURIComponent(encoded));
                        const name = meta.fileName || document.title || `Telegram Video ${idx+1}`;
                        const thumb = video.poster || '';
                        // Báo cáo với full absolute URL
                        reportVideo(rawSrc, 'Telegram Stream', name, false, thumb);
                    } catch(e) {
                        // Báo cáo bình thường nếu parse thất bại
                        processVideoElement(video, `Telegram Video #${idx+1}`);
                    }
                }
            });
        }

        scanTelegramStreamVideos_ADDITION();
    }

    // Hook vào HTMLMediaElement.prototype.play để bắt video ngay khi trang web kích hoạt phát
    try {
        const originalPlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function() {
            if (this.nodeName === 'VIDEO' && videoDetectionEnabled) {
                processVideoElement(this, this.title || document.title || 'Playing Video');
            }
            return originalPlay.apply(this, arguments);
        };
    } catch(e) {}

    // Hook vào HTMLMediaElement.prototype.src setter
    try {
        const srcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
        if (srcDesc && srcDesc.set) {
            const originalSrcSet = srcDesc.set;
            Object.defineProperty(HTMLMediaElement.prototype, 'src', {
                set: function(val) {
                    if (this.nodeName === 'VIDEO' && videoDetectionEnabled && val) {
                        setTimeout(() => processVideoElement(this, this.title || document.title || 'Stream Video'), 50);
                    }
                    return originalSrcSet.call(this, val);
                },
                get: srcDesc.get,
                configurable: true,
                enumerable: true
            });
        }
    } catch(e) {}

    /**
     * Xử lý một thẻ video cụ thể
     */
    function processVideoElement(video, defaultName) {
        const src = video.src || video.currentSrc;
        if (src) {
            const isBlob = src.startsWith('blob:');
            const type = isBlob ? 'Blob/HLS Stream' : 'HTML5 Video';
            
            // Lấy tên phim từ title của trang hoặc thuộc tính title của video
            let name = video.title || document.title || defaultName;
            if (name.includes(' - ')) name = name.split(' - ')[0]; // Rút gọn tên nếu có " - "
            
            const thumb = video.poster || ''; // Lấy ảnh đại diện của video nếu có

            reportVideo(src, type, name, isBlob, thumb);
        }

        // Kiểm tra các thẻ <source> bên trong
        video.querySelectorAll('source').forEach((s, si) => {
            if (s.src) {
                const name = document.title || `Source #${si + 1}`;
                reportVideo(s.src, 'Video Source', name, false, video.poster || '');
            }
        });
    }

    /**
     * Gửi thông tin video về background
     */
    function reportVideo(url, type, filename, isBlob = false, thumb = '') {
        if (!url || url.startsWith('data:')) return;

        // Kiểm tra Extension Context trước khi gửi tin nhắn
        if (!checkContextValidity()) return;

        chrome.runtime.sendMessage({
            type: 'newVideoDetectedFromContent',
            video: {
                url: url,
                type: type,
                filename: filename,
                size: isBlob ? 'Streaming Data' : 'Detected',
                isBlob: isBlob,
                baseURI: document.baseURI,
                thumbnail: thumb,
                // Báo cáo URL hiện tại của frame để hỗ trợ đồng bộ thanh địa chỉ
                currentFrameUrl: window.location.href
            }
        }).catch(() => {
            // Im lặng nếu context bị hủy
        });
    }

    let observer = null;
    function startObserver() {
        if (observer) return;

        // Đảm bảo document.body đã sẵn sàng
        if (!document.body) {
            window.addEventListener('DOMContentLoaded', startObserver);
            return;
        }

        observer = new MutationObserver((mutations) => {
            if (!videoDetectionEnabled) return;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeName === 'VIDEO') {
                        processVideoElement(node, 'New Video');
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('video').forEach((v, idx) => {
                            processVideoElement(v, `New Video #${idx + 1}`);
                        });
                    }
                });

                // Theo dõi sự thay đổi thuộc tính src (quan trọng cho blob)
                if (mutation.type === 'attributes' && mutation.attributeName === 'src' && mutation.target.nodeName === 'VIDEO') {
                    processVideoElement(mutation.target, 'Updated Video');
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src']
        });
    }

    // Add Global Media Sniffer Bubble
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'SHOW_SNIFFER_BUBBLE' && request.video) {
            showSnifferBubble(request.video);
        }
    });

    function showSnifferBubble(video) {
        let bubble = document.getElementById('pm-sniffer-bubble');
        if (!bubble) {
            bubble = document.createElement('div');
            bubble.id = 'pm-sniffer-bubble';
            bubble.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #1f1f1f, #2b2b2b);
                border: 1px solid #7ed6df;
                border-radius: 12px;
                padding: 15px;
                color: white;
                font-family: Arial, sans-serif;
                z-index: 2147483647;
                box-shadow: 0 4px 15px rgba(126, 214, 223, 0.3);
                display: flex;
                align-items: center;
                gap: 15px;
                transition: all 0.3s ease;
                cursor: pointer;
            `;
            document.body.appendChild(bubble);

            // Auto hide after 10s
            setTimeout(() => {
                if (bubble && bubble.parentNode) {
                    bubble.style.opacity = '0';
                    setTimeout(() => bubble.parentNode && bubble.remove(), 300);
                }
            }, 10000);
        }

        bubble.textContent = '';

        const iconDiv = document.createElement('div');
        iconDiv.style.fontSize = '24px';
        iconDiv.textContent = '📥';

        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = 'display: flex; flex-direction: column;';

        const titleStrong = document.createElement('strong');
        titleStrong.style.cssText = 'font-size: 14px; margin-bottom: 5px; color: #7ed6df;';
        titleStrong.textContent = 'Media Detected!';

        const infoSpan = document.createElement('span');
        infoSpan.style.cssText = 'font-size: 12px; color: #dcdde1; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        infoSpan.textContent = `${video.filename || 'Unknown stream'} (${video.type || 'Media'})`;

        const hintSpan = document.createElement('span');
        hintSpan.style.cssText = 'font-size: 10px; color: #fff; margin-top: 3px; opacity: 0.7;';
        hintSpan.textContent = 'Click to open Downloader';

        contentDiv.appendChild(titleStrong);
        contentDiv.appendChild(infoSpan);
        contentDiv.appendChild(hintSpan);

        bubble.appendChild(iconDiv);
        bubble.appendChild(contentDiv);

        bubble.onclick = () => {
            if (bubble.parentNode) bubble.remove();
            try {
                chrome.runtime.sendMessage({
                    type: 'createNotification',
                    options: {
                        type: 'basic',
                        title: 'Media Intercepted',
                        message: 'Please open Thanus Extension -> Video Downloader to download the media.'
                    }
                });
            } catch (e) {}
        };
    }
})();
