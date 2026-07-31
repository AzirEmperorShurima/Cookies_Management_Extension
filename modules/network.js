import { notify } from '../popup.js';
import { settings, saveSettings } from '../popup.js';

const elements = {
    webrtcToggle: document.getElementById('webrtcToggle'),
    proxyListInput: document.getElementById('proxyListInput'),
    proxyAutoRotateToggle: document.getElementById('proxyAutoRotateToggle'),
    proxyRotateInterval: document.getElementById('proxyRotateInterval'),
    proxyConnectBtn: document.getElementById('proxyConnectBtn'),
    proxyDisconnectBtn: document.getElementById('proxyDisconnectBtn'),
    networkShieldStatusText: document.getElementById('networkShieldStatusText'),
    proxyTerminalLog: document.getElementById('proxyTerminalLog')
};

const translations = window.translations;
const getDict = () => translations[settings.language || 'vi'] || translations.vi;

// Prevent WebRTC Leak
export function setWebRTCLeakProtection(enabled) {
    if (!chrome.privacy || !chrome.privacy.network || !chrome.privacy.network.webRTCIPHandlingPolicy) return;
    
    const policy = enabled ? 'disable_non_proxied_udp' : 'default';
    chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: policy }, () => {
        console.log(`[Network Shield] WebRTC Protection set to: ${policy}`);
    });
}

function updateUIStatus(isConnected) {
    if (elements.networkShieldStatusText) {
        elements.networkShieldStatusText.textContent = isConnected ? 'ON' : 'OFF';
        elements.networkShieldStatusText.style.color = isConnected ? '#00b894' : '#00cec9';
    }
}

export function appendLog(message, type = 'info') {
    if (!elements.proxyTerminalLog) return;
    
    const d = new Date();
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    
    const logEl = document.createElement('div');
    logEl.style.display = 'flex';
    logEl.style.gap = '8px';
    logEl.style.opacity = '0';
    logEl.style.animation = 'fadeIn 0.3s forwards';
    
    let color = '#00ff00';
    if (type === 'error') color = '#ff4757';
    if (type === 'warning') color = '#ffa502';
    
    logEl.innerHTML = `<span style="color: #576574;">[${time}]</span> <span style="color: ${color};">${message}</span>`;
    
    elements.proxyTerminalLog.appendChild(logEl);
    elements.proxyTerminalLog.scrollTop = elements.proxyTerminalLog.scrollHeight;
}

export function parseProxyList(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const proxies = [];
    
    for (const line of lines) {
        // Handle protocol://user:pass@host:port or protocol://host:port
        let match = line.match(/^(http|https|socks4|socks5):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/i);
        if (match) {
            proxies.push({
                scheme: match[1].toLowerCase(),
                username: match[2] || '',
                password: match[3] || '',
                host: match[4],
                port: parseInt(match[5])
            });
            continue;
        }

        // Handle host:port or host:port:user:pass
        const parts = line.split(':');
        if (parts.length === 2) {
            proxies.push({ scheme: 'http', host: parts[0], port: parseInt(parts[1]), username: '', password: '' });
        } else if (parts.length === 4) {
            proxies.push({ scheme: 'http', host: parts[0], port: parseInt(parts[1]), username: parts[2], password: parts[3] });
        }
    }
    return proxies;
}

export async function init() {
    // Add CSS animation for logs if not exists
    if (!document.getElementById('proxyLogAnim')) {
        const style = document.createElement('style');
        style.id = 'proxyLogAnim';
        style.innerHTML = `@keyframes fadeIn { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }`;
        document.head.appendChild(style);
    }

    // Load saved settings
    const data = await chrome.storage.local.get(['networkShieldSettings']);
    const savedConfig = data.networkShieldSettings || {
        webrtcProtected: false,
        proxyEnabled: false,
        proxyRawList: '',
        autoRotate: false,
        rotateInterval: 10
    };

    if (elements.webrtcToggle) {
        elements.webrtcToggle.checked = savedConfig.webrtcProtected;
        elements.webrtcToggle.addEventListener('change', async (e) => {
            savedConfig.webrtcProtected = e.target.checked;
            setWebRTCLeakProtection(savedConfig.webrtcProtected);
            await chrome.storage.local.set({ networkShieldSettings: savedConfig });
        });
    }

    if (elements.proxyListInput) elements.proxyListInput.value = savedConfig.proxyRawList;
    if (elements.proxyAutoRotateToggle) elements.proxyAutoRotateToggle.checked = savedConfig.autoRotate;
    if (elements.proxyRotateInterval) elements.proxyRotateInterval.value = savedConfig.rotateInterval;

    updateUIStatus(savedConfig.proxyEnabled);

    // Listen for background log messages
    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === 'PROXY_LOG') {
            appendLog(request.message, request.logType);
        }
        if (request.type === 'PROXY_STATUS') {
            updateUIStatus(request.connected);
        }
    });

    if (elements.proxyConnectBtn) {
        elements.proxyConnectBtn.addEventListener('click', async () => {
            const rawList = elements.proxyListInput.value;
            const proxies = parseProxyList(rawList);
            
            if (proxies.length === 0) {
                notify(getDict().proxyErrorEmpty || 'Vui lòng nhập ít nhất một proxy hợp lệ.', 'error');
                appendLog('Error: No valid proxies found in list.', 'error');
                return;
            }

            savedConfig.proxyRawList = rawList;
            savedConfig.autoRotate = elements.proxyAutoRotateToggle.checked;
            savedConfig.rotateInterval = parseInt(elements.proxyRotateInterval.value) || 10;
            savedConfig.proxyEnabled = true;

            await chrome.storage.local.set({ networkShieldSettings: savedConfig });
            
            appendLog(`Parsed ${proxies.length} proxies. Starting connection...`, 'info');
            
            // Notify background to start proxy manager
            chrome.runtime.sendMessage({ 
                type: 'START_PROXY', 
                proxies: proxies,
                autoRotate: savedConfig.autoRotate,
                rotateInterval: savedConfig.rotateInterval
            });
        });
    }

    if (elements.proxyDisconnectBtn) {
        elements.proxyDisconnectBtn.addEventListener('click', async () => {
            savedConfig.proxyEnabled = false;
            await chrome.storage.local.set({ networkShieldSettings: savedConfig });
            
            appendLog('Disconnecting...', 'warning');
            chrome.runtime.sendMessage({ type: 'STOP_PROXY' });
        });
    }
}
