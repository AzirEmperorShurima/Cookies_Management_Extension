import { elements, settings, notify, saveSettings, showConfirm } from '../popup.js';
import { createElement } from './utils.js';

const translations = window.translations;

export function loadContainers() {
    const { containerList } = elements;
    if (!containerList) return;

    const containers = settings.accountContainers || [];
    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;

    containerList.textContent = '';

    if (containers.length === 0) {
        containerList.appendChild(createElement('p', { className: 'empty-msg' }, dict.noContainers || 'No containers yet. Create one to start!'));
        return;
    }

    containers.forEach(container => {
        const card = document.createElement('div');
        card.className = 'container-card';
        card.style.setProperty('--container-color', container.color || '#3182ce');
        card.style.setProperty('--container-shadow', `${container.color || '#3182ce'}4D`);

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'container-card-icon';

        const iconImg = document.createElement('img');
        const iconName = container.icon || 'container.png';
        iconImg.src = `icons/${iconName}`;
        iconImg.alt = iconName;
        iconImg.style.width = '24px';
        iconImg.style.height = '24px';
        iconWrapper.appendChild(iconImg);

        card.appendChild(iconWrapper);

        const infoWrapper = document.createElement('div');
        infoWrapper.className = 'container-info-wrapper';
        infoWrapper.style.display = 'flex';
        infoWrapper.style.flexDirection = 'column';
        infoWrapper.style.flex = '1';
        infoWrapper.style.minWidth = '0';

        const name = document.createElement('span');
        name.className = 'container-card-name';
        name.textContent = container.name;
        name.style.fontWeight = '600';
        infoWrapper.appendChild(name);

        const targetUrl = container.targetUrl || 'https://www.google.com';
        const urlLabel = document.createElement('small');
        urlLabel.className = 'container-url-label';
        urlLabel.textContent = targetUrl.replace(/^https?:\/\//, '').substring(0, 24) + (targetUrl.length > 24 ? '...' : '');
        urlLabel.style.opacity = '0.7';
        urlLabel.style.fontSize = '0.7rem';
        infoWrapper.appendChild(urlLabel);

        card.appendChild(infoWrapper);

        const modeBadge = document.createElement('span');
        modeBadge.className = 'container-mode-badge';
        const isIsolated = container.mode === 'incognito';
        modeBadge.textContent = isIsolated ? '🔒 Incognito' : '🌐 Session';
        modeBadge.style.fontSize = '0.7rem';
        modeBadge.style.padding = '2px 6px';
        modeBadge.style.borderRadius = '4px';
        modeBadge.style.background = isIsolated ? 'rgba(168, 255, 120, 0.15)' : 'rgba(126, 214, 223, 0.15)';
        modeBadge.style.color = isIsolated ? '#a8ff78' : '#7ed6df';
        card.appendChild(modeBadge);

        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '4px';
        actionsDiv.style.alignItems = 'center';

        const saveSessionBtn = document.createElement('button');
        saveSessionBtn.className = 'container-action-btn';
        saveSessionBtn.textContent = '💾';
        saveSessionBtn.title = 'Save active tab session to this container';
        saveSessionBtn.style.background = 'transparent';
        saveSessionBtn.style.border = 'none';
        saveSessionBtn.style.cursor = 'pointer';
        saveSessionBtn.style.fontSize = '0.9rem';
        saveSessionBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.url && !tab.url.startsWith('chrome://')) {
                    const domain = new URL(tab.url).hostname;
                    const cookiesModule = await import('./cookies.js');
                    if (cookiesModule && cookiesModule.saveSnapshot) {
                        await cookiesModule.saveSnapshot(domain, `Container: ${container.name}`);
                        container.targetUrl = tab.url;
                        saveSettings();
                        loadContainers();
                        notify(`Saved session for "${container.name}" (${domain})!`, 'success');
                    }
                } else {
                    notify('No active web page to save session.', 'warning');
                }
            } catch (err) {
                notify('Could not save session: ' + err.message, 'error');
            }
        });
        actionsDiv.appendChild(saveSessionBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'container-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Remove Container';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (await showConfirm(`Remove container "${container.name}"?`)) {
                settings.accountContainers = settings.accountContainers.filter(c => c.id !== container.id);
                saveSettings();
                loadContainers();
                notify('Container removed', 'success');
            }
        });
        actionsDiv.appendChild(deleteBtn);

        card.appendChild(actionsDiv);

        card.addEventListener('click', async () => {
            const launchUrl = container.targetUrl || 'https://www.google.com';
            if (container.mode === 'incognito') {
                chrome.windows.create({
                    url: launchUrl,
                    incognito: true,
                    type: 'normal'
                });
                notify(`Opening "${container.name}" in isolated session window...`, 'success');
            } else {
                chrome.tabs.create({ url: launchUrl });
                notify(`Opening tab for "${container.name}"...`, 'info');
            }
        });

        containerList.appendChild(card);
    });
}

export function init() {
    const { addContainerBtn, newContainerName, newContainerColor, newContainerMode, containerIconPicker, quickIdentityBtn } = elements;

    if (addContainerBtn) {
        addContainerBtn.addEventListener('click', () => {
            if (!newContainerName || !newContainerColor) return;
            const name = newContainerName.value.trim();
            const color = newContainerColor.value;
            const mode = newContainerMode ? newContainerMode.value : 'normal';

            const selectedIconEl = document.querySelector('.picker-icon.selected');
            const icon = selectedIconEl ? selectedIconEl.getAttribute('data-icon') : 'container.png';

            if (!name) {
                notify('Please enter a container name.', 'warning');
                return;
            }

            const newContainer = {
                id: Date.now().toString(),
                name: name,
                color: color,
                icon: icon,
                mode: mode
            };

            if (!settings.accountContainers) settings.accountContainers = [];
            settings.accountContainers.push(newContainer);
            saveSettings();

            newContainerName.value = '';
            document.querySelectorAll('.picker-icon').forEach(i => i.classList.remove('selected'));
            if (containerIconPicker?.firstElementChild) {
                containerIconPicker.firstElementChild.classList.add('selected');
            }

            loadContainers();
            notify(`Container "${name}" created!`, 'success');
        });
    }

    if (quickIdentityBtn) {
        quickIdentityBtn.addEventListener('click', () => {
            const randomNames = ['Ghost', 'Phantom', 'Stealth', 'Ninja', 'Specter', 'Shadow', 'Anon', 'Voyager'];
            const randomColors = ['#3182ce', '#e53e3e', '#38a169', '#d69e2e', '#805ad5', '#ff0080'];
            const randomIcons = ['container.png', 'shield.png', 'incognito.png', 'shape.png', 'vietnam.png'];

            const name = `${randomNames[Math.floor(Math.random() * randomNames.length)]}_${Math.floor(Math.random() * 1000)}`;
            const color = randomColors[Math.floor(Math.random() * randomColors.length)];
            const icon = randomIcons[Math.floor(Math.random() * randomIcons.length)];

            const newContainer = {
                id: Date.now().toString(),
                name: name,
                color: color,
                icon: icon,
                isTemporary: true
            };

            if (!settings.accountContainers) settings.accountContainers = [];
            settings.accountContainers.push(newContainer);
            saveSettings();

            loadContainers();
            notify(`Quick Identity "${name}" created!`, 'success');
            chrome.tabs.create({ url: 'https://www.google.com' });
        });
    }

    loadContainers();
}
