import { elements, settings, notify, saveSettings } from '../popup.js';
import { createElement, escapeHTML } from './utils.js';
import { toggleFilterSource } from './adblock/adblock-manager.js';

const translations = window.translations;
const getDict = () => translations[settings.language || 'vi'] || translations.vi;

// --- Module-level state ---
let _adblockUIInitialized = false;
let isFetchingEasyList = false;
let _fetchStartTime = 0;
const MIN_FETCH_ANIM_MS = 3600; // Thời gian hiển thị animation tối thiểu (ms)

/**
 * Listener cố định ở mức module: đăng ký một lần khi module được load,
 * luôn lắng nghe kết quả FETCH_EASYLIST_RESULT từ background.
 * Không bị xóa sau khi dùng nên hoạt động đúng ở mọi lần bấm.
 */
chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'FETCH_EASYLIST_RESULT') return;
    // Đảm bảo animation hiển tối thiểu MIN_FETCH_ANIM_MS trước khi ẩn
    const elapsed = Date.now() - _fetchStartTime;
    const remaining = Math.max(0, MIN_FETCH_ANIM_MS - elapsed);
    setTimeout(() => _onEasyListFetchDone(message.success, message.error), remaining);
});

/**
 * Khởi tạo giao diện và nạp dữ liệu cũ cho Adblock Manager
 */
export async function initAdblockUI() {
    const dict = getDict();
    
    // Bypass elements object and query directly to avoid stale references
    const adblockEnabledToggle = document.getElementById('adblockEnabledToggle');
    const easylistToggle = document.getElementById('easylistToggle');
    const customAdblockRules = document.getElementById('customAdblockRules');
    const customAdblockCssRules = document.getElementById('customAdblockCssRules');
    const fetchEasyListBtn = document.getElementById('fetchEasyListBtn');

    if (!adblockEnabledToggle) return;

    // Nạp cấu hình từ settings (luôn cập nhật khi mở lại tab)
    adblockEnabledToggle.checked = settings.adblockEnabled !== false;
    if (easylistToggle) easylistToggle.checked = settings.easylistEnabled !== false;
    if (customAdblockRules) customAdblockRules.value = settings.customAdblockRules || '';
    if (customAdblockCssRules) customAdblockCssRules.value = settings.customAdblockCssRules || '';

    // Cập nhật thống kê từ bộ nhớ
    updateAdblockStats();

    // --- Guard: Chỉ gắn event listener một lần duy nhất ---
    if (_adblockUIInitialized) return;
    _adblockUIInitialized = true;

    // Bind sự kiện lưu cài đặt nhanh khi thay đổi switch
    adblockEnabledToggle.addEventListener('change', async (e) => {
        settings.adblockEnabled = e.target.checked;
        updateAdblockStats(); // Cập nhật UI ngay lập tức
        await saveSettings();
        await compileAllRules();
        chrome.runtime.sendMessage({ type: 'updateSecurityRules' });
        notify(dict.adblockSaved || 'Đã lưu cấu hình chặn quảng cáo!');
    });

    if (easylistToggle) {
        easylistToggle.addEventListener('change', async (e) => {
            settings.easylistEnabled = e.target.checked;
            await saveSettings();
            
            await compileAllRules();
            // Thông báo background cập nhật lại quy tắc bảo vệ và custom rules
            chrome.runtime.sendMessage({ type: 'updateSecurityRules' });
            
            notify(dict.adblockSaved || 'Đã cập nhật trạng thái bộ lọc!');
        });
    }

    // Nạp & Cập nhật EasyList – delegate sang background để không bị cancel khi popup mất focus
    if (fetchEasyListBtn) {
        fetchEasyListBtn.addEventListener('click', () => {
            if (isFetchingEasyList) return;
            startEasyListFetch();
        });
    }

    const zapperModeBtn = document.getElementById('zapperModeBtn');
    if (zapperModeBtn) {
        zapperModeBtn.addEventListener('click', async () => {
            try {
                const tabs = await chrome.tabs.query({ active: true });
                const tab = tabs.find(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('edge://')) || tabs[0];
                if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('edge://')) {
                    // Change UI state to active
                    zapperModeBtn.classList.add('pulse-anim');
                    zapperModeBtn.style.background = 'linear-gradient(135deg, #00d2ff, #3a7bd5)';
                    zapperModeBtn.style.boxShadow = '0 4px 15px rgba(0, 210, 255, 0.4)';
                    const textSpan = zapperModeBtn.querySelector('.btn-text');
                    if (textSpan) textSpan.innerText = getDict().zapperActive || 'Zapper Đang Bật...';
                    
                    await chrome.runtime.sendMessage({ type: 'ACTIVATE_ZAPPER', tabId: tab.id });
                    notify(getDict().zapperActivatedNotify || 'Zapper đã sẵn sàng! Hãy click vào phần tử bạn muốn xóa trên trang.', 'success');
                    
                    // Do not close window, let user see the state change
                    setTimeout(() => window.close(), 2000);
                } else {
                    const errorMsg = getDict().zapperError || 'Không thể dùng Zapper trên trang cài đặt. Vui lòng mở tiện ích trên 1 trang web bình thường!';
                    notify(errorMsg, 'error');
                    alert(errorMsg); // Ensure user sees it if notifications are disabled/hidden
                }
            } catch (err) {
                console.error("Zapper error:", err);
                notify(getDict().zapperError || "Có lỗi xảy ra khi bật Zapper.", 'error');
            }
        });
    }

    renderZapperManager();

    // Tự động lưu cấu hình cho quy tắc tự viết khi người dùng click ra ngoài
    const autoSaveCustomRules = async () => {
        settings.customAdblockRules = customAdblockRules?.value || '';
        settings.customAdblockCssRules = customAdblockCssRules?.value || '';
        saveSettings();
        
        await compileAllRules();
        notify(dict.adblockSaved || 'Đã tự động lưu cấu hình chặn quảng cáo!');
    };

    if (customAdblockRules) customAdblockRules.onblur = autoSaveCustomRules;
    if (customAdblockCssRules) customAdblockCssRules.onblur = autoSaveCustomRules;
}

/**
 * Cập nhật số lượng quy tắc hiển thị trên giao diện
 */
export async function updateAdblockStats() {
    const { adblockNetworkCount, adblockCssCount, adsBlockedCount, statAdsBlocked } = elements;
    
    // Hiển thị trạng thái (Running / Paused)
    const adblockStatusBadge = document.getElementById('adblockStatusBadge');
    if (adblockStatusBadge) {
        if (settings.adblockEnabled === false) {
            adblockStatusBadge.textContent = 'Paused';
            adblockStatusBadge.className = 'status-badge paused';
        } else {
            adblockStatusBadge.textContent = 'Running';
            adblockStatusBadge.className = 'status-badge running';
        }
    }

    // Đếm các ruleset tĩnh (giữ nguyên số lượng để hiển thị "Loaded" thay vì "Enabled")
    let staticRulesCount = 55380 + 46770; // EasyList + EasyPrivacy

    chrome.storage.local.get(['compiledAdblockRules', 'adblockCssRules', 'adsBlockedCount'], async (res) => {
        const networkRules = res.compiledAdblockRules || [];
        const cssRules = res.adblockCssRules || {};

        // Tổng rules mạng = rules tĩnh (EasyList) + rules động (Custom)
        const totalNetworkRules = settings.adblockEnabled === false ? 0 : networkRules.length + staticRulesCount;

        // Đếm tổng số CSS selector
        let cssTotalCount = 0;
        Object.keys(cssRules).forEach(domain => {
            if (Array.isArray(cssRules[domain])) {
                cssTotalCount += cssRules[domain].length;
            }
        });

        // Sum up last 7 days for blocked count
        let totalBlocked7Days = 0;
        const keys = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const offset = d.getTimezoneOffset() * 60000;
            const localDateStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
            keys.push(`stats_${localDateStr}`);
        }
        const statsRes = await chrome.storage.local.get(keys);
        keys.forEach(k => {
            if (statsRes[k] && statsRes[k].trackersBlocked) {
                totalBlocked7Days += statsRes[k].trackersBlocked;
            }
        });

        if (adblockNetworkCount) adblockNetworkCount.textContent = totalNetworkRules;

        
        if (adblockCssCount) adblockCssCount.textContent = cssTotalCount;
        if (adsBlockedCount) adsBlockedCount.textContent = totalBlocked7Days;
        if (statAdsBlocked) statAdsBlocked.textContent = totalBlocked7Days;
        
        chrome.storage.local.set({ adsBlockedCount: totalBlocked7Days });
        
        renderAnalyticsChart();
    });
}

/**
 * Hiển thị biểu đồ thống kê Analytics
 */
async function renderAnalyticsChart() {
    const canvas = document.getElementById('adblockAnalyticsChart');
    if (!canvas || !window.Chart) return;
    
    // Lấy ngày hiện tại và 6 ngày trước
    const dates = [];
    const keys = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const offset = d.getTimezoneOffset() * 60000;
        const dateStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
        dates.push(dateStr.slice(5)); // Chỉ lấy MM-DD
        keys.push(`stats_${dateStr}`);
    }
    
    try {
        const result = await chrome.storage.local.get(keys);
        const dataPoints = keys.map(k => (result[k] && result[k].trackersBlocked) ? result[k].trackersBlocked : 0);
        const detailsList = keys.map(k => (result[k] && result[k].details) ? result[k].details : {});
        
        const dateSelect = document.getElementById('adblockDateSelect');
        const btnViewChart = document.getElementById('btnViewChart');
        const btnViewList = document.getElementById('btnViewList');
        const chartContainer = document.getElementById('adblockChartContainer');
        const detailsContainer = document.getElementById('adblockDetailsContainer');

        // Setup Date Select options
        if (dateSelect) {
            dateSelect.innerHTML = '';
            dates.forEach((date, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = date;
                dateSelect.appendChild(opt);
            });
            dateSelect.value = 6;
            
            dateSelect.addEventListener('change', (e) => {
                const idx = parseInt(e.target.value);
                renderDetailsView(dates[idx], detailsList[idx]);
            });
        }

        // Setup View Toggles
        if (btnViewChart && btnViewList && chartContainer && detailsContainer) {
            btnViewChart.addEventListener('click', () => {
                btnViewChart.style.background = '#a29bfe';
                btnViewChart.style.color = 'white';
                btnViewChart.style.boxShadow = '0 2px 5px rgba(162, 155, 254, 0.3)';
                
                btnViewList.style.background = 'transparent';
                btnViewList.style.color = 'var(--text-muted)';
                btnViewList.style.boxShadow = 'none';
                
                chartContainer.style.display = 'block';
                detailsContainer.style.display = 'none';
            });
            
            btnViewList.addEventListener('click', () => {
                btnViewList.style.background = '#a29bfe';
                btnViewList.style.color = 'white';
                btnViewList.style.boxShadow = '0 2px 5px rgba(162, 155, 254, 0.3)';
                
                btnViewChart.style.background = 'transparent';
                btnViewChart.style.color = 'var(--text-muted)';
                btnViewChart.style.boxShadow = 'none';
                
                chartContainer.style.display = 'none';
                detailsContainer.style.display = 'block';
                
                const idx = parseInt(dateSelect.value || 6);
                renderDetailsView(dates[idx], detailsList[idx]);
            });
        }

        // Helper func để render list
        const renderDetailsView = (dateStr, detailsObj) => {
            const list = document.getElementById('adblockDetailsList');
            if (dateSelect) dateSelect.value = dates.indexOf(dateStr);
            if (!list) return;
            
            if (!detailsObj || Object.keys(detailsObj).length === 0) {
                list.innerHTML = '<div class="empty-state" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 15px;">Không có dữ liệu chi tiết.</div>';
                return;
            }
            
            const sortedDomains = Object.entries(detailsObj).sort((a, b) => b[1] - a[1]);
            const htmlParts = sortedDomains.map(([domain, count]) => {
                const escapedDomain = escapeHTML(domain);
                return `<div class="adblock-detail-item" style="display: flex; justify-content: space-between; padding: 10px 8px; border-bottom: 1px solid rgba(162, 155, 254, 0.1); border-radius: 4px; transition: background 0.2s; background: transparent;">
                            <span style="color: var(--text-color, #333); word-break: break-all;">${escapedDomain}</span>
                            <span style="color: #ff7675; font-weight: bold; min-width: 30px; text-align: right;">${count}</span>
                         </div>`;
            });
            list.innerHTML = htmlParts.join('');
            
            // Fix CSP Violation via event delegation
            if (!list._hasHoverListener) {
                list.addEventListener('mouseover', (e) => {
                    const item = e.target.closest('.adblock-detail-item');
                    if (item) item.style.background = 'rgba(162, 155, 254, 0.05)';
                });
                list.addEventListener('mouseout', (e) => {
                    const item = e.target.closest('.adblock-detail-item');
                    if (item) item.style.background = 'transparent';
                });
                list._hasHoverListener = true;
            }
        };

        // Render default (hôm nay)
        renderDetailsView(dates[6], detailsList[6]);
        
        if (window.adblockChartInstance) {
            window.adblockChartInstance.destroy();
        }
        
        window.adblockChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Trackers/Ads Blocked',
                    data: dataPoints,
                    borderColor: '#6c5ce7',
                    backgroundColor: 'rgba(108, 92, 231, 0.2)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (e, elements) => {
                    if (elements && elements.length > 0) {
                        const idx = elements[0].index;
                        // Chuyển sang tab Danh sách và hiện dữ liệu của ngày đó
                        if (btnViewList) btnViewList.click();
                        renderDetailsView(dates[idx], detailsList[idx]);
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#888' }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#888' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#888' }
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: function(context) {
                                const idx = context[0].dataIndex;
                                const detailsObj = detailsList[idx];
                                if (!detailsObj || Object.keys(detailsObj).length === 0) return '';
                                
                                const sorted = Object.entries(detailsObj).sort((a, b) => b[1] - a[1]).slice(0, 5);
                                let lines = [];
                                sorted.forEach(([domain, count]) => {
                                    lines.push(`• ${domain}: ${count}`);
                                });
                                if (Object.keys(detailsObj).length > 5) {
                                    lines.push(`...và ${Object.keys(detailsObj).length - 5} tên miền khác`);
                                }
                                return lines;
                            }
                        }
                    }
                }
            }
        });
    } catch(e) {
        console.error("Error rendering chart:", e);
    }
}

/**
 * Bắt đầu quá trình fetch EasyList: cập nhật UI loading rồi gửi lệnh cho background.
 * Background sẽ thực hiện fetch() thực sự và gửi FETCH_EASYLIST_RESULT về cho popup.
 * Cách này tránh bị cancel khi popup mất focus hoặc đóng.
 */
function startEasyListFetch() {
    if (isFetchingEasyList) return;
    isFetchingEasyList = true;
    _fetchStartTime = Date.now(); // Ghi lại thời điểm bắt đầu để thi đầu minimum animation

    const fetchEasyListBtn = document.getElementById('fetchEasyListBtn');
    const fetchOverlay = document.getElementById('adblockFetchOverlay');

    // Hiển thị overlay loading
    if (fetchOverlay) fetchOverlay.classList.remove('hidden');

    if (fetchEasyListBtn) {
        fetchEasyListBtn.disabled = true;
        fetchEasyListBtn.style.transform = 'scale(0.95)';
        fetchEasyListBtn.style.opacity = '0.8';
        setTimeout(() => { fetchEasyListBtn.style.transform = 'scale(1)'; }, 200);

        const fetchIcon = fetchEasyListBtn.querySelector('.fetch-icon');
        const spinnerIcon = fetchEasyListBtn.querySelector('.spinner-icon');
        const btnText = fetchEasyListBtn.querySelector('.btn-text');

        if (fetchIcon) fetchIcon.classList.add('hidden');
        if (spinnerIcon) spinnerIcon.classList.remove('hidden');
        if (btnText) btnText.innerText = 'Đang cập nhật...';
    }

    // Giao nhiệm vụ fetch cho background service worker
    chrome.runtime.sendMessage({ type: 'FETCH_EASYLIST' }).catch(err => {
        console.error('[Adblock] Failed to send FETCH_EASYLIST message:', err);
        // Nếu không gửi được message, reset UI ngay lập tức
        _onEasyListFetchDone(false, err.message);
    });
}

/**
 * Callback sau khi background báo fetch xong (thành công hoặc thất bại).
 * Reset UI về trạng thái ban đầu và hiện thông báo kết quả.
 */
function _onEasyListFetchDone(success, errMsg) {
    const dict = getDict();
    const fetchEasyListBtn = document.getElementById('fetchEasyListBtn');
    const fetchOverlay = document.getElementById('adblockFetchOverlay');

    isFetchingEasyList = false;

    if (fetchOverlay) fetchOverlay.classList.add('hidden');

    if (success) {
        const msg = dict.easyListSuccess || 'Đã nạp thành công EasyList!';
        notify(msg, 'success');
        if (!settings.showNotifications) alert(msg);
        // Cập nhật lại stats sau khi có dữ liệu mới
        updateAdblockStats();
    } else {
        const msg = dict.easyListFail || 'Lỗi khi tải EasyList. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.';
        notify(msg, 'error');
        alert(msg);
    }

    if (fetchEasyListBtn) {
        fetchEasyListBtn.disabled = false;
        fetchEasyListBtn.style.opacity = '1';
        const fetchIcon = fetchEasyListBtn.querySelector('.fetch-icon');
        const spinnerIcon = fetchEasyListBtn.querySelector('.spinner-icon');
        const btnText = fetchEasyListBtn.querySelector('.btn-text');

        if (fetchIcon) fetchIcon.classList.remove('hidden');
        if (spinnerIcon) spinnerIcon.classList.add('hidden');
        if (btnText) btnText.innerText = dict.fetchEasyList || 'Nạp & Cập nhật';
    }
}

/**
 * Tổng hợp các quy tắc (EasyList + Quy tắc tùy chỉnh) và tạo cấu trúc quy tắc hoàn chỉnh
 */
async function compileAllRules() {
    const dict = getDict();
    
    // 1. Lấy dữ liệu EasyList và cấu hình tùy chỉnh
    const storage = await chrome.storage.local.get([
        'easyListParsedCssRules'
    ]);
    const easyListCss = settings.easylistEnabled ? (storage.easyListParsedCssRules || {}) : {};

    // 2. Phân tích quy tắc mạng tùy chỉnh của người dùng
    const customNetRules = [];
    if (settings.customAdblockRules) {
        const lines = settings.customAdblockRules.split('\n');
        let warned = false;
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('!')) {
                if (customNetRules.length < 2000) {
                    customNetRules.push(trimmed);
                } else if (!warned) {
                    notify(dict.customRulesLimitExceeded || 'Quy tắc mạng tuỳ chỉnh vượt quá 2000 dòng. Đã cắt bớt để tránh lỗi.', 'error');
                    warned = true;
                }
            }
        });
    }

    // 3. Phân tích quy tắc CSS tùy chỉnh của người dùng
    const customCssRules = {};
    if (settings.customAdblockCssRules) {
        const lines = settings.customAdblockCssRules.split('\n');
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && trimmed.includes('##')) {
                const parts = trimmed.split('##');
                const domainsPart = parts[0].trim();
                const selector = parts[1].trim();

                if (selector) {
                    if (domainsPart) {
                        const domains = domainsPart.split(',');
                        domains.forEach(domain => {
                            domain = domain.trim();
                            customCssRules[domain] = customCssRules[domain] || [];
                            customCssRules[domain].push(selector);
                        });
                    } else {
                        customCssRules['global'] = customCssRules['global'] || [];
                        customCssRules['global'].push(selector);
                    }
                }
            }
        });
    }

    // 4. Biên dịch quy tắc mạng sang Chrome Declarative Net Request (DNR) format
    // Gom tất cả urlFilter và gán ID bắt đầu từ 3000
    const compiledDnrRules = [];
    let ruleId = 3000;

    // Ưu tiên nạp quy tắc tùy chỉnh trước
    customNetRules.forEach(filter => {
        compiledDnrRules.push({
            id: ruleId++,
            priority: 2, // Quy tắc tùy chỉnh có độ ưu tiên cao hơn
            action: { type: 'block' },
            condition: {
                urlFilter: filter,
                resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'image', 'other']
            }
        });
    });



    // 5. Kết hợp quy tắc ẩn CSS
    const compiledCssRules = { ...easyListCss };
    Object.keys(customCssRules).forEach(domain => {
        compiledCssRules[domain] = compiledCssRules[domain] || [];
        // Gộp selectors không trùng lặp
        customCssRules[domain].forEach(sel => {
            if (!compiledCssRules[domain].includes(sel)) {
                compiledCssRules[domain].push(sel);
            }
        });
    });

    // 6. Lưu tất cả vào chrome.storage.local
    await chrome.storage.local.set({
        compiledAdblockRules: compiledDnrRules,
        adblockCssRules: compiledCssRules
    });

    // 7. Yêu cầu background service worker nạp lại quy tắc mới
    chrome.runtime.sendMessage({ type: 'updateSecurityRules' });
    
    // Cập nhật lại số liệu hiển thị
    updateAdblockStats();
}

async function renderZapperManager() {
    const container = document.getElementById('zapperListContainer');
    const badge = document.getElementById('zapperCountBadge');
    if (!container || !badge) return;

    const data = await chrome.storage.local.get(['userZappedCssRules']);
    let zappedRules = data.userZappedCssRules || {};
    
    if (Object.keys(zappedRules).length > 500) {
        zappedRules = {};
        await chrome.storage.local.set({ userZappedCssRules: zappedRules });
    }
    
    let totalItems = 0;
    let html = '';
    
    for (const [domain, selectors] of Object.entries(zappedRules)) {
        if (!selectors || selectors.length === 0) continue;
        selectors.forEach((selector, index) => {
            totalItems++;
            const escapedDomain = escapeHTML(domain);
            const escapedSelector = escapeHTML(selector);
            
            html += `
                <div class="zapper-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 8px 12px; margin-bottom: 8px; border-radius: 8px; font-family: monospace; font-size: 12px;">
                    <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <span style="color: var(--secondary); font-weight: bold;">${escapedDomain}: </span>
                        <span style="color: var(--text-muted);">${escapedSelector}</span>
                    </div>
                    <button class="zapper-remove-btn" data-domain="${escapedDomain}" data-index="${index}" title="${getDict().unZapBtn || 'Xóa phần tử (Unzap)'}" style="background: rgba(255,71,87,0.2); color: #ff4757; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-left: 10px; transition: all 0.2s;">&times;</button>
                </div>
            `;
        });
    }

    badge.innerText = `${totalItems} items`;
    
    if (totalItems === 0) {
        container.innerHTML = `<div class="empty-state" style="text-align: center; color: var(--text-muted); padding: 20px; font-style: italic;">${getDict().zapperEmpty || 'Chưa có phần tử nào bị xóa bằng Zapper.'}</div>`;
        return;
    }
    
    container.innerHTML = html;
    
    if (!container._hasZapperListener) {
        container.addEventListener('mouseover', (e) => {
            const btn = e.target.closest('.zapper-remove-btn');
            if (btn) btn.style.background = '#ff4757';
        });
        container.addEventListener('mouseout', (e) => {
            const btn = e.target.closest('.zapper-remove-btn');
            if (btn) btn.style.background = 'rgba(255,71,87,0.2)';
        });
        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('.zapper-remove-btn');
            if (!btn) return;
            const domain = btn.getAttribute('data-domain');
            const index = parseInt(btn.getAttribute('data-index'), 10);
            
            const res = await chrome.storage.local.get(['userZappedCssRules']);
            const zapped = res.userZappedCssRules || {};
            if (zapped[domain]) {
                zapped[domain] = zapped[domain].filter((_, i) => i !== index);
                if (zapped[domain].length === 0) delete zapped[domain];
                await chrome.storage.local.set({ userZappedCssRules: zapped });
                if (window.notify) window.notify(getDict().unZapSuccess || 'Đã khôi phục phần tử.', 'success');
                renderZapperManager();
                chrome.runtime.sendMessage({ type: 'UPDATE_ADBLOCK_RULES' });
            }
        });
        container._hasZapperListener = true;
    }
}

// Lắng nghe thay đổi storage để cập nhật Filter Statistics real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        const localDateStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
        const key = `stats_${localDateStr}`;
        
        if (changes[key] || changes['compiledAdblockRules'] || changes['adblockCssRules'] || changes['adsBlockedCount']) {
            // Kiểm tra xem Adblock Manager có đang được mở không
            if (document.getElementById('adblockNetworkCount')) {
                updateAdblockStats();
            }
        }
    }
});
