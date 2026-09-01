/**
 * Initialize extension state from storage
 */
// Dynamic Tracker Domains Pool (initialized from constants.js, auto-expanded via storage)
let TRACKER_DOMAINS = (typeof DEFAULT_TRACKER_DOMAINS !== 'undefined')
    ? [...DEFAULT_TRACKER_DOMAINS]
    : [
        'google-analytics.com', 'doubleclick.net', 'facebook.net', 'googlesyndication.com',
        'adnxs.com', 'quantserve.com', 'scorecardresearch.com', 'amazon-adsystem.com',
        'casalemedia.com', 'criteo.com', 'rubiconproject.com', 'pubmatic.com',
        'hotjar.com', 'clarity.ms', 'segment.io'
    ];
let TRACKER_DOMAINS_SET = new Set(TRACKER_DOMAINS);

function isTrackerDomain(hostname) {
    if (!hostname) return false;
    const lower = hostname.toLowerCase();
    if (TRACKER_DOMAINS_SET.has(lower)) return true;
    for (const d of TRACKER_DOMAINS) {
        if (lower.endsWith('.' + d) || lower === d) return true;
    }
    return false;
}

// Initialize app settings, ensure installSeed exists, and load custom trackers
const initReadyPromise = Promise.all([
    chrome.storage.local.get(['appSettings', 'installSeed', 'networkShieldSettings', 'customTrackerDomains']),
    typeof globalsReadyPromise !== 'undefined' ? globalsReadyPromise : Promise.resolve()
]).then(([result]) => {
    const settings = result.appSettings ? { ...DEFAULT_SETTINGS, ...result.appSettings } : DEFAULT_SETTINGS;
    videoDetectionEnabled = settings.videoDownloaderEnabled || false;
    hibernationEnabled = settings.hibernationEnabled || false;
    hibernationTimeout = settings.hibernationTimeout || 30;
    updateHibernationAlarm(hibernationEnabled, hibernationTimeout);

    // Synchronize WebRTC Protection Policy on startup
    if (result.networkShieldSettings?.webrtcProtected) {
        if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
            chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: 'disable_non_proxied_udp' }, () => {
                console.log('[Background Init] WebRTC Protection activated.');
            });
        }
    }

    if (!result.installSeed) {
        const newSeed = crypto.getRandomValues(new Uint32Array(4)).join('-');
        chrome.storage.local.set({ installSeed: newSeed });
    }

    if (Array.isArray(result.customTrackerDomains)) {
        TRACKER_DOMAINS = Array.from(new Set([...TRACKER_DOMAINS, ...result.customTrackerDomains]));
        TRACKER_DOMAINS_SET = new Set(TRACKER_DOMAINS);
    }
}).catch(err => {
    console.error('[Background Init] Initialization error:', err);
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.customTrackerDomains) {
        if (Array.isArray(changes.customTrackerDomains.newValue)) {
            TRACKER_DOMAINS = Array.from(new Set([...TRACKER_DOMAINS, ...changes.customTrackerDomains.newValue]));
            TRACKER_DOMAINS_SET = new Set(TRACKER_DOMAINS);
        }
    }
});

// Video file extensions and patterns (sourced centrally from background/constants.js)
if (typeof VIDEO_EXTENSIONS === 'undefined') {
    self.VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv', 'm3u8', 'ts', 'mpd', 'm4v', '3gp', 'ogv', 'm4s'];
}
if (typeof TELEGRAM_STREAM_PATTERN === 'undefined') {
    self.TELEGRAM_STREAM_PATTERN = [
        'https://web.telegram.org/stream/*',
        'https://webk.telegram.org/stream/*',
        'https://webz.telegram.org/stream/*'
    ];
}

