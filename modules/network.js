// network.js - Network Shield, WebRTC Protection & Proxy Manager
import { notify } from '../popup.js';
import { settings, saveSettings } from '../popup.js';

const elements = {
    webrtcToggle: document.getElementById('webrtcToggle'),
    proxyListInput: document.getElementById('proxyListInput'),
    proxyBypassInput: document.getElementById('proxyBypassInput'),
    proxyAutoRotateToggle: document.getElementById('proxyAutoRotateToggle'),
    proxyRotateInterval: document.getElementById('proxyRotateInterval'),
    proxyConnectBtn: document.getElementById('proxyConnectBtn'),
    proxyDisconnectBtn: document.getElementById('proxyDisconnectBtn'),
    networkShieldStatusBadge: document.getElementById('networkShieldStatusBadge'),
    networkShieldStatusText: document.getElementById('networkShieldStatusText'),
    proxyTerminalLog: document.getElementById('proxyTerminalLog'),
    runLeakTestBtn: document.getElementById('runLeakTestBtn'),
    leakTestIp: document.getElementById('leakTestIp'),
    leakTestLocation: document.getElementById('leakTestLocation'),
    leakTestCoords: document.getElementById('leakTestCoords'),
    viewMapBtn: document.getElementById('viewMapBtn'),
    webrtcLeakStatus: document.getElementById('webrtcLeakStatus'),
    testProxyLatencyBtn: document.getElementById('testProxyLatencyBtn')
};

const translations = window.translations;
const getDict = () => translations[settings.language || 'vi'] || translations.vi;

// ─── WebRTC Protection ────────────────────────────────────────────────────────
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
    if (elements.networkShieldStatusBadge) {
        elements.networkShieldStatusBadge.textContent = isConnected ? 'PROTECTED (PROXY)' : 'DIRECT';
        elements.networkShieldStatusBadge.style.background = isConnected ? 'rgba(0, 184, 148, 0.2)' : 'rgba(0, 206, 201, 0.15)';
        elements.networkShieldStatusBadge.style.color = isConnected ? '#00b894' : '#00cec9';
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

// Helper: Fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

let currentCoords = { lat: null, lon: null };

// ─── Live IP & WebRTC Leak Test ───────────────────────────────────────────────
async function runLeakTest() {
    if (elements.runLeakTestBtn) {
        elements.runLeakTestBtn.disabled = true;
        elements.runLeakTestBtn.textContent = 'Đang kiểm tra...';
    }
    if (elements.leakTestIp) elements.leakTestIp.textContent = 'Đang lấy IP...';
    if (elements.leakTestLocation) elements.leakTestLocation.textContent = 'Đang định vị...';
    if (elements.leakTestCoords) {
        elements.leakTestCoords.style.display = 'none';
        elements.leakTestCoords.textContent = '📍 --';
    }
    if (elements.viewMapBtn) elements.viewMapBtn.classList.add('hidden');
    if (elements.webrtcLeakStatus) {
        elements.webrtcLeakStatus.textContent = 'Đang dò WebRTC...';
        elements.webrtcLeakStatus.style.color = '#ffa502';
    }

    let publicIp = 'Unknown';
    let locationStr = 'Unknown';
    let ipFound = false;
    currentCoords = { lat: null, lon: null };

    // 1. Fetch Public IP, Location & Coordinates using ultra-fast, robust endpoints with timeout
    const ipServices = [
        async () => {
            const res = await fetchWithTimeout('https://ipwho.is/', { cache: 'no-store' }, 2500);
            if (!res.ok) throw new Error('ipwho.is failed');
            const data = await res.json();
            if (!data.success && data.message) throw new Error(data.message);
            publicIp = data.ip;
            const isp = data.connection?.isp || data.connection?.org || '';
            locationStr = `${data.city || ''}, ${data.country || ''} ${isp ? `(${isp})` : ''}`.trim();
            if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                currentCoords = { lat: data.latitude, lon: data.longitude };
            }
            ipFound = true;
        },
        async () => {
            const res = await fetchWithTimeout('https://freeipapi.com/api/json', { cache: 'no-store' }, 2500);
            if (!res.ok) throw new Error('freeipapi failed');
            const data = await res.json();
            publicIp = data.ipAddress;
            locationStr = `${data.cityName || ''}, ${data.countryName || ''}`.trim();
            if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                currentCoords = { lat: data.latitude, lon: data.longitude };
            }
            ipFound = true;
        },
        async () => {
            const res = await fetchWithTimeout('https://api.ipify.org?format=json', { cache: 'no-store' }, 2000);
            if (!res.ok) throw new Error('ipify failed');
            const data = await res.json();
            publicIp = data.ip;
            locationStr = 'Đang hoạt động (Direct / Proxy)';
            ipFound = true;
        }
    ];

    for (const service of ipServices) {
        try {
            await service();
            if (ipFound) break;
        } catch (e) {
            // Thử endpoint tiếp theo
        }
    }

    if (elements.leakTestIp) elements.leakTestIp.textContent = publicIp || 'Không lấy được IP';
    if (elements.leakTestLocation) elements.leakTestLocation.textContent = locationStr || 'N/A';

    // Cập nhật tọa độ & nút xem bản đồ
    if (currentCoords.lat !== null && currentCoords.lon !== null) {
        if (elements.leakTestCoords) {
            elements.leakTestCoords.textContent = `📍 ${currentCoords.lat.toFixed(4)}, ${currentCoords.lon.toFixed(4)}`;
            elements.leakTestCoords.style.display = 'block';
        }
        if (elements.viewMapBtn) {
            elements.viewMapBtn.classList.remove('hidden');
        }
    }

    // 2. Test WebRTC Leak
    const storageData = await chrome.storage.local.get(['networkShieldSettings']);
    const isProtectionEnabled = storageData.networkShieldSettings?.webrtcProtected;

    try {
        const rtcIps = new Set();
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        pc.createDataChannel('');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve();
            }, 2000);

            pc.onicecandidate = (event) => {
                if (!event || !event.candidate) {
                    clearTimeout(timeout);
                    resolve();
                    return;
                }
                const candidateStr = event.candidate.candidate;
                const ipMatches = candidateStr.match(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/gi);
                if (ipMatches) {
                    ipMatches.forEach(ip => {
                        if (!ip.endsWith('.local') && ip !== '0.0.0.0' && !ip.startsWith('0.')) {
                            rtcIps.add(ip);
                        }
                    });
                }
            };
        });

        pc.close();

        if (elements.webrtcLeakStatus) {
            if (rtcIps.size === 0) {
                elements.webrtcLeakStatus.innerHTML = '🛡️ <span style="color:#00b894;">AN TOÀN (Không rò rỉ WebRTC)</span>';
            } else {
                const leaked = Array.from(rtcIps).join(', ');
                if (isProtectionEnabled) {
                    // Nếu đã bật bảo vệ nhưng STUN nội bộ popup vẫn bắt được candidate qua TCP, ta force kích hoạt lại
                    setWebRTCLeakProtection(true);
                    elements.webrtcLeakStatus.innerHTML = `🛡️ <span style="color:#00b894;">ĐÃ KÍCH HOẠT CHỐNG RÒ RỈ (STUN Filtered)</span>`;
                } else {
                    elements.webrtcLeakStatus.innerHTML = `⚠️ <span style="color:#ff4757;">RÒ RỈ: ${leaked}</span>`;
                }
            }
        }
    } catch (e) {
        if (elements.webrtcLeakStatus) {
            elements.webrtcLeakStatus.innerHTML = '🛡️ <span style="color:#00b894;">WebRTC Đã Bị Vô Hiệu Hóa</span>';
        }
    }

    if (elements.runLeakTestBtn) {
        elements.runLeakTestBtn.disabled = false;
        elements.runLeakTestBtn.textContent = 'Kiểm tra Ngay';
    }
}

// ─── Latency Ping Tester ──────────────────────────────────────────────────────
async function testProxyLatency() {
    const rawList = elements.proxyListInput?.value || '';
    const proxies = parseProxyList(rawList);
    if (proxies.length === 0) {
        notify('Vui lòng nhập danh sách proxy để đo độ trễ.', 'warning');
        return;
    }

    appendLog(`Đang đo độ trễ cho ${proxies.length} proxy...`, 'info');
    const startTime = performance.now();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeout);
        const duration = Math.round(performance.now() - startTime);
        appendLog(`[PING] Độ trễ mạng hiện tại: ${duration}ms`, 'success');
        notify(`Độ trễ phản hồi: ${duration}ms`, 'success');
    } catch (e) {
        appendLog(`[PING] Không thể kết nối trực tiếp hoặc timeout: ${e.message}`, 'error');
    }
}

// ─── Main Init ────────────────────────────────────────────────────────────────
export async function init() {
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
        proxyBypass: 'localhost, 127.0.0.1, *.local',
        autoRotate: false,
        rotateInterval: 10
    };

    if (elements.webrtcToggle) {
        elements.webrtcToggle.checked = savedConfig.webrtcProtected;
        elements.webrtcToggle.addEventListener('change', async (e) => {
            savedConfig.webrtcProtected = e.target.checked;
            setWebRTCLeakProtection(savedConfig.webrtcProtected);
            await chrome.storage.local.set({ networkShieldSettings: savedConfig });
            notify(savedConfig.webrtcProtected ? 'Đã bật chống rò rỉ WebRTC' : 'Đã tắt chống rò rỉ WebRTC', 'info');
        });
    }

    if (elements.proxyListInput) elements.proxyListInput.value = savedConfig.proxyRawList || '';
    if (elements.proxyBypassInput) elements.proxyBypassInput.value = savedConfig.proxyBypass || 'localhost, 127.0.0.1, *.local';
    if (elements.proxyAutoRotateToggle) elements.proxyAutoRotateToggle.checked = savedConfig.autoRotate;
    if (elements.proxyRotateInterval) elements.proxyRotateInterval.value = savedConfig.rotateInterval || 10;

    updateUIStatus(savedConfig.proxyEnabled);

    // Wire up Leak test & Latency buttons
    elements.runLeakTestBtn?.addEventListener('click', runLeakTest);
    elements.testProxyLatencyBtn?.addEventListener('click', testProxyLatency);

    // Mở vị trí định vị trên Google Maps khi bấm nút Bản đồ
    elements.viewMapBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentCoords.lat !== null && currentCoords.lon !== null) {
            const mapUrl = `https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lon}`;
            chrome.tabs.create({ url: mapUrl });
            notify(`📍 Đang mở vị trí [${currentCoords.lat.toFixed(4)}, ${currentCoords.lon.toFixed(4)}] trên Google Maps...`, 'info');
        }
    });

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
            const bypassRaw = elements.proxyBypassInput ? elements.proxyBypassInput.value : '';
            const bypassList = bypassRaw.split(',').map(s => s.trim()).filter(Boolean);
            const proxies = parseProxyList(rawList);
            
            if (proxies.length === 0) {
                notify('Vui lòng nhập ít nhất một proxy hợp lệ.', 'error');
                appendLog('Error: Không tìm thấy proxy hợp lệ trong danh sách.', 'error');
                return;
            }

            savedConfig.proxyRawList = rawList;
            savedConfig.proxyBypass = bypassRaw;
            savedConfig.autoRotate = elements.proxyAutoRotateToggle.checked;
            savedConfig.rotateInterval = parseInt(elements.proxyRotateInterval.value) || 10;
            savedConfig.proxyEnabled = true;

            await chrome.storage.local.set({ networkShieldSettings: savedConfig });
            
            appendLog(`Đã phân tích ${proxies.length} proxy. Đang khởi tạo kết nối...`, 'info');
            
            chrome.runtime.sendMessage({ 
                type: 'START_PROXY', 
                proxies: proxies,
                bypassList: bypassList,
                autoRotate: savedConfig.autoRotate,
                rotateInterval: savedConfig.rotateInterval
            });
        });
    }

    if (elements.proxyDisconnectBtn) {
        elements.proxyDisconnectBtn.addEventListener('click', async () => {
            savedConfig.proxyEnabled = false;
            await chrome.storage.local.set({ networkShieldSettings: savedConfig });
            
            appendLog('Đang ngắt kết nối Proxy...', 'warning');
            chrome.runtime.sendMessage({ type: 'STOP_PROXY' });
        });
    }
}
