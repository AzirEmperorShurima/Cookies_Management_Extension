import { elements, settings, notify, saveSettings, showConfirm } from '../popup.js';
import { debounce, createElement, ASSETS } from './utils.js';

let currentCookiesByDomain = {};
let cachedCookies = [];

// ============ COOKIE SECURITY INSPECTOR ============
function createSecurityBadges(cookie) {
    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'cookie-security-badges';

    // 1. Secure Badge
    const securePill = document.createElement('span');
    securePill.className = `security-pill ${cookie.secure ? 'pill-secure' : 'pill-insecure'}`;
    securePill.title = cookie.secure ? '🔒 HTTPS Only (Encrypted transmission)' : '⚠️ Insecure (Transmitted over plain HTTP)';
    securePill.textContent = cookie.secure ? '🔒 Secure' : '⚠️ Insecure';
    badgesContainer.appendChild(securePill);

    // 2. HttpOnly Badge
    const httpOnlyPill = document.createElement('span');
    httpOnlyPill.className = `security-pill ${cookie.httpOnly ? 'pill-httponly' : 'pill-js'}`;
    httpOnlyPill.title = cookie.httpOnly ? '🛡️ HttpOnly (Protected from XSS / JS access)' : 'Accessible via document.cookie (XSS Risk)';
    httpOnlyPill.textContent = cookie.httpOnly ? '🛡️ HttpOnly' : 'JS Access';
    badgesContainer.appendChild(httpOnlyPill);

    // 3. SameSite Badge
    const sameSite = (cookie.sameSite || 'unspecified').toLowerCase();
    const sameSitePill = document.createElement('span');
    if (sameSite === 'strict') {
        sameSitePill.className = 'security-pill pill-samesite-strict';
        sameSitePill.title = 'SameSite=Strict (Max CSRF Protection)';
        sameSitePill.textContent = '🌐 Strict';
    } else if (sameSite === 'lax') {
        sameSitePill.className = 'security-pill pill-samesite-lax';
        sameSitePill.title = 'SameSite=Lax (Standard CSRF Protection)';
        sameSitePill.textContent = '🌐 Lax';
    } else if (sameSite === 'no_restriction' || sameSite === 'none') {
        sameSitePill.className = 'security-pill pill-samesite-none';
        sameSitePill.title = 'SameSite=None (Cross-site access allowed)';
        sameSitePill.textContent = '🌐 None';
    }
    if (sameSitePill.textContent) {
        badgesContainer.appendChild(sameSitePill);
    }

    // 4. Partitioned (CHIPS) Badge
    if (cookie.partitionKey || cookie.partitioned) {
        const partitionedPill = document.createElement('span');
        partitionedPill.className = 'security-pill pill-partitioned';
        partitionedPill.title = 'CHIPS (Cookies Having Independent Partitioned State)';
        partitionedPill.textContent = '🧩 CHIPS';
        badgesContainer.appendChild(partitionedPill);
    }

    return badgesContainer;
}

// ============ COOKIE SANITIZATION HELPER ============
export function sanitizeCookieForSet(c, fallbackDomain = '') {
    let domain = c.domain || fallbackDomain || '';
    const isHostOnly = c.hostOnly === true || (domain && !domain.startsWith('.'));
    const cleanDomain = domain.startsWith('.') ? domain.slice(1) : (domain || 'localhost');
    const path = c.path || '/';
    const url = `http${c.secure ? 's' : ''}://${cleanDomain}${path}`;

    const details = {
        url: url,
        name: c.name,
        value: c.value || '',
        path: path,
        secure: Boolean(c.secure),
        httpOnly: Boolean(c.httpOnly)
    };

    // Only set domain for non-host-only cookies
    if (!isHostOnly && domain) {
        details.domain = domain.startsWith('.') ? domain : `.${domain}`;
    }

    // Chrome API only accepts specific sameSite values
    if (c.sameSite) {
        const lowerSameSite = c.sameSite.toLowerCase();
        if (['no_restriction', 'lax', 'strict'].includes(lowerSameSite)) {
            details.sameSite = lowerSameSite;
        }
    }

    if (c.expirationDate && typeof c.expirationDate === 'number') {
        details.expirationDate = c.expirationDate;
    }

    if (c.partitionKey) {
        details.partitionKey = c.partitionKey;
    }

    return details;
}

// ============ COOKIE & FULL ACCOUNT SNAPSHOTS / PROFILE SWITCHER ============
export async function getSnapshots(domain) {
    const res = await chrome.storage.local.get(['cookieSnapshots']);
    const allSnapshots = res.cookieSnapshots || {};
    const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
    return allSnapshots[cleanDomain] || allSnapshots[domain] || [];
}

export async function saveSnapshot(domain, profileName) {
    if (!profileName) return;
    const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
    const cookies = await chrome.cookies.getAll({ domain: domain });

    // Trích xuất LocalStorage & SessionStorage từ tab hiện tại
    let localStorageData = {};
    let sessionStorageData = {};
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id && tab.url && (tab.url.includes(cleanDomain) || tab.url.includes(domain))) {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const local = {};
                    const session = {};
                    try {
                        for (let i = 0; i < localStorage.length; i++) {
                            const k = localStorage.key(i);
                            local[k] = localStorage.getItem(k);
                        }
                    } catch (e) {}
                    try {
                        for (let i = 0; i < sessionStorage.length; i++) {
                            const k = sessionStorage.key(i);
                            session[k] = sessionStorage.getItem(k);
                        }
                    } catch (e) {}
                    return { local, session };
                }
            });
            if (results && results[0] && results[0].result) {
                localStorageData = results[0].result.local || {};
                sessionStorageData = results[0].result.session || {};
            }
        }
    } catch (e) {
        console.warn('[Snapshot] Could not extract web storage:', e);
    }

    if ((!cookies || cookies.length === 0) && Object.keys(localStorageData).length === 0) {
        notify(`No session data found to save for ${domain}`, 'warning');
        return;
    }

    const res = await chrome.storage.local.get(['cookieSnapshots']);
    const allSnapshots = res.cookieSnapshots || {};
    if (!allSnapshots[cleanDomain]) allSnapshots[cleanDomain] = [];

    const newSnapshot = {
        id: 'snap_' + Date.now(),
        name: profileName,
        createdAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cookiesCount: cookies.length,
        storageCount: Object.keys(localStorageData).length,
        cookies: cookies,
        localStorageData: localStorageData,
        sessionStorageData: sessionStorageData
    };

    allSnapshots[cleanDomain].push(newSnapshot);
    await chrome.storage.local.set({ cookieSnapshots: allSnapshots });
    notify(`Saved profile "${profileName}" (${cookies.length} cookies, ${Object.keys(localStorageData).length} storage keys)`, 'success');
}

export async function restoreSnapshot(domain, snapshotId) {
    const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
    const snapshots = await getSnapshots(domain);
    const target = snapshots.find(s => s.id === snapshotId);
    if (!target) {
        notify('Snapshot profile not found', 'error');
        return;
    }

    if (!(await showConfirm(`Switch to profile "${target.name}"? Current session for ${domain} will be replaced.`))) {
        return;
    }

    // 1. Delete all current cookies in domain
    const currentCookies = await chrome.cookies.getAll({ domain: domain });
    await Promise.all(
        currentCookies.map(c => {
            const cDomain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
            return chrome.cookies.remove({
                url: `http${c.secure ? 's' : ''}://${cDomain}${c.path}`,
                name: c.name
            });
        })
    );

    // 2. Set all cookies from target snapshot with sanitization
    for (const c of target.cookies) {
        const setDetails = sanitizeCookieForSet(c, cleanDomain);
        try {
            await chrome.cookies.set(setDetails);
        } catch (e) {
            console.warn('[Cookies] Failed to restore cookie:', c.name, e);
        }
    }

    // 3. Restore LocalStorage & SessionStorage into the active tab
    if (target.localStorageData || target.sessionStorageData) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id && tab.url && (tab.url.includes(cleanDomain) || tab.url.includes(domain))) {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [target.localStorageData || {}, target.sessionStorageData || {}],
                    func: (savedLocal, savedSession) => {
                        try {
                            localStorage.clear();
                            Object.keys(savedLocal).forEach(k => localStorage.setItem(k, savedLocal[k]));
                            sessionStorage.clear();
                            Object.keys(savedSession).forEach(k => sessionStorage.setItem(k, savedSession[k]));
                        } catch (err) {}
                    }
                });
            }
        } catch (e) {
            console.warn('[Snapshot] Could not restore web storage:', e);
        }
    }

    notify(`Switched to profile "${target.name}"! Reloading tab...`, 'success');

    // 4. Reload active tab if matching domain
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && (tab.url.includes(cleanDomain) || tab.url.includes(domain))) {
            chrome.tabs.reload(tab.id);
        }
    } catch (e) {}

    // Refresh UI
    loadCookies('', true);
    renderCurrentTabCookies(cleanDomain);
}

export async function deleteSnapshot(domain, snapshotId) {
    const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
    const res = await chrome.storage.local.get(['cookieSnapshots']);
    const allSnapshots = res.cookieSnapshots || {};
    if (!allSnapshots[cleanDomain]) return;

    allSnapshots[cleanDomain] = allSnapshots[cleanDomain].filter(s => s.id !== snapshotId);
    if (allSnapshots[cleanDomain].length === 0) {
        delete allSnapshots[cleanDomain];
    }
    await chrome.storage.local.set({ cookieSnapshots: allSnapshots });
    notify('Snapshot profile removed', 'success');
}

export async function exportProfiles(domain) {
    const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
    const snapshots = await getSnapshots(domain);
    if (!snapshots || snapshots.length === 0) {
        notify('No profiles to export for this domain', 'warning');
        return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshots, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${cleanDomain}_profiles_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    notify(`Exported ${snapshots.length} profiles for ${cleanDomain}`, 'success');
}

function renderSnapshotBar(domain, parentElement, onRefresh) {
    getSnapshots(domain).then(snapshots => {
        const bar = document.createElement('div');
        bar.className = 'domain-snapshots-bar';

        const title = document.createElement('span');
        title.className = 'snapshots-title';
        title.innerHTML = '<span>📸 Profiles:</span>';
        bar.appendChild(title);

        if (snapshots.length === 0) {
            const emptyLabel = document.createElement('span');
            emptyLabel.style.fontSize = '0.72rem';
            emptyLabel.style.color = 'var(--text-muted)';
            emptyLabel.textContent = 'None';
            bar.appendChild(emptyLabel);
        } else {
            snapshots.forEach(s => {
                const chip = document.createElement('span');
                chip.className = 'snapshot-chip';
                chip.title = `Created: ${s.createdAt} · ${s.cookiesCount} cookies, ${s.storageCount || 0} storage items. Click to switch!`;
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = s.name;
                nameSpan.addEventListener('click', () => {
                    restoreSnapshot(domain, s.id);
                });

                const removeBtn = document.createElement('span');
                removeBtn.className = 'snapshot-remove-btn';
                removeBtn.textContent = '×';
                removeBtn.title = 'Delete profile';
                removeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (await showConfirm(`Delete profile "${s.name}"?`)) {
                        await deleteSnapshot(domain, s.id);
                        if (typeof onRefresh === 'function') onRefresh();
                    }
                });

                chip.appendChild(nameSpan);
                chip.appendChild(removeBtn);
                bar.appendChild(chip);
            });
        }

        const actionsWrapper = document.createElement('div');
        actionsWrapper.style.display = 'inline-flex';
        actionsWrapper.style.gap = '4px';
        actionsWrapper.style.marginLeft = 'auto';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'snapshot-save-btn';
        saveBtn.innerHTML = '<span>+</span> <span>Save Session</span>';
        saveBtn.addEventListener('click', async () => {
            const profileName = prompt(`Enter profile name for ${domain} (e.g. Work Acc, Personal, Clone 1):`);
            if (profileName && profileName.trim()) {
                await saveSnapshot(domain, profileName.trim());
                if (typeof onRefresh === 'function') onRefresh();
            }
        });
        actionsWrapper.appendChild(saveBtn);

        if (snapshots.length > 0) {
            const exportBtn = document.createElement('button');
            exportBtn.className = 'snapshot-save-btn';
            exportBtn.style.opacity = '0.85';
            exportBtn.innerHTML = '<span>📥 Export</span>';
            exportBtn.title = 'Export profiles to JSON file';
            exportBtn.addEventListener('click', () => exportProfiles(domain));
            actionsWrapper.appendChild(exportBtn);
        }

        bar.appendChild(actionsWrapper);
        parentElement.appendChild(bar);
    });
}

export async function loadCookies(filter = '', forceRefresh = false) {
    const { cookieTableContainer, totalCookies } = elements;
    if (!cookieTableContainer) return;

    if (forceRefresh || cachedCookies.length === 0) {
        cachedCookies = await chrome.cookies.getAll({});
    }

    const cookiesByDomain = {};
    const lowerFilter = filter.toLowerCase();

    cachedCookies.forEach((cookie) => {
        if (cookie.name.toLowerCase().includes(lowerFilter) ||
            cookie.domain.toLowerCase().includes(lowerFilter)) {
            cookiesByDomain[cookie.domain] = cookiesByDomain[cookie.domain] || [];
            cookiesByDomain[cookie.domain].push(cookie);
        }
    });

    currentCookiesByDomain = cookiesByDomain;

    const totalDomains = Object.keys(cookiesByDomain).length;
    const totalCookiesCount = Object.values(cookiesByDomain).reduce((count, list) => count + list.length, 0);

    if (totalDomains === 0) {
        cookieTableContainer.textContent = '';
        if (totalCookies) totalCookies.textContent = `No results found for "${filter}"`;
        return;
    }

    if (totalCookies) {
        totalCookies.textContent = `${totalDomains} Domains · ${totalCookiesCount} Cookies`;
    }

    const fragment = document.createDocumentFragment();

    Object.keys(cookiesByDomain).forEach((domain) => {
        const domainSection = document.createElement('div');
        domainSection.className = 'domain-section';

        const domainHeader = document.createElement('div');
        domainHeader.className = 'domain-header';

        const domainLabel = document.createElement('span');
        domainLabel.className = 'domain-label';
        domainLabel.textContent = domain;
        domainHeader.appendChild(domainLabel);

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'domain-actions';

        const copyIcon = document.createElement('img');
        copyIcon.src = ASSETS.icons.copy;
        copyIcon.title = 'Copy Domain Cookies';
        copyIcon.className = 'copy-domain-btn';
        copyIcon.dataset.domain = domain;

        const clearIcon = document.createElement('img');
        clearIcon.src = ASSETS.icons.clear;
        clearIcon.title = 'Clear Domain Cookies';
        clearIcon.className = 'clear-domain-btn';
        clearIcon.dataset.domain = domain;

        actionsContainer.appendChild(copyIcon);
        actionsContainer.appendChild(clearIcon);
        domainHeader.appendChild(actionsContainer);
        domainSection.appendChild(domainHeader);

        // Render Snapshot Profiles Bar for this domain
        renderSnapshotBar(domain, domainSection, () => loadCookies(filter, true));

        const tableContainer = document.createElement('div');
        tableContainer.style.overflowX = 'auto';

        const table = createElement('table', {},
            createElement('thead', {},
                createElement('tr', {},
                    createElement('th', {}, 'Name & Security'),
                    createElement('th', {}, 'Value'),
                    createElement('th', {}, 'Path'),
                    createElement('th', {}, 'Expires'),
                    createElement('th', {}, 'Expand')
                )
            )
        );
        const tbody = createElement('tbody');
        cookiesByDomain[domain].forEach(cookie => {
            const expiresText = cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleString() : 'Session';
            const isLongValue = cookie.value.length > 30 || cookie.name.length > 20 || cookie.path.length > 15;

            const nameCell = createElement('td', {},
                createElement('span', { className: 'cookie-text-container', title: cookie.name }, cookie.name),
                createSecurityBadges(cookie)
            );

            const tr = createElement('tr', { className: 'cookie-row' },
                nameCell,
                createElement('td', {}, createElement('span', { className: 'cookie-text-container', title: cookie.value }, cookie.value)),
                createElement('td', {}, createElement('span', { className: 'cookie-text-container', title: cookie.path }, cookie.path)),
                createElement('td', {}, createElement('span', { className: 'cookie-text-container', title: expiresText }, expiresText)),
                createElement('td', {}, isLongValue ? createElement('button', { className: 'row-expand-btn', title: 'Expand Row' }, '...') : null)
            );
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        domainSection.appendChild(tableContainer);
        fragment.appendChild(domainSection);
    });

    cookieTableContainer.textContent = '';
    cookieTableContainer.appendChild(fragment);
}

export async function deleteCookiesInDomain(domain, filter) {
    if (!(await showConfirm(`Are you sure you want to delete all cookies in ${domain}?`))) return;

    const cookies = await chrome.cookies.getAll({ domain: domain });
    await Promise.all(
        cookies.map((cookie) => {
            const cleanDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
            return chrome.cookies.remove({
                url: `http${cookie.secure ? 's' : ''}://${cleanDomain}${cookie.path}`,
                name: cookie.name
            });
        })
    );
    notify(`All cookies in ${domain} deleted`, 'warning');
    loadCookies(filter, true);

    // Refresh current tab cookies if open
    const currentTabCookiesContainer = document.getElementById('currentTabCookiesContainer');
    if (currentTabCookiesContainer && currentTabCookiesContainer.style.display === 'block') {
        const currentTabDomainName = document.getElementById('currentTabDomainName');
        if (currentTabDomainName && currentTabDomainName.textContent === domain) {
            renderCurrentTabCookies(domain);
        }
    }
}

export async function clearAllCookies() {
    if (!(await showConfirm('Are you sure you want to clear all cookies?'))) return;

    const cookies = await chrome.cookies.getAll({});
    await Promise.all(
        cookies.map((cookie) => {
            const cleanDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
            return chrome.cookies.remove({
                url: `http${cookie.secure ? 's' : ''}://${cleanDomain}${cookie.path}`,
                name: cookie.name
            });
        })
    );
    notify('All cookies cleared', 'warning');
    loadCookies('', true);
}

export async function clearSiteData() {
    if (!(await showConfirm('Are you sure you want to clear all site data?'))) return;

    await chrome.browsingData.remove(
        { since: 0 },
        { cookies: true, cache: true, localStorage: true }
    );
    notify('All site data cleared', 'warning');
    loadCookies('', true);
}

export async function copyCurrentTabCookies() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) throw new Error('Unable to get tab URL');

        const url = new URL(tab.url);
        const domain = url.hostname;
        const cookies = await chrome.cookies.getAll({ url: tab.url });

        if (!cookies.length) throw new Error('No cookies found');

        const cookieString = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
        const data = `domain=${domain}\n${cookieString}`;

        await navigator.clipboard.writeText(data);
        notify('Cookies copied to clipboard', 'success');
    } catch (error) {
        notify(`Failed to copy cookies: ${error.message}`, 'error');
    }
}

export async function pasteCookies() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) throw new Error('Clipboard is empty');

        let domain, cookies;
        try {
            const jsonCookies = JSON.parse(text);
            if (Array.isArray(jsonCookies)) {
                cookies = jsonCookies;
                domain = cookies[0]?.domain;
            } else {
                throw new Error('Invalid JSON format');
            }
        } catch {
            const [domainLine, ...cookieLines] = text.split('\n');
            const domainMatch = domainLine?.match(/^domain=(.+)$/);
            if (!domainMatch) throw new Error('Domain not found');

            domain = domainMatch[1];
            cookies = cookieLines
                .map((line) => {
                    const separator = line.indexOf('=');
                    if (separator === -1) return null;
                    return { name: line.slice(0, separator), value: line.slice(separator + 1) };
                })
                .filter(Boolean);
        }

        if (!domain || !cookies.length) throw new Error('No valid cookies found');

        const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
        const newTab = await chrome.tabs.create({ url: `https://${cleanDomain}` });
        await Promise.all(
            cookies.map((cookie) => {
                const details = sanitizeCookieForSet(cookie, cleanDomain);
                return chrome.cookies.set(details).catch(err => {
                    console.warn('[Cookies] Error setting pasted cookie:', cookie.name, err);
                });
            })
        );
        notify('Cookies pasted and tab opened', 'success');
    } catch (error) {
        notify(`Failed to paste cookies: ${error.message}`, 'error');
    }
}

export function renderWhitelist() {
    const { whitelistList } = elements;
    if (!whitelistList) return;

    whitelistList.textContent = '';
    const whitelist = settings.whitelist || [];

    whitelist.forEach(domain => {
        const tag = createElement('div', { className: 'whitelist-tag' },
            createElement('span', {}, domain),
            createElement('span', { className: 'whitelist-remove', dataset: { domain: domain } }, '×')
        );
        whitelistList.appendChild(tag);
    });

    whitelistList.querySelectorAll('.whitelist-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const domain = e.target.dataset.domain;
            settings.whitelist = settings.whitelist.filter(d => d !== domain);
            saveSettings();
            renderWhitelist();
            notify(`Removed ${domain} from whitelist`, 'success');
        });
    });
}
export async function renderCurrentTabCookies(host) {
    const currentTabCookieTable = document.getElementById('currentTabCookieTable');
    const currentTabDomainName = document.getElementById('currentTabDomainName');
    if (!currentTabCookieTable) return;

    try {
        const cookies = await chrome.cookies.getAll({ domain: host });
        if (currentTabDomainName) currentTabDomainName.textContent = host;

        currentTabCookieTable.textContent = '';

        // Render Snapshot Profiles Bar for Current Tab
        renderSnapshotBar(host, currentTabCookieTable, () => renderCurrentTabCookies(host));

        if (cookies.length === 0) {
            currentTabCookieTable.appendChild(createElement('p', { className: 'empty-msg', style: { margin: '10px 0', color: 'var(--text-muted)' } }, 'No cookies found for this domain.'));
            return;
        }

        const table = createElement('table', { className: 'cookies-table', style: { width: '100%', borderCollapse: 'collapse' } },
            createElement('thead', {},
                createElement('tr', {},
                    createElement('th', {}, 'Name & Security'),
                    createElement('th', {}, 'Value'),
                    createElement('th', {}, 'Path'),
                    createElement('th', {}, 'Expires'),
                    createElement('th', {}, 'Expand')
                )
            )
        );
        const tbody = createElement('tbody');
        cookies.forEach(cookie => {
            const expiresText = cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleString() : 'Session';
            const isLongValue = cookie.value.length > 30 || cookie.name.length > 20 || cookie.path.length > 15;

            const nameCell = createElement('td', {},
                createElement('span', { className: 'cookie-text-container', title: cookie.name }, cookie.name),
                createSecurityBadges(cookie)
            );

            const tr = createElement('tr', { className: 'cookie-row' },
                nameCell,
                createElement('td', {}, createElement('span', { className: 'cookie-text-container', title: cookie.value }, cookie.value)),
                createElement('td', {}, createElement('span', { className: 'cookie-text-container', title: cookie.path }, cookie.path)),
                createElement('td', {}, createElement('span', { className: 'cookie-text-container', title: expiresText }, expiresText)),
                createElement('td', {}, isLongValue ? createElement('button', { className: 'row-expand-btn', title: 'Expand Row' }, '...') : null)
            );
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        currentTabCookieTable.appendChild(table);
        // Event delegation for row-expand-btn is handled globally in init()
    } catch (err) {
        console.error(err);
        currentTabCookieTable.textContent = '';
        currentTabCookieTable.appendChild(createElement('p', { className: 'empty-msg', style: { color: 'var(--danger-color, #ef4444)' } }, 'Failed to load cookies.'));
    }
}

export function init() {
    const {
        cookieTableContainer, filterInput, clearCookies, clearSiteData: clearSiteDataBtn,
        copyCurrentCookies, pasteCookies: pasteCookiesBtn, cookieDestroyerToggle,
        addWhitelistBtn, whitelistInput, autoCleanupRulesSection
    } = elements;

    if (cookieTableContainer) {
        // Shared logic for both tables
        const handleExpandClick = (e) => {
            const expandBtn = e.target.closest('.row-expand-btn');
            if (expandBtn) {
                const targetRow = expandBtn.closest('.cookie-row');
                if (targetRow) {
                    targetRow.classList.toggle('expanded');
                    expandBtn.classList.toggle('active');
                }
            }
        };

        const currentTabCookieTable = document.getElementById('currentTabCookieTable');
        if (currentTabCookieTable) {
            currentTabCookieTable.addEventListener('click', handleExpandClick);
        }

        cookieTableContainer.addEventListener('click', (e) => {
            handleExpandClick(e);
            
            const copyBtn = e.target.closest('.copy-domain-btn');
            if (copyBtn) {
                const domain = copyBtn.dataset.domain;
                const domainCookies = currentCookiesByDomain[domain];
                if (domainCookies) {
                    const cookiesParser = JSON.stringify(domainCookies, null, 2);
                    navigator.clipboard.writeText(cookiesParser);
                    notify(`Copied ${domain} cookies`, 'success');
                }
                return;
            }

            const clearBtn = e.target.closest('.clear-domain-btn');
            if (clearBtn) {
                const domain = clearBtn.dataset.domain;
                deleteCookiesInDomain(domain, filterInput?.value || '');
                return;
            }
        });
    }

    if (filterInput) {
        filterInput.addEventListener('input', debounce((e) => {
            loadCookies(e.target.value);
        }, 200));
    }

    if (clearCookies) clearCookies.addEventListener('click', () => clearAllCookies());
    if (clearSiteDataBtn) clearSiteDataBtn.addEventListener('click', () => clearSiteData());
    if (copyCurrentCookies) copyCurrentCookies.addEventListener('click', () => copyCurrentTabCookies());
    if (pasteCookiesBtn) pasteCookiesBtn.addEventListener('click', () => pasteCookies());

    if (cookieDestroyerToggle) {
        cookieDestroyerToggle.addEventListener('change', (e) => {
            settings.cookieDestroyer = e.target.checked;
            if (autoCleanupRulesSection) {
                autoCleanupRulesSection.style.display = settings.cookieDestroyer ? 'block' : 'none';
            }
            saveSettings();
            notify(`Auto-Cookie Destroyer ${settings.cookieDestroyer ? 'enabled' : 'disabled'}`, 'success');
        });
    }

    if (addWhitelistBtn) {
        addWhitelistBtn.addEventListener('click', () => {
            if (!whitelistInput) return;
            const domain = whitelistInput.value.trim().toLowerCase();
            if (!domain) return;

            if (!settings.whitelist) settings.whitelist = [];
            if (settings.whitelist.includes(domain)) {
                notify('Domain already in whitelist', 'warning');
                return;
            }

            settings.whitelist.push(domain);
            saveSettings();
            whitelistInput.value = '';
            renderWhitelist();
            notify(`Added ${domain} to whitelist`, 'success');
        });
    }

    const getCurrentDomainCookies = document.getElementById('getCurrentDomainCookies');
    const currentTabCookiesContainer = document.getElementById('currentTabCookiesContainer');
    const closeCurrentTabCookiesBtn = document.getElementById('closeCurrentTabCookiesBtn');

    if (getCurrentDomainCookies && currentTabCookiesContainer) {
        getCurrentDomainCookies.addEventListener('click', async () => {
            const isVisible = currentTabCookiesContainer.style.display === 'block';
            if (isVisible) {
                currentTabCookiesContainer.style.display = 'none';
                getCurrentDomainCookies.classList.remove('active-filter');
                getCurrentDomainCookies.style.background = '';
            } else {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.url) {
                        notify('No active tab detected or permission denied', 'warning');
                        return;
                    }
                    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                        notify('Cannot query cookies on browser internal pages', 'warning');
                        return;
                    }
                    const urlObj = new URL(tab.url);
                    let host = urlObj.hostname;
                    if (host.startsWith('www.')) {
                        host = host.substring(4);
                    }
                    
                    currentTabCookiesContainer.style.display = 'block';
                    getCurrentDomainCookies.classList.add('active-filter');
                    getCurrentDomainCookies.style.background = 'var(--success-color, #10b981)';
                    
                    await renderCurrentTabCookies(host);
                } catch (err) {
                    console.error(err);
                    notify('Failed to get current tab domain', 'error');
                }
            }
        });
    }

    if (closeCurrentTabCookiesBtn && currentTabCookiesContainer) {
        closeCurrentTabCookiesBtn.addEventListener('click', () => {
            currentTabCookiesContainer.style.display = 'none';
            if (getCurrentDomainCookies) {
                getCurrentDomainCookies.classList.remove('active-filter');
                getCurrentDomainCookies.style.background = '';
            }
        });
    }

    const backToTopCookiesBtn = document.getElementById('backToTopCookiesBtn');
    if (backToTopCookiesBtn) {
        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            if (scrollTop > 200) {
                backToTopCookiesBtn.classList.remove('hidden');
            } else {
                backToTopCookiesBtn.classList.add('hidden');
            }
        });

        backToTopCookiesBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    renderWhitelist();
    loadCookies();
}
