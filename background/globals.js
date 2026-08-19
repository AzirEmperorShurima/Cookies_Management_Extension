/**
 * globals.js — Single source of truth for shared utilities and constants.
 * 
 * Contains:
 * - safeGetDomain(): URL → domain extraction with tldts support
 * - updateTabBadge(): Updates extension icon badge (uses cached adblock state)
 * - ASSETS: Icon/image paths
 * - DEFAULT_SETTINGS: Complete default settings object
 * - _cachedAdblockEnabled: Cached flag to avoid per-badge storage reads
 */

// ─── Cached adblock state — avoids storage.local.get on every badge update ───
// Updated by context-menu.js storage.onChanged listener when settings change
let _cachedAdblockEnabled = true;  // Default: enabled
let _cachedAdblockSources = [];     // Cached enabledSources array

// Load initial adblock state into cache
chrome.storage.local.get(['appSettings', 'adblockSettings']).then(result => {
    const appSettings = result.appSettings || {};
    const adblockSettings = result.adblockSettings || {};
    _cachedAdblockEnabled = appSettings.adblockEnabled !== false;
    _cachedAdblockSources = adblockSettings.enabledSources || [];
}).catch(() => {});

// Update cache when settings change (called from context-menu.js onChanged)
function _updateAdblockCache(newAppSettings, newAdblockSources) {
    if (newAppSettings !== undefined) {
        _cachedAdblockEnabled = newAppSettings.adblockEnabled !== false;
    }
    if (newAdblockSources !== undefined) {
        _cachedAdblockSources = newAdblockSources;
    }
}

// ─── Domain Helper ────────────────────────────────────────────────────────────
function safeGetDomain(urlOrHostname) {
    if (!urlOrHostname) return '';
    try {
        if (self.tldts && self.tldts.parse) {
            const parsed = self.tldts.parse(urlOrHostname);
            return parsed.domain || parsed.hostname || urlOrHostname;
        }
        const hostname = urlOrHostname.includes('://') ? new URL(urlOrHostname).hostname : urlOrHostname;
        return hostname.replace(/^www\./, '');
    } catch (e) {
        return '';
    }
}

// ─── Badge Updater ────────────────────────────────────────────────────────────
// OPTIMIZED: Uses cached adblock state instead of storage.local.get per call
function updateTabBadge(tabId) {
    const videosCount = detectedVideos[tabId] ? detectedVideos[tabId].length : 0;
    if (videosCount > 0) {
        chrome.action.setBadgeText({ text: videosCount.toString(), tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#e53e3e', tabId });
        return;
    }

    // Use cached value — no async storage read needed
    if (_cachedAdblockEnabled && _cachedAdblockSources.length > 0) {
        chrome.action.setBadgeText({ text: 'ON', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#38a169', tabId });
    } else {
        chrome.action.setBadgeText({ text: '', tabId });
    }
}

// ─── Assets ───────────────────────────────────────────────────────────────────
const ASSETS = {
    icons: {
        default: "icons/icon48.png",
        icon128: "icons/icon128.png",
        extension: "icons/extension.png",
        extensionDefault: "icons/extension-default.png",
        dev: "icons/dev.png",
        store: "icons/store.png",
        admin: "icons/admin.png",
        other: "icons/other.png",
        aboutUs: "icons/about-us.png",
        skincell: "icons/skincell.png",
        trackingProtection: "icons/tracking_protection.png",
        copy: "icons/copy.png",
        clear: "icons/clear.png"
    },
    images: {
        defaultBg: "images/anh-phong-canh-66-1.jpg"
    }
};

// ─── Default Settings — Complete definition ───────────────────────────────────
// This is the SINGLE source of truth. Do NOT duplicate in constants.js or elsewhere.
const DEFAULT_SETTINGS = {
    darkMode: false,
    autoClearStealth: true,
    showNotifications: true,
    cookieDestroyer: false,
    historyIncognito: false,
    defaultPlayerWidth: 100,
    defaultPlayerHeight: 400,
    followDefaultPlayerSize: true,
    searchEngine: 'google',
    favoriteWebsites: [],
    useSidePanel: false,
    realTimeProtection: true,
    blockClickjacking: true,
    blockCryptoMining: true,
    enableSecurityHeaders: true,
    historyDestroyer: false,
    stealthDestroyer: true,
    clearSiteData: false,
    protectionLevel: 'standard',
    safeSearch: false,
    blockWebRTC: false,
    autoCloseEmptyTabs: true,
    language: 'vi',
    playerBackgroundType: 'default',
    playerBgDisplayMode: 'cover',
    playerLinkBehavior: 'inside',
    playerLinkFilter: 'all',
    customBgUrl: '',
    customBgList: [],
    bgPreviewHeight: 500,
    bgPreviewWidth: '100%',
    panicAction: 'closeIncognito',
    safeRedirectUrl: 'https://www.google.com',
    savedSessions: [],
    telegramDownloaderEnabled: false,
    videoDownloaderEnabled: false,
    multiAccountEnabled: false,
    accountContainers: [],
    hibernationEnabled: false,
    hibernationTimeout: 30,
    whitelist: ['google.com', 'facebook.com', 'gmail.com', 'youtube.com', 'github.com'],
    alwaysRequirePassword: true,
    vaultSyncEnabled: false,
    masterSyncKey: null,
    linkClickBehavior: 'inside',
    appliedLinkType: 'all',
    antiTabunderEnabled: true,
    googleSafeSearch: 'active',
    safeUrls: [],
    requireStrongPassword: false,
    showPasswordInSettings: true,
    playerIsolatedIdentity: true,
    adblockEnabled: true,
    easylistEnabled: true,
    sponsorBlockEnabled: true,
    autoDismissCookieConsent: true,
    customAdblockRules: '',
    customAdblockCssRules: '',
    syncEnabled: false,
    syncBackend: 'chrome'
};
