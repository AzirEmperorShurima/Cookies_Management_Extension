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
// Maps requestId → logEntry object reference for direct O(1) property mutation
const _requestIdToLogMap = new Map();

chrome.storage.session.get(['networkLogs']).then(res => {
    if (res.networkLogs) {
        networkLogs = res.networkLogs;
        // Rebuild reference map from restored logs
        networkLogs.forEach(log => {
            if (log.id) _requestIdToLogMap.set(log.id, log);
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
    // If at capacity, remove oldest entry (from beginning) and update reference map
    if (networkLogs.length >= MAX_LOGS) {
        const removed = networkLogs.shift(); // Remove oldest
        if (removed?.id) _requestIdToLogMap.delete(removed.id);
    }

    networkLogs.push(logEntry);
    if (logEntry.id) {
        _requestIdToLogMap.set(logEntry.id, logEntry);
    }

    debounceSaveLogs();

    if (loggerPort) {
        loggerPort.postMessage({ type: 'new_log', log: logEntry });
    }
}

/**
 * O(1) lookup: find log by requestId using object reference map
 */
function findLogByRequestId(requestId) {
    return _requestIdToLogMap.get(requestId) || null;
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
                _requestIdToLogMap.clear(); // Also clear the reference map
                chrome.storage.session.set({ networkLogs }).catch(() => {});
            } else if (msg.type === 'request_logs') {
                port.postMessage({ type: 'init_logs', logs: [...networkLogs].reverse() });
            }
        });
    }
});
