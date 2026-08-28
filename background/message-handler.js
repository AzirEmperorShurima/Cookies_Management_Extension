/**
 * Central Message Handler — single source of truth for all background message types.
 * Consolidated from: message-handler.js + context-menu.js (GET_TOP_LEVEL_DOMAIN)
 */
/**
 * Helper to process and persist iframe navigation state without recursive message dispatch
 */
function _processIframeNavigation(url, targetTabId, fromPopup = false) {
    if (!url) return;
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

        if (targetTabId && targetTabId !== -1) {
            mapping[targetTabId] = url;
        } else if (!fromPopup) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) mapping[tabs[0].id] = url;
            });
        }

        if (fromPopup) {
            let newHistory = [...history];
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
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);

    // ── Domain helper ────────────────────────────────────────────────────────
    if (request.type === 'GET_TOP_LEVEL_DOMAIN') {
        const url = sender.tab ? sender.tab.url : null;
        sendResponse({ domain: safeGetDomain(url) });
        return false;
    }

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

        // Dynamic Storage-Driven Zen Rules (Đọc trực tiếp danh sách người dùng cấu hình từ storage)
        const DEFAULT_ZEN_DOMAINS = ['facebook.com', 'twitter.com', 'x.com', 'reddit.com', 'tiktok.com', 'instagram.com', 'netflix.com', 'youtube.com'];
        chrome.storage.local.get(['zenCustomUrls']).then(async (res) => {
            const domains = (Array.isArray(res.zenCustomUrls) && res.zenCustomUrls.length > 0)
                ? res.zenCustomUrls
                : DEFAULT_ZEN_DOMAINS;

            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const zenRuleIdsToRemove = existingRules.filter(r => r.id >= 9000 && r.id < 10000).map(r => r.id);

            let ruleId = 9000;
            const blockRules = domains.map(domain => {
                const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
                return {
                    id: ruleId++,
                    priority: 1,
                    action: { type: 'block' },
                    condition: {
                        urlFilter: `||${cleanDomain}`,
                        resourceTypes: ['main_frame']
                    }
                };
            });

            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: zenRuleIdsToRemove,
                addRules: blockRules
            });
            console.log(`[Zen Mode] Activated with ${blockRules.length} dynamic domain rules.`);
            sendResponse({ success: true, count: blockRules.length });
        }).catch(err => {
            console.error('[Zen Mode] Error starting Zen:', err);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    } else if (request.type === 'STOP_ZEN') {
        chrome.storage.local.remove(['zenEndTime']);
        chrome.alarms.clear('zenModeAlarm');

        chrome.declarativeNetRequest.getDynamicRules().then(async (existingRules) => {
            const zenRuleIdsToRemove = existingRules.filter(r => r.id >= 9000 && r.id < 10000).map(r => r.id);
            if (zenRuleIdsToRemove.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: zenRuleIdsToRemove
                });
            }
            console.log(`[Zen Mode] Deactivated. Removed ${zenRuleIdsToRemove.length} rules.`);
            sendResponse({ success: true });
        }).catch(err => {
            console.error('[Zen Mode] Error stopping Zen:', err);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    } else if (request.type === 'getTrackerCount' && tabId) {
        Promise.resolve(typeof stateReadyPromise !== 'undefined' ? stateReadyPromise : null).then(() => {
            sendResponse({
                count: trackerCount[tabId] || 0,
                list: trackerList[tabId] || []
            });
        });
        return true;
    } else if (request.type === 'getDetectedVideos' && tabId) {
        Promise.resolve(typeof stateReadyPromise !== 'undefined' ? stateReadyPromise : null).then(() => {
            sendResponse({ videos: detectedVideos[tabId] || [] });
        });
        return true;
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
        _processIframeNavigation(request.url, sender.tab ? sender.tab.id : -1, false);
    } else if (request.type === 'updateHibernation') {
        hibernationEnabled = request.enabled;
        hibernationTimeout = request.timeout;
    } else if (request.type === 'iframeNavigated') {
        const realTabId = (sender.tab ? sender.tab.id : null) || (request.tabId && request.tabId !== -1 ? request.tabId : null);
        _processIframeNavigation(request.url, realTabId, !realTabId);
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
    // ── Floating Vertical Tab Bar & Workspace Handlers ───────────────────────
    else if (request.type === 'GET_ALL_TABS_FOR_FLOATING_BAR') {
        Promise.all([
            chrome.windows.getAll({ populate: false }),
            chrome.tabs.query({}),
            chrome.windows.getCurrent(),
            (chrome.tabGroups && chrome.tabGroups.query) ? chrome.tabGroups.query({}) : Promise.resolve([])
        ]).then(([windows, tabs, currentWin, groupsList]) => {
            const groups = {};
            groupsList.forEach(g => { groups[g.id] = g; });
            sendResponse({
                success: true,
                data: {
                    windows,
                    tabs,
                    currentWindowId: currentWin ? currentWin.id : null,
                    groups
                }
            });
        }).catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    } else if (request.type === 'FOCUS_TAB') {
        chrome.tabs.update(request.tabId, { active: true });
        if (request.windowId) chrome.windows.update(request.windowId, { focused: true });
        sendResponse({ success: true });
        return true;
    } else if (request.type === 'CLOSE_TAB') {
        chrome.tabs.remove(request.tabId, () => sendResponse({ success: true }));
        return true;
    } else if (request.type === 'MUTE_TAB') {
        chrome.tabs.update(request.tabId, { muted: request.muted }, () => sendResponse({ success: true }));
        return true;
    } else if (request.type === 'DISCARD_TAB') {
        chrome.tabs.discard(request.tabId, () => sendResponse({ success: true }));
        return true;
    } else if (request.type === 'CREATE_NEW_TAB') {
        chrome.tabs.create({}, () => sendResponse({ success: true }));
        return true;
    } else if (request.type === 'CLOSE_DUPLICATE_TABS') {
        chrome.tabs.query({}).then(tabs => {
            const urlMap = new Map();
            const tabsToClose = [];
            tabs.forEach(tab => {
                if (!tab.url || tab.pinned || tab.url.startsWith('chrome://')) return;
                const cleanUrl = tab.url.split('#')[0];
                if (urlMap.has(cleanUrl)) {
                    tabsToClose.push(tab.id);
                } else {
                    urlMap.set(cleanUrl, tab.id);
                }
            });
            if (tabsToClose.length > 0) {
                chrome.tabs.remove(tabsToClose, () => sendResponse({ success: true, count: tabsToClose.length }));
            } else {
                sendResponse({ success: true, count: 0 });
            }
        });
        return true;
    } else if (request.type === 'HIBERNATE_INACTIVE_TABS') {
        chrome.tabs.query({ active: false, pinned: false, discarded: false }).then(tabs => {
            let count = 0;
            tabs.forEach(tab => {
                if (!tab.audible) {
                    chrome.tabs.discard(tab.id);
                    count++;
                }
            });
            sendResponse({ success: true, count });
        });
        return true;
    } else if (request.type === 'INJECT_FLOATING_BAR_TO_ALL_TABS') {
        injectFloatingTabBarToAllTabs(request.enabled ?? true);
        sendResponse({ success: true });
        return true;
    } else if (request.type === 'RESTORE_SESSION_TABS') {
        const { tabs, inNewWindow } = request;
        if (!Array.isArray(tabs) || tabs.length === 0) {
            sendResponse({ success: false, error: 'No tabs to restore' });
            return true;
        }

        const validUrls = tabs.map(t => typeof t === 'string' ? t : t.url).filter(u => u && !u.startsWith('chrome://'));
        if (validUrls.length === 0) {
            sendResponse({ success: false, error: 'No valid URLs' });
            return true;
        }

        if (inNewWindow) {
            chrome.windows.create({ url: validUrls }, (win) => {
                sendResponse({ success: true, windowId: win ? win.id : null });
            });
        } else {
            validUrls.forEach((url, i) => {
                chrome.tabs.create({ url, active: i === 0 });
            });
            sendResponse({ success: true, count: validUrls.length });
        }
        return true;
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

        // Lưu EasyList đã parse vào storage và đồng bộ ngay adblockCssRules
        const appSettingsRes = await chrome.storage.local.get(['appSettings']);
        const appSettings = appSettingsRes.appSettings || {};
        const isAdblockOn = appSettings.adblockEnabled !== false;
        const isEasylistOn = appSettings.easylistEnabled !== false;

        const customCssRules = {};
        if (appSettings.customAdblockCssRules) {
            const customLines = appSettings.customAdblockCssRules.split('\n');
            customLines.forEach(l => {
                const trimmed = l.trim();
                if (trimmed && trimmed.includes('##')) {
                    const parts = trimmed.split('##');
                    const domainsPart = parts[0].trim();
                    const selector = parts[1]?.trim();
                    if (selector) {
                        if (domainsPart) {
                            domainsPart.split(',').forEach(d => {
                                const domain = d.trim();
                                customCssRules[domain] = customCssRules[domain] || [];
                                customCssRules[domain].push(selector);
                            });
                        } else {
                            customCssRules['global'] = customCssRules['global'] || [];
                            customCssRules['global'].push(selector);
                        }
                    }
                }
            });
        }

        const compiledCssRules = (isAdblockOn && isEasylistOn) ? { ...easyListCssRules } : {};
        if (isAdblockOn) {
            Object.keys(customCssRules).forEach(domain => {
                compiledCssRules[domain] = compiledCssRules[domain] || [];
                customCssRules[domain].forEach(sel => {
                    if (!compiledCssRules[domain].includes(sel)) {
                        compiledCssRules[domain].push(sel);
                    }
                });
            });
        }

        await chrome.storage.local.set({ 
            easyListParsedCssRules: easyListCssRules,
            adblockCssRules: compiledCssRules
        });
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
    }).catch(() => {});
}

/**
 * Dynamic Live Injection: Injects modules/floating-tab-bar.js to all active tabs
 * so the user never needs to manually reload their pages.
 */
function injectFloatingTabBarToAllTabs(enabled = true) {
    if (!chrome.scripting) return;
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (!tab.id || !tab.url) return;
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) return;

            if (enabled) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['modules/floating-tab-bar.js']
                }).catch(() => {});
                chrome.tabs.sendMessage(tab.id, { type: 'SET_FLOATING_BAR_ENABLED', enabled: true }).catch(() => {});
            } else {
                chrome.tabs.sendMessage(tab.id, { type: 'SET_FLOATING_BAR_ENABLED', enabled: false }).catch(() => {});
            }
        });
    });
}

// Broadcast tabs update to content scripts (Throttled & Filtered)
let broadcastDebounceTimer = null;
function broadcastTabsUpdated() {
    if (typeof _cachedFloatingTabBarEnabled !== 'undefined' && !_cachedFloatingTabBarEnabled) {
        return;
    }
    clearTimeout(broadcastDebounceTimer);
    broadcastDebounceTimer = setTimeout(() => {
        if (typeof _cachedFloatingTabBarEnabled !== 'undefined' && !_cachedFloatingTabBarEnabled) {
            return;
        }
        chrome.tabs.query({ active: true }, (tabs) => {
            if (!tabs || tabs.length === 0) return;
            tabs.forEach(t => {
                if (t.id && t.url) {
                    const isInternal = t.url.startsWith('chrome://') || 
                                       t.url.startsWith('edge://') || 
                                       t.url.startsWith('about:') || 
                                       t.url.startsWith('chrome-extension://');
                    if (!isInternal) {
                        chrome.tabs.sendMessage(t.id, { type: 'BROADCAST_TABS_UPDATED' }).catch(() => {});
                    }
                }
            });
        });
    }, 400);
}

if (chrome.tabs) {
    chrome.tabs.onCreated.addListener(broadcastTabsUpdated);
    chrome.tabs.onRemoved.addListener(broadcastTabsUpdated);
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === 'complete' || changeInfo.title || changeInfo.favIconUrl || changeInfo.audible !== undefined || changeInfo.discarded !== undefined) {
            broadcastTabsUpdated();
        }
    });
    chrome.tabs.onActivated.addListener(broadcastTabsUpdated);
}

