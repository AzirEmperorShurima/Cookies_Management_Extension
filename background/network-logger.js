/**
 * Network Logger (Nhật ký mạng)
 */
let networkLogs = [];
const MAX_LOGS = 1000;
let loggerPort = null;
let pendingLogSave = null;

chrome.storage.session.get(['networkLogs']).then(res => {
    if (res.networkLogs) networkLogs = res.networkLogs;
});

function debounceSaveLogs() {
    if (pendingLogSave) return;
    pendingLogSave = setTimeout(() => {
        chrome.storage.session.set({ networkLogs });
        pendingLogSave = null;
    }, 2000); // 2 giây cập nhật 1 lần thay vì mỗi request
}

function addNetworkLog(logEntry) {
    networkLogs.unshift(logEntry);
    if (networkLogs.length > MAX_LOGS) {
        networkLogs.pop();
    }
    
    debounceSaveLogs();

    if (loggerPort) {
        loggerPort.postMessage({ type: 'new_log', log: logEntry });
    }
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
        const log = networkLogs.find(l => l.id === details.requestId);
        if (log && log.status === 'pending') {
            log.status = 'allowed';
            if (loggerPort) loggerPort.postMessage({ type: 'update_log', log });
        }
    },
    { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
        const log = networkLogs.find(l => l.id === details.requestId);
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
        const log = networkLogs.find(l => l.id === info.request.requestId);
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
        port.postMessage({ type: 'init_logs', logs: networkLogs });
        port.onDisconnect.addListener(() => {
            loggerPort = null;
        });
        
        port.onMessage.addListener((msg) => {
            if (msg.type === 'clear_logs') {
                networkLogs = [];
                chrome.storage.session.set({ networkLogs });
            } else if (msg.type === 'request_logs') {
                port.postMessage({ type: 'init_logs', logs: networkLogs });
            }
        });
    }
});
