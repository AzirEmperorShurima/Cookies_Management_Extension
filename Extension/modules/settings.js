import { elements, settings, notify, saveSettings, updateUILanguage, applySettings, state, showConfirm, ModuleLoader } from '../popup.js';
import { isValidUrl, hashPassword, verifyPassword, generateMasterKey, decryptData, encryptData, createElement, ASSETS } from './utils.js';
import { updatePlayerSize } from './player.js';

const translations = window.translations;
const getDict = () => translations[settings.language || 'vi'] || translations.vi;
let currentTabsToSave = [];

export function toggleCustomBgUrlRow() {
    const { customBgUrlRow } = elements;
    if (!customBgUrlRow) return;

    if (settings.playerBackgroundType === 'custom') {
        customBgUrlRow.classList.remove('hidden');
    } else {
        customBgUrlRow.classList.add('hidden');
    }
}

export function renderCustomBgList() {
    const { customBgList } = elements;
    if (!customBgList) return;

    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;
    customBgList.textContent = '';

    if (!settings.customBgList || settings.customBgList.length === 0) {
        customBgList.appendChild(createElement('p', { className: 'empty-msg' }, dict.noCustomBg || 'No custom backgrounds added.'));
        return;
    }

    settings.customBgList.forEach((url, index) => {
        const item = document.createElement('div');
        item.className = `custom-bg-item ${settings.customBgUrl === url ? 'active' : ''}`;

        const preview = document.createElement('img');
        preview.src = url;
        preview.className = 'custom-bg-item-preview';
        preview.onerror = () => { preview.onerror = null; preview.src = ASSETS.icons.extension; };

        const urlSpan = document.createElement('span');
        urlSpan.className = 'custom-bg-item-url';
        urlSpan.textContent = url.length > 30 ? url.substring(0, 27) + '...' : url;
        urlSpan.title = url;

        const actions = document.createElement('div');
        actions.className = 'custom-bg-item-actions';

        const selectBtn = document.createElement('button');
        selectBtn.textContent = '✔';
        selectBtn.title = 'Select this background';
        selectBtn.onclick = (e) => {
            e.stopPropagation();
            settings.customBgUrl = url;
            saveSettings();
            renderCustomBgList();
            applyPlayerBackground();
            notify(getDict().bgUpdated, 'success');
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑';
        deleteBtn.title = 'Delete this background';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (await showConfirm('Delete this background from list?')) {
                settings.customBgList.splice(index, 1);
                if (settings.customBgUrl === url) {
                    settings.customBgUrl = settings.customBgList[0] || '';
                }
                saveSettings();
                renderCustomBgList();
                applyPlayerBackground();
            }
        };

        actions.appendChild(selectBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(preview);
        item.appendChild(urlSpan);
        item.appendChild(actions);

        item.onclick = () => {
            updateBgPreview(url);
        };

        customBgList.appendChild(item);
    });
}

export const BG_DISPLAY_MODES = {
    cover: {
        size: 'cover',
        repeat: 'no-repeat',
        position: 'center',
        objectFit: 'cover',
        label: 'Cover'
    },
    contain: {
        size: 'contain',
        repeat: 'no-repeat',
        position: 'center',
        objectFit: 'contain',
        label: 'Contain'
    },
    stretch: {
        size: '100% 100%',
        repeat: 'no-repeat',
        position: 'center',
        objectFit: 'fill',
        label: 'Stretch'
    },
    repeat: {
        size: 'auto',
        repeat: 'repeat',
        position: 'top left',
        objectFit: 'none',
        label: 'Repeat'
    },
    center: {
        size: 'auto',
        repeat: 'no-repeat',
        position: 'center',
        objectFit: 'none',
        label: 'Center'
    },
    smart: {
        size: 'cover',
        repeat: 'no-repeat',
        position: 'center',
        objectFit: 'cover',
        label: 'Smart Adaptive'
    }
};

export let isDisplayModePreviewEnabled = true;

export function updatePlayerViewportGhost(flash = false) {
    const ghost = document.getElementById('playerViewportGhost');
    const container = document.getElementById('bgPreviewContainer');
    const label = document.getElementById('ghostFrameLabel');
    if (!ghost || !container) return;

    if (!isDisplayModePreviewEnabled) {
        ghost.classList.add('hidden-ghost');
        return;
    }

    const pW = parseFloat(settings.defaultPlayerWidth) || 600;
    const pH = parseFloat(settings.defaultPlayerHeight) || 400;
    if (label) label.textContent = `🎬 Player Viewport (${Math.round(pW)}×${Math.round(pH)})`;

    const rect = container.getBoundingClientRect();
    const cW = rect.width || container.clientWidth || 500;
    const cH = rect.height || container.clientHeight || 500;

    const padding = 24;
    const availW = Math.max(80, cW - padding * 2);
    const availH = Math.max(80, cH - padding * 2);

    const playerRatio = pW / pH;
    let gW = availW;
    let gH = gW / playerRatio;

    if (gH > availH) {
        gH = availH;
        gW = gH * playerRatio;
    }

    ghost.style.width = `${Math.round(gW)}px`;
    ghost.style.height = `${Math.round(gH)}px`;
    ghost.style.left = `${Math.round((cW - gW) / 2)}px`;
    ghost.style.top = `${Math.round((cH - gH) / 2)}px`;

    if (flash) {
        ghost.classList.remove('flash-pulse');
        void ghost.offsetWidth; // Force reflow
        ghost.classList.add('flash-pulse');
    }
}

export function updateBgPreview(url) {
    const { bgPreviewImg, bgPreviewPlaceholder } = elements;
    const container = document.getElementById('bgPreviewContainer');
    const badge = document.getElementById('bgPreviewModeBadge');
    const ghost = document.getElementById('playerViewportGhost');
    if (!container) return;

    const targetUrl = url || (settings.playerBackgroundType === 'custom' && settings.customBgUrl ? settings.customBgUrl : ASSETS.images.defaultBg);
    const mode = settings.playerBgDisplayMode || 'cover';

    if (targetUrl && (isValidUrl(targetUrl) || targetUrl.startsWith('data:') || targetUrl.startsWith('chrome') || targetUrl.startsWith('moz') || targetUrl.startsWith('/') || targetUrl.startsWith('./') || targetUrl === ASSETS.images.defaultBg)) {
        const testImg = new Image();
        testImg.onload = () => {
            let modeConfig = BG_DISPLAY_MODES[mode] || BG_DISPLAY_MODES.cover;
            let displayLabel = modeConfig.label || mode.toUpperCase();

            if (mode === 'smart') {
                const isPortrait = testImg.naturalHeight > testImg.naturalWidth * 1.05;
                if (isPortrait) {
                    modeConfig = {
                        size: 'contain',
                        repeat: 'no-repeat',
                        position: 'center',
                        objectFit: 'contain'
                    };
                    displayLabel = 'Smart: Dọc (Contain)';
                } else {
                    modeConfig = {
                        size: 'cover',
                        repeat: 'no-repeat',
                        position: 'center',
                        objectFit: 'cover'
                    };
                    displayLabel = 'Smart: Ngang (Cover)';
                }
            }

            if (isDisplayModePreviewEnabled) {
                // ── Preview Mode ON: Áp dụng Background Display Mode lên ảnh/khung
                if (badge) {
                    badge.textContent = `${displayLabel} 🟢`;
                    badge.classList.add('active-preview');
                    badge.classList.remove('disabled-preview');
                    badge.title = 'Display Mode Preview: ĐANG BẬT (Nhấp để tắt)';
                }

                if (mode === 'repeat') {
                    container.style.backgroundImage = `url('${targetUrl}')`;
                    container.style.backgroundSize = modeConfig.size;
                    container.style.backgroundRepeat = modeConfig.repeat;
                    container.style.backgroundPosition = modeConfig.position;
                } else {
                    container.style.backgroundImage = 'none';
                }

                if (bgPreviewImg) {
                    bgPreviewImg.src = targetUrl;
                    bgPreviewImg.classList.remove('hidden');
                    bgPreviewImg.style.objectFit = modeConfig.objectFit || 'contain';
                    bgPreviewImg.style.opacity = mode === 'repeat' ? '0' : '1';
                }

                if (ghost) ghost.classList.remove('hidden-ghost');
                updatePlayerViewportGhost(false);
            } else {
                // ── Preview Mode OFF: Hiển thị ảnh gốc RAW, không áp dụng Display Mode
                if (badge) {
                    badge.textContent = `RAW (Preview OFF) ⚪`;
                    badge.classList.add('disabled-preview');
                    badge.classList.remove('active-preview');
                    badge.title = 'Display Mode Preview: ĐÃ TẮT (Nhấp để bật lại)';
                }

                container.style.backgroundImage = 'none';
                if (bgPreviewImg) {
                    bgPreviewImg.src = targetUrl;
                    bgPreviewImg.classList.remove('hidden');
                    bgPreviewImg.style.objectFit = 'contain';
                    bgPreviewImg.style.opacity = '1';
                }

                if (ghost) ghost.classList.add('hidden-ghost');
            }

            if (bgPreviewPlaceholder) bgPreviewPlaceholder.classList.add('hidden');
        };
        testImg.onerror = () => {
            container.style.backgroundImage = 'none';
            if (bgPreviewImg) bgPreviewImg.classList.add('hidden');
            if (bgPreviewPlaceholder) {
                bgPreviewPlaceholder.classList.remove('hidden');
                bgPreviewPlaceholder.textContent = 'Invalid Image URL';
            }
            if (ghost) ghost.classList.add('hidden-ghost');
        };
        testImg.src = targetUrl;
    } else {
        container.style.backgroundImage = 'none';
        if (bgPreviewImg) bgPreviewImg.classList.add('hidden');
        if (bgPreviewPlaceholder) {
            bgPreviewPlaceholder.classList.remove('hidden');
            bgPreviewPlaceholder.textContent = 'No Image Selected';
        }
        if (ghost) ghost.classList.add('hidden-ghost');
    }
}

export function applyPlayerBackground() {
    const { playerContainer } = elements;
    if (!playerContainer) return;

    const mode = settings.playerBgDisplayMode || 'cover';
    const gradient = "linear-gradient(135deg, rgba(26, 26, 46, 0.4) 0%, rgba(22, 33, 62, 0.4) 100%)";
    let bgImage;
    if (settings.playerBackgroundType === 'custom' && settings.customBgUrl) {
        bgImage = `url('${settings.customBgUrl}')`;
    } else {
        bgImage = `url('${ASSETS.images.defaultBg}')`;
    }

    const rawUrl = (settings.playerBackgroundType === 'custom' && settings.customBgUrl) ? settings.customBgUrl : ASSETS.images.defaultBg;

    if (mode === 'smart' && rawUrl) {
        const img = new Image();
        img.onload = () => {
            const isPortrait = img.naturalHeight > img.naturalWidth * 1.05;
            const size = isPortrait ? 'contain' : 'cover';
            playerContainer.style.backgroundImage = `${gradient}, ${bgImage}`;
            playerContainer.style.backgroundSize = `${size}, ${size}`;
            playerContainer.style.backgroundRepeat = 'no-repeat, no-repeat';
            playerContainer.style.backgroundPosition = 'center, center';
        };
        img.src = rawUrl;
    } else {
        const modeConfig = BG_DISPLAY_MODES[mode] || BG_DISPLAY_MODES.cover;
        playerContainer.style.backgroundImage = `${gradient}, ${bgImage}`;
        playerContainer.style.backgroundSize = `${modeConfig.size}, ${modeConfig.size}`;
        playerContainer.style.backgroundRepeat = `${modeConfig.repeat}, ${modeConfig.repeat}`;
        playerContainer.style.backgroundPosition = `${modeConfig.position}, ${modeConfig.position}`;
    }

    // Synchronize live preview in settings as well
    updateBgPreview(settings.playerBackgroundType === 'custom' ? settings.customBgUrl : ASSETS.images.defaultBg);
}

export function updatePanicDescription(action) {
    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;

    const descriptions = {
        'closeIncognito': dict.panicDesc_closeIncognito || '🛡️ Bảo vệ riêng tư: Đóng ngay lập tức tất cả các cửa sổ ẩn danh đang mở.',
        'redirectAll': dict.panicDesc_redirectAll || '🌐 Ngụy trang nhanh: Chuyển hướng toàn bộ các tab hiện có sang một trang web an toàn.',
        'closeAll': dict.panicDesc_closeAll || '🚫 Xóa dấu vết: Đóng toàn bộ trình duyệt ngay lập tức.'
    };
    if (elements.panicDescText) {
        elements.panicDescText.textContent = descriptions[action] || descriptions['closeIncognito'];
    }
}

export function updateCurrentShortcutDisplay() {
    if (chrome.commands && elements.currentPanicKey) {
        chrome.commands.getAll((commands) => {
            const panicCommand = commands.find(c => c.name === 'activate_panic');
            if (panicCommand && panicCommand.shortcut) {
                elements.currentPanicKey.textContent = panicCommand.shortcut;
            }
        });
    }
}

export function renderTabSelection() {
    const container = elements.sessionTabListContainer || elements.tabListContainer;
    if (!container) return;
    container.textContent = '';

    currentTabsToSave.forEach((tab, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 4px; border-bottom: 1px solid rgba(0,0,0,0.05);';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `tab-chk-${index}`;
        checkbox.checked = true;
        checkbox.dataset.index = index;
        checkbox.className = 'tab-selection-checkbox';

        const label = document.createElement('label');
        label.htmlFor = `tab-chk-${index}`;
        label.style.cssText = 'font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; flex: 1;';
        label.title = tab.url;

        label.textContent = '';
        if (tab.favIconUrl) {
            label.appendChild(createElement('img', {
                src: tab.favIconUrl,
                width: '12',
                height: '12',
                style: { marginRight: '5px', verticalAlign: 'middle' }
            }));
        } else {
            label.appendChild(document.createTextNode('🌐 '));
        }
        if (tab.incognito) {
            label.appendChild(document.createTextNode('🔒 '));
        }
        label.appendChild(document.createTextNode(tab.title || tab.url));

        div.appendChild(checkbox);
        div.appendChild(label);
        tabListContainer.appendChild(div);
    });
}

export function renderSessions() {
    const { sessionsList } = elements;
    if (!sessionsList) return;
    sessionsList.textContent = '';

    if (!settings.savedSessions || settings.savedSessions.length === 0) {
        const lang = settings.language || 'vi';
        const dict = translations[lang] || translations.vi;
        sessionsList.appendChild(createElement('p', { className: 'empty-msg' }, dict.noSessions || 'Chưa có phiên làm việc nào được lưu.'));
        return;
    }

    settings.savedSessions.forEach((session, index) => {
        const sessionContainer = document.createElement('div');
        sessionContainer.className = 'session-container-wrapper';
        sessionContainer.style.marginBottom = '8px';

        const div = document.createElement('div');
        div.className = 'favorite-item session-item';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'favorite-name';
        infoDiv.style.flexDirection = 'column';
        infoDiv.style.alignItems = 'flex-start';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = session.name;
        nameSpan.style.fontWeight = 'bold';

        const detailsSpan = document.createElement('small');
        const typeLabels = { 'all': 'Tất cả', 'normal': 'Thường', 'incognito': 'Ẩn danh' };
        const typeLabel = typeLabels[session.tabType || 'all'];
        detailsSpan.textContent = `${typeLabel} • ${session.tabs.length} tabs • ${new Date(session.date).toLocaleDateString()}`;
        detailsSpan.style.color = 'var(--text-secondary)';

        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(detailsSpan);
        div.appendChild(infoDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'favorite-actions';

        const expandBtn = document.createElement('button');
        expandBtn.className = 'favorite-go-btn';
        expandBtn.title = 'Xem danh sách tab';
        expandBtn.textContent = '🔽';
        expandBtn.style.fontSize = '10px';

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'favorite-go-btn';
        restoreBtn.title = 'Khôi phục phiên';
        restoreBtn.textContent = '📂';
        restoreBtn.onclick = (e) => {
            e.stopPropagation();
            restoreSession(session);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'favorite-delete-btn';
        deleteBtn.title = 'Xóa phiên';
        deleteBtn.textContent = '🗑️';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (await showConfirm(`Xóa phiên "${session.name}"?`)) {
                settings.savedSessions.splice(index, 1);
                saveSettings();
                renderSessions();
                notify(getDict().sessionDeleted, 'warning');
            }
        };

        const tabsListDiv = document.createElement('div');
        tabsListDiv.className = 'session-tabs-list hidden';
        tabsListDiv.style.cssText = 'padding: 8px; background: rgba(0,0,0,0.02); border-radius: 0 0 8px 8px; border: 1px solid var(--border-color); border-top: none; font-size: 10px; max-height: 200px; overflow-y: auto;';

        const restoreSelectedBtn = document.createElement('button');
        restoreSelectedBtn.className = 'action-btn primary-btn';
        restoreSelectedBtn.style.cssText = 'width: 100%; padding: 4px; font-size: 10px; margin-bottom: 8px;';
        restoreSelectedBtn.textContent = 'Khôi phục các tab đã chọn';
        restoreSelectedBtn.onclick = () => {
            const selectedItems = tabsListDiv.querySelectorAll('.session-tab-checkbox:checked');
            if (selectedItems.length === 0) {
                notify(getDict().selectOneTabWarning, 'warning');
                return;
            }
            const tabsToRestore = Array.from(selectedItems).map(cb => session.tabs[parseInt(cb.dataset.tabIndex)]);
            restoreSession({ ...session, tabs: tabsToRestore });
        };
        tabsListDiv.appendChild(restoreSelectedBtn);

        session.tabs.forEach((tab, tabIndex) => {
            const tabItem = document.createElement('div');
            tabItem.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 5px; padding: 2px 0; border-bottom: 1px dashed rgba(0,0,0,0.05);';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'session-tab-checkbox';
            checkbox.dataset.tabIndex = tabIndex;
            checkbox.checked = true;

            const tabTitleSpan = document.createElement('span');
            tabTitleSpan.style.cssText = 'flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
            tabTitleSpan.title = tab.url;
            const tabIcon = tab.incognito ? '🔒 ' : '🌐 ';
            tabTitleSpan.textContent = `${tabIcon}${tab.title || tab.url}`;

            const tabActions = document.createElement('div');
            tabActions.style.cssText = 'display: flex; gap: 4px;';

            const restoreNormalBtn = document.createElement('button');
            restoreNormalBtn.title = 'Mở trong cửa sổ thường';
            restoreNormalBtn.textContent = '🌐';
            restoreNormalBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 12px;';
            restoreNormalBtn.onclick = () => {
                chrome.windows.create({ url: tab.url, incognito: false });
            };

            const restoreIncognitoBtn = document.createElement('button');
            restoreIncognitoBtn.title = 'Mở trong cửa sổ ẩn danh';
            restoreIncognitoBtn.textContent = '🔒';
            restoreIncognitoBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 12px;';
            restoreIncognitoBtn.onclick = () => {
                chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
                    if (isAllowed) {
                        chrome.windows.create({ url: tab.url, incognito: true });
                    } else {
                        notify(getDict().incognitoAccessRequired, 'error');
                    }
                });
            };

            tabActions.append(restoreNormalBtn, restoreIncognitoBtn);
            tabItem.append(checkbox, tabTitleSpan, tabActions);
            tabsListDiv.appendChild(tabItem);
        });

        expandBtn.onclick = () => {
            const isHidden = tabsListDiv.classList.toggle('hidden');
            expandBtn.textContent = isHidden ? '🔽' : '🔼';
            div.style.borderRadius = isHidden ? 'var(--radius-md)' : '8px 8px 0 0';
        };

        actionsDiv.append(expandBtn, restoreBtn, deleteBtn);
        div.appendChild(actionsDiv);

        sessionContainer.append(div, tabsListDiv);
        sessionsList.appendChild(sessionContainer);
    });
}

export async function restoreSession(session) {
    try {
        notify((getDict().restoringSession || 'Đang khôi phục phiên') + ` "${session.name}"...`, 'success');
        const normalTabs = session.tabs.filter(t => !t.incognito);
        const incognitoTabs = session.tabs.filter(t => t.incognito);

        if (normalTabs.length > 0) {
            chrome.windows.create({ url: normalTabs.map(t => t.url), incognito: false });
        }

        if (incognitoTabs.length > 0) {
            chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
                chrome.windows.create({
                    url: incognitoTabs.map(t => t.url),
                    incognito: isAllowed
                });
                if (!isAllowed) {
                    notify(getDict().incognitoAccessRequired, 'error');
                }
            });
        }
    } catch (error) {
        notify((getDict().restoreError || 'Lỗi khi khôi phục: ') + error.message, 'error');
    }
}

function isStrongPassword(password) {
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password);
}

function togglePasswordEyes() {
    const isVisible = elements.showPasswordToggle?.checked;
    document.querySelectorAll('.pass-eye').forEach(eye => {
        eye.classList.toggle('hidden', !isVisible);
    });
}

function setupPasswordToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (input && toggle) {
        toggle.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            toggle.textContent = isPassword ? '🙈' : '👁️';
        });
    }
}

export async function init() {
    const {
        darkModeToggle, autoClearToggle, showNotifyToggle, useSidePanelToggle, enableTabManagerToggle, enableFloatingTabBarToggle, enableTempMailToggle, tabManagerBtn, tempMailBtn,
        telegramDownloaderToggle, videoDownloaderToggle, pipToggle, multiAccountToggle, hibernationToggle, historyIncognitoToggle,
        telegramDownloaderBtn, videoDownloaderBtn, togglePip, multiAccountBtn, switchViewBtn,
        realTimeProtectionToggle, blockClickjackingToggle, blockCryptoMiningToggle, protectionLevelSelect,
        hibernationTimeoutSelect, hibernationCustomTimeout,
        strongPasswordToggle, passwordRequirementText, alwaysRequirePasswordToggle,
        showPasswordToggle, verifyOldPass, oldPassInput, newPassRow, saveNewPass,
        newPassInput, confirmNewPassInput, searchEngineSelect, googleSafeSearchSelect, addSafeUrlBtn,
        newSafeUrlInput, panicActionSelect, changeShortcutBtn, saveSessionBtn,
        sessionNameInput, sessionTabTypeSelect, selectAllTabsBtn, deselectAllTabsBtn,
        cancelSaveSessionBtn, confirmSaveSessionBtn, tabSelectionArea, settingsSearchInput,
        clearSettingsSearch, playerBackgroundType, playerBgDisplayMode, customBgUrlInput, addCustomBgBtn,
        customCursorInput, setCustomCursorBtn, resetCursorBtn, customCursorToggle, customCursorInputContainer, playerIsolatedIdentityToggle,
        hlsBufferModeSelect, hlsMaxRamSlider, hlsMaxRamVal, hlsBufferExplanationCard, hlsMaxRamRow
    } = elements;

    // Load initial listings
    renderSessions();
    renderSafeUrls();
    renderCustomBgList();
    toggleCustomBgUrlRow();
    updateCurrentShortcutDisplay();
    updatePanicDescription(settings.panicAction || 'closeIncognito');

    function updateHlsExplanation(mode) {
        if (!hlsBufferExplanationCard) return;
        if (mode === 'only_ram') {
            hlsBufferExplanationCard.innerHTML = '⚡ <strong>Only RAM:</strong> Xử lý 100% trên bộ nhớ RAM. Tốc độ ghép cực nhanh, 0% tác động/hao mòn ổ cứng SSD. Khuyến nghị cho video ngắn/vừa.';
            if (hlsMaxRamRow) hlsMaxRamRow.style.display = 'none';
        } else if (mode === 'hybrid_disk') {
            hlsBufferExplanationCard.innerHTML = '🔄 <strong>Hybrid RAM + Disk:</strong> Giữ trên RAM và tự động gom khối lớn (64MB) xả xuống bộ đệm khi video vượt ngưỡng. Chống sập RAM (OOM) tuyệt đối cho phim dài 4K/nhiều GB.';
            if (hlsMaxRamRow) hlsMaxRamRow.style.display = 'flex';
        } else {
            hlsBufferExplanationCard.innerHTML = '🧠 <strong>Smart Controller:</strong> Tự động điều tiết luồng tải video theo hạn mức RAM đã chọn, vừa tránh tràn bộ nhớ (OOM) vừa không bào mòn ổ cứng SSD.';
            if (hlsMaxRamRow) hlsMaxRamRow.style.display = 'flex';
        }
    }

    if (hlsBufferModeSelect) {
        hlsBufferModeSelect.value = settings.hlsBufferMode || 'smart_ram_controller';
        updateHlsExplanation(hlsBufferModeSelect.value);
        hlsBufferModeSelect.addEventListener('change', (e) => {
            settings.hlsBufferMode = e.target.value;
            saveSettings();
            updateHlsExplanation(settings.hlsBufferMode);
            notify(`Đã đổi chiến lược đệm HLS: ${e.target.options[e.target.selectedIndex].text}`, 'success');
        });
    }

    if (hlsMaxRamSlider) {
        hlsMaxRamSlider.value = settings.hlsMaxRamMb || 256;
        if (hlsMaxRamVal) hlsMaxRamVal.textContent = `${settings.hlsMaxRamMb || 256} MB`;
        hlsMaxRamSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            settings.hlsMaxRamMb = val;
            if (hlsMaxRamVal) hlsMaxRamVal.textContent = `${val} MB`;
            saveSettings();
        });
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', (e) => {
            settings.darkMode = e.target.checked;
            applySettings();
            saveSettings();
            notify(`Dark mode ${settings.darkMode ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (autoClearToggle) {
        autoClearToggle.addEventListener('change', (e) => {
            settings.autoClearStealth = e.target.checked;
            saveSettings();
            if (settings.autoClearStealth) {
                chrome.storage.local.remove(['stealthHistory', 'lastPlayerUrl']);
                if (elements.stealthPlayer) elements.stealthPlayer.src = '';
                notify(`${getDict().autoClearStealth || 'Auto-clear Stealth History'} ${getDict().enabled || 'enabled'}`, 'warning');
            } else {
                notify(`${getDict().autoClearStealth || 'Auto-clear Stealth History'} ${getDict().disabled || 'disabled'}`, 'success');
            }
        });
    }

    if (showNotifyToggle) {
        showNotifyToggle.addEventListener('change', (e) => {
            settings.showNotifications = e.target.checked;
            saveSettings();
            notify(`Thông báo ${settings.showNotifications ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (enableTabManagerToggle) {
        enableTabManagerToggle.addEventListener('change', (e) => {
            settings.enableTabManager = e.target.checked;
            if (tabManagerBtn) tabManagerBtn.style.display = settings.enableTabManager ? 'flex' : 'none';
            saveSettings();
            notify(`Tab Manager ${settings.enableTabManager ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }
    if (enableFloatingTabBarToggle) {
        enableFloatingTabBarToggle.addEventListener('change', (e) => {
            settings.enableFloatingTabBar = e.target.checked;
            saveSettings();
            chrome.runtime.sendMessage({ type: 'INJECT_FLOATING_BAR_TO_ALL_TABS', enabled: settings.enableFloatingTabBar }).catch(() => {});
            notify(`On-Page Floating Tab Bar ${settings.enableFloatingTabBar ? 'enabled' : 'disabled'}`, 'success');
        });
    }
    if (enableTempMailToggle) {
        enableTempMailToggle.addEventListener('change', (e) => {
            settings.enableTempMail = e.target.checked;
            if (tempMailBtn) tempMailBtn.style.display = settings.enableTempMail ? 'flex' : 'none';
            saveSettings();
            notify(`Temp Mail ${settings.enableTempMail ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }
    
    if (telegramDownloaderToggle) {
        telegramDownloaderToggle.addEventListener('change', (e) => {
            settings.telegramDownloaderEnabled = e.target.checked;
            if (telegramDownloaderBtn) telegramDownloaderBtn.classList.toggle('hidden', !settings.telegramDownloaderEnabled);
            saveSettings();
            notify(`Telegram Downloader ${settings.telegramDownloaderEnabled ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (videoDownloaderToggle) {
        videoDownloaderToggle.addEventListener('change', (e) => {
            settings.videoDownloaderEnabled = e.target.checked;
            if (videoDownloaderBtn) videoDownloaderBtn.classList.toggle('hidden', !settings.videoDownloaderEnabled);
            saveSettings();
            notify(`Video Downloader ${settings.videoDownloaderEnabled ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (pipToggle) {
        pipToggle.addEventListener('change', (e) => {
            settings.pipEnabled = e.target.checked;
            if (togglePip) togglePip.classList.toggle('hidden', !settings.pipEnabled);
            saveSettings();
            notify(`Picture-in-Picture ${settings.pipEnabled ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (multiAccountToggle) {
        multiAccountToggle.addEventListener('change', (e) => {
            if (e.target.checked && !chrome.contextualIdentities) {
                e.target.checked = false;
                const lang = settings.language || 'vi';
                const dict = window.translations ? window.translations[lang] || window.translations.vi : {};
                notify(dict.apiNotSupported || 'Trình duyệt của bạn không hỗ trợ Multi-Account Containers API.', 'error');
                return;
            }
            settings.multiAccountEnabled = e.target.checked;
            if (multiAccountBtn) multiAccountBtn.classList.toggle('hidden', !settings.multiAccountEnabled);
            saveSettings();
            notify(`Multi-Account Containers ${settings.multiAccountEnabled ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (hibernationToggle) {
        hibernationToggle.addEventListener('change', (e) => {
            settings.hibernationEnabled = e.target.checked;
            saveSettings();
            notify(`Tab Hibernation ${settings.hibernationEnabled ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (hibernationTimeoutSelect) {
        const currentVal = settings.hibernationTimeout || 30;
        const standardVals = ['1', '5', '15', '30', '60'];
        if (standardVals.includes(String(currentVal))) {
            hibernationTimeoutSelect.value = String(currentVal);
            if (hibernationCustomTimeout) hibernationCustomTimeout.classList.add('hidden');
        } else {
            hibernationTimeoutSelect.value = 'custom';
            if (hibernationCustomTimeout) {
                hibernationCustomTimeout.value = currentVal;
                hibernationCustomTimeout.classList.remove('hidden');
            }
        }

        hibernationTimeoutSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                if (hibernationCustomTimeout) {
                    hibernationCustomTimeout.classList.remove('hidden');
                    hibernationCustomTimeout.focus();
                }
            } else {
                if (hibernationCustomTimeout) hibernationCustomTimeout.classList.add('hidden');
                settings.hibernationTimeout = parseInt(e.target.value, 10);
                saveSettings();
                notify(`Thời gian ngủ đông: ${e.target.options[e.target.selectedIndex].text}`, 'success');
            }
        });
    }

    if (hibernationCustomTimeout) {
        hibernationCustomTimeout.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 10) {
                settings.hibernationTimeout = val;
                saveSettings();
                notify(`Đã đặt thời gian ngủ đông tùy chỉnh: ${val} giây`, 'success');
            } else {
                notify('Thời gian ngủ đông tùy chỉnh tối thiểu là 10 giây!', 'warning');
            }
        });
    }

    if (historyIncognitoToggle) {
        historyIncognitoToggle.addEventListener('change', (e) => {
            settings.historyIncognito = e.target.checked;
            saveSettings();
            notify(`Mở liên kết lịch sử trong ẩn danh ${settings.historyIncognito ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }
    if (useSidePanelToggle) {
        useSidePanelToggle.addEventListener('change', (e) => {
            settings.useSidePanel = e.target.checked;
            saveSettings();
            
            // Apply immediately without requiring reload
            if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
                chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: settings.useSidePanel }).catch(console.error);
            }
            
            notify(`${getDict().useSidePanel || 'Default to side panel'} ${settings.useSidePanel ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (switchViewBtn) {
        switchViewBtn.addEventListener('click', async () => {
            // Toggle the default view mode
            settings.useSidePanel = !settings.useSidePanel;
            if (useSidePanelToggle) useSidePanelToggle.checked = settings.useSidePanel;
            await saveSettings();

            if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
                chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: settings.useSidePanel }).catch(console.error);
            }

            if (settings.useSidePanel) {
                // User switched TO Side Panel mode
                if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
                    chrome.windows.getCurrent({ populate: false }, (window) => {
                        chrome.sidePanel.open({ windowId: window.id }).then(() => {
                            // If opened from popup window, close the popup
                            if (window.innerWidth <= 800 && window.innerHeight <= 620) {
                                window.close();
                            }
                        }).catch(() => {
                            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?mode=tab') });
                        });
                    });
                }
                notify(getDict().sidePanelActive || 'Đã chuyển sang chế độ Side Panel!', 'success');
            } else {
                // User switched TO Popup / Tab mode
                chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?mode=tab') });
                notify(getDict().popupModeActive || 'Đã chuyển sang chế độ Popup / Tab (Nhấp icon tiện ích để mở Popup)!', 'success');
            }
        });
    }

    if (protectionLevelSelect) {
        protectionLevelSelect.value = settings.protectionLevel || 'standard';
        protectionLevelSelect.addEventListener('change', (e) => {
            settings.protectionLevel = e.target.value;
            if (settings.protectionLevel === 'enhanced' || settings.protectionLevel === 'noscript') {
                settings.blockClickjacking = true;
                settings.realTimeProtection = true;
                if (blockClickjackingToggle) blockClickjackingToggle.checked = true;
                if (realTimeProtectionToggle) realTimeProtectionToggle.checked = true;
            }
            saveSettings();
            chrome.runtime.sendMessage({ type: 'updateSecurityRules' }).catch(() => {});
            const levelNames = {
                standard: 'Tiêu chuẩn (Standard)',
                enhanced: 'Nâng cao (Enhanced 🛡️)',
                noscript: 'NoScript (Tối đa)'
            };
            notify(`Đã đặt mức bảo vệ: ${levelNames[settings.protectionLevel] || settings.protectionLevel}`, 'success');
        });
    }

    if (realTimeProtectionToggle) {
        realTimeProtectionToggle.addEventListener('change', (e) => {
            settings.realTimeProtection = e.target.checked;
            saveSettings();
            chrome.runtime.sendMessage({ type: 'updateSecurityRules' }).catch(() => {});
            notify(`${getDict().realTimeProtection || 'Real-time protection'} ${settings.realTimeProtection ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (blockClickjackingToggle) {
        blockClickjackingToggle.addEventListener('change', (e) => {
            settings.blockClickjacking = e.target.checked;
            saveSettings();
            chrome.runtime.sendMessage({ type: 'updateSecurityRules' }).catch(() => {});
            notify(`${getDict().blockClickjacking || 'Clickjacking protection'} ${settings.blockClickjacking ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (blockCryptoMiningToggle) {
        blockCryptoMiningToggle.addEventListener('change', (e) => {
            settings.blockCryptoMining = e.target.checked;
            saveSettings();
            chrome.runtime.sendMessage({ type: 'updateSecurityRules' }).catch(() => {});
            notify(`${getDict().blockCryptoMining || 'Cryptomining protection'} ${settings.blockCryptoMining ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (elements.playerLinkBehavior) {
        elements.playerLinkBehavior.value = settings.linkClickBehavior || 'inside';
        elements.playerLinkBehavior.addEventListener('change', (e) => {
            settings.linkClickBehavior = e.target.value;
            saveSettings();
            const playerDropdown = document.getElementById('linkClickBehaviorDropdown');
            if (playerDropdown) playerDropdown.value = settings.linkClickBehavior;
            const behaviorNames = {
                inside: 'Mở trong Player (Inside)',
                newTab: 'Mở Tab mới (New Tab)',
                incognito: 'Cửa sổ Ẩn danh (Incognito)',
                block: 'Chặn link ra ngoài (Block)',
                smart: 'Thông minh (Smart Mode)'
            };
            notify(`Đã đặt hành vi click link: ${behaviorNames[e.target.value] || e.target.value}`, 'success');
        });
    }

    if (elements.playerLinkFilter) {
        elements.playerLinkFilter.value = settings.appliedLinkType || 'all';
        elements.playerLinkFilter.addEventListener('change', (e) => {
            settings.appliedLinkType = e.target.value;
            saveSettings();
            const playerDropdown = document.getElementById('appliedLinkTypeDropdown');
            if (playerDropdown) playerDropdown.value = settings.appliedLinkType;
            const scopeNames = {
                all: 'Tất cả liên kết (All)',
                externalOnly: 'Chỉ liên kết ngoài (External)',
                targetBlankOnly: 'Chỉ link Blank / Popup'
            };
            notify(`Đã đặt phạm vi áp dụng: ${scopeNames[e.target.value] || e.target.value}`, 'success');
        });
    }

    if (elements.antiTabunderToggle) {
        elements.antiTabunderToggle.checked = settings.antiTabunderEnabled ?? true;
        elements.antiTabunderToggle.addEventListener('change', (e) => {
            settings.antiTabunderEnabled = e.target.checked;
            saveSettings();
            const playerToggle = document.getElementById('playerAntiTabunderToggle');
            if (playerToggle) playerToggle.checked = settings.antiTabunderEnabled;
            notify(settings.antiTabunderEnabled ? 'Đã bật Anti-Tabunder Shield (Chống cướp tab cũ)' : 'Đã tắt Anti-Tabunder Shield', 'success');
        });
    }

    if (strongPasswordToggle) {
        strongPasswordToggle.addEventListener('click', async (e) => {
            e.preventDefault();
            const intendedState = !settings.requireStrongPassword;
            const action = intendedState ? 'bật' : 'tắt';
            const currentPass = prompt(`Vui lòng nhập mật khẩu hiện tại để ${action} ràng buộc mật khẩu mạnh:`);
            if (currentPass === null) return;

            chrome.storage.local.get(['stealthPasswordHash', 'stealthSalt'], async (result) => {
                const storedHash = result.stealthPasswordHash || await hashPassword('1234', 'default_salt');
                const salt = result.stealthSalt || 'default_salt';
                const isValid = await verifyPassword(currentPass, salt, storedHash);

                if (isValid) {
                    state.secretCode = currentPass;
                    settings.requireStrongPassword = intendedState;
                    strongPasswordToggle.checked = intendedState;
                    if (passwordRequirementText) passwordRequirementText.classList.toggle('hidden', !intendedState);
                    saveSettings();
                    notify(settings.language === 'en' ? `Strong password requirement ${intendedState ? 'enabled' : 'disabled'} successfully!` : `Đã ${action} ràng buộc mật khẩu mạnh thành công!`, 'success');
                } else {
                    notify(getDict().incorrectCode, 'error');
                }
            });
        });
    }

    if (alwaysRequirePasswordToggle) {
        alwaysRequirePasswordToggle.addEventListener('change', (e) => {
            settings.alwaysRequirePassword = e.target.checked;
            saveSettings();
            notify(`${getDict().alwaysRequirePassword || 'Always require password'} ${settings.alwaysRequirePassword ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }





    if (elements.geoDropdown) {
        elements.geoDropdown.addEventListener('change', (e) => {
            settings.blockGeolocation = (e.target.value === 'block');
            saveSettings();
            
            // Apply immediately to iframe if it exists
            const stealthPlayer = document.getElementById('stealthPlayer');
            if (stealthPlayer) {
                if (settings.blockGeolocation) {
                    stealthPlayer.allow = stealthPlayer.allow.replace(/geolocation\s*/, '').trim();
                } else {
                    if (!stealthPlayer.allow.includes('geolocation')) {
                        stealthPlayer.allow += ' geolocation';
                    }
                }
                // Reload iframe to take effect
                if (stealthPlayer.src) stealthPlayer.src = stealthPlayer.src;
            }
            
            notify(settings.blockGeolocation ? 'Đã chặn quyền truy cập vị trí' : 'Đã cho phép quyền truy cập vị trí', 'success');
        });
    }

    if (playerIsolatedIdentityToggle) {
        playerIsolatedIdentityToggle.addEventListener('change', (e) => {
            settings.playerIsolatedIdentity = e.target.checked;
            saveSettings();
            chrome.runtime.sendMessage({ type: 'updateSecurityRules' });
            notify(`${getDict().playerIsolatedIdentity || 'Isolated Identity'} ${settings.playerIsolatedIdentity ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    const PX_PER_CM = 37.79527559;

    function toggleSizeUnit() {
        settings.playerSizeUnit = (settings.playerSizeUnit === 'cm') ? 'px' : 'cm';
        saveSettings();
        if (typeof applySettings === 'function') applySettings();
    }

    if (elements.widthUnitBtn) elements.widthUnitBtn.addEventListener('click', toggleSizeUnit);
    if (elements.heightUnitBtn) elements.heightUnitBtn.addEventListener('click', toggleSizeUnit);

    if (elements.defaultPlayerWidth) {
        elements.defaultPlayerWidth.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) return;
            if (settings.playerSizeUnit === 'cm') val = val * PX_PER_CM;
            val = Math.round(val);
            if (val >= 360 && val <= 1000) {
                settings.defaultPlayerWidth = val;
                saveSettings();
            } else {
                if (typeof applySettings === 'function') applySettings();
            }
        });
    }

    if (elements.defaultPlayerHeight) {
        elements.defaultPlayerHeight.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) return;
            if (settings.playerSizeUnit === 'cm') val = val * PX_PER_CM;
            val = Math.round(val);
            if (val >= 300 && val <= 1000) {
                settings.defaultPlayerHeight = val;
                saveSettings();
            } else {
                if (typeof applySettings === 'function') applySettings();
            }
        });
    }

    if (elements.followDefaultPlayerSizeToggle) {
        elements.followDefaultPlayerSizeToggle.addEventListener('change', async (e) => {
            settings.followDefaultPlayerSize = e.target.checked;
            if (settings.followDefaultPlayerSize && elements.force100PercentToggle && elements.force100PercentToggle.checked) {
                settings.force100Percent = false;
                elements.force100PercentToggle.checked = false;
            }
            saveSettings();
            
            // Apply dynamically if player module is loaded
            if (ModuleLoader.loaded.has('player')) {
                const { updatePlayerSize } = await import('./player.js');
                updatePlayerSize();
            }
        });
    }

    if (elements.force100PercentToggle) {
        elements.force100PercentToggle.addEventListener('change', async (e) => {
            settings.force100Percent = e.target.checked;
            if (settings.force100Percent && elements.followDefaultPlayerSizeToggle && elements.followDefaultPlayerSizeToggle.checked) {
                settings.followDefaultPlayerSize = false;
                elements.followDefaultPlayerSizeToggle.checked = false;
            }
            saveSettings();
            
            // Apply dynamically if player module is loaded
            if (ModuleLoader.loaded.has('player')) {
                const { updatePlayerSize } = await import('./player.js');
                updatePlayerSize();
            }
        });
    }

    if (showPasswordToggle) {
        showPasswordToggle.addEventListener('change', (e) => {
            settings.showPasswordInSettings = e.target.checked;
            togglePasswordEyes();
            saveSettings();
        });
    }

    setupPasswordToggle('oldPassInput', 'toggleOldPass');
    setupPasswordToggle('newPassInput', 'toggleNewPass');
    setupPasswordToggle('confirmNewPassInput', 'toggleConfirmPass');
    setupPasswordToggle('stealthPassInput', 'toggleStealthPass');
    setupPasswordToggle('vaultPassInput', 'toggleVaultPass');

    if (verifyOldPass) {
        verifyOldPass.addEventListener('click', async () => {
            const oldPass = oldPassInput.value;
            chrome.storage.local.get(['stealthPasswordHash', 'stealthSalt'], async (result) => {
                const storedHash = result.stealthPasswordHash || await hashPassword('1234', 'default_salt');
                const salt = result.stealthSalt || 'default_salt';
                const isValid = await verifyPassword(oldPass, salt, storedHash);

                if (isValid) {
                    state.secretCode = oldPass;
                    if (newPassRow) newPassRow.classList.remove('hidden');
                    oldPassInput.disabled = true;
                    verifyOldPass.disabled = true;
                    notify(getDict().oldPassVerified, 'success');
                    if (settings.requireStrongPassword && passwordRequirementText) {
                        passwordRequirementText.classList.remove('hidden');
                    }
                } else {
                    notify(getDict().incorrectCode, 'error');
                    oldPassInput.value = '';
                }
            });
        });
    }

    if (saveNewPass) {
        saveNewPass.addEventListener('click', async () => {
            if (!newPassInput || !confirmNewPassInput) return;
            const newPass = newPassInput.value.trim();
            const confirmPass = confirmNewPassInput.value.trim();

            if (newPass === '') {
                notify(getDict().enterNewPass || 'Please enter a new password', 'warning');
                return;
            }
            if (newPass !== confirmPass) {
                notify(getDict().passMismatch || 'Passwords do not match!', 'error');
                return;
            }
            if (settings.requireStrongPassword && !isStrongPassword(newPass)) {
                notify(getDict().passwordRequirement || 'Password does not meet security standards!', 'error');
                return;
            }
            if (!settings.requireStrongPassword && newPass.length < 4) {
                notify(getDict().passMinLength || 'Password must be at least 4 chars', 'warning');
                return;
            }

            const newSalt = await generateMasterKey();
            const newHash = await hashPassword(newPass, newSalt);

            if (settings.vaultSyncEnabled && settings.masterSyncKey) {
                const oldPass = state.secretCode;
                const masterKey = await decryptData(settings.masterSyncKey, oldPass);
                if (masterKey) {
                    const reEncryptedKey = await encryptData(masterKey, newPass);
                    settings.masterSyncKey = reEncryptedKey;
                }
            }

            chrome.storage.local.set({
                stealthPasswordHash: newHash,
                stealthSalt: newSalt
            }, () => {
                chrome.storage.local.remove('stealthPassword');
                state.secretCode = newPass;
                saveSettings();
                notify(getDict().passUpdated || 'Password updated successfully!', 'success');

                oldPassInput.value = '';
                oldPassInput.disabled = false;
                if (verifyOldPass) verifyOldPass.disabled = false;
                newPassInput.value = '';
                confirmNewPassInput.value = '';
                if (newPassRow) newPassRow.classList.add('hidden');

                oldPassInput.type = 'password';
                newPassInput.type = 'password';
                confirmNewPassInput.type = 'password';
                const eyeOld = document.getElementById('toggleOldPass');
                if (eyeOld) eyeOld.textContent = '👁️';
            });
        });
    }

    if (searchEngineSelect) {
        searchEngineSelect.addEventListener('change', (e) => {
            settings.searchEngine = e.target.value;
            saveSettings();
            if (elements.overlaySearchEngine) elements.overlaySearchEngine.value = settings.searchEngine;
            notify((settings.language === 'en' ? 'Default search engine set to ' : 'Đã thay đổi công cụ tìm kiếm mặc định thành ') + settings.searchEngine, 'success');
        });
    }

    if (googleSafeSearchSelect) {
        googleSafeSearchSelect.addEventListener('change', (e) => {
            settings.googleSafeSearch = e.target.value;
            saveSettings();
            notify((getDict().googleSafeSearchSet || 'Đã đặt Google SafeSearch thành ') + settings.googleSafeSearch, 'success');
        });
    }

    if (addSafeUrlBtn) {
        addSafeUrlBtn.addEventListener('click', () => {
            if (!newSafeUrlInput) return;
            let url = newSafeUrlInput.value.trim();
            if (!url) {
                notify(getDict().enterNoteOrLink || 'Vui lòng nhập URL', 'warning');
                return;
            }
            if (!url.startsWith('http')) url = 'https://' + url;
            if (!isValidUrl(url)) {
                notify(getDict().invalidUrl || 'URL không hợp lệ', 'error');
                return;
            }

            if (!settings.safeUrls) settings.safeUrls = [];
            if (settings.safeUrls.includes(url)) {
                notify(getDict().urlExists || 'URL này đã có trong danh sách', 'warning');
                return;
            }

            settings.safeUrls.push(url);
            saveSettings();
            newSafeUrlInput.value = '';
            renderSafeUrls();
            notify(getDict().safeUrlAdded || 'Safe URL added!', 'success');
        });
    }

    if (panicActionSelect) {
        panicActionSelect.addEventListener('change', (e) => {
            settings.panicAction = e.target.value;
            saveSettings();
            updatePanicDescription(e.target.value);
            notify((settings.language === 'en' ? 'Panic action set to: ' : 'Hành động Panic được cài đặt thành: ') + e.target.value, 'success');
        });
    }

    if (elements.mainPanicBtn) {
        elements.mainPanicBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'ACTIVATE_PANIC' });
            window.close(); // Close popup immediately
        });
    }

    if (changeShortcutBtn) {
        changeShortcutBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        });
    }

    if (saveSessionBtn) {
        saveSessionBtn.addEventListener('click', async () => {
            if (!sessionNameInput || !sessionTabTypeSelect) return;
            const sessionName = sessionNameInput.value.trim();
            if (!sessionName) {
                notify(getDict().enterSessionName || 'Vui lòng nhập tên phiên làm việc', 'warning');
                return;
            }

            try {
                const tabType = sessionTabTypeSelect.value;
                const allTabs = await chrome.tabs.query({});
                currentTabsToSave = allTabs.filter(tab => {
                    if (tabType === 'normal') return !tab.incognito;
                    if (tabType === 'incognito') return tab.incognito;
                    return true;
                });

                if (currentTabsToSave.length === 0) {
                    notify(getDict().noTabsFound || 'Không tìm thấy tab nào để lưu!', 'warning');
                    return;
                }

                renderTabSelection();
                if (tabSelectionArea) tabSelectionArea.classList.remove('hidden');
                saveSessionBtn.disabled = true;
                notify(getDict().selectTabsToSave || 'Vui lòng chọn các tab bạn muốn lưu', 'success');
            } catch (error) {
                notify((getDict().getTabsError || 'Lỗi khi lấy danh sách tab: ') + error.message, 'error');
            }
        });
    }

    if (selectAllTabsBtn) {
        selectAllTabsBtn.addEventListener('click', () => {
            document.querySelectorAll('.tab-selection-checkbox').forEach(cb => cb.checked = true);
        });
    }

    if (deselectAllTabsBtn) {
        deselectAllTabsBtn.addEventListener('click', () => {
            document.querySelectorAll('.tab-selection-checkbox').forEach(cb => cb.checked = false);
        });
    }

    if (cancelSaveSessionBtn) {
        cancelSaveSessionBtn.addEventListener('click', () => {
            if (tabSelectionArea) tabSelectionArea.classList.add('hidden');
            if (saveSessionBtn) saveSessionBtn.disabled = false;
            currentTabsToSave = [];
            notify(getDict().saveSessionCancelled || 'Đã hủy thao tác lưu phiên', 'warning');
        });
    }

    if (confirmSaveSessionBtn) {
        confirmSaveSessionBtn.addEventListener('click', async () => {
            if (!sessionNameInput || !sessionTabTypeSelect) return;
            const sessionName = sessionNameInput.value.trim();
            const selectedCheckboxes = document.querySelectorAll('.tab-selection-checkbox:checked');

            if (selectedCheckboxes.length === 0) {
                notify(getDict().selectOneTabWarning || 'Vui lòng chọn ít nhất một tab để lưu!', 'warning');
                return;
            }

            const selectedTabs = Array.from(selectedCheckboxes).map(cb => currentTabsToSave[parseInt(cb.dataset.index)]);

            const sessionData = {
                id: Date.now(),
                name: sessionName,
                date: new Date().toISOString(),
                tabType: sessionTabTypeSelect.value,
                tabs: selectedTabs.map(t => ({
                    url: t.url,
                    title: t.title,
                    incognito: t.incognito
                }))
            };

            if (!settings.savedSessions) settings.savedSessions = [];
            settings.savedSessions.unshift(sessionData);
            saveSettings();
            renderSessions();

            sessionNameInput.value = '';
            if (tabSelectionArea) tabSelectionArea.classList.add('hidden');
            if (saveSessionBtn) saveSessionBtn.disabled = false;

            if (await showConfirm(settings.language === 'en' ? `Saved "${sessionName}" with ${selectedTabs.length} tabs. Do you want to close the selected tabs?` : `Đã lưu "${sessionName}" với ${selectedTabs.length} tab. Bạn có muốn đóng các tab đã chọn không?`)) {
                selectedTabs.forEach(t => {
                    chrome.tabs.remove(t.id).catch(() => { });
                });
            }

            notify((getDict().sessionSaved || 'Đã lưu phiên: ') + sessionName, 'success');
        });
    }

    if (settingsSearchInput) {
        settingsSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const groups = document.querySelectorAll('.settings-group');

            groups.forEach(group => {
                const title = group.querySelector('h3')?.textContent.toLowerCase() || '';
                const items = group.querySelectorAll('.setting-item');
                let groupHasMatch = title.includes(query);

                items.forEach(item => {
                    const itemText = item.textContent.toLowerCase();
                    const isMatch = itemText.includes(query);

                    if (query === '') {
                        item.classList.remove('hidden-search');
                        item.classList.remove('match-search');
                    } else if (isMatch) {
                        item.classList.remove('hidden-search');
                        item.classList.add('match-search');
                        groupHasMatch = true;
                    } else {
                        item.classList.add('hidden-search');
                        item.classList.remove('match-search');
                    }
                });

                if (query === '') {
                    group.classList.remove('hidden-search');
                    group.classList.remove('fade-out');
                } else if (groupHasMatch) {
                    group.classList.remove('hidden-search');
                    group.classList.remove('fade-out');
                } else {
                    group.classList.add('fade-out');
                    setTimeout(() => {
                        if (group.classList.contains('fade-out')) {
                            group.classList.add('hidden-search');
                        }
                    }, 300);
                }
            });
        });
    }

    if (clearSettingsSearch) {
        clearSettingsSearch.addEventListener('click', () => {
            if (settingsSearchInput) {
                settingsSearchInput.value = '';
                settingsSearchInput.dispatchEvent(new Event('input'));
            }
        });
    }

    if (elements.languageSelect) {
        elements.languageSelect.addEventListener('change', (e) => {
            settings.language = e.target.value;
            saveSettings();
            updateUILanguage();
            notify(getDict().langUpdated || 'Language updated!', 'success');
        });
    }

    if (playerBackgroundType) {
        playerBackgroundType.addEventListener('change', (e) => {
            settings.playerBackgroundType = e.target.value;
            saveSettings();
            toggleCustomBgUrlRow();
            applyPlayerBackground();
            notify(getDict().bgUpdated || 'Background type updated!', 'success');
        });
    }

    if (playerBgDisplayMode) {
        playerBgDisplayMode.addEventListener('change', (e) => {
            settings.playerBgDisplayMode = e.target.value;
            saveSettings();
            applyPlayerBackground();
            updateBgPreview();
            updatePlayerViewportGhost(true);
            const modeText = e.target.options[e.target.selectedIndex]?.textContent?.trim() || e.target.value;
            notify(`${getDict().playerBgDisplayMode || 'Background mode'}: ${modeText}`, 'success');
        });
    }

    if (addCustomBgBtn) {
        addCustomBgBtn.addEventListener('click', () => {
            if (!customBgUrlInput) return;
            const url = customBgUrlInput.value.trim();
            if (!url) return;
            if (!isValidUrl(url)) {
                notify(getDict().invalidImgUrl || 'Invalid Image URL', 'error');
                return;
            }

            if (!settings.customBgList) settings.customBgList = [];
            if (settings.customBgList.includes(url)) {
                notify(getDict().bgUrlExists || 'Background URL already exists', 'warning');
                return;
            }

            settings.customBgList.push(url);
            settings.customBgUrl = url;
            saveSettings();
            customBgUrlInput.value = '';
            renderCustomBgList();
            applyPlayerBackground();
            notify(getDict().bgAdded || 'Custom background added!', 'success');
        });
    }

    if (elements.vaultSyncToggle) {
        elements.vaultSyncToggle.addEventListener('change', async (e) => {
            settings.vaultSyncEnabled = e.target.checked;
            if (elements.masterSyncSection) {
                elements.masterSyncSection.style.display = settings.vaultSyncEnabled ? 'block' : 'none';
            }
            if (settings.vaultSyncEnabled && !settings.masterSyncKey) {
                const masterKey = await generateMasterKey();
                const encryptedKey = await encryptData(masterKey, state.secretCode);
                settings.masterSyncKey = encryptedKey;
                if (elements.masterSyncKeyInput) elements.masterSyncKeyInput.value = masterKey;
            }
            saveSettings();
            notify(`Vault sync ${settings.vaultSyncEnabled ? (getDict().enabled || 'enabled') : (getDict().disabled || 'disabled')}`, 'success');
        });
    }

    if (elements.copyMasterKeyBtn) {
        elements.copyMasterKeyBtn.addEventListener('click', async () => {
            if (settings.masterSyncKey) {
                const masterKey = await decryptData(settings.masterSyncKey, state.secretCode);
                if (masterKey) {
                    navigator.clipboard.writeText(masterKey);
                    notify(getDict().masterKeyCopied || 'Master Key copied!', 'success');
                }
            }
        });
    }

    if (elements.saveMasterKeyBtn) {
        elements.saveMasterKeyBtn.addEventListener('click', async () => {
            if (!elements.manualMasterKeyInput) return;
            const inputKey = elements.manualMasterKeyInput.value.trim();
            if (inputKey.length !== 64) {
                notify(getDict().masterKeyInvalidLength || 'Master Key must be 64 characters!', 'error');
                return;
            }

            const encryptedKey = await encryptData(inputKey, state.secretCode);
            settings.masterSyncKey = encryptedKey;
            saveSettings();
            elements.manualMasterKeyInput.value = '';
            if (elements.masterSyncKeyInput) elements.masterSyncKeyInput.value = '********';
            notify(getDict().masterKeySaved || 'Master Key saved! Merging vault items...', 'success');

            // Pull items using the new key
            import('./vault.js').then(v => {
                if (v.loadVault) v.loadVault();
            });
        });
    }


    if (elements.pullSyncBtn) {
        elements.pullSyncBtn.addEventListener('click', async () => {
            elements.pullSyncBtn.disabled   = true;
            elements.pullSyncBtn.textContent = '⏳ Pulling...';
            try {
                const { syncFromCloud } = await import('./sync.js');
                // syncFromCloud now exists in the new unified sync.js (fixes the missing-function bug)
                const cloudData = await syncFromCloud(['settings']);
                if (cloudData.settings) {
                    Object.assign(settings, cloudData.settings);
                    saveSettings();
                    notify(getDict().settingsPulled || 'Đã kéo cài đặt từ Cloud!', 'success');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    notify(getDict().noSettingsInCloud || 'Không tìm thấy cài đặt trên Cloud.', 'warning');
                }
            } catch (e) {
                console.error('[PullSync]', e);
                const msg = e.message?.includes('session_pass')
                    ? (getDict().syncEnterPassFirst || 'Vui lòng nhập Sync Password ở phần Cloud Sync và thực hiện Backup/Restore trước.')
                    : (getDict().errorPullingCloud   || 'Lỗi khi kéo từ Cloud: ' + e.message);
                notify(msg, 'error');
            } finally {
                elements.pullSyncBtn.disabled   = false;
                elements.pullSyncBtn.textContent = '☁️ Pull';
            }
        });
    }


if (customCursorToggle) {
    customCursorToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            if (customCursorInputContainer) customCursorInputContainer.style.display = 'flex';
        } else {
            if (customCursorInputContainer) customCursorInputContainer.style.display = 'none';
            settings.customCursor = '';
            saveSettings();
            import('../popup.js').then(m => m.applySettings());
            if (customCursorInput) customCursorInput.value = '';
            notify(getDict().cursorReset || 'Đã khôi phục con trỏ chuột mặc định.', 'success');
        }
    });
}

// Custom Cursor event handlers
if (setCustomCursorBtn && customCursorInput) {
    setCustomCursorBtn.addEventListener('click', () => {
        const url = customCursorInput.value.trim();
        if (url) {
            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image')) {
                settings.customCursor = url;
                saveSettings();
                import('../popup.js').then(m => m.applySettings());
                notify(getDict().cursorApplied || 'Đã áp dụng con trỏ chuột tùy chỉnh!', 'success');
            } else {
                notify(getDict().invalidImgUrl || 'URL hình ảnh không hợp lệ!', 'error');
            }
        } else {
            notify(getDict().enterImgUrl || 'Vui lòng nhập URL hình ảnh!', 'warning');
        }
    });
}


// =========================================================================
// Ultra-HD Smooth Focal Zoom & Pan Engine for bgPreviewContainer
// =========================================================================
if (elements.bgPreviewImg) {
    const img = elements.bgPreviewImg;
    const container = document.getElementById('bgPreviewContainer');

    let currentScale = 1.0;
    const MIN_SCALE = 1.0;
    const MAX_SCALE = 6.0;
    let currentTx = 0;
    let currentTy = 0;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let isDragMove = false;

    let hudTimer = null;

    // Create or locate the Floating Zoom HUD
    let zoomHud = document.getElementById('bgZoomHud');
    if (!zoomHud && container) {
        zoomHud = document.createElement('div');
        zoomHud.id = 'bgZoomHud';
        zoomHud.className = 'bg-zoom-hud';
        container.appendChild(zoomHud);
    }

    const showZoomHud = (scale) => {
        if (!zoomHud) return;
        const pct = Math.round(scale * 100);
        zoomHud.textContent = `🔍 ${pct}%`;
        zoomHud.classList.add('visible');
        clearTimeout(hudTimer);
        hudTimer = setTimeout(() => {
            zoomHud.classList.remove('visible');
        }, 1500);
    };

    const applyTransform = (animate = true) => {
        img.style.transition = animate ? 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)' : 'none';
        img.style.transformOrigin = '0 0';
        img.style.transform = `translate3d(${currentTx}px, ${currentTy}px, 0) scale(${currentScale})`;

        if (currentScale > 1.0) {
            img.classList.add('zoomed');
            if (container) container.classList.add('zoomed-container');
        } else {
            img.classList.remove('zoomed');
            if (container) container.classList.remove('zoomed-container');
            const mode = settings.playerBgDisplayMode || 'cover';
            img.style.opacity = mode === 'repeat' ? '0' : '1';
        }
    };

    const resetZoom = (animate = true) => {
        currentScale = 1.0;
        currentTx = 0;
        currentTy = 0;
        applyTransform(animate);
        showZoomHud(1.0);
    };

    // Reset state when image source changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                resetZoom(false);
            }
        });
    });
    observer.observe(img, { attributes: true });

    // ─── Mathematical Focal Point Zoom Algorithm ──────────────────────────────
    const zoomAtPoint = (newScale, focalX, focalY, animate = true) => {
        const clampedScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
        if (Math.abs(clampedScale - currentScale) < 0.001 && clampedScale === currentScale) return;

        if (clampedScale <= 1.0) {
            resetZoom(animate);
            return;
        }

        // Compute new translation so the point under cursor remains stationary
        const scaleRatio = clampedScale / currentScale;
        currentTx = focalX - (focalX - currentTx) * scaleRatio;
        currentTy = focalY - (focalY - currentTy) * scaleRatio;
        currentScale = clampedScale;

        applyTransform(animate);
        showZoomHud(currentScale);
    };

    // ─── Smooth Mouse Wheel Zoom ───────────────────────────────────────────────
    if (container) {
        container.addEventListener('wheel', (e) => {
            if (img.classList.contains('hidden') || !img.src) return;
            e.preventDefault();

            const rect = container.getBoundingClientRect();
            const focalX = e.clientX - rect.left;
            const focalY = e.clientY - rect.top;

            const zoomDelta = e.deltaY < 0 ? 0.35 : -0.35;
            zoomAtPoint(currentScale + zoomDelta, focalX, focalY, true);
        }, { passive: false });
    }

    // ─── Drag / Pan Interactivity ─────────────────────────────────────────────
    img.addEventListener('mousedown', (e) => {
        if (currentScale > 1.0) {
            isDragging = true;
            isDragMove = false;
            dragStartX = e.clientX - currentTx;
            dragStartY = e.clientY - currentTy;
            img.classList.add('dragging');
            applyTransform(false);
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        isDragMove = true;
        currentTx = e.clientX - dragStartX;
        currentTy = e.clientY - dragStartY;
        applyTransform(false);
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            img.classList.remove('dragging');
            applyTransform(true);
            setTimeout(() => { isDragMove = false; }, 60);
        }
    });

    // ─── Click / Double-Click Fast Zoom ────────────────────────────────────────
    img.addEventListener('click', (e) => {
        if (isDragMove) return;

        const rect = container.getBoundingClientRect();
        const focalX = e.clientX - rect.left;
        const focalY = e.clientY - rect.top;

        if (currentScale <= 1.05) {
            zoomAtPoint(2.5, focalX, focalY, true);
        } else if (currentScale < 3.8) {
            zoomAtPoint(4.5, focalX, focalY, true);
        } else {
            resetZoom(true);
        }
    });

    if (container) {
        container.addEventListener('click', (e) => {
            if (e.target === container) {
                const rect = container.getBoundingClientRect();
                const distRight = rect.right - e.clientX;
                const distBottom = rect.bottom - e.clientY;
                // Ignore clicks on resizer edge handles
                if (distRight > 16 && distBottom > 16) {
                    img.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: e.clientX, clientY: e.clientY }));
                }
            }
        });
    }
}

// Dimension Controls and Edge Hover/Click Resize Logic for bgPreviewContainer
const previewContainer = document.getElementById('bgPreviewContainer');
const widthDecBtn = document.getElementById('bgWidthDecBtn');
const widthIncBtn = document.getElementById('bgWidthIncBtn');
const widthVal = document.getElementById('bgWidthVal');
const heightDecBtn = document.getElementById('bgHeightDecBtn');
const heightIncBtn = document.getElementById('bgHeightIncBtn');
const heightVal = document.getElementById('bgHeightVal');
const resetSizeBtn = document.getElementById('bgResetSizeBtn');

const handleRight = document.getElementById('bgEdgeHandleRight');
const handleBottom = document.getElementById('bgEdgeHandleBottom');
const handleCorner = document.getElementById('bgEdgeHandleCorner');

if (previewContainer) {
    let curHeight = settings.bgPreviewHeight ? parseInt(settings.bgPreviewHeight, 10) : 500;
    if (isNaN(curHeight) || curHeight < 200) curHeight = 500;
    let curWidth = settings.bgPreviewWidth ? settings.bgPreviewWidth : '100%';

    const matchPlayerSizeBtn = document.getElementById('matchPlayerSizeBtn');
    const toggleGhostFrameBtn = document.getElementById('toggleGhostFrameBtn');
    const previewBadge = document.getElementById('bgPreviewModeBadge');
    const ghostFrameEl = document.getElementById('playerViewportGhost');

    const updateDimensionUI = () => {
        previewContainer.style.minHeight = `${curHeight}px`;
        previewContainer.style.height = `${curHeight}px`;
        if (heightVal) heightVal.textContent = `${curHeight}px`;

        if (curWidth === '100%') {
            previewContainer.style.width = '100%';
            if (widthVal) widthVal.textContent = '100%';
        } else {
            const wNum = parseInt(curWidth, 10);
            previewContainer.style.width = `${wNum}px`;
            if (widthVal) widthVal.textContent = `${wNum}px`;
        }
        if (isDisplayModePreviewEnabled) {
            updatePlayerViewportGhost(false);
        }
    };

    const saveDimensions = () => {
        settings.bgPreviewHeight = curHeight;
        settings.bgPreviewWidth = curWidth;
        saveSettings();
    };

    const applyWidthDelta = (delta) => {
        let currentWidthPx = previewContainer.getBoundingClientRect().width;
        let newWidth = Math.max(260, Math.min(1200, Math.round(currentWidthPx + delta)));
        curWidth = `${newWidth}px`;
        updateDimensionUI();
        saveDimensions();
    };

    const applyHeightDelta = (delta) => {
        curHeight = Math.max(250, Math.min(1200, Math.round(curHeight + delta)));
        updateDimensionUI();
        saveDimensions();
    };

    // Apply saved size on initial load
    updateDimensionUI();

    // Toggle Background Display Mode Preview on Title Badge click
    if (previewBadge) {
        previewBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            isDisplayModePreviewEnabled = !isDisplayModePreviewEnabled;
            updateBgPreview();
            if (isDisplayModePreviewEnabled) {
                updatePlayerViewportGhost(true);
                notify('🟢 Đã BẬT áp dụng Background Display Mode lên Preview.', 'info');
            } else {
                notify('⚪ Đã TẮT áp dụng Display Mode (Hiển thị ảnh gốc RAW).', 'info');
            }
        });
    }

    // Toggle Ghost Frame Viewport
    if (toggleGhostFrameBtn && ghostFrameEl) {
        toggleGhostFrameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = ghostFrameEl.classList.toggle('hidden-ghost');
            toggleGhostFrameBtn.classList.toggle('active', !isHidden);
            notify(isHidden ? 'Đã ẩn Khung mờ Player Viewport' : 'Đã hiện Khung mờ Player Viewport', 'info');
        });
    }

    // Toolbar buttons (Width: +-20px, Height: +-30px)
    if (widthDecBtn) widthDecBtn.addEventListener('click', (e) => { e.stopPropagation(); applyWidthDelta(-20); });
    if (widthIncBtn) widthIncBtn.addEventListener('click', (e) => { e.stopPropagation(); applyWidthDelta(20); });
    if (heightDecBtn) heightDecBtn.addEventListener('click', (e) => { e.stopPropagation(); applyHeightDelta(-30); });
    if (heightIncBtn) heightIncBtn.addEventListener('click', (e) => { e.stopPropagation(); applyHeightDelta(30); });
    if (resetSizeBtn) resetSizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        curHeight = 500;
        curWidth = '100%';
        updateDimensionUI();
        saveDimensions();
        notify(getDict().previewResetSize || 'Đã khôi phục kích thước xem trước mặc định (100% × 500px).', 'info');
    });

    // Edge handles click to increment (Width: +20px, Height: +30px)
    if (handleRight) {
        handleRight.addEventListener('click', (e) => {
            e.stopPropagation();
            applyWidthDelta(20);
        });
    }
    if (handleBottom) {
        handleBottom.addEventListener('click', (e) => {
            e.stopPropagation();
            applyHeightDelta(30);
        });
    }
    if (handleCorner) {
        handleCorner.addEventListener('click', (e) => {
            e.stopPropagation();
            applyWidthDelta(20);
            applyHeightDelta(30);
        });
    }

    // Dynamic edge mouse hover & click detection on the container
    previewContainer.addEventListener('mousemove', (e) => {
        if (elements.bgPreviewImg && elements.bgPreviewImg.classList.contains('zoomed')) return;
        const rect = previewContainer.getBoundingClientRect();
        const distRight = rect.right - e.clientX;
        const distBottom = rect.bottom - e.clientY;

        if (distRight <= 16 && distBottom <= 16) {
            previewContainer.style.cursor = 'se-resize';
        } else if (distRight <= 14) {
            previewContainer.style.cursor = 'ew-resize';
        } else if (distBottom <= 14) {
            previewContainer.style.cursor = 'ns-resize';
        } else {
            previewContainer.style.cursor = 'zoom-in';
        }
    });

    previewContainer.addEventListener('mouseleave', () => {
        if (elements.bgPreviewImg && !elements.bgPreviewImg.classList.contains('zoomed')) {
            previewContainer.style.cursor = 'zoom-in';
        }
    });
}
} // End of init()

export function renderSafeUrls() {
    const { safeUrlsList } = elements;
    if (!safeUrlsList) return;

    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;
    safeUrlsList.textContent = '';

    if (!settings.safeUrls || settings.safeUrls.length === 0) {
        safeUrlsList.appendChild(createElement('p', { className: 'empty-msg' }, dict.noSafeUrls || 'No safe URLs added. Default: Google.'));
        return;
    }

    settings.safeUrls.forEach((url, index) => {
        const item = document.createElement('div');
        item.className = 'favorite-item';

        const info = document.createElement('div');
        info.className = 'favorite-info';

        const urlSpan = document.createElement('span');
        urlSpan.className = 'favorite-url';
        urlSpan.textContent = url;
        urlSpan.style.fontSize = '0.8rem';
        info.appendChild(urlSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'favorite-delete-btn';
        deleteBtn.textContent = '🗑';
        deleteBtn.onclick = () => {
            settings.safeUrls.splice(index, 1);
            saveSettings();
            renderSafeUrls();
            notify(getDict().safeUrlRemoved || 'Đã xoá Safe URL.', 'warning');
        };

        item.append(info, deleteBtn);
        safeUrlsList.appendChild(item);
    });
}
