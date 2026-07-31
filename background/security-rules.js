/**
 * Global Listeners
 */
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['appSettings'], (result) => {
        const settings = result.appSettings || {};
        const useSidePanel = settings.useSidePanel || false;
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: useSidePanel }).catch(e => console.error(e));
    });

    chrome.notifications.create({
        type: 'basic',
        title: 'Privacy & Cookie Manager',
        message: 'Welcome to Cookie Manager! Click the extension icon to get started.',
        iconUrl: ASSETS.icons.icon128
    });

    // Tạo menu chuột phải
    // chrome.contextMenus.create({ id: "addToVault", title: "Add to Privacy Vault 🔐", contexts: ["page", "link"] });
    // chrome.contextMenus.create({ id: "addToFavorites", title: "Add to Favorite Websites ⭐", contexts: ["page", "link"] });
    // chrome.contextMenus.create({ id: "quickPanic", title: "Quick Panic Button 🚨", contexts: ["all"] });
    // chrome.contextMenus.create({ id: "quickSaveSession", title: "Quick Save Session 📋", contexts: ["all"] });
});

chrome.commands.onCommand.addListener((command) => {
    if (command === "activate_panic") executePanic();
});

chrome.tabs.onCreated.addListener((tab) => {
    tabLastActive[tab.id] = Date.now(); // Track for hibernation
});

// Hàm cập nhật quy tắc bảo mật động (Clickjacking & Real-time Protection)
async function updateSecurityRules() {
    const result = await chrome.storage.local.get(['appSettings']);
    const settings = result.appSettings ? { ...DEFAULT_SETTINGS, ...result.appSettings } : DEFAULT_SETTINGS;
    const userWhitelist = settings.whitelist || [];

    // Các domain mặc định cần loại trừ để đảm bảo tính năng bảo mật/captcha hoạt động
    const baseExclusions = [
        'challenges.cloudflare.com',
        'cloudflare.com',
        'gstatic.com',
        'google.com',
        'hcaptcha.com',
        'recaptcha.net',
        'youtube.com',
        'googlevideo.com'
    ];

    // Kết hợp với whitelist của người dùng để cho phép họ tự khắc phục các trang bị lỗi
    const allExclusions = Array.from(new Set([...baseExclusions, ...userWhitelist]));

    const rulesToAdd = [];

    // 1. Clickjacking Protection Rule
    if (settings.blockClickjacking || settings.protectionLevel === 'enhanced' || settings.protectionLevel === 'noscript') {
        rulesToAdd.push({
            id: 1001,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                responseHeaders: [
                    { header: 'X-Frame-Options', operation: 'set', value: 'SAMEORIGIN' }
                ]
            },
            condition: {
                urlFilter: '*',
                resourceTypes: ['main_frame'],
                excludedRequestDomains: allExclusions
            }
        });
    }

    // 1.1 Privacy Player - Allow Embedding for Search Engines (Unblocking rule)
    rulesToAdd.push({
        id: 2001,
        priority: 2, // Higher priority than protection rules
        action: {
            type: 'modifyHeaders',
            responseHeaders: [
                { header: 'X-Frame-Options', operation: 'remove' },
                { header: 'Content-Security-Policy', operation: 'remove' },
                { header: 'Frame-Options', operation: 'remove' }
            ]
        },
        condition: {
            urlFilter: '*',
            resourceTypes: ['sub_frame'],
            // Only strip headers for known search engine domains to allow them in Privacy Player
            requestDomains: [
                'google.com', 'www.google.com',
                'bing.com', 'www.bing.com',
                'yahoo.com', 'search.yahoo.com',
                'baidu.com', 'www.baidu.com',
                'yandex.com', 'yandex.ru'
            ]
        }
    });

    const sessionRulesToAdd = [];

    // 1.2 Privacy Player - Stateless Identity & Universal Embed rules targeting tabIds: [-1]
    if (settings.playerIsolatedIdentity) {
        sessionRulesToAdd.push({
            id: 2002,
            priority: 4,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    { header: 'Cookie', operation: 'remove' },
                    { header: 'Authorization', operation: 'remove' }
                ],
                responseHeaders: [
                    { header: 'Set-Cookie', operation: 'remove' }
                ]
            },
            condition: {
                urlFilter: '*',
                tabIds: [-1]
            }
        });
    }

    sessionRulesToAdd.push({
        id: 2003,
        priority: 4,
        action: {
            type: 'modifyHeaders',
            responseHeaders: [
                { header: 'X-Frame-Options', operation: 'remove' },
                { header: 'Content-Security-Policy', operation: 'remove' },
                { header: 'Frame-Options', operation: 'remove' }
            ]
        },
        condition: {
            urlFilter: '*',
            resourceTypes: ['sub_frame'],
            tabIds: [-1]
        }
    });

    // 2. Real-time Protection Rule
    if (settings.realTimeProtection || settings.protectionLevel === 'enhanced' || settings.protectionLevel === 'noscript') {
        const headers = [
            { header: 'X-Content-Type-Options', operation: 'set', value: 'nosniff' },
            { header: 'Referrer-Policy', operation: 'set', value: 'strict-origin-when-cross-origin' }
        ];

        // Loại bỏ X-XSS-Protection vì nó gây lỗi với Cloudflare và đã lỗi thời
        if (settings.protectionLevel === 'enhanced' || settings.protectionLevel === 'noscript') {
            headers.push({ header: 'Content-Security-Policy', operation: 'set', value: "upgrade-insecure-requests" });
        }

        rulesToAdd.push({
            id: 1002,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                responseHeaders: headers
            },
            condition: {
                urlFilter: '*',
                resourceTypes: ['main_frame', 'sub_frame'],
                excludedRequestDomains: allExclusions,
                excludedInitiatorDomains: [
                    'challenges.cloudflare.com',
                    'cloudflare.com',
                    'hcaptcha.com',
                    'recaptcha.net'
                ]
            }
        });
    }

    // 3. NoScript (Max Security) - Chặn tất cả các script nhưng ngoại trừ captcha
    if (settings.protectionLevel === 'noscript') {
        rulesToAdd.push({
            id: 1003,
            priority: 2,
            action: { type: 'block' },
            condition: {
                urlFilter: '*',
                resourceTypes: ['script'],
                excludedRequestDomains: [
                    'challenges.cloudflare.com',
                    'cloudflare.com',
                    'gstatic.com',
                    'google.com',
                    'hcaptcha.com',
                    'recaptcha.net'
                ]
            }
        });
    }

    // 4. Chặn Popup quảng cáo cứng đầu (như miss.ai/pop và Tsyndicate, Adsterra, PropellerAds, PopAds)
    if (settings.adblockEnabled !== false && (settings.linkClickBehavior === 'block' || settings.linkClickBehavior === 'player')) {
        const adBlockRules = [
            { id: 1004, filter: '*miss.ai/pop*' },
            { id: 1005, filter: '*tsyndicate.com*' },
            { id: 1006, filter: '*tsyndicate.net*' },
            { id: 1007, filter: '*trafficstars.com*' },
            { id: 1008, filter: '*exoclick.com*' },
            { id: 1009, filter: '*tsyndicate.io*' },
            { id: 1010, filter: '*tsyndicads.com*' },
            { id: 1011, filter: '*onclickads.net*' },
            { id: 1012, filter: '*adsterra.com*' },
            { id: 1013, filter: '*propellerads.com*' },
            { id: 1014, filter: '*popads.net*' },
            { id: 1015, filter: '*popcash.net*' },
            { id: 1016, filter: '*mgid.com*' },
            { id: 1017, filter: '*clickadu.com*' },
            { id: 1018, filter: '*juicyads.com*' }
        ];

        adBlockRules.forEach(rule => {
            rulesToAdd.push({
                id: rule.id,
                priority: 3,
                action: { type: 'block' },
                condition: {
                    urlFilter: rule.filter,
                    resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'image', 'other']
                }
            });
        });
    }

    // 5. Áp dụng thêm quy tắc Adblock động đã được biên dịch (nếu adblockEnabled)
    if (settings.adblockEnabled) {
        try {
            const adblockStorage = await chrome.storage.local.get(['compiledAdblockRules']);
            const compiledRules = adblockStorage.compiledAdblockRules || [];
            compiledRules.forEach(rule => {
                // Chỉ nạp các quy tắc hợp lệ có ID từ 3000 trở đi để tránh đè lên quy tắc hệ thống
                if (rule.id >= 3000) {
                    rulesToAdd.push(rule);
                }
            });
        } catch (e) {
            console.error('[Background] Failed to load compiled adblock rules:', e);
        }
    }

    // 6. Whitelist YouTube Live Chat and Heartbeat (Tránh tính năng bị hỏng khi dùng Adblock)
    rulesToAdd.push({
        id: 2003,
        priority: 100,
        action: { type: 'allow' },
        condition: {
            urlFilter: '*youtube.com/youtubei/v1/live_chat*',
            resourceTypes: ['xmlhttprequest', 'script', 'other']
        }
    });
    rulesToAdd.push({
        id: 2004,
        priority: 100,
        action: { type: 'allow' },
        condition: {
            urlFilter: '*youtube.com/youtubei/v1/player/heartbeat*',
            resourceTypes: ['xmlhttprequest', 'script', 'other']
        }
    });

    // Áp dụng các quy tắc mới bằng cách chia làm 2 nhóm để tránh lỗi nhóm này làm sập nhóm kia
    try {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

        const systemRulesToAdd = rulesToAdd.filter(r => r.id < 3000);
        const systemRuleIdsToRemove = existingRules.filter(r => r.id < 3000).map(r => r.id);

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: systemRuleIdsToRemove,
            addRules: systemRulesToAdd
        });

        const adblockRulesToAdd = rulesToAdd.filter(r => r.id >= 3000);
        const adblockRuleIdsToRemove = existingRules.filter(r => r.id >= 3000).map(r => r.id);

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: adblockRuleIdsToRemove,
            addRules: adblockRulesToAdd
        });

        console.log(`Dynamic rules updated successfully. System rules: ${systemRulesToAdd.length}, Adblock rules: ${adblockRulesToAdd.length}`);
    } catch (error) {
        console.error('Error updating security rules:', error);
    }

    try {
        const existingSessionRules = await chrome.declarativeNetRequest.getSessionRules();
        const existingSessionIds = existingSessionRules.map(r => r.id);

        await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: existingSessionIds,
            addRules: sessionRulesToAdd
        });
        console.log('Session security rules updated successfully');
    } catch (error) {
        console.error('Error updating session security rules:', error);
    }

    // 7. Sync static rulesets based on adblock/easylist settings
    try {
        const isAdblockOn = settings.adblockEnabled !== false;
        const isEasylistOn = settings.easylistEnabled !== false;

        const rulesetsToEnable = [];
        const rulesetsToDisable = [];

        if (isAdblockOn) {
            rulesetsToEnable.push('custom_rules');
            if (isEasylistOn) {
                rulesetsToEnable.push('easylist_1', 'easylist_2', 'easyprivacy_1', 'easyprivacy_2');
            } else {
                rulesetsToDisable.push('easylist_1', 'easylist_2', 'easyprivacy_1', 'easyprivacy_2');
            }
        } else {
            rulesetsToDisable.push('custom_rules', 'easylist_1', 'easylist_2', 'easyprivacy_1', 'easyprivacy_2');
        }

        if (rulesetsToEnable.length > 0 || rulesetsToDisable.length > 0) {
            await chrome.declarativeNetRequest.updateEnabledRulesets({
                enableRulesetIds: rulesetsToEnable,
                disableRulesetIds: rulesetsToDisable
            });
            console.log(`Static rulesets synced. Enabled: ${rulesetsToEnable.join(', ')}. Disabled: ${rulesetsToDisable.join(', ')}`);
        }
    } catch (e) {
        console.error('Error syncing static rulesets:', e);
    }
}

// Khởi chạy khi extension được load
updateSecurityRules();

// Biến lưu trữ tạm (cache) để tránh data race và quá tải storage
let dailyStatsCache = {};
let isFlushingStats = false;

// Hàm cộng dồn số liệu vào biểu đồ theo ngày (Local Time)
function incrementDailyStat(domain) {
    const d = new Date();
    // Chuyển về giờ Local dưới dạng YYYY-MM-DD
    const offset = d.getTimezoneOffset() * 60000; 
    const localDateStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
    const key = `stats_${localDateStr}`;
    
    if (!dailyStatsCache[key]) {
        dailyStatsCache[key] = { trackersBlocked: 0, details: {} };
    }
    
    dailyStatsCache[key].trackersBlocked += 1;
    dailyStatsCache[key].details[domain] = (dailyStatsCache[key].details[domain] || 0) + 1;
}

// Lưu cache xuống Storage định kỳ mỗi 2 giây
setInterval(() => {
    if (Object.keys(dailyStatsCache).length === 0 || isFlushingStats) return;
    
    isFlushingStats = true;
    const keysToFetch = Object.keys(dailyStatsCache);
    const cacheCopy = { ...dailyStatsCache };
    dailyStatsCache = {}; // Reset cache ngay lập tức để nhận request mới
    
    chrome.storage.local.get(keysToFetch, (res) => {
        let updates = {};
        for (const key of keysToFetch) {
            const currentData = res[key] || { trackersBlocked: 0, details: {} };
            const cacheData = cacheCopy[key];
            
            // Merge dữ liệu
            let mergedTrackers = currentData.trackersBlocked + cacheData.trackersBlocked;
            let mergedDetails = { ...currentData.details };
            
            for (const [domain, count] of Object.entries(cacheData.details)) {
                mergedDetails[domain] = (mergedDetails[domain] || 0) + count;
            }
            
            updates[key] = {
                trackersBlocked: mergedTrackers,
                details: mergedDetails
            };
        }
        
        chrome.storage.local.set(updates, () => {
            isFlushingStats = false;
        });
    });
}, 2000);

// Thống kê quảng cáo bị chặn (Debug mode / Developer mode hỗ trợ onRuleMatchedDebug)
if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
        chrome.storage.local.get(['appSettings'], (res) => {
            const isAdblockOn = res.appSettings ? (res.appSettings.adblockEnabled !== false) : true;
            if (!isAdblockOn) return;
            if (info.rule && info.rule.ruleId >= 1004 && info.request && info.request.method !== 'OPTIONS') {
                try {
                    const url = new URL(info.request.url);
                    incrementDailyStat(url.hostname);
                } catch (e) {
                    incrementDailyStat('ad-network');
                }
            }
        });
    });
}

