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

// Pre-compiled regex patterns to avoid per-request object creation
const HLS_SEGMENT_REGEX = /(?:seg|segment|chunk|frag|slice|part|index|track)[-_]?\d+\.(?:ts|m4s)/i;
const HLS_NUMERIC_SEGMENT_REGEX = /\/\d{3,}\.(?:ts|m4s)/i;

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

        const isTracker = typeof isTrackerDomain === 'function' 
            ? isTrackerDomain(url.hostname) 
            : TRACKER_DOMAINS.some(domain => url.hostname.includes(domain));

        if (isTracker) {
            const domain = url.hostname;

            // Update tracker entry with per-tab limit
            addTrackerEntry(details.tabId, domain);
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
                urlString.includes('manifest')) {

                // Smart filter for HLS/DASH segment spam (.ts, .m4s)
                if (isHlsSegmentSpam(urlString, extension)) {
                    return;
                }

                const type = extension || (urlString.includes('m3u8') ? 'm3u8' : 'video');
                addDetectedVideo(details.tabId, urlString, type, 'Streaming...', details.initiator, '');
            }
        }
    },
    { urls: ["<all_urls>"] }
);

/**
 * Filter out repetitive HLS / DASH micro-segments from flooding detected videos list
 */
function isHlsSegmentSpam(urlString, extension) {
    if (extension !== 'ts' && extension !== 'm4s') return false;
    const lower = urlString.toLowerCase();

    // Allow initial probe segments (index 0 or 1)
    const isFirstSegment = lower.includes('seg-0.') || lower.includes('seg-1.') || 
                           lower.includes('segment-0.') || lower.includes('segment-1.') ||
                           lower.includes('chunk-0.') || lower.includes('chunk-1.') ||
                           lower.includes('chunk_0.') || lower.includes('chunk_1.') ||
                           lower.includes('index_0.') || lower.includes('index-0.') ||
                           lower.includes('00000.ts') || lower.includes('00001.ts');

    if (isFirstSegment) return false;

    // Detect common repeating segment patterns: seg-12.ts, chunk_005.ts, /00123.ts, frag-10.m4s
    return HLS_SEGMENT_REGEX.test(lower) || HLS_NUMERIC_SEGMENT_REGEX.test(lower) || lower.includes('.ts?') || lower.includes('.m4s?');
}

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
                const openIncognito = () => {
                    chrome.tabs.remove(details.tabId).catch(() => {});
                    chrome.windows.create({
                        url: details.url,
                        incognito: true,
                        type: 'popup',
                        width: 800,
                        height: 600
                    }).catch(() => {
                        // Fallback if incognito is disabled: open regular window
                        chrome.windows.create({
                            url: details.url,
                            type: 'popup',
                            width: 800,
                            height: 600
                        }).catch(() => {});
                    });
                };

                if (chrome.extension && typeof chrome.extension.isAllowedIncognitoAccess === 'function') {
                    chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
                        if (isAllowed) openIncognito();
                    });
                } else {
                    openIncognito();
                }
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

