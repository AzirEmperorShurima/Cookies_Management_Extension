import { elements, notify, showConfirm } from '../popup.js';
import { updateDashboard } from './dashboard.js';
import { createElement, ASSETS, escapeHTML } from './utils.js';

function getInstallTypeInfo(installType) {
    const info = {
        development: { icon: ASSETS.icons.dev, label: 'Development Mode' },
        normal: { icon: ASSETS.icons.store, label: 'Chrome Web Store' },
        admin: { icon: ASSETS.icons.admin, label: 'Admin Installed' },
        sideload: { icon: ASSETS.icons.other, label: 'Sideloaded' },
        other: { icon: ASSETS.icons.other, label: 'Other Source' }
    };
    return info[installType] || { icon: ASSETS.icons.other, label: 'Unknown Source' };
}

function createExtensionCardHTML(ext) {
    const iconUrl = ext.icons?.length ? ext.icons[ext.icons.length - 1].url : ASSETS.icons.extensionDefault;
    const { icon, label } = getInstallTypeInfo(ext.installType);

    const card = document.createElement('div');
    card.className = 'extension-card';

    const visiblePerms = ext.permissions.slice(0, 3);
    const hiddenPerms = ext.permissions.slice(3);
    const hasManyPermissions = ext.permissions.length > 3;

    const permissionsBox = createElement('div', { className: 'extension-permissions-box' },
        createElement('strong', {}, 'Permissions:')
    );

    const tagContainer = createElement('div', { 
        className: 'permissions-tag-container', 
        style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } 
    });

    if (ext.permissions.length === 0) {
        tagContainer.textContent = 'None';
    } else {
        visiblePerms.forEach(p => {
            tagContainer.appendChild(createElement('span', { className: 'permission-tag' }, p));
        });
        if (hasManyPermissions) {
            const extraDiv = createElement('div', { 
                className: 'extra-permissions', 
                style: { display: 'none', marginTop: '4px', flexWrap: 'wrap', gap: '4px', width: '100%' } 
            });
            hiddenPerms.forEach(p => {
                extraDiv.appendChild(createElement('span', { className: 'permission-tag' }, p));
            });
            const expandBtn = createElement('button', { 
                className: 'permissions-expand-btn', 
                style: { background: 'none', border: 'none', color: '#7928ca', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 0', marginTop: '4px', fontWeight: '600', display: 'block', width: '100%', textAlign: 'left' } 
            }, '[+ Expand]');
            
            tagContainer.appendChild(extraDiv);
            tagContainer.appendChild(expandBtn);
        }
    }
    permissionsBox.appendChild(tagContainer);

    const iconImg = createElement('img', { src: iconUrl, alt: ext.name, className: 'extension-large-icon' });
    iconImg.onerror = () => { iconImg.onerror = null; iconImg.src = ASSETS.icons.extension; };

    const checkbox = createElement('input', { type: 'checkbox' });
    if (ext.enabled) checkbox.checked = true;

    card.textContent = '';
    card.appendChild(
        createElement('div', { className: 'extension-top' },
            createElement('div', { className: 'extension-large-icon-container' }, iconImg),
            createElement('div', { className: 'extension-info' },
                createElement('h3', { className: 'extension-name' }, ext.name),
                createElement('span', { className: 'extension-version' }, `v${ext.version}`)
            )
        )
    );
    card.appendChild(
        createElement('div', { className: 'extension-status-bar ' + (ext.enabled ? 'enabled' : 'disabled') },
            createElement('label', { className: 'switch' },
                checkbox,
                createElement('span', { className: 'slider round' })
            ),
            createElement('span', { className: 'status-text' }, ext.enabled ? 'Enabled' : 'Disabled'),
            createElement('button', { className: 'remove-extension' }, 'Remove')
        )
    );
    card.appendChild(
        createElement('div', { className: 'extension-meta' },
            createElement('strong', {}, 'Type: '),
            label + ' ',
            createElement('img', { src: icon, title: label, alt: label, className: 'type-mini-icon' })
        )
    );
    card.appendChild(permissionsBox);

    return card;
}

function addToggleEvent(card, ext) {
    const toggle = card.querySelector('input[type="checkbox"]');
    toggle.addEventListener('change', async () => {
        const newState = toggle.checked;

        if (!newState && ext.enabled) {
            if (!(await showConfirm(`Are you sure you want to disable "${ext.name}"?`))) {
                toggle.checked = true;
                return;
            }
        }

        toggle.disabled = true;

        try {
            await new Promise((resolve, reject) => {
                chrome.management.setEnabled(ext.id, newState, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            });

            ext.enabled = newState;

            const statusBox = card.querySelector('.extension-status-bar');
            statusBox.className = `extension-status-bar ${newState ? 'enabled' : 'disabled'}`;
            card.querySelector('.status-text').textContent = newState ? 'Enabled' : 'Disabled';

            notify(`Extension "${ext.name}" ${newState ? 'enabled' : 'disabled'}`, 'success');
            updateDashboard();
        } catch (error) {
            toggle.checked = !newState;
            notify(`Failed to change state: ${error.message}`, 'error');
        } finally {
            toggle.disabled = false;
        }
    });
}

function addRemoveEvent(card, ext) {
    const removeButton = card.querySelector('.remove-extension');
    removeButton.addEventListener('click', async () => {
        if (await showConfirm(`Are you sure you want to remove "${ext.name}"?`)) {
            chrome.management.uninstall(ext.id, () => {
                if (chrome.runtime.lastError) {
                    notify(`Failed to remove "${ext.name}": ${chrome.runtime.lastError.message}`, 'error');
                    return;
                }
                card.remove();
                notify(`Extension "${ext.name}" removed`, 'warning');
            });
        }
    });
}

function addPermissionsToggleEvent(card) {
    const expandBtn = card.querySelector('.permissions-expand-btn');
    const extraPerms = card.querySelector('.extra-permissions');
    if (expandBtn && extraPerms) {
        expandBtn.addEventListener('click', () => {
            const isHidden = extraPerms.style.display === 'none';
            if (isHidden) {
                extraPerms.style.display = 'flex';
                expandBtn.textContent = '[- Collapse]';
            } else {
                extraPerms.style.display = 'none';
                expandBtn.textContent = '[+ Expand]';
            }
        });
    }
}

export function displayExtensions() {
    const { extensionsList, cookiesList, controls, extensionManager, cookiesManager } = elements;
    const isVisible = extensionsList.classList.contains('show');

    cookiesList.classList.remove('show');
    controls.classList.remove('show');
    cookiesManager.classList.remove('active');

    if (!isVisible) {
        renderExtensions();
    } else {
        extensionsList.classList.remove('show');
        extensionManager.classList.remove('active');
    }
}

let extensionFilterState = {
    search: '',
    type: 'all' // 'all' | 'enabled' | 'disabled' | 'dev'
};

export function renderExtensions() {
    const { extensionsList, extensionManager } = elements;
    if (!extensionsList || !extensionManager) return;

    extensionsList.textContent = '';
    extensionManager.classList.add('active');
    
    // Toolbar: Search + Quick Filter Pills
    const toolbar = document.createElement('div');
    toolbar.className = 'ext-toolbar glass-card';
    toolbar.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; padding: 10px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);';

    toolbar.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="extSearchInput" placeholder="Search extensions by name..." value="${escapeHTML(extensionFilterState.search)}"
                style="flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: var(--text-color); outline: none; font-size: 0.85rem;">
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="ext-filter-pill ${extensionFilterState.type === 'all' ? 'active' : ''}" data-type="all" style="padding: 3px 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); background: ${extensionFilterState.type === 'all' ? '#00f2fe22' : 'transparent'}; color: var(--text-color); font-size: 0.75rem; cursor: pointer;">All</button>
            <button class="ext-filter-pill ${extensionFilterState.type === 'enabled' ? 'active' : ''}" data-type="enabled" style="padding: 3px 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); background: ${extensionFilterState.type === 'enabled' ? '#00f2fe22' : 'transparent'}; color: var(--text-color); font-size: 0.75rem; cursor: pointer;">Enabled</button>
            <button class="ext-filter-pill ${extensionFilterState.type === 'disabled' ? 'active' : ''}" data-type="disabled" style="padding: 3px 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); background: ${extensionFilterState.type === 'disabled' ? '#00f2fe22' : 'transparent'}; color: var(--text-color); font-size: 0.75rem; cursor: pointer;">Disabled</button>
            <button class="ext-filter-pill ${extensionFilterState.type === 'dev' ? 'active' : ''}" data-type="dev" style="padding: 3px 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); background: ${extensionFilterState.type === 'dev' ? '#00f2fe22' : 'transparent'}; color: var(--text-color); font-size: 0.75rem; cursor: pointer;">Dev Mode</button>
        </div>
    `;

    toolbar.querySelector('#extSearchInput').addEventListener('input', (e) => {
        extensionFilterState.search = e.target.value.toLowerCase().trim();
        renderExtensionsListOnly();
    });

    toolbar.querySelectorAll('.ext-filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            extensionFilterState.type = btn.dataset.type;
            renderExtensions();
        });
    });

    extensionsList.appendChild(toolbar);

    const container = document.createElement('div');
    container.id = 'extensionsGridContainer';
    container.className = 'extensions-grid';
    extensionsList.appendChild(container);

    renderExtensionsListOnly();
    extensionsList.classList.add('show');
}

function renderExtensionsListOnly() {
    const container = document.getElementById('extensionsGridContainer');
    if (!container) return;
    container.innerHTML = '';

    chrome.management.getAll((extensions) => {
        const filtered = extensions.filter(ext => {
            if (ext.id === chrome.runtime.id) return false; // Hide self

            // Search filter
            if (extensionFilterState.search && !ext.name.toLowerCase().includes(extensionFilterState.search)) {
                return false;
            }

            // Type filter
            if (extensionFilterState.type === 'enabled') return ext.enabled;
            if (extensionFilterState.type === 'disabled') return !ext.enabled;
            if (extensionFilterState.type === 'dev') return ext.installType === 'development';

            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No extensions match current filter.</div>';
            return;
        }

        filtered.forEach((ext) => {
            const actualCard = createExtensionCardHTML(ext);
            addToggleEvent(actualCard, ext);
            addRemoveEvent(actualCard, ext);
            addPermissionsToggleEvent(actualCard);
            container.appendChild(actualCard);
        });
    });
}

export function init() {
    renderExtensions();
}
