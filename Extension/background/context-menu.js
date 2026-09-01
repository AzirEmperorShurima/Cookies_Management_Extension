/**
 * Context Menu Management
 * Single source of truth for all context menus.
 * Consolidated from cookie-destroyer.js and context-menu.js to avoid duplicate listeners.
 */

// Helper to create context menu and suppress duplicate id errors
function safeCreateMenu(options) {
    chrome.contextMenus.create(options, () => {
        if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message;
            if (msg && !msg.includes('duplicate id')) {
                console.error('Context menu error for ' + options.id + ':', msg);
            }
        }
    });
}

function createAllContextMenus() {
    chrome.contextMenus.removeAll(() => {
        safeCreateMenu({ id: "toggleFloatingTabBar", title: "📑 Toggle Vertical Tabs (Alt+T)", contexts: ["all"] });
        safeCreateMenu({ id: "addToVault", title: "Add to Privacy Vault 🔐", contexts: ["all"] });
        safeCreateMenu({ id: "addToFavorites", title: "Add to Favorite Websites ⭐", contexts: ["all"] });
        safeCreateMenu({ id: "quickPanic", title: "Quick Panic Button 🚨", contexts: ["all"] });
        safeCreateMenu({ id: "quickSaveSession", title: "Quick Save Session 📋", contexts: ["all"] });
        safeCreateMenu({ id: "add-to-zen-mode", title: "Add site to Zen Mode block 🧘", contexts: ["all"] });
        safeCreateMenu({
            id: "sessionManager",
            title: "📋 Session Manager",
            contexts: ["all"]
        });

        // 2. Create static session items
        const staticItems = [
            { id: "saveAllTabs", title: "💾 Save All Tabs" },
            { id: "saveNormalTabs", title: "🌐 Save Normal Tabs" },
            { id: "saveIncognitoTabs", title: "🔒 Save Incognito Tabs" },
            { id: "saveCurrentTab", title: "📄 Save Current Tab" },
            { id: "separator_session", type: "separator" },
            { id: "restoreSessionParent", title: "📂 Restore Session..." }
        ];

        staticItems.forEach(item => {
            safeCreateMenu({
                id: item.id,
                parentId: "sessionManager",
                title: item.title,
                type: item.type || "normal",
                contexts: ["all"]
            });
        });

        // 3. Update restore session items from storage
        chrome.storage.local.get(['appSettings'], (result) => {
            const settings = result.appSettings ? { ...DEFAULT_SETTINGS, ...result.appSettings } : DEFAULT_SETTINGS;
            const sessions = settings.savedSessions || [];

            if (sessions.length === 0) {
                safeCreateMenu({
                    id: "noSessions",
                    parentId: "restoreSessionParent",
                    title: "(No saved sessions)",
                    enabled: false,
                    contexts: ["all"]
                });
            } else {
                // Show up to 8 most recent sessions
                sessions.slice(0, 8).forEach((session, index) => {
                    safeCreateMenu({
                        id: `restoreSession_${session.id}`,
                        parentId: "restoreSessionParent",
                        title: `${index + 1}. ${session.name} (${session.tabs ? session.tabs.length : 0} tabs)`,
                        contexts: ["all"]
                    });
                });
            }
        });
    });
}

/**
 * Single consolidated onInstalled handler — single source of truth.
 * Merged from: context-menu.js (original) + security-rules.js (welcome notification + sidePanel)
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        const newSeed = crypto.getRandomValues(new Uint32Array(4)).join('-');
        await chrome.storage.local.set({ installSeed: newSeed });

        // Show welcome notification only on first install
        chrome.notifications.create({
            type: 'basic',
            title: 'Thanus Privacy Gauntlet',
            message: 'Welcome to Cookie Manager! Click the extension icon to get started.',
            iconUrl: ASSETS.icons.icon128
        });
    } else if (details.reason === 'update') {
        try {
            const result = await chrome.storage.local.get(['adblockSettings']);
            const settings = result.adblockSettings || {};
            const enabledSources = settings.enabledSources || [];
            if (enabledSources.length > 0) {
                await chrome.declarativeNetRequest.updateEnabledRulesets({
                    enableRulesetIds: enabledSources
                });
                console.log('[AdBlock] Đã khôi phục rulesets:', enabledSources);
            }
        } catch (e) {
            console.error('[AdBlock] Lỗi khôi phục rulesets:', e);
        }
    }

    // Apply sidePanel behavior from settings
    try {
        const settingsResult = await chrome.storage.local.get(['appSettings']);
        const appSettings = settingsResult.appSettings || {};
        chrome.sidePanel.setPanelBehavior({
            openPanelOnActionClick: appSettings.useSidePanel || false
        }).catch(e => console.error('[SidePanel]', e));
    } catch (e) {
        console.error('[SidePanel] Failed to set panel behavior:', e);
    }

    createAllContextMenus();

    try {
        const result = await chrome.storage.local.get(['appSettings']);
        if (!result.appSettings) {
            await chrome.storage.local.set({ appSettings: DEFAULT_SETTINGS });
            console.log('Initialized default app settings on install');
        }
    } catch (e) {
        console.error('Error initializing default settings:', e);
    }
    await updateSecurityRules();
});

function cleanupStaleStorage() {
    chrome.storage.local.get(['stealthHistory', 'tabUrlMapping'], (res) => {
        let history = res.stealthHistory || [];
        if (history.length > 100) {
            history = history.slice(-100);
            chrome.storage.local.set({ stealthHistory: history });
        }
        // Cleanup mapping for tabs that are no longer open
        if (res.tabUrlMapping) {
            chrome.tabs.query({}, (tabs) => {
                const activeTabIds = new Set(tabs.map(t => t.id));
                const mapping = res.tabUrlMapping;
                let changed = false;
                for (const tId of Object.keys(mapping)) {
                    if (!activeTabIds.has(Number(tId))) {
                        delete mapping[tId];
                        changed = true;
                    }
                }
                if (changed) {
                    chrome.storage.local.set({ tabUrlMapping: mapping });
                }
            });
        }
    });
}

chrome.runtime.onStartup.addListener(() => {
    createAllContextMenus();
    cleanupStaleStorage();
});

// NOTE: GET_TOP_LEVEL_DOMAIN message handling is consolidated in message-handler.js


/**
 * Sync context menus when storage changes (e.g., sessions updated in popup)
 */
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.appSettings) {
        const oldValue = changes.appSettings.oldValue || {};
        const newValue = changes.appSettings.newValue || {};

        const oldSessions = oldValue.savedSessions || [];
        const newSessions = newValue.savedSessions || [];
        // Only recreate menus if sessions list actually changed
        if (oldSessions.length !== newSessions.length || JSON.stringify(oldSessions) !== JSON.stringify(newSessions)) {
            createAllContextMenus();
        }

        // Sync local variables and alarms
        videoDetectionEnabled = newValue.videoDownloaderEnabled || false;
        hibernationEnabled = newValue.hibernationEnabled || false;
        hibernationTimeout = newValue.hibernationTimeout || 30;

        if (newValue.hibernationEnabled !== oldValue.hibernationEnabled ||
            newValue.hibernationTimeout !== oldValue.hibernationTimeout) {
            updateHibernationAlarm(newValue.hibernationEnabled || false, newValue.hibernationTimeout || 30);
        }

        // Update cached adblock state in globals.js to avoid per-badge storage reads
        _updateAdblockCache(newValue);

        // Dynamic rule update on settings change
        updateSecurityRules();
    }

});

/**
 * Context Menu Click Handler
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    // Handle session saving commands
    if (info.menuItemId.startsWith("save")) {
        const mode = info.menuItemId;
        const allTabs = await chrome.tabs.query({});
        let tabsToSave = [];

        if (mode === "saveAllTabs") {
            tabsToSave = allTabs;
        } else if (mode === "saveNormalTabs") {
            tabsToSave = allTabs.filter(t => !t.incognito);
        } else if (mode === "saveIncognitoTabs") {
            tabsToSave = allTabs.filter(t => t.incognito);
        } else if (mode === "saveCurrentTab") {
            tabsToSave = [tab];
        }

        if (tabsToSave.length === 0) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: ASSETS.icons.icon128,
                title: 'Session Manager',
                message: 'No suitable tabs found to save.'
            });
            return;
        }

        const timestamp = new Date().toLocaleString();
        const sessionName = `Quick Session (${timestamp})`;

        const sessionData = {
            id: Date.now(),
            name: sessionName,
            date: new Date().toISOString(),
            tabType: mode.replace("save", "").toLowerCase(),
            tabs: tabsToSave.map(t => ({
                url: t.url,
                title: t.title,
                incognito: t.incognito
            }))
        };

        await updateAppSettingsBackground(currentSettings => {
            const settings = currentSettings ? { ...DEFAULT_SETTINGS, ...currentSettings } : { ...DEFAULT_SETTINGS };
            const sessions = Array.isArray(settings.savedSessions) ? [...settings.savedSessions] : [];
            sessions.unshift(sessionData);
            return { ...settings, savedSessions: sessions };
        });

        chrome.notifications.create({
            type: 'basic',
            iconUrl: ASSETS.icons.icon128,
            title: 'Session Manager',
            message: `Saved session "${sessionName}" with ${tabsToSave.length} tabs.`
        });
    }
    // Handle session restoration commands
    else if (info.menuItemId.startsWith("restoreSession_")) {
        const sessionIdStr = info.menuItemId.substring("restoreSession_".length);
        const result = await chrome.storage.local.get(['appSettings']);
        const settings = result.appSettings ? { ...DEFAULT_SETTINGS, ...result.appSettings } : DEFAULT_SETTINGS;
        const sessions = settings.savedSessions || [];
        const session = sessions.find(s => String(s.id) === sessionIdStr);

        if (session) {
            // Group tabs by incognito status to open in correct window types
            const normalTabs = session.tabs.filter(t => !t.incognito);
            const incognitoTabs = session.tabs.filter(t => t.incognito);

            if (normalTabs.length > 0) {
                try {
                    chrome.windows.create({
                        url: normalTabs.map(t => t.url),
                        incognito: false
                    });
                } catch (error) {
                    console.error("Error creating normal window:", error);
                }
            }

            if (incognitoTabs.length > 0) {
                chrome.extension.isAllowedIncognitoAccess(async (isAllowed) => {
                    if (isAllowed) {
                        try {
                            chrome.windows.create({
                                url: incognitoTabs.map(t => t.url),
                                incognito: true
                            });
                        } catch (error) {
                            console.error("Error creating incognito window:", error);
                        }
                    } else {
                        // Fallback to normal window if incognito access not granted
                        try {
                            chrome.windows.create({
                                url: incognitoTabs.map(t => t.url),
                                incognito: false
                            });
                        } catch (error) {
                            console.error("Error creating fallback normal window:", error);
                        }
                    }
                });
            }
        }
    }
    // Handle toggle floating tab bar
    else if (info.menuItemId === "toggleFloatingTabBar") {
        if (tab && tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_FLOATING_TAB_BAR' }).catch(() => {
                // Fallback: inject if not injected
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['modules/floating-tab-bar.js']
                }).catch(() => {});
            });
        }
    }
    // Handle Quick Panic and Vault additions
    else if (info.menuItemId === "quickPanic") {
        executePanic();
    } else if (info.menuItemId === "addToVault") {
        const item = {
            id: Date.now(),
            title: tab.title || "No Title",
            url: info.linkUrl || info.pageUrl,
            date: new Date().toISOString()
        };

        atomicUpdateStorageBackground('privacyVault', (currentVault = []) => {
            const vault = Array.isArray(currentVault) ? [...currentVault] : [];
            vault.push(item);
            return vault;
        }).then(() => {
            syncVaultToCloud();
            chrome.notifications.create({
                type: 'basic',
                title: 'Privacy Vault',
                message: `Đã thêm "${item.title.substring(0, 20)}..." vào két sắt bí mật!`,
                iconUrl: ASSETS.icons.icon128
            });
        });
    } else if (info.menuItemId === "addToFavorites") {
        const favoriteItem = {
            name: tab.title || "Website",
            url: info.linkUrl || info.pageUrl
        };
        let wasAdded = false;
        updateAppSettingsBackground(currentSettings => {
            const settings = currentSettings ? { ...DEFAULT_SETTINGS, ...currentSettings } : { ...DEFAULT_SETTINGS };
            const favorites = Array.isArray(settings.favoriteWebsites) ? [...settings.favoriteWebsites] : [];
            const exists = favorites.some(f => f.url === favoriteItem.url);
            if (!exists) {
                favorites.push(favoriteItem);
                wasAdded = true;
            }
            return { ...settings, favoriteWebsites: favorites };
        }).then(() => {
            chrome.notifications.create({
                type: 'basic',
                title: 'Favorite Websites',
                message: wasAdded 
                    ? `Đã thêm "${favoriteItem.name}" vào danh sách yêu thích!`
                    : `Trang này đã có trong danh sách yêu thích!`,
                iconUrl: ASSETS.icons.icon128
            });
        });
    } else if (info.menuItemId === "quickSaveSession") {
        executeQuickSaveSession();
    } else if (info.menuItemId === "add-to-zen-mode") {
        const domain = safeGetDomain(tab.url);
        if (!domain) return;
        let isAlreadyBlocked = false;
        atomicUpdateStorageBackground('zenCustomUrls', (currentUrls) => {
            let urls = Array.isArray(currentUrls) && currentUrls.length > 0
                ? [...currentUrls]
                : ['facebook.com', 'tiktok.com', 'youtube.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'netflix.com'];
            if (!urls.includes(domain)) {
                urls.push(domain);
                isAlreadyBlocked = false;
            } else {
                isAlreadyBlocked = true;
            }
            return urls;
        }).then(() => {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: ASSETS.icons.default,
                title: 'Zen Mode',
                message: isAlreadyBlocked
                    ? `${domain} is already blocked in Zen Mode.`
                    : `Added ${domain} to Zen Mode blocklist!`
            });
        });
    }
});

