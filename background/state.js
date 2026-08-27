/**
 * State Management
 * These variables track tab-specific data in memory for performance.
 * 
 * OPTIMIZED (Phase 3.1, 3.2, 3.5):
 * - trackerList: capped at MAX_TRACKERS_PER_TAB (200) per tab
 * - detectedVideos: capped at MAX_VIDEOS_PER_TAB (50) per tab
 * - session storage: only saves essential data (counts + urls, not full tracker details)
 *   to reduce QUOTA_EXCEEDED risk
 * - QUOTA_EXCEEDED error handling added
 */

// ─── Per-tab Limits ───────────────────────────────────────────────────────────
const MAX_TRACKERS_PER_TAB = 200;
const MAX_VIDEOS_PER_TAB = 50;

// ─── In-memory State ──────────────────────────────────────────────────────────
let trackerCount = {};      // Tracker counts per tab { tabId: number }
let trackerList = {};       // Detailed tracker lists per tab { tabId: [{domain, count, firstSeen, lastSeen}] }
let detectedVideos = {};    // Detected videos per tab { tabId: [videoData] }
let videoDetectionEnabled = false;

/**
 * Hibernation & Cleanup State
 */
let hibernationEnabled = false;
let hibernationTimeout = 30; // In minutes
let tabLastActive = {};      // tabId → last active timestamp
let tabUrls = {};            // tabId → current URL (used for auto-cleanup on close)

// Restore state from session storage on startup to prevent MV3 state loss
let isStateLoaded = false;
const stateReadyPromise = chrome.storage.session.get(['trackerCount', 'detectedVideos', 'tabLastActive', 'tabUrls']).then((result) => {
    // Note: trackerList not restored from session (large payload) — it resets per SW restart
    // trackerCount + tabUrls are the essential state
    trackerCount = { ...trackerCount, ...(result.trackerCount || {}) };
    detectedVideos = { ...detectedVideos, ...(result.detectedVideos || {}) };
    tabLastActive = { ...tabLastActive, ...(result.tabLastActive || {}) };
    tabUrls = { ...tabUrls, ...(result.tabUrls || {}) };
    isStateLoaded = true;
}).catch(err => {
    console.error('Error loading session state:', err);
    isStateLoaded = true;
});

let pendingSessionSave = null;

/**
 * Phase 3.5: Safe session state save with QUOTA_EXCEEDED handling.
 * Preserves full video URLs without truncation.
 */
function saveStateToSession(immediate = false) {
    const doSave = async () => {
        pendingSessionSave = null;
        if (!isStateLoaded && stateReadyPromise) {
            try { await stateReadyPromise; } catch (e) {}
        }
        const essentialState = {
            trackerCount,
            tabLastActive,
            tabUrls,
            detectedVideos: Object.fromEntries(
                Object.entries(detectedVideos).map(([tabId, videos]) => [
                    tabId,
                    videos.slice(0, MAX_VIDEOS_PER_TAB)
                ])
            )
        };

        chrome.storage.session.set(essentialState).catch(err => {
            if (err?.message?.includes('QUOTA_BYTES')) {
                console.warn('[State] Session storage quota exceeded, saving minimal state');
                chrome.storage.session.set({ trackerCount, tabLastActive, tabUrls }).catch(() => {});
            } else {
                console.error('Error saving state to session:', err);
            }
        });
    };

    if (immediate) {
        if (pendingSessionSave) {
            clearTimeout(pendingSessionSave);
            pendingSessionSave = null;
        }
        doSave();
        return;
    }

    if (pendingSessionSave) return;
    pendingSessionSave = setTimeout(doSave, 400);
}

/**
 * Phase 3.1: Add a tracker entry with enforced per-tab limit.
 * Used by media-detector.js instead of direct array push.
 */
function addTrackerEntry(tabId, domain) {
    if (!trackerList[tabId]) trackerList[tabId] = [];

    const existing = trackerList[tabId].find(t => t.domain === domain);
    if (existing) {
        existing.count++;
        existing.lastSeen = Date.now();
    } else {
        // Enforce cap: remove oldest if at limit
        if (trackerList[tabId].length >= MAX_TRACKERS_PER_TAB) {
            trackerList[tabId].shift(); // Remove oldest entry
        }
        trackerList[tabId].push({
            domain,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            count: 1
        });
    }

    trackerCount[tabId] = (trackerCount[tabId] || 0) + 1;
}
