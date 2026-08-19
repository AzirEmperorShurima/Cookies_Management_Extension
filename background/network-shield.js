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

    const endpoints = [
        async () => {
            const timeoutId = setTimeout(() => testAbortController?.abort(), 3000);
            try {
                const res = await fetch("https://ipwho.is/", { signal: testAbortController.signal, cache: 'no-store' });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error('Status ' + res.status);
                const data = await res.json();
                if (!data.success && data.message) throw new Error(data.message);
                return { country: data.country || 'Unknown', ip: data.ip, isp: data.connection?.isp || '' };
            } finally { clearTimeout(timeoutId); }
        },
        async () => {
            const timeoutId = setTimeout(() => testAbortController?.abort(), 3000);
            try {
                const res = await fetch("https://freeipapi.com/api/json", { signal: testAbortController.signal, cache: 'no-store' });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error('Status ' + res.status);
                const data = await res.json();
                return { country: data.countryName || 'Unknown', ip: data.ipAddress, isp: '' };
            } finally { clearTimeout(timeoutId); }
        },
        async () => {
            const timeoutId = setTimeout(() => testAbortController?.abort(), 2500);
            try {
                const res = await fetch("https://api.ipify.org?format=json", { signal: testAbortController.signal, cache: 'no-store' });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error('Status ' + res.status);
                const data = await res.json();
                return { country: 'Protected Proxy', ip: data.ip, isp: '' };
            } finally { clearTimeout(timeoutId); }
        }
    ];

    let lastError = null;
    for (const fetchEndpoint of endpoints) {
        try {
            const info = await fetchEndpoint();
            const ispStr = info.isp ? ` - ${info.isp}` : '';
            sendLog(`[SUCCESS] Connected to ${info.country} (${info.ip}${ispStr})`, 'success');
            sendStatus(true);
            return true;
        } catch (e) {
            lastError = e;
            if (e.name === 'AbortError') break;
        }
    }

    sendLog(`[FAILED] Connection test failed: ${lastError ? lastError.message : 'Timeout'}`, 'error');
    sendStatus(false);
    return false;
}

let customBypassList = ["localhost", "127.0.0.1"];

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
            bypassList: customBypassList
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
        if (Array.isArray(request.bypassList) && request.bypassList.length > 0) {
            customBypassList = request.bypassList;
        } else {
            customBypassList = ["localhost", "127.0.0.1"];
        }
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
