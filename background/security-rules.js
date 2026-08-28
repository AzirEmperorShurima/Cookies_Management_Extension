/**
 * Global Listeners
 * NOTE: chrome.runtime.onInstalled handler is consolidated in context-menu.js
 *       to have a single install handler (welcome notification + sidePanel setup
 *       + context menus + default settings init + security rules update).
 */

chrome.commands.onCommand.addListener(async (command) => {
    if (command === "activate_panic") {
        executePanic();
    } else if (command === "activate_zapper") {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['modules/zapper-content.js']
                }).catch(console.error);
            }
        } catch (e) {
            console.error('[Zapper Shortcut]', e);
        }
    } else if (command === "toggle_spotlight") {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
                chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SPOTLIGHT' }).catch(() => {});
            }
        } catch (e) {
            console.error('[Spotlight Shortcut]', e);
        }
    }
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
        'turnstile.cloudflare.com',
        'static.cloudflareinsights.com',
        'gstatic.com',
        'google.com',
        'hcaptcha.com',
        'newassets.hcaptcha.com',
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

    const sessionRulesToAdd = [];

    // 1.1 Privacy Player - Universal Embed rules targeting tabIds: [-1]
    // Allow embedding any website/search engine in Privacy Player by stripping frame-blocking headers
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

    // 2.5 Client Hints & User-Agent Sync Rule (Dynamically match current browser version or active profile)
    const profileRes = await chrome.storage.local.get(['activeDeviceProfileId', 'customDeviceProfile']);
    let chVersion = '131';
    let chPlatform = '"Windows"';
    let chMobile = '?0';

    try {
        const match = (navigator.userAgent || '').match(/(?:Chrome|Chromium)\/(\d+)/);
        if (match && match[1]) chVersion = match[1];
    } catch (e) {}

    if (profileRes.customDeviceProfile && profileRes.customDeviceProfile.clientHints) {
        const ch = profileRes.customDeviceProfile.clientHints;
        if (ch.platform) chPlatform = `"${ch.platform}"`;
        chMobile = ch.mobile ? '?1' : '?0';
    }

    rulesToAdd.push({
        id: 1025,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [
                { header: 'Sec-CH-UA', operation: 'set', value: `"Chromium";v="${chVersion}", "Google Chrome";v="${chVersion}", "Not_A Brand";v="24"` },
                { header: 'Sec-CH-UA-Platform', operation: 'set', value: chPlatform },
                { header: 'Sec-CH-UA-Mobile', operation: 'set', value: chMobile }
            ]
        },
        condition: {
            urlFilter: '*',
            resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'other'],
            excludedRequestDomains: allExclusions
        }
    });

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

    // 4. Chặn Popup quảng cáo cứng đầu (như miss.ai/pop và Tsyndicate, Adsterra, PropellerAds, PopAds, Monetag)
    if (settings.adblockEnabled !== false) {
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
            { id: 1018, filter: '*juicyads.com*' },
            { id: 1019, filter: '*monetag.com*' },
            { id: 1020, filter: '*hilltopads.net*' },
            { id: 1021, filter: '*adnxs.com*' }
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
    if (settings.adblockEnabled !== false) {
        try {
            const adblockStorage = await chrome.storage.local.get(['compiledAdblockRules']);
            const compiledRules = adblockStorage.compiledAdblockRules || [];
            
            // Quota Guard: Chrome limits dynamic rules to 5000 max.
            // We reserve 1-2999 for system rules, 9000-9999 for Zen Mode.
            // We safely allocate up to 3500 rules for compiled custom adblock rules.
            const MAX_COMPILED_RULES = 3500;
            const validCompiledRules = compiledRules
                .filter(r => r && r.id >= 3000 && r.id < 9000)
                .slice(0, MAX_COMPILED_RULES);

            validCompiledRules.forEach(rule => {
                rulesToAdd.push(rule);
            });
        } catch (e) {
            console.error('[Background] Failed to load compiled adblock rules:', e);
        }
    }

    // 6. Whitelist YouTube Live Chat and Heartbeat (Tránh tính năng bị hỏng khi dùng Adblock)
    rulesToAdd.push({
        id: 2005,
        priority: 100,
        action: { type: 'allow' },
        condition: {
            urlFilter: '*youtube.com/youtubei/v1/live_chat*',
            resourceTypes: ['xmlhttprequest', 'script', 'other']
        }
    });
    rulesToAdd.push({
        id: 2006,
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

        const adblockRulesToAdd = rulesToAdd.filter(r => r.id >= 3000 && r.id < 9000);
        const adblockRuleIdsToRemove = existingRules.filter(r => r.id >= 3000 && r.id < 9000).map(r => r.id);

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
        const allStaticRulesets = ['custom_rules', 'easylist_1', 'easylist_2', 'easyprivacy_1', 'easyprivacy_2'];
        const currentlyEnabled = await chrome.declarativeNetRequest.getEnabledRulesets();

        let rulesetsToEnable = [];
        let rulesetsToDisable = [];

        if (isAdblockOn) {
            const targetEnabled = ['custom_rules'];
            if (isEasylistOn) {
                targetEnabled.push('easylist_1', 'easylist_2', 'easyprivacy_1', 'easyprivacy_2');
            }
            rulesetsToEnable = targetEnabled.filter(id => !currentlyEnabled.includes(id));
            rulesetsToDisable = allStaticRulesets.filter(id => !targetEnabled.includes(id) && currentlyEnabled.includes(id));
        } else {
            rulesetsToDisable = allStaticRulesets.filter(id => currentlyEnabled.includes(id));
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

    // Phase 3.4: Giới hạn details tối đa 100 domain để tránh memory leak
    const details = dailyStatsCache[key].details;
    if (Object.keys(details).length < 100) {
        details[domain] = (details[domain] || 0) + 1;
    } else if (details[domain] !== undefined) {
        details[domain]++; // Update existing domain
    } else {
        details['__other__'] = (details['__other__'] || 0) + 1; // Bucket overflow
    }
}

// Phase 2.4: Event-driven stats flush instead of setInterval
// MV3 service workers can be killed at any time, making setInterval unreliable.
// We flush on significant events + use a 30s alarm as backup.
function flushDailyStats() {
    if (Object.keys(dailyStatsCache).length === 0 || isFlushingStats) return;

    isFlushingStats = true;
    const keysToFetch = Object.keys(dailyStatsCache);
    const cacheCopy = { ...dailyStatsCache };
    dailyStatsCache = {}; // Reset immediately to accept new data

    chrome.storage.local.get(keysToFetch, (res) => {
        const updates = {};
        for (const key of keysToFetch) {
            const currentData = res[key] || { trackersBlocked: 0, details: {} };
            const cacheData = cacheCopy[key];

            const mergedDetails = { ...currentData.details };
            for (const [d, count] of Object.entries(cacheData.details)) {
                mergedDetails[d] = (mergedDetails[d] || 0) + count;
            }

            updates[key] = {
                trackersBlocked: currentData.trackersBlocked + cacheData.trackersBlocked,
                details: mergedDetails
            };
        }

        chrome.storage.local.set(updates, () => {
            isFlushingStats = false;
        });
    });
}

// Backup alarm: flush every 30s in case SW is kept alive longer
chrome.alarms.create('flushDailyStats', { periodInMinutes: 0.5 }); // 30 seconds


// Phase 2.2: Thống kê quảng cáo bị chặn — dùng cached state thay vì storage.local.get
// (onRuleMatchedDebug là hot path, có thể fire hàng trăm lần/giây trên trang nhiều ads)
if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
        // Use cached value from globals.js — no async storage read needed
        if (!_cachedAdblockEnabled) return;
        if (info.rule && info.rule.ruleId >= 1004 && info.request && info.request.method !== 'OPTIONS') {
            try {
                const url = new URL(info.request.url);
                incrementDailyStat(url.hostname);
            } catch (e) {
                incrementDailyStat('ad-network');
            }
            // Flush stats after accumulating 50 events (event-driven)
            if (Object.keys(dailyStatsCache).reduce((sum, k) => sum + dailyStatsCache[k].trackersBlocked, 0) >= 50) {
                flushDailyStats();
            }
        }
    });
}

