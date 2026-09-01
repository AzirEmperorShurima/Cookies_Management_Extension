/**
 * Tab Updated Handler
 * Resets state on reload and handles auto-injection
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        tabLastActive[tabId] = Date.now(); // Update hibernation tracker
    }
    // 1. Reset data when tab starts loading
    if (changeInfo.status === 'loading') {
        trackerCount[tabId] = 0;
        trackerList[tabId] = [];
        if (typeof trackerMap !== 'undefined') delete trackerMap[tabId];
        detectedVideos[tabId] = [];
        updateTabBadge(tabId);
        saveStateToSession();
    }

    // 2. Update tabUrls for Auto-Cleanup logic
    if (tab.url && !tab.url.startsWith('chrome')) {
        tabUrls[tabId] = tab.url;
        saveStateToSession();
    }


    if (changeInfo.status === 'complete' && tab.url) {
        const isTelegram = ['web.telegram.org', 'webk.telegram.org', 'webz.telegram.org']
            .some(h => tab.url.includes(h));

        if (isTelegram) {
            chrome.storage.local.get(['appSettings'], (result) => {
                const settings = result.appSettings ? { ...DEFAULT_SETTINGS, ...result.appSettings } : DEFAULT_SETTINGS;
                if (settings.telegramDownloaderEnabled) {
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['telegram_content.js']
                    }).catch(err => console.error('Auto-inject Telegram error:', err));
                }
            });
        }
    }
});

// ─── SPA Navigation Handler (Single Page Apps: YouTube, Twitter, Next.js) ─────
if (chrome.webNavigation && chrome.webNavigation.onHistoryStateUpdated) {
    chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
        if (details.tabId > 0 && details.url && !details.url.startsWith('chrome')) {
            tabUrls[details.tabId] = details.url;
            tabLastActive[details.tabId] = Date.now();
            saveStateToSession();

            // Thông báo cho content script quét lại video khi chuyển trang trong SPA
            chrome.tabs.sendMessage(details.tabId, {
                type: 'SPA_NAVIGATION_DETECTED',
                url: details.url
            }).catch(() => {});
        }
    });
}

// ─── Service Worker Keep-Alive Port Handler for Media Downloader ──────────────
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'thanus_media_keepalive') {
        const keepAliveTimer = setInterval(() => {
            try { port.postMessage({ type: 'ping' }); } catch (e) { clearInterval(keepAliveTimer); }
        }, 20000);

        port.onDisconnect.addListener(() => {
            clearInterval(keepAliveTimer);
        });
    }
});

// ============ Hàng đợi bền vững (Queue-Persist Cookie Destroyer) ============
async function enqueuePendingDeletion(domain) {
    try {
        const res = await chrome.storage.local.get(['__pendingDeleteDomains__']);
        const list = Array.isArray(res.__pendingDeleteDomains__) ? res.__pendingDeleteDomains__ : [];
        if (!list.includes(domain)) {
            list.push(domain);
            await chrome.storage.local.set({ __pendingDeleteDomains__: list });
        }
    } catch (e) {
        console.error('[CookieDestroyer] Enqueue error:', e);
    }
}

async function markDeletionDone(domain) {
    try {
        const res = await chrome.storage.local.get(['__pendingDeleteDomains__']);
        let list = Array.isArray(res.__pendingDeleteDomains__) ? res.__pendingDeleteDomains__ : [];
        list = list.filter(d => d !== domain);
        await chrome.storage.local.set({ __pendingDeleteDomains__: list });
    } catch (e) {
        console.error('[CookieDestroyer] MarkDone error:', e);
    }
}

let isProcessingCookieQueue = false;
async function processPendingDeletions() {
    if (isProcessingCookieQueue) return;
    isProcessingCookieQueue = true;
    try {
        const res = await chrome.storage.local.get(['__pendingDeleteDomains__']);
        const pendingDomains = Array.isArray(res.__pendingDeleteDomains__) ? res.__pendingDeleteDomains__ : [];

        if (pendingDomains.length === 0) return;

        for (const domain of pendingDomains) {
            try {
                const cookies = await chrome.cookies.getAll({ domain });
                await Promise.allSettled(
                    cookies.map(cookie => {
                        const url = (cookie.secure ? 'https://' : 'http://') + cookie.domain.replace(/^\./, '') + cookie.path;
                        return chrome.cookies.remove({ url, name: cookie.name });
                    })
                );
                await markDeletionDone(domain);
            } catch (err) {
                console.error(`[CookieDestroyer] Lỗi khi xóa domain ${domain}:`, err);
            }
        }
    } finally {
        isProcessingCookieQueue = false;
    }
}

chrome.runtime.onStartup.addListener(processPendingDeletions);
chrome.alarms.create('retryCookieDestroyer', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'retryCookieDestroyer') {
        processPendingDeletions();
    } else if (alarm.name === 'zenModeAlarm') {
        chrome.storage.local.remove(['zenEndTime']);
        chrome.declarativeNetRequest.getDynamicRules().then(async (existingRules) => {
            const zenRuleIdsToRemove = existingRules.filter(r => r.id >= 9000 && r.id < 10000).map(r => r.id);
            if (zenRuleIdsToRemove.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: zenRuleIdsToRemove
                });
            }
            console.log(`[Zen Mode Alarm] Zen session completed. Cleaned up ${zenRuleIdsToRemove.length} DNR rules.`);
        }).catch((err) => {
            console.error('[Zen Mode Alarm] Error cleaning up DNR rules:', err);
        });
        chrome.notifications.create({
            type: 'basic',
            iconUrl: ASSETS.icons.icon128,
            title: 'Zen Mode Hoàn tất',
            message: 'Chúc mừng bạn đã hoàn thành phiên làm việc tập trung!'
        });
    } else if (alarm.name === 'hibernationCheck') {
        if (!hibernationEnabled) return;

        const now = Date.now();
        const timeoutMs = hibernationTimeout * 60 * 1000;

        chrome.tabs.query({ active: false, pinned: false, discarded: false }, (tabs) => {
            tabs.forEach(tab => {
                const lastActive = tabLastActive[tab.id] || 0;
                if (lastActive > 0 && (now - lastActive) > timeoutMs) {
                    chrome.tabs.discard(tab.id, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Hibernation error:', chrome.runtime.lastError);
                        } else {
                            console.log(`Tab ${tab.id} hibernated to save RAM.`);
                        }
                    });
                }
            });
        });
    } else if (alarm.name === 'flushDailyStats') {
        // Backup flush for daily stats (from security-rules.js)
        if (typeof flushDailyStats === 'function') flushDailyStats();
    }
    // Note: 'rotateProxyAlarm' is handled by its own listener in network-shield.js
});

let batchTimer = null;
function scheduleDebouncedBatchProcess() {
    clearTimeout(batchTimer);
    batchTimer = setTimeout(processPendingDeletions, 500);
}

/**
 * Tab Removed Handler
 * Performs cleanup and auto-cookie destruction
 */
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // 1. Cleanup Cookies & URL Mappings
    chrome.storage.local.get(['appSettings', 'tabUrlMapping'], async (result) => {
        const settings = result.appSettings ? { ...DEFAULT_SETTINGS, ...result.appSettings } : DEFAULT_SETTINGS;
        const mapping = result.tabUrlMapping || {};

        // Auto-Cleanup Cookies on tab close
        const urlToClean = tabUrls[tabId] || mapping[tabId];
        if (settings.cookieDestroyer && urlToClean) {
            const domain = safeGetDomain(urlToClean);
            if (domain) {
                const whitelist = settings.whitelist || [];
                const isWhitelisted = whitelist.some(w => domain === w || domain.endsWith('.' + w));

                if (!isWhitelisted) {
                    await enqueuePendingDeletion(domain);
                    if (removeInfo && removeInfo.isWindowClosing) {
                        scheduleDebouncedBatchProcess();
                    } else {
                        await processPendingDeletions();
                    }
                }
            }
        }

        // Remove mappings and URLs to prevent memory leaks
        if (mapping[tabId]) {
            delete mapping[tabId];
            chrome.storage.local.set({ tabUrlMapping: mapping });
        }
        
        // Ephemeral Domain cleanup
        const urlToClear = tabUrls[tabId];
        if (urlToClear) {
            try {
                const urlObj = new URL(urlToClear);
                const domain = urlObj.hostname;
                chrome.storage.local.get(['ephemeralDomains'], (res) => {
                    const ephemerals = res.ephemeralDomains || [];
                    if (ephemerals.includes(domain)) {
                        let hasOther = false;
                        for (const tId in tabUrls) {
                            if (tId != tabId && tabUrls[tId].includes(domain)) hasOther = true;
                        }
                        if (!hasOther) {
                            chrome.browsingData.remove({ origins: [urlObj.origin] }, {
                                "cache": true, "cookies": true, "localStorage": true, "indexedDB": true
                            });
                        }
                    }
                });
            } catch(e) {}
        }
        delete tabUrls[tabId];
    });

    // 2. Clear memory-based state
    delete trackerCount[tabId];
    delete trackerList[tabId];
    if (typeof trackerMap !== 'undefined') delete trackerMap[tabId];
    delete detectedVideos[tabId];
    delete tabLastActive[tabId];
    saveStateToSession();
});

/**
 * Tab Hibernation Logic
 * Periodically discards inactive tabs to save RAM
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
    tabLastActive[activeInfo.tabId] = Date.now();
    saveStateToSession();
});

function updateHibernationAlarm(enabled, timeout) {
    chrome.alarms.clear("hibernationCheck").then(() => {
        if (enabled) {
            chrome.alarms.create("hibernationCheck", { periodInMinutes: 1 });
            console.log(`Hibernation alarm registered. Timeout: ${timeout}m`);
        } else {
            console.log("Hibernation alarm disabled.");
        }
    }).catch(err => console.error("Alarm error:", err));
}


