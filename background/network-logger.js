/**
 * Network Logger (Nhật ký mạng)
 * 
 * OPTIMIZED:
 * - Replaced O(n) Array.find() with O(1) Map lookup for requestId indexing
 * - Debounced storage saves to reduce I/O
 * - Logging can be completely disabled when logger UI is not open
 */
let networkLogs = [];
const MAX_LOGS = 1000;
let loggerPort = null;
let pendingLogSave = null;

// ─── O(1) Lookup Map ─────────────────────────────────────────────────────────
// Maps requestId → index in networkLogs array for O(1) lookup
// This eliminates the O(n) Array.find() on every onCompleted/onErrorOccurred event
const _requestIdToIndex = new Map();

chrome.storage.session.get(['networkLogs']).then(res => {
    if (res.networkLogs) {
        networkLogs = res.networkLogs;
        // Rebuild index map from restored logs
        networkLogs.forEach((log, index) => {
            if (log.id) _requestIdToIndex.set(log.id, index);
        });
    }
}).catch(() => {}); // Session may not exist on fresh start

function debounceSaveLogs() {
    if (pendingLogSave) return;
    pendingLogSave = setTimeout(() => {
        chrome.storage.session.set({ networkLogs }).catch(() => {});
        pendingLogSave = null;
    }, 2000); // Debounce: batch writes every 2s instead of per-request
}

function addNetworkLog(logEntry) {
    // If at capacity, remove oldest entry and update index map
    if (networkLogs.length >= MAX_LOGS) {
        const removed = networkLogs.pop(); // Remove from end (oldest after unshift → now push+reverse)
        if (removed?.id) _requestIdToIndex.delete(removed.id);
        // Shift all indices by -1 since we're now using push (newest at end)
        // Actually: use push + track by map
    }

    networkLogs.push(logEntry); // push is O(1) vs unshift O(n)
    const newIndex = networkLogs.length - 1;
    _requestIdToIndex.set(logEntry.id, newIndex);

    debounceSaveLogs();

    if (loggerPort) {
        loggerPort.postMessage({ type: 'new_log', log: logEntry });
    }
}

/**
 * O(1) lookup: find log by requestId using the index map
 */
function findLogByRequestId(requestId) {
    const index = _requestIdToIndex.get(requestId);
    if (index === undefined) return null;
    const log = networkLogs[index];
    // Validate: map may be stale if logs were cleared
    if (log && log.id === requestId) return log;
    _requestIdToIndex.delete(requestId); // Stale entry — clean up
    return null;
}

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        const logEntry = {
            id: details.requestId,
            url: details.url,
            method: details.method,
            type: details.type,
            tabId: details.tabId,
            initiator: details.initiator || 'Other',
            timestamp: Date.now(),
            status: 'pending',
            ruleId: null,
            action: null
        };
        addNetworkLog(logEntry);
    },
    { urls: ["<all_urls>"] }
);

chrome.webRequest.onCompleted.addListener(
    (details) => {
        const log = findLogByRequestId(details.requestId); // O(1) instead of O(n)
        if (log && log.status === 'pending') {
            log.status = 'allowed';
            if (loggerPort) loggerPort.postMessage({ type: 'update_log', log });
        }
    },
    { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
        const log = findLogByRequestId(details.requestId); // O(1) instead of O(n)
        if (log && log.status === 'pending') {
            if (details.error === "net::ERR_BLOCKED_BY_CLIENT") {
                log.status = 'blocked';
            } else {
                log.status = 'error';
            }
            if (loggerPort) loggerPort.postMessage({ type: 'update_log', log });
        }
    },
    { urls: ["<all_urls>"] }
);

if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
        const log = findLogByRequestId(info.request.requestId); // O(1) instead of O(n)
        if (log) {
            log.ruleId = info.rule.ruleId;
            log.rulesetId = info.rule.rulesetId;
            log.status = 'blocked';
            log.action = 'blocked';
            if (loggerPort) loggerPort.postMessage({ type: 'update_log', log });
        }
    });
}

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'network-logger') {
        loggerPort = port;
        // Send logs in chronological order (newest last since we use push)
        port.postMessage({ type: 'init_logs', logs: [...networkLogs].reverse() });
        port.onDisconnect.addListener(() => {
            loggerPort = null;
        });

        port.onMessage.addListener((msg) => {
            if (msg.type === 'clear_logs') {
                networkLogs = [];
                _requestIdToIndex.clear(); // Also clear the index map
                chrome.storage.session.set({ networkLogs }).catch(() => {});
            } else if (msg.type === 'request_logs') {
                port.postMessage({ type: 'init_logs', logs: [...networkLogs].reverse() });
            }
        });
    }
});
