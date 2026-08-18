// Background Service Worker Entry Point
// Load order matters: globals first, then state, then all feature modules
importScripts('modules/vendor/tldts.min.js');
importScripts('email.min.js');
importScripts('background/globals.js');   // Single source of truth: ASSETS, DEFAULT_SETTINGS, safeGetDomain, updateTabBadge
importScripts('background/state.js');     // In-memory state: trackerCount, trackerList, detectedVideos, etc.
importScripts('background/context-menu.js'); // Context menus + onInstalled + onStartup + onMessage(GET_TOP_LEVEL_DOMAIN)
importScripts('background/init.js');      // Load settings from storage on startup
importScripts('background/media-detector.js'); // webRequest listeners for video/tracker detection
importScripts('background/tab-manager.js');    // Tab lifecycle: onUpdated, onRemoved, onActivated, alarms
importScripts('background/message-handler.js'); // Central message dispatcher
importScripts('background/session-vault.js');  // Panic, SessionManager, Vault encryption helpers
importScripts('background/security-rules.js'); // DNR rules, daily stats, onRuleMatchedDebug
importScripts('background/cookie-destroyer.js'); // Zen Mode context menu item only (ephemeral logic moved to tab-manager)
importScripts('background/network-logger.js'); // Network logging via port
importScripts('background/network-shield.js'); // Proxy management
