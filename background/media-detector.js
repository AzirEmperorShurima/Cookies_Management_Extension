/**
 * Detect Telegram video streams via network requests
 */
function setupTelegramStreamDetection() {
    try {
        chrome.webRequest.onBeforeRequest.addListener(
            (details) => {
                if (!videoDetectionEnabled || details.tabId === -1) return;

                const url = details.url;
                if (!url || !url.includes('/stream/')) return;

                try {
                    // Decode and parse JSON metadata from URL
                    const encoded = url.split('/stream/')[1];
                    const meta = JSON.parse(decodeURIComponent(encoded));

                    const filename = meta.fileName || 'telegram_video.mp4';
                    const size = meta.size ? (meta.size / 1024 / 1024).toFixed(1) + ' MB' : 'Streaming';

                    addDetectedVideo(
                        details.tabId,
                        url, // Absolute URL for fetching
                        meta.mimeType || 'video/mp4',
                        size,
                        details.initiator,
                        ''
                    );
                } catch (e) {
                    // Fallback for parsing failures
                    addDetectedVideo(details.tabId, url, 'video/mp4', 'Telegram Stream', details.initiator, '');
                }
            },
            { urls: TELEGRAM_STREAM_PATTERN },
            ['requestBody']
        );
    } catch (err) {
        console.warn('[Media Detector] Error setting up Telegram stream detection:', err);
    }
}

// Initialize Telegram stream detection
setupTelegramStreamDetection();

/**
 * Monitor network requests for trackers and video files
 */
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.tabId === -1 || !details.url) return;

        let url;
        const urlString = details.url;
        try {
            url = new URL(urlString);
        } catch {
            return;
        }

        const isTracker = TRACKER_DOMAINS.some(domain => url.hostname.includes(domain));

        if (isTracker) {
            const domain = url.hostname;

            // Update detailed tracker list per tab
            if (!trackerList[details.tabId]) trackerList[details.tabId] = [];
            const existing = trackerList[details.tabId].find(t => t.domain === domain);
            if (existing) {
                existing.count++;
                existing.lastSeen = Date.now();
            } else {
                trackerList[details.tabId].push({
                    domain: domain,
                    firstSeen: Date.now(),
                    lastSeen: Date.now(),
                    count: 1
                });
            }

            // Update total tracker count and notify popup
            trackerCount[details.tabId] = (trackerCount[details.tabId] || 0) + 1;
            saveStateToSession();
            chrome.runtime.sendMessage({
                type: 'updateTrackerCount',
                tabId: details.tabId,
                count: trackerCount[details.tabId],
                list: trackerList[details.tabId]
            }).catch(() => { });

            // Thống kê số lượng bị chặn trên biểu đồ (CHỈ ghi nhận khi Adblock đang BẬT)
            if (typeof _cachedAdblockEnabled !== 'undefined' && _cachedAdblockEnabled && typeof incrementDailyStat === 'function') {
                incrementDailyStat(domain);
            }
        }

        // Detect videos via URL patterns
        if (videoDetectionEnabled) {
            const path = url.pathname.toLowerCase();
            const extension = path.split('.').pop();

            // Match manifest files or direct video links
            if (VIDEO_EXTENSIONS.includes(extension) ||
                urlString.includes('.m3u8') ||
                urlString.includes('.mpd') ||
                urlString.includes('googlevideo.com') ||
                urlString.includes('/videoplayback') ||
                urlString.includes('manifest') ||
                urlString.includes('.ts')) {

                // Filter out small segments for HLS streams
                if (extension === 'ts' && urlString.includes('seg-')) {
                    if (!urlString.includes('seg-1.')) return;
                }

                const type = extension || (urlString.includes('m3u8') ? 'm3u8' : 'video');
                addDetectedVideo(details.tabId, urlString, type, 'Streaming...', details.initiator, '');
            }
        }
    },
    { urls: ["<all_urls>"] }
);

/**
 * Handle new tab creation from Privacy Player (popup mode)
 */
chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    // sourceTabId -1 indicates creation from extension popup/iframe
    if (details.sourceTabId === -1) {
        chrome.storage.local.get(['appSettings'], (result) => {
            const settings = result.appSettings ? { ...DEFAULT_SETTINGS, ...result.appSettings } : DEFAULT_SETTINGS;

            // Redirect to incognito if configured
            if (settings.playerLinkBehavior === 'incognito') {
                chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
                    if (isAllowed) {
                        chrome.tabs.remove(details.tabId); // Close original tab
                        chrome.windows.create({
                            url: details.url,
                            incognito: true,
                            type: 'popup',
                            width: 800,
                            height: 600
                        });
                    }
                });
            }
        });
    }
});

/**
 * Detect videos via Response Headers (MIME Types)
 */
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (!videoDetectionEnabled || details.tabId === -1) return;

        const contentTypeHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
        const contentLengthHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-length');

        if (contentTypeHeader) {
            const contentType = contentTypeHeader.value.toLowerCase();
            // Check for video MIME types or common stream formats
            if (contentType.startsWith('video/') ||
                contentType === 'application/x-mpegurl' ||
                contentType === 'application/vnd.apple.mpegurl' ||
                contentType === 'application/dash+xml' ||
                (contentType === 'application/octet-stream' && isVideoUrl(details.url))) {

                let size = 'Unknown size';
                if (contentLengthHeader) {
                    const bytes = parseInt(contentLengthHeader.value);
                    if (bytes > 1024 * 1024) size = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                    else if (bytes > 1024) size = (bytes / 1024).toFixed(1) + ' KB';
                    else size = bytes + ' bytes';
                }

                let type = contentType.split('/')[1] || 'video';
                if (type.includes(';')) type = type.split(';')[0];
                if (type === 'x-mpegurl' || type === 'vnd.apple.mpegurl') type = 'm3u8';

                addDetectedVideo(details.tabId, details.url, type, size, details.initiator, '');
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

/**
 * Check if a URL points to a video based on its file extension
 */
function isVideoUrl(url) {
    try {
        const path = new URL(url).pathname.toLowerCase();
        const extension = path.split('.').pop();
        return VIDEO_EXTENSIONS.includes(extension);
    } catch {
        return false;
    }
}

/**
 * Helper to add a detected video to the internal state and notify popup
 */
function addDetectedVideo(tabId, url, type, size = 'Unknown size', initiator = '', title = '', thumb = '', frameId = 0) {
    if (!detectedVideos[tabId]) {
        detectedVideos[tabId] = [];
    }

    // Prevent detecting requests initiated by the extension itself
    if (initiator && initiator.includes(chrome.runtime.id)) return;

    // Ignore invalid URLs — must be http/https or blob for valid media
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('blob:')) {
        console.warn('[Video Detector] Bỏ qua URL không hợp lệ:', url.substring(0, 80));
        return;
    }


    // Check for existing video to update title or thumbnail
    const normalizedUrl = url.split('?')[0];
    const existingIndex = detectedVideos[tabId].findIndex(v => v.url.split('?')[0] === normalizedUrl);

    if (existingIndex !== -1) {
        const existing = detectedVideos[tabId][existingIndex];
        if (title && (!existing.filename || existing.filename.length < title.length)) {
            existing.filename = decodeURIComponent(title);
        }
        if (thumb && !existing.thumbnail) {
            existing.thumbnail = thumb;
        }
        return;
    }

    // Determine filename from URL or metadata
    let filename = '';
    if (url.startsWith('blob:')) {
        filename = title || `streaming_video_${Date.now()}`;
    } else {
        try {
            const urlObj = new URL(url);
            // Handle Telegram stream metadata
            if (url.includes('/stream/')) {
                try {
                    const meta = JSON.parse(decodeURIComponent(urlObj.pathname.split('/stream/')[1] || '{}'));
                    filename = title || meta.fileName || `telegram_stream_${Date.now()}.mp4`;
                } catch (e) {
                    filename = title || `telegram_stream_${Date.now()}.mp4`;
                }
            } else {
                filename = title || urlObj.pathname.split('/').pop() || 'video_file';
            }
        } catch (e) {
            filename = title || `video_${Date.now()}`;
        }
    }

    // Sanitize filename
    filename = filename.replace(/[<>:"/\\|?*]/g, '_').trim();
    if (!filename.includes('.')) {
        let ext = 'mp4';
        if (type.includes('m3u8')) ext = 'm3u8';
        else if (type.includes('mpd')) ext = 'mpd';
        filename += '.' + ext;
    }

    const videoData = {
        url, type, size,
        filename: decodeURIComponent(filename),
        thumbnail: thumb,
        tabId, frameId,
        timestamp: Date.now()
    };

    // Phase 3.2: Enforce per-tab video limit to prevent memory growth
    if (detectedVideos[tabId].length >= MAX_VIDEOS_PER_TAB) {
        detectedVideos[tabId].shift(); // Remove oldest video
    }
    detectedVideos[tabId].push(videoData);
    saveStateToSession();

    // Update UI badge
    updateTabBadge(tabId);
    chrome.runtime.sendMessage({ type: 'newVideoDetected', tabId, video: videoData }).catch(() => {});

    // Trigger Global Media Sniffer Bubble
    chrome.tabs.sendMessage(tabId, { type: 'SHOW_SNIFFER_BUBBLE', video: videoData }).catch(() => { });
}

/**
 * Handle navigation inside iframes (Privacy Player)
 */
function handleIframeNavigation(details) {
    // Notify popup about iframe URL changes
    chrome.runtime.sendMessage({
        type: 'iframeNavigated',
        tabId: details.tabId,
        url: details.url,
        frameId: details.frameId,
        processId: details.processId,
        timestamp: Date.now()
    }).catch(() => { });
}

/**
 * Monitor sub-frame requests from Privacy Player
 */
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        // Only track requests from the extension itself
        if (details.type === 'sub_frame' && details.initiator && details.initiator.startsWith('chrome-extension://')) {
            handleIframeNavigation(details);
        }
    },
    { urls: ["<all_urls>"] }
);

