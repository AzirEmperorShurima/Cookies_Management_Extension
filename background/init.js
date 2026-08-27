/**
 * Initialize extension state from storage
 */
// Initialize app settings and ensure installSeed exists
chrome.storage.local.get(['appSettings', 'installSeed', 'networkShieldSettings']).then((result) => {
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
});

// Dynamic Tracker Domains Pool (có khả năng tự mở rộng qua storage)
let TRACKER_DOMAINS = [
    'google-analytics.com', 'doubleclick.net', 'facebook.net', 'googlesyndication.com',
    'adnxs.com', 'quantserve.com', 'scorecardresearch.com', 'amazon-adsystem.com',
    'casalemedia.com', 'criteo.com', 'rubiconproject.com', 'pubmatic.com',
    'hotjar.com', 'clarity.ms', 'segment.io'
];

chrome.storage.local.get(['customTrackerDomains']).then((res) => {
    if (Array.isArray(res.customTrackerDomains)) {
        TRACKER_DOMAINS = Array.from(new Set([...TRACKER_DOMAINS, ...res.customTrackerDomains]));
    }
}).catch(() => {});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.customTrackerDomains) {
        if (Array.isArray(changes.customTrackerDomains.newValue)) {
            TRACKER_DOMAINS = Array.from(new Set([...TRACKER_DOMAINS, ...changes.customTrackerDomains.newValue]));
        }
    }
});

// Video file extensions and patterns to monitor
const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv', 'm3u8', 'ts', 'mpd', 'm4v', '3gp', 'ogv', 'm4s'];
const TELEGRAM_STREAM_PATTERN = [
    'https://web.telegram.org/stream/*',
    'https://webk.telegram.org/stream/*',
    'https://webz.telegram.org/stream/*'
];

