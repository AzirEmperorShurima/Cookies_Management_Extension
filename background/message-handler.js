/**
 * Global Message Listener
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);

    if (request.type === 'ZAP_ELEMENT') {
        const { selector, domain } = request;
        chrome.storage.local.get(['userZappedCssRules'], (res) => {
            const rules = res.userZappedCssRules || {};
            if (!rules[domain]) rules[domain] = [];
            if (!rules[domain].includes(selector)) {
                rules[domain].push(selector);
                chrome.storage.local.set({ userZappedCssRules: rules });

                // Inject the rule immediately to the current tab
                if (sender.tab && sender.tab.id) {
                    chrome.scripting.insertCSS({
                        target: { tabId: sender.tab.id },
                        css: `${selector} { display: none !important; }`
                    }).catch(console.error);
                }
            }
        });
        return;
    } else if (request.type === 'ACTIVATE_PANIC') {
        executePanic();
        return;
    } else if (request.type === 'ACTIVATE_ZAPPER') {
        chrome.scripting.executeScript({
            target: { tabId: request.tabId },
            files: ['modules/zapper-content.js']
        }).then(() => sendResponse({ success: true }))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    } else if (request.type === 'START_ZEN') {
        const endTime = Date.now() + (request.minutes * 60 * 1000);
        chrome.storage.local.set({ zenEndTime: endTime });
        chrome.alarms.create('zenModeAlarm', { delayInMinutes: request.minutes });
        // Block social media
        const blockRules = [
            { id: 9000, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||facebook.com', resourceTypes: ['main_frame'] } },
            { id: 9001, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||twitter.com', resourceTypes: ['main_frame'] } },
            { id: 9002, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||x.com', resourceTypes: ['main_frame'] } },
            { id: 9003, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||reddit.com', resourceTypes: ['main_frame'] } },
            { id: 9004, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||tiktok.com', resourceTypes: ['main_frame'] } },
            { id: 9005, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||instagram.com', resourceTypes: ['main_frame'] } },
            { id: 9006, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||netflix.com', resourceTypes: ['main_frame'] } },
            { id: 9007, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||youtube.com', resourceTypes: ['main_frame'] } }
        ];
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [9000, 9001, 9002, 9003, 9004, 9005, 9006, 9007],
            addRules: blockRules
        });
        sendResponse({ success: true });
        return true;
    } else if (request.type === 'STOP_ZEN') {
        chrome.storage.local.remove(['zenEndTime']);
        chrome.alarms.clear('zenModeAlarm');
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [9000, 9001, 9002, 9003, 9004, 9005, 9006, 9007]
        });
        sendResponse({ success: true });
        return true;
    } else if (request.type === 'getTrackerCount' && tabId) {
        sendResponse({
            count: trackerCount[tabId] || 0,
            list: trackerList[tabId] || []
        });
    } else if (request.type === 'getDetectedVideos' && tabId) {
        sendResponse({ videos: detectedVideos[tabId] || [] });
    } else if (request.type === 'toggleVideoDetection') {
        videoDetectionEnabled = request.enabled;
    } else if (request.type === 'newVideoDetected' && tabId) {
        addDetectedVideo(tabId, request.video.url, request.video.type, request.video.size || 'Scan detected', '', request.video.filename, request.video.thumbnail, request.video.frameId);
    } else if (request.type === 'newVideoDetectedFromContent' && sender.tab) {
        if (request.video.currentFrameUrl) {
            chrome.runtime.sendMessage({
                type: 'iframeNavigated',
                url: request.video.currentFrameUrl,
                tabId: sender.tab.id,
                frameId: sender.frameId,
                fromContentScript: true
            }).catch(() => { });
        }
        addDetectedVideo(sender.tab.id, request.video.url, request.video.type, request.video.size || 'Detected', '', request.video.filename, request.video.thumbnail, sender.frameId);
    } else if (request.type === 'pageNavigatedInFrame') {
        chrome.runtime.sendMessage({
            type: 'iframeNavigated',
            url: request.url,
            title: request.title,
            tabId: sender.tab ? sender.tab.id : -1,
            fromContentScript: true
        }).catch(() => { });
    } else if (request.type === 'updateHibernation') {
        hibernationEnabled = request.enabled;
        hibernationTimeout = request.timeout;
    } else if (request.type === 'iframeNavigated') {
        const url = request.url;

        const isJunkUrl = (u) => {
            if (!u) return true;
            if (u === 'about:blank' || u === 'about:newtab') return true;
            if (u.startsWith('chrome:') || u.startsWith('chrome-extension:')) return true;
            if (u.startsWith('data:') || u.startsWith('blob:')) return true;
            try {
                const parsed = new URL(u);
                const path = parsed.pathname.toLowerCase();
                if (parsed.hostname === 'www.youtube.com' && path.includes('/live_chat')) return true;
                if (parsed.hostname === 'www.youtube.com' && path.includes('/heartbeat')) return true;
                const junkPaths = ['/analytics', '/pixel', '/collect', '/beacon', '/track', '/ping'];
                if (junkPaths.some(p => path.includes(p))) return true;
            } catch (e) { return true; }
            return false;
        };

        if (isJunkUrl(url)) return;

        chrome.storage.local.get(['tabUrlMapping', 'stealthHistory'], (result) => {
            const mapping = result.tabUrlMapping || {};
            const history = result.stealthHistory || [];

            let realTabId = null;
            if (sender.tab) {
                realTabId = sender.tab.id;
            } else if (request.tabId && request.tabId !== -1) {
                realTabId = request.tabId;
            }

            if (realTabId) {
                mapping[realTabId] = url;
            } else {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) mapping[tabs[0].id] = url;
                });
            }

            const fromPopup = !realTabId;
            let newHistory = [...history];
            if (fromPopup) {
                if (newHistory[newHistory.length - 1] !== url) {
                    newHistory.push(url);
                    if (newHistory.length > 50) newHistory = newHistory.slice(-50);
                }
                chrome.storage.local.set({
                    tabUrlMapping: mapping,
                    stealthHistory: newHistory,
                    lastPlayerUrl: url
                });
            } else {
                chrome.storage.local.set({ tabUrlMapping: mapping });
            }
            // if (newHistory[newHistory.length - 1] !== url) {
            //     newHistory.push(url);
            //     if (newHistory.length > 50) {
            //         newHistory = newHistory.slice(-50);
            //     }
            // }

            // chrome.storage.local.set({
            //     tabUrlMapping: mapping,
            //     stealthHistory: newHistory,
            //     lastPlayerUrl: url
            // });
        })
    } else if (request.type === 'tg_stats_update') {
        chrome.runtime.sendMessage(request).catch(() => { });
    } else if (request.type === 'createNotification') {
        chrome.notifications.create(request.options);
    } else if (request.type === 'updateSecurityRules') {
        updateSecurityRules();
        // Cập nhật lại badge cho tất cả các tab vì cài đặt adblock có thể thay đổi
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => updateTabBadge(tab.id));
        });

    } else if (request.type === 'FETCH_EASYLIST') {
        // Thực hiện fetch EasyList trong background – không bị cancel khi popup đóng
        sendResponse({ received: true }); // Phản hồi ngay để tránh timeout
        _fetchEasyListInBackground();
        return true;

    } else if (request.type === 'tg_toggle_changed') {
        if (request.enabled) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.url) {
                    const isTelegram = ['web.telegram.org', 'webk.telegram.org', 'webz.telegram.org']
                        .some(h => tab.url.includes(h));
                    if (isTelegram) {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['telegram_content.js']
                        }).catch(() => { });
                    }
                }
            });
        }
    }
});

/**
 * Thực hiện fetch EasyList trong background service worker.
 * Kết quả được broadcast qua chrome.runtime.sendMessage({ type: 'FETCH_EASYLIST_RESULT', ... })
 * để popup đang mở nhận và cập nhật UI.
 */
async function _fetchEasyListInBackground() {
    const EASYLIST_URL = 'https://easylist.to/easylist/easylist.txt';
    let success = false;
    let errMsg = null;

    try {
        console.log('[Background] Fetching EasyList from:', EASYLIST_URL);
        const response = await fetch(EASYLIST_URL);
        if (!response.ok) throw new Error('HTTP error ' + response.status);

        const text = await response.text();
        const lines = text.split('\n');
        const easyListCssRules = {};

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('!')) continue; // Bỏ qua comment

            // Phân tích quy tắc CSS Element Hiding
            if (line.includes('##')) {
                const parts = line.split('##');
                const domainsPart = parts[0].trim();
                const selector = parts[1]?.trim();

                if (selector) {
                    if (domainsPart) {
                        const domains = domainsPart.split(',');
                        domains.forEach(domain => {
                            domain = domain.trim();
                            if (domain.startsWith('~')) return; // Bỏ qua domain phủ định
                            easyListCssRules[domain] = easyListCssRules[domain] || [];
                            easyListCssRules[domain].push(selector);
                        });
                    } else {
                        easyListCssRules['global'] = easyListCssRules['global'] || [];
                        easyListCssRules['global'].push(selector);
                    }
                }
            }
        }

        // Lưu EasyList đã parse vào storage
        await chrome.storage.local.set({ easyListParsedCssRules: easyListCssRules });
        console.log('[Background] EasyList parsed and saved. Domains:', Object.keys(easyListCssRules).length);

        // Cập nhật security rules ngay lập tức
        await updateSecurityRules();

        success = true;
    } catch (err) {
        console.error('[Background] Failed to fetch EasyList:', err);
        errMsg = err.message;
    }

    // Broadcast kết quả về popup (nếu đang mở)
    chrome.runtime.sendMessage({
        type: 'FETCH_EASYLIST_RESULT',
        success,
        error: errMsg
    }).catch(() => {
        // Popup có thể đã đóng – không cần xử lý lỗi này
    });
}
