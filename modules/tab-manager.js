/**
 * Vertical Tab Manager Module for Thanus Privacy Gauntlet
 * Manages vertical tabs layout, multi-window tree, Chrome tab groups,
 * audio controls, duplicate tab cleanup, hibernation, and session snapshots.
 */

import { elements, notify, showConfirm } from '../popup.js';
import { debounce, escapeHTML, ASSETS } from './utils.js';

// ==========================================
// STATE & CONFIG
// ==========================================
const tabState = {
    searchQuery: '',
    viewMode: 'window', // 'window' | 'domain'
    activeWindowOnly: false,
    collapsedGroups: new Set(),
    collapsedWindows: new Set(),
    isInitialized: false,
    sessions: []
};

// Chrome Tab Group Color Palettes
const GROUP_COLORS = {
    grey: '#5f6368',
    blue: '#1a73e8',
    red: '#d93025',
    yellow: '#f2994a',
    green: '#1e8e3e',
    pink: '#e52592',
    purple: '#9334e6',
    cyan: '#12b5cb',
    orange: '#fa903e'
};

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================
export function initVerticalTabManager() {
    if (tabState.isInitialized) return;
    tabState.isInitialized = true;

    // Load saved tab sessions
    loadSavedSessions();

    // Bind Controls
    const searchInput = document.getElementById('tabSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            tabState.searchQuery = e.target.value.trim().toLowerCase();
            renderVerticalTabManager();
        }, 200));

        const clearBtn = document.getElementById('tabSearchClearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                tabState.searchQuery = '';
                renderVerticalTabManager();
            });
        }
    }

    const viewModeToggle = document.getElementById('tabViewModeToggle');
    if (viewModeToggle) {
        viewModeToggle.addEventListener('click', () => {
            tabState.viewMode = tabState.viewMode === 'window' ? 'domain' : 'window';
            viewModeToggle.classList.toggle('active', tabState.viewMode === 'domain');
            viewModeToggle.title = tabState.viewMode === 'domain' ? 'Group by Window' : 'Group by Domain';
            renderVerticalTabManager();
        });
    }

    const closeDuplicatesBtn = document.getElementById('tabCloseDuplicatesBtn');
    if (closeDuplicatesBtn) {
        closeDuplicatesBtn.addEventListener('click', handleCloseDuplicateTabs);
    }

    const hibernateAllBtn = document.getElementById('tabHibernateAllBtn');
    if (hibernateAllBtn) {
        hibernateAllBtn.addEventListener('click', handleHibernateInactiveTabs);
    }

    const saveSessionBtn = document.getElementById('tabSaveSessionBtn');
    if (saveSessionBtn) {
        saveSessionBtn.addEventListener('click', handleSaveCurrentSession);
    }

    const newTabBtn = document.getElementById('tabCreateNewBtn');
    if (newTabBtn) {
        newTabBtn.addEventListener('click', () => {
            chrome.tabs.create({});
        });
    }

    // Register live Chrome Tab & Window listeners with debounced re-render
    const debouncedRender = debounce(() => {
        const section = document.getElementById('tabManagerSection');
        if (section && section.classList.contains('show')) {
            renderVerticalTabManager();
        }
    }, 150);

    if (chrome.tabs) {
        chrome.tabs.onCreated.addListener(debouncedRender);
        chrome.tabs.onRemoved.addListener(debouncedRender);
        chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
            if (changeInfo.status || changeInfo.title || changeInfo.favIconUrl || changeInfo.audible !== undefined || changeInfo.discarded !== undefined || changeInfo.pinned !== undefined) {
                debouncedRender();
            }
        });
        chrome.tabs.onMoved.addListener(debouncedRender);
        chrome.tabs.onActivated.addListener(debouncedRender);
        chrome.tabs.onHighlighted.addListener(debouncedRender);
    }

    if (chrome.tabGroups) {
        chrome.tabGroups.onCreated?.addListener(debouncedRender);
        chrome.tabGroups.onUpdated?.addListener(debouncedRender);
        chrome.tabGroups.onRemoved?.addListener(debouncedRender);
        chrome.tabGroups.onMoved?.addListener(debouncedRender);
    }

    if (chrome.windows) {
        chrome.windows.onCreated?.addListener(debouncedRender);
        chrome.windows.onRemoved?.addListener(debouncedRender);
        chrome.windows.onFocusChanged?.addListener(debouncedRender);
    }
}

// ==========================================
// CORE RENDER LOGIC
// ==========================================
export async function renderVerticalTabManager() {
    const container = document.getElementById('verticalTabListContainer');
    if (!container) return;

    try {
        const [windows, allTabs, currentWindow] = await Promise.all([
            chrome.windows.getAll({ populate: false }),
            chrome.tabs.query({}),
            chrome.windows.getCurrent()
        ]);

        let groupsMap = {};
        if (chrome.tabGroups && chrome.tabGroups.query) {
            try {
                const groups = await chrome.tabGroups.query({});
                groups.forEach(g => { groupsMap[g.id] = g; });
            } catch (e) {
                console.warn('TabGroups API error:', e);
            }
        }

        // Filter tabs based on search query
        let filteredTabs = allTabs;
        if (tabState.searchQuery) {
            filteredTabs = allTabs.filter(t => 
                (t.title && t.title.toLowerCase().includes(tabState.searchQuery)) ||
                (t.url && t.url.toLowerCase().includes(tabState.searchQuery))
            );
        }

        // Update stats badge
        const totalTabsCount = allTabs.length;
        const totalWindowsCount = windows.length;
        const statsEl = document.getElementById('tabStatsSummary');
        if (statsEl) {
            statsEl.textContent = `${totalTabsCount} Tabs • ${totalWindowsCount} Windows`;
        }

        container.innerHTML = '';

        if (filteredTabs.length === 0) {
            container.innerHTML = `
                <div class="vtab-empty-state">
                    <div class="vtab-empty-icon">🔍</div>
                    <div class="vtab-empty-text">No tabs matching "${escapeHTML(tabState.searchQuery)}"</div>
                </div>
            `;
            return;
        }

        // Render Pinned Tabs at the top (if any & not searching)
        const pinnedTabs = filteredTabs.filter(t => t.pinned);
        if (pinnedTabs.length > 0) {
            const pinnedContainer = document.createElement('div');
            pinnedContainer.className = 'vtab-pinned-section';
            pinnedContainer.innerHTML = `
                <div class="vtab-section-header">
                    <span class="vtab-section-title">📌 Pinned (${pinnedTabs.length})</span>
                </div>
                <div class="vtab-pinned-grid"></div>
            `;
            const pinnedGrid = pinnedContainer.querySelector('.vtab-pinned-grid');
            pinnedTabs.forEach(tab => {
                pinnedGrid.appendChild(createPinnedTabPill(tab));
            });
            container.appendChild(pinnedContainer);
        }

        // Render Normal Tabs by Selected View Mode
        const unpinnedTabs = filteredTabs.filter(t => !t.pinned);

        if (tabState.viewMode === 'domain') {
            renderDomainClusteredTabs(container, unpinnedTabs);
        } else {
            renderWindowGroupedTabs(container, unpinnedTabs, windows, currentWindow.id, groupsMap);
        }

        // Render Saved Sessions section at bottom
        renderSessionsFooter(container);

    } catch (error) {
        console.error('Error rendering Vertical Tab Manager:', error);
        container.innerHTML = `<div class="vtab-error">Failed to load tabs: ${escapeHTML(error.message)}</div>`;
    }
}

// ==========================================
// RENDER HELPERS: WINDOW & GROUP VIEW
// ==========================================
function renderWindowGroupedTabs(container, tabs, windows, currentWindowId, groupsMap) {
    // Group tabs by windowId
    const tabsByWindow = {};
    tabs.forEach(tab => {
        if (!tabsByWindow[tab.windowId]) tabsByWindow[tab.windowId] = [];
        tabsByWindow[tab.windowId].push(tab);
    });

    windows.forEach((win, index) => {
        const winTabs = tabsByWindow[win.id] || [];
        if (winTabs.length === 0) return;

        const isCurrentWin = win.id === currentWindowId;
        const isCollapsed = tabState.collapsedWindows.has(win.id);

        const winCard = document.createElement('div');
        winCard.className = `vtab-window-card ${isCurrentWin ? 'current-window' : ''}`;

        // Header for Window
        const winHeader = document.createElement('div');
        winHeader.className = 'vtab-window-header';
        winHeader.innerHTML = `
            <div class="vtab-window-title-row">
                <span class="vtab-collapse-arrow ${isCollapsed ? 'collapsed' : ''}">▼</span>
                <span class="vtab-window-title">
                    🪟 Window ${index + 1} ${isCurrentWin ? '<span class="vtab-current-badge">Current</span>' : ''}
                </span>
                <span class="vtab-window-count">${winTabs.length} tabs</span>
            </div>
            <div class="vtab-window-actions">
                <button class="vtab-icon-btn vtab-win-focus-btn" title="Focus this Window">🎯</button>
                <button class="vtab-icon-btn vtab-win-close-btn" title="Close Window">✕</button>
            </div>
        `;

        winHeader.querySelector('.vtab-window-title-row').addEventListener('click', () => {
            if (tabState.collapsedWindows.has(win.id)) {
                tabState.collapsedWindows.delete(win.id);
            } else {
                tabState.collapsedWindows.add(win.id);
            }
            renderVerticalTabManager();
        });

        winHeader.querySelector('.vtab-win-focus-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.windows.update(win.id, { focused: true });
        });

        winHeader.querySelector('.vtab-win-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirm(`Are you sure you want to close this entire window (${winTabs.length} tabs)?`, () => {
                chrome.windows.remove(win.id);
            });
        });

        winCard.appendChild(winHeader);

        // Window Tabs List Body
        if (!isCollapsed) {
            const tabsList = document.createElement('div');
            tabsList.className = 'vtab-tabs-list';

            // Partition into Chrome Tab Groups vs Ungrouped
            const renderedGroupIds = new Set();

            winTabs.forEach(tab => {
                const groupId = tab.groupId;
                if (groupId && groupId !== -1 && groupsMap[groupId]) {
                    if (!renderedGroupIds.has(groupId)) {
                        renderedGroupIds.add(groupId);
                        const groupInfo = groupsMap[groupId];
                        const groupTabs = winTabs.filter(t => t.groupId === groupId);
                        tabsList.appendChild(createTabGroupElement(groupInfo, groupTabs));
                    }
                } else if (!groupId || groupId === -1) {
                    tabsList.appendChild(createVerticalTabItem(tab));
                }
            });

            winCard.appendChild(tabsList);
        }

        container.appendChild(winCard);
    });
}

// ==========================================
// RENDER HELPERS: DOMAIN CLUSTER VIEW
// ==========================================
function renderDomainClusteredTabs(container, tabs) {
    const domainGroups = {};
    tabs.forEach(tab => {
        let domain = 'Other';
        try {
            if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
                domain = new URL(tab.url).hostname;
            }
        } catch (e) {}

        if (!domainGroups[domain]) domainGroups[domain] = [];
        domainGroups[domain].push(tab);
    });

    // Sort domains by tab count descending
    const sortedDomains = Object.keys(domainGroups).sort((a, b) => domainGroups[b].length - domainGroups[a].length);

    sortedDomains.forEach(domain => {
        const domainTabs = domainGroups[domain];
        const isCollapsed = tabState.collapsedGroups.has(`domain:${domain}`);

        const groupEl = document.createElement('div');
        groupEl.className = 'vtab-domain-group';

        const header = document.createElement('div');
        header.className = 'vtab-domain-header';
        
        let sampleIcon = domainTabs[0].favIconUrl || ASSETS.icons.default;
        if (!sampleIcon || sampleIcon.startsWith('chrome://') || sampleIcon.startsWith('edge://') || sampleIcon.startsWith('javascript:')) {
            sampleIcon = ASSETS.icons.default;
        }
        const safeSampleIcon = escapeHTML(sampleIcon);

        header.innerHTML = `
            <div class="vtab-domain-title-row">
                <span class="vtab-collapse-arrow ${isCollapsed ? 'collapsed' : ''}">▼</span>
                <img src="${safeSampleIcon}" class="vtab-domain-icon" onerror="this.src='${ASSETS.icons.default}'">
                <span class="vtab-domain-name">${escapeHTML(domain)}</span>
                <span class="vtab-domain-count">${domainTabs.length}</span>
            </div>
            <div class="vtab-group-actions">
                <button class="vtab-icon-btn vtab-close-all-domain" title="Close all ${domainTabs.length} tabs">✕</button>
            </div>
        `;

        header.querySelector('.vtab-domain-title-row').addEventListener('click', () => {
            const key = `domain:${domain}`;
            if (tabState.collapsedGroups.has(key)) {
                tabState.collapsedGroups.delete(key);
            } else {
                tabState.collapsedGroups.add(key);
            }
            renderVerticalTabManager();
        });

        header.querySelector('.vtab-close-all-domain').addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirm(`Close all ${domainTabs.length} tabs on ${domain}?`, () => {
                const tabIds = domainTabs.map(t => t.id);
                chrome.tabs.remove(tabIds);
            });
        });

        groupEl.appendChild(header);

        if (!isCollapsed) {
            const list = document.createElement('div');
            list.className = 'vtab-domain-list';
            domainTabs.forEach(tab => {
                list.appendChild(createVerticalTabItem(tab));
            });
            groupEl.appendChild(list);
        }

        container.appendChild(groupEl);
    });
}

// ==========================================
// TAB ITEM BUILDERS
// ==========================================
function createTabGroupElement(groupInfo, groupTabs) {
    const groupCard = document.createElement('div');
    groupCard.className = 'vtab-chrome-group';

    const colorHex = GROUP_COLORS[groupInfo.color] || '#1a73e8';
    groupCard.style.borderColor = colorHex;

    const isCollapsed = groupInfo.collapsed || tabState.collapsedGroups.has(`group:${groupInfo.id}`);

    const header = document.createElement('div');
    header.className = 'vtab-chrome-group-header';
    header.style.backgroundColor = `${colorHex}18`;
    header.style.borderLeft = `4px solid ${colorHex}`;

    const title = groupInfo.title || 'Tab Group';

    header.innerHTML = `
        <div class="vtab-group-title-row">
            <span class="vtab-group-color-dot" style="background-color: ${colorHex}"></span>
            <span class="vtab-group-title" style="color: ${colorHex}">${escapeHTML(title)}</span>
            <span class="vtab-group-count">(${groupTabs.length})</span>
        </div>
        <div class="vtab-group-controls">
            <button class="vtab-icon-btn vtab-ungroup-btn" title="Ungroup Tabs">🔓</button>
            <button class="vtab-icon-btn vtab-group-close-btn" title="Close Tab Group">✕</button>
        </div>
    `;

    header.querySelector('.vtab-group-title-row').addEventListener('click', () => {
        if (chrome.tabGroups && chrome.tabGroups.update) {
            chrome.tabGroups.update(groupInfo.id, { collapsed: !groupInfo.collapsed });
        }
    });

    header.querySelector('.vtab-ungroup-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const tabIds = groupTabs.map(t => t.id);
        chrome.tabs.ungroup(tabIds);
    });

    header.querySelector('.vtab-group-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirm(`Close all ${groupTabs.length} tabs in group "${title}"?`, () => {
            const tabIds = groupTabs.map(t => t.id);
            chrome.tabs.remove(tabIds);
        });
    });

    groupCard.appendChild(header);

    if (!isCollapsed) {
        const body = document.createElement('div');
        body.className = 'vtab-group-body';
        groupTabs.forEach(tab => {
            body.appendChild(createVerticalTabItem(tab));
        });
        groupCard.appendChild(body);
    }

    return groupCard;
}

function createVerticalTabItem(tab) {
    const item = document.createElement('div');
    const isActive = tab.active;
    const isDiscarded = tab.discarded;
    const isAudible = tab.audible;
    const isMuted = tab.mutedInfo?.muted;

    item.className = `vtab-item ${isActive ? 'active-tab' : ''} ${isDiscarded ? 'discarded-tab' : ''}`;
    item.dataset.tabId = tab.id;

    let favIconUrl = tab.favIconUrl || ASSETS.icons.default;
    if (!favIconUrl || favIconUrl.startsWith('chrome://') || favIconUrl.startsWith('edge://') || favIconUrl.startsWith('javascript:')) {
        favIconUrl = ASSETS.icons.default;
    }
    const safeFavicon = escapeHTML(favIconUrl);

    const titleEscaped = escapeHTML(tab.title || 'Untitled Tab');
    const urlEscaped = escapeHTML(tab.url || '');

    item.innerHTML = `
        <div class="vtab-item-main" title="${titleEscaped}\n${urlEscaped}">
            <div class="vtab-icon-wrapper">
                <img src="${safeFavicon}" class="vtab-favicon" onerror="this.src='${ASSETS.icons.default}'">
                ${isDiscarded ? '<span class="vtab-sleep-badge" title="Sleeping (RAM Freed)">💤</span>' : ''}
            </div>
            <div class="vtab-text-info">
                <div class="vtab-title">${titleEscaped}</div>
                <div class="vtab-url">${getDomainFromUrl(tab.url)}</div>
            </div>
        </div>
        <div class="vtab-actions">
            ${isAudible || isMuted ? `
                <button class="vtab-action-btn vtab-audio-btn ${isMuted ? 'muted' : 'playing'}" title="${isMuted ? 'Unmute Tab' : 'Mute Tab'}">
                    ${isMuted ? '🔇' : '🔊'}
                </button>
            ` : ''}
            <button class="vtab-action-btn vtab-pin-btn ${tab.pinned ? 'pinned' : ''}" title="${tab.pinned ? 'Unpin' : 'Pin Tab'}">
                📌
            </button>
            ${!isDiscarded && !isActive ? `
                <button class="vtab-action-btn vtab-sleep-btn" title="Sleep / Free RAM (Discard)">
                    💤
                </button>
            ` : ''}
            <button class="vtab-action-btn vtab-close-btn" title="Close Tab">
                ✕
            </button>
        </div>
    `;

    // Click on tab to focus
    item.querySelector('.vtab-item-main').addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
    });

    // Audio mute toggle
    const audioBtn = item.querySelector('.vtab-audio-btn');
    if (audioBtn) {
        audioBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.tabs.update(tab.id, { muted: !isMuted });
        });
    }

    // Pin toggle
    const pinBtn = item.querySelector('.vtab-pin-btn');
    if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.tabs.update(tab.id, { pinned: !tab.pinned });
        });
    }

    // Discard / Hibernate single tab
    const sleepBtn = item.querySelector('.vtab-sleep-btn');
    if (sleepBtn) {
        sleepBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.tabs.discard(tab.id, () => {
                notify('Tab sent to sleep to save RAM 💤', 'success');
            });
        });
    }

    // Close button
    item.querySelector('.vtab-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        item.style.transform = 'scale(0.95)';
        item.style.opacity = '0';
        setTimeout(() => {
            chrome.tabs.remove(tab.id);
        }, 150);
    });

    return item;
}

function createPinnedTabPill(tab) {
    const pill = document.createElement('div');
    pill.className = `vtab-pinned-pill ${tab.active ? 'active' : ''}`;
    pill.title = `${escapeHTML(tab.title || '')}\nClick to switch, Right-click to unpin`;

    let favIconUrl = tab.favIconUrl || ASSETS.icons.default;
    if (!favIconUrl || favIconUrl.startsWith('chrome://') || favIconUrl.startsWith('edge://') || favIconUrl.startsWith('javascript:')) {
        favIconUrl = ASSETS.icons.default;
    }
    const safeFavicon = escapeHTML(favIconUrl);

    pill.innerHTML = `
        <img src="${safeFavicon}" class="vtab-pinned-icon" onerror="this.src='${ASSETS.icons.default}'">
        <span class="vtab-pinned-title">${escapeHTML(tab.title || 'Tab')}</span>
    `;

    pill.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
    });

    pill.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        chrome.tabs.update(tab.id, { pinned: false });
    });

    return pill;
}

// ==========================================
// POWER TOOLS: DUPLICATE CLEANUP & HIBERNATION
// ==========================================
async function handleCloseDuplicateTabs() {
    try {
        const tabs = await chrome.tabs.query({});
        const urlMap = new Map();
        const tabsToClose = [];

        tabs.forEach(tab => {
            if (!tab.url || tab.pinned || tab.url.startsWith('chrome://')) return;

            // Strip hash to detect exact duplicates
            const cleanUrl = tab.url.split('#')[0];
            if (urlMap.has(cleanUrl)) {
                tabsToClose.push(tab.id);
            } else {
                urlMap.set(cleanUrl, tab.id);
            }
        });

        if (tabsToClose.length === 0) {
            notify('No duplicate tabs found! 👍', 'info');
            return;
        }

        showConfirm(`Found ${tabsToClose.length} duplicate tab(s). Close them to free resources?`, () => {
            chrome.tabs.remove(tabsToClose, () => {
                notify(`Closed ${tabsToClose.length} duplicate tab(s) 🚀`, 'success');
            });
        });
    } catch (err) {
        console.error('Duplicate cleanup error:', err);
        notify('Error closing duplicates: ' + err.message, 'error');
    }
}

async function handleHibernateInactiveTabs() {
    try {
        const tabs = await chrome.tabs.query({ active: false, pinned: false, discarded: false });
        if (tabs.length === 0) {
            notify('All eligible background tabs are already sleeping! 💤', 'info');
            return;
        }

        let hibernatedCount = 0;
        for (const tab of tabs) {
            // Do not discard audible tabs (e.g. playing Spotify or YouTube in background)
            if (tab.audible) continue;
            chrome.tabs.discard(tab.id);
            hibernatedCount++;
        }

        notify(`Hibernated ${hibernatedCount} background tab(s) to free RAM! ⚡`, 'success');
        setTimeout(renderVerticalTabManager, 300);
    } catch (err) {
        console.error('Hibernate error:', err);
        notify('Failed to hibernate tabs: ' + err.message, 'error');
    }
}

// ==========================================
// SESSION WORKSPACE (SAVE & RESTORE)
// ==========================================
async function loadSavedSessions() {
    const res = await chrome.storage.local.get(['vtabSessions']);
    tabState.sessions = res.vtabSessions || [];
}

async function handleSaveCurrentSession() {
    try {
        const currentWin = await chrome.windows.getCurrent({ populate: true });
        if (!currentWin || !currentWin.tabs || currentWin.tabs.length === 0) {
            notify('No tabs to save in current window!', 'error');
            return;
        }

        const validTabs = currentWin.tabs
            .filter(t => t.url && !t.url.startsWith('chrome://newtab'))
            .map(t => ({ title: t.title, url: t.url, pinned: t.pinned, favIconUrl: t.favIconUrl }));

        if (validTabs.length === 0) {
            notify('No valid web tabs to save.', 'info');
            return;
        }

        const defaultName = `Workspace - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const sessionName = prompt('Enter a name for this Tab Workspace Session:', defaultName);
        if (!sessionName) return;

        const newSession = {
            id: 'session_' + Date.now(),
            name: sessionName.trim(),
            savedAt: Date.now(),
            tabCount: validTabs.length,
            tabs: validTabs
        };

        tabState.sessions.unshift(newSession);
        // Keep max 20 saved sessions
        if (tabState.sessions.length > 20) tabState.sessions.pop();

        await chrome.storage.local.set({ vtabSessions: tabState.sessions });
        notify(`Saved Workspace "${sessionName}" with ${validTabs.length} tabs! 💾`, 'success');
        renderVerticalTabManager();
    } catch (err) {
        console.error('Error saving session:', err);
        notify('Failed to save session: ' + err.message, 'error');
    }
}

function renderSessionsFooter(container) {
    if (!tabState.sessions || tabState.sessions.length === 0) return;

    const sessionSection = document.createElement('div');
    sessionSection.className = 'vtab-sessions-section';
    sessionSection.innerHTML = `
        <div class="vtab-section-header">
            <span class="vtab-section-title">💾 Saved Workspaces (${tabState.sessions.length})</span>
        </div>
        <div class="vtab-sessions-list"></div>
    `;

    const list = sessionSection.querySelector('.vtab-sessions-list');
    tabState.sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'vtab-session-item';
        item.innerHTML = `
            <div class="vtab-session-info">
                <div class="vtab-session-name">${escapeHTML(session.name)}</div>
                <div class="vtab-session-meta">${session.tabCount} tabs • ${new Date(session.savedAt).toLocaleDateString()}</div>
            </div>
            <div class="vtab-session-actions">
                <button class="vtab-btn-pill vtab-restore-btn" title="Restore all tabs in a new window">Restore 🚀</button>
                <button class="vtab-icon-btn vtab-del-session-btn" title="Delete Workspace">🗑️</button>
            </div>
        `;

        item.querySelector('.vtab-restore-btn').addEventListener('click', () => {
            const urls = session.tabs.map(t => t.url);
            chrome.windows.create({ url: urls }, () => {
                notify(`Restored workspace "${session.name}"!`, 'success');
            });
        });

        item.querySelector('.vtab-del-session-btn').addEventListener('click', () => {
            showConfirm(`Delete workspace "${session.name}"?`, async () => {
                tabState.sessions = tabState.sessions.filter(s => s.id !== session.id);
                await chrome.storage.local.set({ vtabSessions: tabState.sessions });
                notify('Workspace deleted.', 'info');
                renderVerticalTabManager();
            });
        });

        list.appendChild(item);
    });

    container.appendChild(sessionSection);
}

// ==========================================
// UTILITY
// ==========================================
function getDomainFromUrl(urlStr) {
    if (!urlStr) return '';
    try {
        if (urlStr.startsWith('chrome://')) return 'Chrome Internal';
        if (urlStr.startsWith('edge://')) return 'Edge Internal';
        const u = new URL(urlStr);
        return u.hostname.replace(/^www\./, '');
    } catch (e) {
        return '';
    }
}
