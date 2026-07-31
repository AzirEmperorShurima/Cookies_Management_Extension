// Proxy State
let proxyList = [];
let currentProxyIndex = 0;
let isAutoRotate = false;
let currentAuth = null;
let testAbortController = null;
let failedAttempts = 0;
let isTestingProxy = false;

function sendLog(message, type = 'info') {
    chrome.runtime.sendMessage({ type: 'PROXY_LOG', message, logType: type }).catch(() => {});
}

function sendStatus(connected) {
    chrome.runtime.sendMessage({ type: 'PROXY_STATUS', connected }).catch(() => {});
}

async function testProxy() {
    sendLog('Testing connection...', 'info');
    if (testAbortController) testAbortController.abort();
    testAbortController = new AbortController();
    
    try {
        const response = await fetch("http://ip-api.com/json/", { 
            signal: testAbortController.signal,
            cache: 'no-store'
        });
        
        if (!response.ok) throw new Error('Bad response status');
        const data = await response.json();
        
        sendLog(`[SUCCESS] Connected to ${data.country} (${data.query})`, 'success');
        sendStatus(true);
        return true;
    } catch (e) {
        if (e.name === 'AbortError') return false;
        sendLog(`[FAILED] Connection failed: ${e.message}`, 'error');
        return false;
    }
}

async function applyProxy(proxyConfig) {
    if (!chrome.proxy) {
        sendLog('[ERROR] Proxy API not available.', 'error');
        return false;
    }

    const config = {
        mode: "fixed_servers",
        rules: {
            singleProxy: {
                scheme: proxyConfig.scheme,
                host: proxyConfig.host,
                port: proxyConfig.port
            },
            bypassList: ["localhost", "127.0.0.1"]
        }
    };
    
    // Update credentials for onAuthRequired
    currentAuth = null;
    if (proxyConfig.username) {
        currentAuth = { username: proxyConfig.username, password: proxyConfig.password };
    }

    return new Promise((resolve) => {
        chrome.proxy.settings.set({ value: config, scope: 'regular' }, async () => {
            sendLog(`Applied proxy: ${proxyConfig.host}:${proxyConfig.port}`, 'info');
            const isAlive = await testProxy();
            resolve(isAlive);
        });
    });
}

async function switchProxy() {
    if (proxyList.length === 0) return;
    
    isTestingProxy = true;
    const proxy = proxyList[currentProxyIndex];
    sendLog(`---------------------------------`, 'info');
    sendLog(`Switching to [${currentProxyIndex + 1}/${proxyList.length}] ${proxy.host}:${proxy.port}`, 'info');
    
    const isAlive = await applyProxy(proxy);
    
    if (!isAlive) {
        sendLog('Proxy dead. Trying next proxy...', 'warning');
        rotateToNext(true);
    } else {
        failedAttempts = 0;
        isTestingProxy = false;
    }
}

function rotateToNext(isFailure = false) {
    if (proxyList.length <= 1 && isFailure) {
        sendLog('[ERROR] Only 1 proxy available and it failed. Stopping.', 'error');
        stopProxy();
        return;
    }
    
    if (isFailure) {
        failedAttempts++;
        if (failedAttempts >= proxyList.length) {
            sendLog('[ERROR] All proxies failed. Stopping proxy.', 'error');
            stopProxy();
            return;
        }
    } else {
        failedAttempts = 0;
    }

    currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
    switchProxy();
}

function stopProxy() {
    if (chrome.proxy) {
        chrome.proxy.settings.clear({}, () => {
            sendLog('Proxy cleared and disconnected.', 'warning');
            sendStatus(false);
            chrome.alarms.clear('rotateProxyAlarm');
            proxyList = [];
            currentAuth = null;
            failedAttempts = 0;
            isTestingProxy = false;
        });
    }
}

// Handle Auth Request using webRequestAuthProvider
chrome.webRequest.onAuthRequired.addListener(
    function(details) {
        if (details.isProxy && currentAuth) {
            sendLog(`Authenticating proxy with user: ${currentAuth.username}`, 'info');
            return {
                authCredentials: {
                    username: currentAuth.username,
                    password: currentAuth.password
                }
            };
        }
        return { cancel: false };
    },
    { urls: ["<all_urls>"] },
    ["asyncBlocking"] // Use asyncBlocking for Manifest V3 webRequestAuthProvider
);

// Handle Messages from UI
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'START_PROXY') {
        proxyList = request.proxies;
        isAutoRotate = request.autoRotate;
        currentProxyIndex = 0;
        failedAttempts = 0;
        isTestingProxy = false;
        
        chrome.alarms.clear('rotateProxyAlarm');
        if (isAutoRotate && proxyList.length > 1) {
            chrome.alarms.create('rotateProxyAlarm', { periodInMinutes: request.rotateInterval });
            sendLog(`Auto rotate enabled: ${request.rotateInterval} minutes`, 'info');
        }
        
        switchProxy();
    } else if (request.type === 'STOP_PROXY') {
        stopProxy();
    }
});

// Handle Alarms for Auto Rotate
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'rotateProxyAlarm') {
        sendLog('[ALARM] Rotating proxy based on timer...', 'info');
        rotateToNext();
    }
});

// Monitor proxy connection errors in real-time
chrome.webRequest.onErrorOccurred.addListener(
    function(details) {
        if (proxyList.length > 0 && !isTestingProxy && details.error.includes("PROXY")) {
            sendLog(`[ERROR] Network error: ${details.error}. Auto-evaluating proxy...`, 'warning');
            isTestingProxy = true;
            rotateToNext(true);
        }
    },
    { urls: ["<all_urls>"] }
);
