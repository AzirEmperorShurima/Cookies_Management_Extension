let allLogs = [];
let isRecording = true;
let currentFilters = {
    source: 'all', 
    status: 'all', 
    rule: 'all',
    type: 'all' 
};
let currentContext = 'extension'; // tabId as string, or 'extension', 'background', 'all'
let searchQuery = '';
let selectedLogId = null;
let bgPort = null;

const logTable = document.getElementById('logBody');
const searchInput = document.getElementById('searchInput');
const detailsPanel = document.getElementById('detailsPanel');
const emptyState = document.getElementById('emptyState');
const toggleRecordBtn = document.getElementById('toggleRecordBtn');
const contextSelect = document.getElementById('contextSelect');

// Escape HTML
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Format time
function formatTime(ts) {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

// Format Domain
function getDomain(urlStr) {
    try {
        return new URL(urlStr).hostname;
    } catch(e) {
        return urlStr;
    }
}

// Check if 1p or 3p
function isFirstParty(url, initiator) {
    if (!initiator || initiator === 'Other') return false;
    try {
        const uHost = new URL(url).hostname.replace(/^www\./, '');
        const iHost = new URL(initiator).hostname.replace(/^www\./, '');
        return uHost.endsWith(iHost) || iHost.endsWith(uHost);
    } catch (e) {
        return false;
    }
}

// Render Table
function renderTable() {
    logTable.innerHTML = '';
    
    let filtered = allLogs.filter(log => {
        // Context filter
        if (currentContext !== 'all') {
            if (currentContext === 'extension') {
                if (log.tabId !== -1) return false;
            } else if (currentContext === 'background') {
                if (log.tabId !== -1) return false;
            } else {
                if (log.tabId !== parseInt(currentContext)) return false;
            }
        }

        // Source filter
        if (currentFilters.source === '1p' && !isFirstParty(log.url, log.initiator)) return false;
        if (currentFilters.source === '3p' && isFirstParty(log.url, log.initiator)) return false;
        
        // Status filter
        if (currentFilters.status !== 'all') {
            if (currentFilters.status === 'normal' && (log.status === 'blocked' || log.status === 'modified')) return false;
            if (currentFilters.status !== 'normal' && log.status !== currentFilters.status) return false;
        }
        
        // Rule filter
        if (currentFilters.rule === 'user' && (!log.ruleId || log.rulesetId !== 'custom_rules')) return false;

        // Type filter
        if (currentFilters.type !== 'all') {
            const types = currentFilters.type.split(',');
            if (currentFilters.type === 'other') {
                const knownTypes = ['main_frame', 'sub_frame', 'stylesheet', 'script', 'xmlhttprequest', 'image', 'media'];
                if (knownTypes.includes(log.type)) return false;
            } else if (!types.includes(log.type)) {
                return false;
            }
        }

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!log.url.toLowerCase().includes(q) && !(log.initiator && log.initiator.toLowerCase().includes(q))) {
                return false;
            }
        }
        
        return true;
    });

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
        logTable.parentElement.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        logTable.parentElement.style.display = 'block';
    }

    // Render max 500
    const toRender = filtered.slice(0, 500);
    const fragment = document.createDocumentFragment();
    
    toRender.forEach(log => {
        const tr = document.createElement('tr');
        if (log.id === selectedLogId) tr.classList.add('selected');
        
        let statusBadge = 'status-pending';
        let statusText = '...';
        let isBlocked = false;
        
        if (log.status === 'allowed') { statusBadge = 'status-allowed'; statusText = 'Đã cho phép'; }
        else if (log.status === 'blocked') { statusBadge = 'status-blocked'; statusText = 'Đã chặn'; isBlocked = true; }
        else if (log.status === 'modified') { statusBadge = 'status-modified'; statusText = 'Đã sửa đổi'; }
        else if (log.status === 'error') { statusBadge = 'status-error'; statusText = 'Lỗi'; }
        else if (log.status === 'pending') { statusText = 'Đang tải'; }

        const domain = escapeHTML(getDomain(log.url));
        const urlClass = isBlocked ? 'url-text blocked-url' : 'url-text';
        const ruleText = log.ruleId ? `#${escapeHTML(log.ruleId)}` : '-';
        const eUrl = escapeHTML(log.url);
        const eType = escapeHTML(log.type || 'khác');
        const eRuleset = escapeHTML(log.rulesetId || '-');
        const eInitiator = escapeHTML(getDomain(log.initiator));

        tr.innerHTML = `
            <td>${formatTime(log.timestamp)}</td>
            <td><span class="status-badge ${statusBadge}">${statusText}</span></td>
            <td title="${eUrl}"><span class="${urlClass}">${domain}</span></td>
            <td>${eType}</td>
            <td class="rule-text">${ruleText}</td>
            <td>${eRuleset}</td>
            <td title="${escapeHTML(log.initiator)}">${eInitiator}</td>
        `;

        tr.addEventListener('click', () => {
            document.querySelectorAll('#logBody tr').forEach(r => r.classList.remove('selected'));
            tr.classList.add('selected');
            selectedLogId = log.id;
            showDetails(log);
        });

        fragment.appendChild(tr);
    });

    logTable.appendChild(fragment);
}

function showDetails(log) {
    detailsPanel.classList.add('open');
    
    // Status Code & Method
    document.getElementById('detailStatusCode').textContent = '200'; // Mock HTTP status code if not available, wait, we don't have it in logEntry. Use '---'
    document.getElementById('detailMethod').textContent = log.method || 'GET';
    
    // Status Filtering Text
    const stEl = document.getElementById('detailStatus');
    let stText = log.status === 'allowed' ? 'Đã cho phép' : 
                 log.status === 'blocked' ? 'Đã bị chặn 🚫' : 
                 log.status === 'modified' ? 'Đã chỉnh sửa' : log.status;
    stEl.textContent = stText;
    
    if (log.status === 'blocked') {
        stEl.style.color = 'var(--color-blocked)';
    } else if (log.status === 'allowed') {
        stEl.style.color = 'var(--color-allowed)';
    } else {
        stEl.style.color = 'var(--text-main)';
    }

    // URL Details
    const urlEl = document.getElementById('detailUrl');
    urlEl.textContent = log.url;
    urlEl.classList.remove('expanded');
    
    const showFullUrlBtn = document.getElementById('showFullUrlBtn');
    showFullUrlBtn.onclick = (e) => {
        e.preventDefault();
        urlEl.classList.add('expanded');
        showFullUrlBtn.style.display = 'none';
    };
    showFullUrlBtn.style.display = 'inline';
    
    document.getElementById('openInNewTabBtn').href = log.url;

    // Type and Initiator
    document.getElementById('detailType').textContent = log.type || 'Khác';
    document.getElementById('detailInitiator').textContent = log.initiator || 'Trực tiếp';

    // Rule Details
    const ruleSection = document.getElementById('detailRuleSection');
    const rulesetSection = document.getElementById('detailRulesetSection');
    const actionBtn = document.getElementById('blockActionBtn');

    if (log.ruleId) {
        ruleSection.style.display = 'block';
        rulesetSection.style.display = 'block';
        document.getElementById('detailRule').textContent = `${log.ruleId}`; // In a real app we might reverse lookup the exact text string
        document.getElementById('detailRuleset').textContent = log.rulesetId || 'Bộ lọc không xác định';
    } else {
        ruleSection.style.display = 'none';
        rulesetSection.style.display = 'none';
    }
    
    // Bottom Button Action
    if (log.status === 'blocked') {
        actionBtn.textContent = 'Bỏ chặn';
        actionBtn.className = 'action-btn-large'; // green
    } else {
        actionBtn.textContent = 'Chặn';
        actionBtn.className = 'action-btn-large btn-red';
    }
}

document.getElementById('closePanelBtn').addEventListener('click', () => {
    detailsPanel.classList.remove('open');
    selectedLogId = null;
    document.querySelectorAll('#logBody tr').forEach(r => r.classList.remove('selected'));
});

// Context Selector Setup
function initContextSelector() {
    chrome.tabs.query({}, (tabs) => {
        const fragment = document.createDocumentFragment();
        
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = 'Tất cả các thẻ';
        fragment.appendChild(allOpt);

        const extOpt = document.createElement('option');
        extOpt.value = 'extension';
        extOpt.textContent = 'Tiện ích';
        fragment.appendChild(extOpt);
        
        const bgOpt = document.createElement('option');
        bgOpt.value = 'background';
        bgOpt.textContent = 'Thẻ chạy nền';
        fragment.appendChild(bgOpt);

        tabs.forEach(tab => {
            if (tab.url && tab.url.startsWith('chrome-extension://')) return;
            const opt = document.createElement('option');
            opt.value = tab.id.toString();
            // Create a short title like AdGuard "(68) Title..."
            let shortTitle = tab.title;
            if (shortTitle && shortTitle.length > 40) shortTitle = shortTitle.substring(0, 40) + '...';
            opt.textContent = `(${tab.id}) ${shortTitle}`;
            fragment.appendChild(opt);
        });

        contextSelect.innerHTML = '';
        contextSelect.appendChild(fragment);
    });
}
initContextSelector();

contextSelect.addEventListener('change', (e) => {
    currentContext = e.target.value;
    renderTable();
});


// Filters Setup
document.querySelectorAll('.filter-group .pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const filter = e.target.dataset.filter;
        const groupEl = e.target.closest('.filter-group');
        const groupType = groupEl.dataset.group;
        
        if (groupType === 'rule') {
            // Toggle logic for rule
            if (currentFilters.rule === filter) {
                currentFilters.rule = 'all';
                e.target.classList.remove('active');
            } else {
                currentFilters.rule = filter;
                e.target.classList.add('active');
            }
        } else {
            // Radio logic for others
            groupEl.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
            currentFilters[groupType] = filter;
            e.target.classList.add('active');
        }
        
        renderTable();
    });
});

document.getElementById('resetFiltersLink').addEventListener('click', (e) => {
    e.preventDefault();
    currentFilters = { source: 'all', status: 'all', rule: 'all', type: 'all' };
    document.querySelectorAll('.filter-group').forEach(group => {
        group.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        const allBtn = group.querySelector('.pill[data-filter="all"]');
        if (allBtn) allBtn.classList.add('active');
    });
    searchQuery = '';
    searchInput.value = '';
    renderTable();
});

document.getElementById('reloadPageLink').addEventListener('click', (e) => {
    e.preventDefault();
    location.reload();
});

searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTable();
});

document.getElementById('clearBtn').addEventListener('click', () => {
    allLogs = [];
    renderTable();
    detailsPanel.classList.remove('open');
    if (bgPort) {
        bgPort.postMessage({ type: 'clear_logs' });
    }
});

toggleRecordBtn.addEventListener('click', () => {
    isRecording = !isRecording;
    if (isRecording) {
        toggleRecordBtn.classList.add('active-record');
        toggleRecordBtn.classList.remove('paused');
    } else {
        toggleRecordBtn.classList.remove('active-record');
        toggleRecordBtn.classList.add('paused');
    }
});

document.getElementById('refreshBtn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '🔄 Đang tải...';
    if (bgPort) {
        bgPort.postMessage({ type: 'request_logs' });
    } else {
        renderTable();
    }
    setTimeout(() => { btn.innerHTML = originalText; }, 500);
});

// Connect to Background Script
function connectToBackground() {
    bgPort = chrome.runtime.connect({ name: 'network-logger' });
    
    bgPort.onMessage.addListener((msg) => {
        if (msg.type === 'init_logs') {
            allLogs = msg.logs || [];
            renderTable();
        } else if (msg.type === 'new_log' && isRecording) {
            allLogs.unshift(msg.log);
            if (allLogs.length > 1000) allLogs.pop();
            renderTable();
        } else if (msg.type === 'update_log') {
            const index = allLogs.findIndex(l => l.id === msg.log.id);
            if (index !== -1) {
                allLogs[index] = msg.log;
                if (selectedLogId === msg.log.id) {
                    showDetails(msg.log);
                }
                if (isRecording) renderTable();
            }
        }
    });

    bgPort.onDisconnect.addListener(() => {
        console.log('Disconnected from background.');
        setTimeout(connectToBackground, 2000);
    });
}

connectToBackground();
