import { calculatePrivacyGrade, setTrackStyle } from './modules/dashboard.js';
import { createElement, parseHTML, ASSETS, escapeHTML } from './modules/utils.js';

const translations = window.translations;

export const elements = {
    cookiesManager: document.getElementById('cookiesManager'),
    extensionManager: document.getElementById('extensionManager'),
    cookiesList: document.getElementById('cookiesList'),
    extensionsList: document.getElementById('extensionsList'),
    controls: document.getElementById('controls'),
    clearCookies: document.getElementById('clearCookies'),
    clearSiteData: document.getElementById('clearSiteData'),
    copyCurrentCookies: document.getElementById('copyCurrentCookies'),
    pasteCookies: document.getElementById('pasteCookies'),
    toggleTracking: document.getElementById('toggleTracking'),
    filterInput: document.getElementById('filterInput'),
    notification: document.getElementById('notification'),

    tabManagerBtn: document.getElementById('tabManagerBtn'),
    tabManagerSection: document.getElementById('tabManagerSection'),
    tabSearchInput: document.getElementById('tabSearchInput'),
    tabListContainer: document.getElementById('tabListContainer'),
    groupTabsBtn: document.getElementById('groupTabsBtn'),
    tempMailBtn: document.getElementById('tempMailBtn'),
    tempMailSection: document.getElementById('tempMailSection'),
    enableTempMailToggle: document.getElementById('enableTempMailToggle'),
    enableTabManagerToggle: document.getElementById('enableTabManagerToggle'),
    enableFloatingTabBarToggle: document.getElementById('enableFloatingTabBarToggle'),
    totalCookies: document.getElementById('totalCookies'),
    cookieTableContainer: document.getElementById('cookieTableContainer'),
    privacySettings: document.getElementById('privacySettings'),
    privacyPlayer: document.getElementById('privacyPlayer'),

    stealthSection: document.getElementById('stealthSection'),
    stealthUrl: document.getElementById('stealthUrl'),
    loadStealth: document.getElementById('loadStealth'),
    openStealthWindow: document.getElementById('openStealthWindow'),
    stealthPlayer: document.getElementById('stealthPlayer'),
    stealthLockScreen: document.getElementById('stealthLockScreen'),
    stealthPassInput: document.getElementById('stealthPassInput'),
    toggleStealthPass: document.getElementById('toggleStealthPass'),
    unlockStealth: document.getElementById('unlockStealth'),
    stealthTitle: document.getElementById('stealthTitle'),
    lockScreenBackBtn: document.getElementById('lockScreenBackBtn'),
    vaultLockScreenBackBtn: document.getElementById('vaultLockScreenBackBtn'),

    appSettings: document.getElementById('appSettings'),
    oldPassInput: document.getElementById('oldPassInput'),
    verifyOldPass: document.getElementById('verifyOldPass'),
    toggleOldPass: document.getElementById('toggleOldPass'),
    newPassRow: document.getElementById('newPassRow'),
    newPassInput: document.getElementById('newPassInput'),
    toggleNewPass: document.getElementById('toggleNewPass'),
    confirmNewPassInput: document.getElementById('confirmNewPassInput'),
    toggleConfirmPass: document.getElementById('toggleConfirmPass'),
    saveNewPass: document.getElementById('saveNewPass'),
    strongPasswordToggle: document.getElementById('strongPasswordToggle'),
    alwaysRequirePasswordToggle: document.getElementById('alwaysRequirePasswordToggle'),
    showPasswordToggle: document.getElementById('showPasswordToggle'),
    passwordRequirementText: document.getElementById('passwordRequirementText'),

    appSettingsBtn: document.getElementById('appSettingsBtn'),
    pipToggle: document.getElementById('pipToggle'),
    homeSection: document.getElementById('homeSection'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    defaultPlayerWidth: document.getElementById('defaultPlayerWidth'),
    defaultPlayerHeight: document.getElementById('defaultPlayerHeight'),
    widthUnitBtn: document.getElementById('widthUnitBtn'),
    heightUnitBtn: document.getElementById('heightUnitBtn'),
    followDefaultPlayerSizeToggle: document.getElementById('followDefaultPlayerSizeToggle'),
    force100PercentToggle: document.getElementById('force100PercentToggle'),

    overlaySearchEngine: document.getElementById('overlaySearchEngine'),
    geoDropdown: document.getElementById('geoDropdown'),
    playerIsolatedIdentityToggle: document.getElementById('playerIsolatedIdentityToggle'),
    autoClearToggle: document.getElementById('autoClearToggle'),
    showNotifyToggle: document.getElementById('showNotifyToggle'),
    cookieDestroyerToggle: document.getElementById('cookieDestroyerToggle'),
    historyIncognitoToggle: document.getElementById('historyIncognitoToggle'),
    hlsBufferModeSelect: document.getElementById('hlsBufferModeSelect'),
    hlsMaxRamSlider: document.getElementById('hlsMaxRamSlider'),
    hlsMaxRamVal: document.getElementById('hlsMaxRamVal'),
    hlsBufferExplanationCard: document.getElementById('hlsBufferExplanationCard'),
    hlsMaxRamRow: document.getElementById('hlsMaxRamRow'),
    shrinkPlayer: document.getElementById('shrinkPlayer'),
    enlargePlayer: document.getElementById('enlargePlayer'),
    resetPlayer: document.getElementById('resetPlayer'),
    goBackPlayer: document.getElementById('goBackPlayer'),
    goForwardPlayer: document.getElementById('goForwardPlayer'),
    reloadPlayer: document.getElementById('reloadPlayer'),
    togglePip: document.getElementById('togglePip'),
    toggleTheaterMode: document.getElementById('toggleTheaterMode'),
    playerContainer: document.querySelector('.player-container'),

    historyManagerBtn: document.getElementById('historyManagerBtn'),
    historySection: document.getElementById('historySection'),
    historyList: document.getElementById('historyList'),
    deviceList: document.getElementById('deviceList'),
    historyRestrictedOverlay: document.getElementById('historyRestrictedOverlay'),
    historySearchInput: document.getElementById('historySearchInput'),
    bookmarksSearchInput: document.getElementById('bookmarksSearchInput'),
    bookmarksList: document.getElementById('bookmarksList'),
    readingListContainer: document.getElementById('readingListContainer'),
    clearHistorySearch: document.getElementById('clearHistorySearch'),

    networkShieldSection: document.getElementById('networkShieldSection'),
    networkShieldBtn: document.getElementById('networkShieldBtn'),

    statCookies: document.getElementById('statCookies'),
    statExtensions: document.getElementById('statExtensions'),
    statTrackers: document.getElementById('statTrackers'),
    cardEphemeral: document.getElementById('cardEphemeral'),
    ephemeralStatus: document.getElementById('ephemeralStatus'),
    trackerModal: document.getElementById('trackerModal'),
    closeTrackerModal: document.getElementById('closeTrackerModal'),
    trackerDetailsList: document.querySelector('.tracker-details-list'),
    privacyScore: document.getElementById('privacyScore'),
    privacyGradeValue: document.getElementById('privacyGradeValue'),
    healthScoreText: document.getElementById('healthScoreText'),
    healthStatusText: document.getElementById('healthStatusText'),
    healthBarFill: document.getElementById('healthBarFill'),
    privacyInsightsList: document.getElementById('privacyInsightsList'),
    permanentBar: document.getElementById('permanentBar'),
    sessionBar: document.getElementById('sessionBar'),
    permanentCount: document.getElementById('permanentCount'),
    sessionCount: document.getElementById('sessionCount'),

    zenModeBtn: document.getElementById('zenModeBtn'),
    zenModeModal: document.getElementById('zenModeModal'),
    closeZenModal: document.getElementById('closeZenModal'),
    zenTimerInput: document.getElementById('zenTimerInput'),
    startZenModeBtn: document.getElementById('startZenModeBtn'),
    zenActiveState: document.getElementById('zenActiveState'),
    zenCountdown: document.getElementById('zenCountdown'),
    stopZenModeBtn: document.getElementById('stopZenModeBtn'),
    quickFocusMode: document.getElementById('quickFocusMode'),
    quickClearAll: document.getElementById('quickClearAll'),
    fixPrivacyBtn: document.getElementById('fixPrivacyBtn'),
    cardCookies: document.getElementById('cardCookies'),
    cardTrackers: document.getElementById('cardTrackers'),
    cardExtensions: document.getElementById('cardExtensions'),
    gradeCard: document.querySelector('.grade-card-modern'),

    vaultBtn: document.getElementById('vaultBtn'),
    networkLoggerBtn: document.getElementById('networkLoggerBtn'),
    vaultSection: document.getElementById('vaultSection'),
    vaultLockScreen: document.getElementById('vaultLockScreen'),
    vaultPassInput: document.getElementById('vaultPassInput'),
    toggleVaultPass: document.getElementById('toggleVaultPass'),
    unlockVault: document.getElementById('unlockVault'),
    vaultList: document.getElementById('vaultList'),
    vaultInput: document.getElementById('vaultInput'),
    vaultAddBtn: document.getElementById('vaultAddBtn'),

    searchEngineSelect: document.getElementById('searchEngineSelect'),
    newFavoriteName: document.getElementById('newFavoriteName'),
    newFavoriteUrl: document.getElementById('newFavoriteUrl'),
    addFavoriteBtn: document.getElementById('addFavoriteBtn'),
    favoriteWebsitesList: document.getElementById('favoriteWebsitesList'),
    useSidePanelToggle: document.getElementById('useSidePanelToggle'),
    switchViewBtn: document.getElementById('switchViewBtn'),
    realTimeProtectionToggle: document.getElementById('realTimeProtectionToggle'),
    blockClickjackingToggle: document.getElementById('blockClickjackingToggle'),
    blockCryptoMiningToggle: document.getElementById('blockCryptoMiningToggle'),
    antiTabunderToggle: document.getElementById('antiTabunderToggle'),
    playerAntiTabunderToggle: document.getElementById('playerAntiTabunderToggle'),
    protectionLevelSelect: document.getElementById('protectionLevelSelect'),
    languageSelect: document.getElementById('languageSelect'),
    playerBackgroundType: document.getElementById('playerBackgroundType'),
    playerBgDisplayMode: document.getElementById('playerBgDisplayMode'),
    playerLinkBehavior: document.getElementById('playerLinkBehavior'),
    playerLinkFilter: document.getElementById('playerLinkFilter'),
    playerLinkFilterRow: document.getElementById('playerLinkFilterRow'),
    customBgUrlRow: document.getElementById('customBgUrlRow'),
    customBgUrlInput: document.getElementById('customBgUrlInput'),
    addCustomBgBtn: document.getElementById('addCustomBgBtn'),
    customBgList: document.getElementById('customBgList'),
    bgPreviewImg: document.getElementById('bgPreviewImg'),
    bgPreviewPlaceholder: document.getElementById('bgPreviewPlaceholder'),
    panicActionSelect: document.getElementById('panicActionSelect'),
    panicDescText: document.getElementById('panicDescText'),
    currentPanicKey: document.getElementById('currentPanicKey'),
    changeShortcutBtn: document.getElementById('changeShortcutBtn'),
    newSafeUrlInput: document.getElementById('newSafeUrlInput'),
    addSafeUrlBtn: document.getElementById('addSafeUrlBtn'),
    safeUrlsList: document.getElementById('safeUrlsList'),
    mainPanicBtn: document.getElementById('mainPanicBtn'),
    settingsSearchInput: document.getElementById('settingsSearchInput'),
    clearSettingsSearch: document.getElementById('clearSettingsSearch'),
    settingsContainer: document.getElementById('settingsContainer'),
    sessionNameInput: document.getElementById('sessionNameInput'),
    sessionTabTypeSelect: document.getElementById('sessionTabTypeSelect'),
    saveSessionBtn: document.getElementById('saveSessionBtn'),
    sessionsList: document.getElementById('sessionsList'),
    tabSelectionArea: document.getElementById('tabSelectionArea'),
    sessionTabListContainer: document.getElementById('sessionTabListContainer'),
    confirmSaveSessionBtn: document.getElementById('confirmSaveSessionBtn'),
    selectAllTabsBtn: document.getElementById('selectAllTabsBtn'),
    deselectAllTabsBtn: document.getElementById('deselectAllTabsBtn'),
    cancelSaveSessionBtn: document.getElementById('cancelSaveSessionBtn'),

    telegramDownloaderBtn: document.getElementById('telegramDownloaderBtn'),
    telegramDownloaderToggle: document.getElementById('telegramDownloaderToggle'),
    telegramSection: document.getElementById('telegramSection'),
    telegramUrlInput: document.getElementById('telegramUrlInput'),
    extractTelegramBtn: document.getElementById('extractTelegramBtn'),
    scanTelegramMediaBtn: document.getElementById('scanTelegramMediaBtn'),
    telegramMediaList: document.getElementById('telegramMediaList'),
    telegramMediaItems: document.getElementById('telegramMediaItems'),
    telegramMediaPreview: document.getElementById('telegramMediaPreview'),
    videoDownloaderBtn: document.getElementById('videoDownloaderBtn'),
    videoDownloaderToggle: document.getElementById('videoDownloaderToggle'),
    videoDownloaderSection: document.getElementById('videoDownloaderSection'),
    videoList: document.getElementById('videoList'),
    scanVideoBtn: document.getElementById('scanVideoBtn'),

    multiAccountBtn: document.getElementById('multiAccountBtn'),
    multiAccountToggle: document.getElementById('multiAccountToggle'),
    multiAccountSection: document.getElementById('multiAccountSection'),
    newContainerName: document.getElementById('newContainerName'),
    newContainerColor: document.getElementById('newContainerColor'),
    newContainerMode: document.getElementById('newContainerMode'),
    containerIconPicker: document.getElementById('containerIconPicker'),
    addContainerBtn: document.getElementById('addContainerBtn'),
    quickIdentityBtn: document.getElementById('quickIdentityBtn'),
    containerList: document.getElementById('containerList'),

    hibernationToggle: document.getElementById('hibernationToggle'),
    hibernationTimeoutSelect: document.getElementById('hibernationTimeoutSelect'),
    hibernationCustomTimeout: document.getElementById('hibernationCustomTimeout'),
    hibernationTimeoutRow: document.getElementById('hibernationTimeoutRow'),

    autoCleanupRulesSection: document.getElementById('autoCleanupRulesSection'),
    whitelistInput: document.getElementById('whitelistInput'),
    addWhitelistBtn: document.getElementById('addWhitelistBtn'),
    whitelistList: document.getElementById('whitelistList'),

    vaultSyncToggle: document.getElementById('vaultSyncToggle'),
    masterSyncSection: document.getElementById('masterSyncSection'),
    masterSyncKeyInput: document.getElementById('masterSyncKeyInput'),
    copyMasterKeyBtn: document.getElementById('copyMasterKeyBtn'),
    manualMasterKeyInput: document.getElementById('manualMasterKeyInput'),
    saveMasterKeyBtn: document.getElementById('saveMasterKeyBtn'),
    pullSyncBtn: document.getElementById('pullSyncBtn'),

    telegramStats: document.getElementById('telegramStats'),
    statParallel: document.getElementById('statParallel'),
    statChunkSize: document.getElementById('statChunkSize'),
    statRetries: document.getElementById('statRetries'),
    statSpeed: document.getElementById('statSpeed'),

    customCursorInput: document.getElementById('customCursorInput'),
    setCustomCursorBtn: document.getElementById('setCustomCursorBtn'),
    resetCursorBtn: document.getElementById('resetCursorBtn'),

    adblockBtn: document.getElementById('adblockBtn'),
    adblockSection: document.getElementById('adblockSection'),
    adblockEnabledToggle: document.getElementById('adblockEnabledToggle'),
    easylistToggle: document.getElementById('easylistToggle'),
    fetchEasyListBtn: document.getElementById('fetchEasyListBtn'),
    adblockNetworkCount: document.getElementById('adblockNetworkCount'),
    adblockCssCount: document.getElementById('adblockCssCount'),
    adsBlockedCount: document.getElementById('adsBlockedCount'),
    customAdblockRules: document.getElementById('customAdblockRules'),
    customAdblockCssRules: document.getElementById('customAdblockCssRules'),
    cardAdblock: document.getElementById('cardAdblock'),
    statAdsBlocked: document.getElementById('statAdsBlocked'),
};

export const state = {
    secretCode: null,
    isStealthUnlocked: false,
    isVaultUnlocked: false,
    isGroupedByDomain: false,
    currentCookiesByDomain: {},
    currentVideos: [],
    currentTelegramItems: []
};

export let settings = {
    darkMode: false,
    autoClearStealth: true,
    showNotifications: true,
    cookieDestroyer: false,
    historyIncognito: false,
    defaultPlayerWidth: 600,
    defaultPlayerHeight: 400,
    followDefaultPlayerSize: true,
    searchEngine: 'google',
    favoriteWebsites: [],
    useSidePanel: false,
    enableTempMail: false,
    enableTabManager: false,
    enableFloatingTabBar: true,
    realTimeProtection: true,
    blockClickjacking: true,
    blockCryptoMining: true,
    protectionLevel: 'standard',
    language: 'vi',
    playerBackgroundType: 'default',
    playerBgDisplayMode: 'cover',
    playerLinkBehavior: 'inside',
    playerLinkFilter: 'all',
    customBgUrl: '',
    customBgList: [],
    panicAction: 'closeIncognito',
    safeRedirectUrl: 'https://www.google.com',
    savedSessions: [],
    telegramDownloaderEnabled: false,
    videoDownloaderEnabled: false,
    multiAccountEnabled: false,
    accountContainers: [],
    hibernationEnabled: false,
    hibernationTimeout: 30,
    whitelist: ['google.com', 'facebook.com', 'gmail.com', 'youtube.com', 'github.com'],
    alwaysRequirePassword: true,
    vaultSyncEnabled: false,
    masterSyncKey: null,
    linkClickBehavior: 'inside',
    appliedLinkType: 'all',
    antiTabunderEnabled: true,
    googleSafeSearch: 'active',
    requireStrongPassword: false,
    showPasswordInSettings: true,
    customCursor: '',
    adblockEnabled: true,
    easylistEnabled: true,
    customAdblockRules: '',
    customAdblockCssRules: '',
    // Cloud Sync (unified system v2)
    syncEnabled:  false,
    syncBackend:  'chrome'  // 'chrome' | 'drive'
};

export let activeTab = null;

export const ModuleLoader = {
    loaded: new Set(),
    async load(moduleId) {
        if (this.loaded.has(moduleId)) return;
        try {
            console.log(`[LazyLoad] Loading: ${moduleId}`);
            const module = await import(`./modules/${moduleId}.js`);
            if (module.init) {
                await module.init();
            }
            this.loaded.add(moduleId);
        } catch (error) {
            console.error(`[LazyLoad] Failed to load ${moduleId}:`, error);
        }
    }
};

export function saveSettings() {
    return new Promise(resolve => {
        chrome.storage.local.set({ appSettings: settings }, () => {
            // Auto-sync via unified sync module (uses session-cached password, silent fail)
            if (settings.syncEnabled) {
                import('./modules/sync.js').then(m => m.syncToCloud?.()).catch(e => console.warn('[Sync] Auto-sync skipped:', e.message));
            }
            resolve();
        });
    });
}

export function setupUnifiedLockScreen(container, passInput, unlockBtn, onSuccess) {
    if (!container || !passInput || !unlockBtn) return;

    chrome.storage.local.get(['stealthPasswordHash', 'stealthSalt'], (result) => {
        const hasPassword = !!result.stealthPasswordHash;

        if (!hasPassword) {
            const header = container.querySelector('.lock-header');
            const body = container.querySelector('.lock-body');
            if (header && body) {
                const lang = settings.language || 'vi';
                const dict = translations[lang] || translations.vi;

                header.textContent = '';
                header.appendChild(
                    createElement('div', { className: 'lock-icon-wrapper' },
                        createElement('img', { src: ASSETS.icons.icon128, alt: 'security', className: 'lock-icon' }),
                        createElement('div', { className: 'lock-pulse' })
                    )
                );
                header.appendChild(createElement('h3', {}, dict.setupStealthCodeTitle || 'Tạo Mã Số Bí Mật'));
                header.appendChild(createElement('p', {}, dict.setupStealthCodeDesc || 'Thiết lập mã số bảo mật để bảo vệ Két sắt và Trình phát riêng tư.'));

                body.textContent = '';
                body.appendChild(
                    createElement('div', { className: 'password-input-group' },
                        createElement('div', { className: 'password-wrapper', style: { position: 'relative', width: '100%' } },
                            createElement('input', { type: 'password', className: 'lock-new-pass', placeholder: dict.enterNewPassPlaceholder || 'Nhập mật khẩu mới (từ 4 kí tự)...' }),
                            createElement('button', { className: 'pass-eye lock-new-eye hidden', style: { position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' } }, '👁️')
                        ),
                        createElement('div', { className: 'password-wrapper', style: { position: 'relative', width: '100%' } },
                            createElement('input', { type: 'password', className: 'lock-confirm-pass', placeholder: dict.confirmPassPlaceholder || 'Xác nhận mật khẩu mới...' }),
                            createElement('button', { className: 'pass-eye lock-confirm-eye hidden', style: { position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' } }, '👁️')
                        ),
                        createElement('button', { className: 'unlock-btn-modern setup-save-btn' },
                            createElement('span', {}, '💾'),
                            ' ' + (dict.saveAndUnlock || 'Tạo & Mở Khóa')
                        )
                    )
                );

                const saveBtn = body.querySelector('.setup-save-btn');
                const newPassInput = body.querySelector('.lock-new-pass');
                const confirmPassInput = body.querySelector('.lock-confirm-pass');
                const newEyeBtn = body.querySelector('.lock-new-eye');
                const confirmEyeBtn = body.querySelector('.lock-confirm-eye');

                if (settings.showPasswordInSettings) {
                    if (newEyeBtn) newEyeBtn.classList.remove('hidden');
                    if (confirmEyeBtn) confirmEyeBtn.classList.remove('hidden');
                }

                if (newEyeBtn) {
                    newEyeBtn.addEventListener('click', () => {
                        const isPassword = newPassInput.type === 'password';
                        newPassInput.type = isPassword ? 'text' : 'password';
                        newEyeBtn.textContent = isPassword ? '🙈' : '👁️';
                    });
                }

                if (confirmEyeBtn) {
                    confirmEyeBtn.addEventListener('click', () => {
                        const isPassword = confirmPassInput.type === 'password';
                        confirmPassInput.type = isPassword ? 'text' : 'password';
                        confirmEyeBtn.textContent = isPassword ? '🙈' : '👁️';
                    });
                }

                const triggerSave = async () => {
                    const pass = newPassInput.value.trim();
                    const confirmPass = confirmPassInput.value.trim();

                    if (!pass) {
                        notify(dict.enterPassWarning || 'Vui lòng nhập mật khẩu!', 'warning');
                        return;
                    }
                    if (pass.length < 4) {
                        notify(dict.passMinLength || 'Mật khẩu phải từ 4 ký tự trở lên!', 'warning');
                        return;
                    }
                    if (pass !== confirmPass) {
                        notify(dict.passMismatch || 'Mật khẩu xác nhận không trùng khớp!', 'error');
                        return;
                    }

                    const { hashPassword, generateMasterKey } = await import('./modules/utils.js');
                    const salt = await generateMasterKey();
                    const hash = await hashPassword(pass, salt);

                    chrome.storage.local.set({
                        stealthPasswordHash: hash,
                        stealthSalt: salt
                    }, () => {
                        state.secretCode = pass;
                        if (chrome.storage.session) {
                            chrome.storage.session.set({ sessionPassword: pass });
                        }
                        state.isStealthUnlocked = true;
                        state.isVaultUnlocked = true;
                        
                        if (elements.vaultLockScreen) elements.vaultLockScreen.classList.remove('show');
                        if (elements.stealthLockScreen) elements.stealthLockScreen.classList.remove('show');
                        
                        notify(dict.setupSuccess || 'Thiết lập mật khẩu thành công!', 'success');
                        
                        if (typeof onSuccess === 'function') onSuccess();
                    });
                };

                saveBtn.addEventListener('click', triggerSave);
                confirmPassInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') triggerSave();
                });
                newPassInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') triggerSave();
                });
            }
        } else {
            const header = container.querySelector('.lock-header');
            const body = container.querySelector('.lock-body');
            if (header && body) {
                const lang = settings.language || 'vi';
                const dict = translations[lang] || translations.vi;

                const isVault = container.id === 'vaultLockScreen';
                const titleKey = isVault ? 'vaultProtected' : 'stealthModeLocked';
                const descKey = isVault ? 'vaultLockDesc' : 'stealthLockDesc';

                header.textContent = '';
                header.appendChild(
                    createElement('div', { className: 'lock-icon-wrapper' },
                        createElement('img', { src: ASSETS.icons.icon128, alt: 'security', className: 'lock-icon' }),
                        createElement('div', { className: 'lock-pulse' })
                    )
                );
                header.appendChild(createElement('h3', {}, dict[titleKey] || (isVault ? 'Vault Protected' : 'Stealth Mode Locked')));
                header.appendChild(createElement('p', {}, dict[descKey] || (isVault ? 'Enter your Stealth Code to access the Vault' : 'Enter your secret code to unlock Privacy Player')));

                body.textContent = '';
                body.appendChild(
                    createElement('div', { className: 'password-input-group' },
                        createElement('div', { className: 'password-wrapper', style: { position: 'relative' } },
                            createElement('input', { type: 'password', className: 'lock-login-pass', placeholder: dict.enterSecretCode || 'Nhập mã số bí mật...', value: '' }),
                            createElement('button', { className: 'pass-eye hidden', style: { position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' } }, '👁️')
                        ),
                        createElement('button', { className: 'unlock-btn-modern login-unlock-btn' },
                            createElement('span', {}, '🔓'),
                            ' ' + (dict.unlock || 'Unlock')
                        )
                    )
                );

                const loginInput = body.querySelector('.lock-login-pass');
                const loginUnlockBtn = body.querySelector('.login-unlock-btn');
                const eyeBtn = body.querySelector('.pass-eye');

                if (settings.showPasswordInSettings) {
                    eyeBtn.classList.remove('hidden');
                }
                eyeBtn.addEventListener('click', () => {
                    const isPassword = loginInput.type === 'password';
                    loginInput.type = isPassword ? 'text' : 'password';
                    eyeBtn.textContent = isPassword ? '🙈' : '👁️';
                });

                const triggerUnlock = async () => {
                    const code = loginInput.value;
                    const { hashPassword } = await import('./modules/utils.js');
                    chrome.storage.local.get(['stealthPasswordHash', 'stealthSalt'], async (res) => {
                        const storedHash = res.stealthPasswordHash;
                        const salt = res.stealthSalt;
                        const enteredHash = await hashPassword(code, salt);

                        if (enteredHash === storedHash) {
                            state.secretCode = code;
                            if (chrome.storage.session) {
                                chrome.storage.session.set({ sessionPassword: code });
                            }
                            state.isStealthUnlocked = true;
                            state.isVaultUnlocked = true;
                            
                            if (elements.vaultLockScreen) elements.vaultLockScreen.classList.remove('show');
                            if (elements.stealthLockScreen) elements.stealthLockScreen.classList.remove('show');
                            
                            notify(dict.unlockSuccess || 'Mở khóa thành công!', 'success');
                            if (typeof onSuccess === 'function') onSuccess();
                        } else {
                            notify(dict.incorrectCode || 'Mã bảo mật không chính xác!', 'error');
                            loginInput.value = '';
                        }
                    });
                };

                loginUnlockBtn.addEventListener('click', triggerUnlock);
                loginInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') triggerUnlock();
                });
            }
        }
    });
}

let _notifyTimer = null;
export function notify(message, status = 'info') {
    if (!settings.showNotifications) return;

    let notification = elements.notification || document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
        elements.notification = notification;
    }

    const gradients = {
        success: 'linear-gradient(135deg, #10b981, #059669)',
        warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
        error: 'linear-gradient(135deg, #ef4444, #dc2626)',
        info: 'linear-gradient(135deg, #3b82f6, #2563eb)'
    };

    const icons = {
        success: '✓',
        warning: '⚠',
        error: '✕',
        info: 'ℹ'
    };

    const icon = icons[status] || icons.info;
    notification.style.background = gradients[status] || gradients.info;
    notification.innerHTML = `<span style="font-weight: 800; font-size: 13px; opacity: 0.9;">${icon}</span> <span>${message}</span>`;

    // Ensure re-triggering rapid notifications plays smoothly
    notification.classList.remove('show');
    void notification.offsetWidth; // force reflow
    notification.classList.add('show');

    if (_notifyTimer) clearTimeout(_notifyTimer);
    _notifyTimer = setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

export function notifySend(message, title = 'Cookie Manager', type = 'basic', iconUrl = ASSETS.icons.default) {
    chrome.runtime.sendMessage({
        type: 'createNotification',
        options: { type, message, title, iconUrl }
    });
}

export function applySettings() {
    document.body.classList.toggle('dark-mode', settings.darkMode);
    if (elements.darkModeToggle) elements.darkModeToggle.checked = settings.darkMode;
    if (elements.languageSelect) elements.languageSelect.value = settings.language || 'vi';

    if (elements.autoClearToggle) elements.autoClearToggle.checked = settings.autoClearStealth;
    if (elements.showNotifyToggle) elements.showNotifyToggle.checked = settings.showNotifications;
    if (elements.cookieDestroyerToggle) elements.cookieDestroyerToggle.checked = settings.cookieDestroyer;
    if (elements.historyIncognitoToggle) elements.historyIncognitoToggle.checked = settings.historyIncognito;
    if (elements.useSidePanelToggle) elements.useSidePanelToggle.checked = settings.useSidePanel || false;
    if (elements.enableTempMailToggle) elements.enableTempMailToggle.checked = settings.enableTempMail ?? false;
    if (elements.enableTabManagerToggle) elements.enableTabManagerToggle.checked = settings.enableTabManager ?? false;
    if (elements.enableFloatingTabBarToggle) elements.enableFloatingTabBarToggle.checked = settings.enableFloatingTabBar ?? true;
    if (elements.tempMailBtn) elements.tempMailBtn.style.display = (settings.enableTempMail ?? false) ? 'flex' : 'none';
    if (elements.tabManagerBtn) elements.tabManagerBtn.style.display = (settings.enableTabManager ?? false) ? 'flex' : 'none';
    if (elements.realTimeProtectionToggle) elements.realTimeProtectionToggle.checked = settings.realTimeProtection ?? true;
    if (elements.blockClickjackingToggle) elements.blockClickjackingToggle.checked = settings.blockClickjacking ?? true;
    if (elements.blockCryptoMiningToggle) elements.blockCryptoMiningToggle.checked = settings.blockCryptoMining ?? true;
    if (elements.playerLinkBehavior) elements.playerLinkBehavior.value = settings.linkClickBehavior || 'inside';
    if (elements.playerLinkFilter) elements.playerLinkFilter.value = settings.appliedLinkType || 'all';
    if (elements.antiTabunderToggle) elements.antiTabunderToggle.checked = settings.antiTabunderEnabled ?? true;
    if (elements.playerAntiTabunderToggle) elements.playerAntiTabunderToggle.checked = settings.antiTabunderEnabled ?? true;
    if (elements.strongPasswordToggle) elements.strongPasswordToggle.checked = settings.requireStrongPassword ?? false;
    if (elements.alwaysRequirePasswordToggle) elements.alwaysRequirePasswordToggle.checked = settings.alwaysRequirePassword ?? true;
    if (elements.showPasswordToggle) elements.showPasswordToggle.checked = settings.showPasswordInSettings ?? true;
    if (elements.playerIsolatedIdentityToggle) elements.playerIsolatedIdentityToggle.checked = settings.playerIsolatedIdentity ?? true;
    if (elements.hlsBufferModeSelect) elements.hlsBufferModeSelect.value = settings.hlsBufferMode || 'smart_ram_controller';
    if (elements.hlsMaxRamSlider) elements.hlsMaxRamSlider.value = settings.hlsMaxRamMb || 256;
    if (elements.hlsMaxRamVal) elements.hlsMaxRamVal.textContent = `${settings.hlsMaxRamMb || 256} MB`;
    if (elements.hlsMaxRamRow) elements.hlsMaxRamRow.style.display = (settings.hlsBufferMode === 'only_ram') ? 'none' : 'flex';
    
    const sizeUnit = settings.playerSizeUnit || 'px';
    const PX_PER_CM = 37.79527559;
    if (elements.widthUnitBtn) elements.widthUnitBtn.textContent = sizeUnit;
    if (elements.heightUnitBtn) elements.heightUnitBtn.textContent = sizeUnit;
    if (elements.defaultPlayerWidth) {
        let w = settings.defaultPlayerWidth || 600;
        elements.defaultPlayerWidth.value = sizeUnit === 'cm' ? (w / PX_PER_CM).toFixed(2) : w;
    }
    if (elements.defaultPlayerHeight) {
        let h = settings.defaultPlayerHeight || 400;
        elements.defaultPlayerHeight.value = sizeUnit === 'cm' ? (h / PX_PER_CM).toFixed(2) : h;
    }
    if (elements.followDefaultPlayerSizeToggle) elements.followDefaultPlayerSizeToggle.checked = settings.followDefaultPlayerSize ?? true;
    if (elements.force100PercentToggle) elements.force100PercentToggle.checked = settings.force100Percent ?? false;

    if (elements.overlaySearchEngine) elements.overlaySearchEngine.value = settings.searchEngine || 'google';
    if (elements.searchEngineSelect) elements.searchEngineSelect.value = settings.searchEngine || 'google';
    if (elements.googleSafeSearchSelect) elements.googleSafeSearchSelect.value = settings.googleSafeSearch || 'active';
    if (elements.protectionLevelSelect) elements.protectionLevelSelect.value = settings.protectionLevel || 'standard';
    if (elements.panicActionSelect) elements.panicActionSelect.value = settings.panicAction || 'closeIncognito';
    if (elements.vaultSyncToggle) elements.vaultSyncToggle.checked = settings.vaultSyncEnabled || false;
    if (elements.geoDropdown) elements.geoDropdown.value = settings.blockGeolocation ? 'block' : 'allow';

    const stealthPlayer = document.getElementById('stealthPlayer');
    if (stealthPlayer) {
        if (settings.blockGeolocation) {
            stealthPlayer.allow = stealthPlayer.allow.replace(/geolocation\s*/, '').trim();
        } else {
            if (!stealthPlayer.allow.includes('geolocation')) {
                stealthPlayer.allow += ' geolocation';
            }
        }
    }

    if (elements.telegramDownloaderToggle) elements.telegramDownloaderToggle.checked = settings.telegramDownloaderEnabled || false;
    if (elements.videoDownloaderToggle) elements.videoDownloaderToggle.checked = settings.videoDownloaderEnabled || false;
    if (elements.pipToggle) elements.pipToggle.checked = settings.pipEnabled ?? true;
    if (elements.multiAccountToggle) elements.multiAccountToggle.checked = settings.multiAccountEnabled || false;
    if (elements.hibernationToggle) elements.hibernationToggle.checked = settings.hibernationEnabled || false;
    if (elements.hibernationTimeoutSelect) elements.hibernationTimeoutSelect.value = settings.hibernationTimeout || 30;

    if (elements.telegramDownloaderBtn) elements.telegramDownloaderBtn.classList.toggle('hidden', !settings.telegramDownloaderEnabled);
    if (elements.videoDownloaderBtn) elements.videoDownloaderBtn.classList.toggle('hidden', !settings.videoDownloaderEnabled);
    if (elements.togglePip) elements.togglePip.classList.toggle('hidden', !settings.pipEnabled);
    if (elements.multiAccountBtn) elements.multiAccountBtn.classList.toggle('hidden', !settings.multiAccountEnabled);

    const showEyes = settings.showPasswordInSettings ?? true;
    document.querySelectorAll('.pass-eye').forEach(eye => {
        eye.classList.toggle('hidden', !showEyes);
    });

    if (elements.customCursorToggle) elements.customCursorToggle.checked = !!settings.customCursor;
    if (elements.customCursorInputContainer) elements.customCursorInputContainer.style.display = settings.customCursor ? 'flex' : 'none';
    if (elements.customCursorInput) elements.customCursorInput.value = settings.customCursor || '';

    if (settings.customCursor) {
        document.body.style.cursor = `url('${settings.customCursor}'), auto`;
        let styleEl = document.getElementById('custom-cursor-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'custom-cursor-style';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = `* { cursor: url('${settings.customCursor}'), auto !important; }`;
    } else {
        document.body.style.cursor = '';
        const styleEl = document.getElementById('custom-cursor-style');
        if (styleEl) styleEl.remove();
    }
    if (elements.playerBackgroundType) elements.playerBackgroundType.value = settings.playerBackgroundType || 'default';
    if (elements.playerBgDisplayMode) elements.playerBgDisplayMode.value = settings.playerBgDisplayMode || 'cover';

    updateUILanguage();
    document.body.style.opacity = '1';
}

export function updateUILanguage() {
    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            const children = Array.from(el.childNodes).filter(node =>
                node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('beta-badge')
            );
            el.textContent = '';
            children.forEach(child => el.appendChild(child));
            const translatedText = dict[key];
            if (translatedText.includes('<') && translatedText.includes('>')) {
                el.appendChild(parseHTML(translatedText));
            } else {
                el.appendChild(document.createTextNode(' ' + translatedText));
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) el.placeholder = dict[key];
    });

    document.querySelectorAll('.info-icon[data-info]').forEach(el => {
        const infoKey = el.getAttribute('data-i18n-info');
        if (infoKey && dict[infoKey]) el.setAttribute('data-info', dict[infoKey]);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (dict[key]) el.title = dict[key];
    });

    const languageLabel = document.getElementById('languageLabel');
    if (languageLabel) languageLabel.textContent = dict.languageLabel;

    import('./modules/settings.js').then(m => {
        if (typeof m.updatePanicDescription === 'function') {
            m.updatePanicDescription(settings.panicAction || 'closeIncognito');
        }
    }).catch(() => {});

    calculatePrivacyGrade();
}
export async function toggleSection(section) {
    const {
        extensionsList, cookiesList, controls,
        extensionManager, cookiesManager, privacySettings,
        privacyPlayer, stealthSection, appSettings,
        appSettingsBtn, homeSection, historyManagerBtn,
        historySection, vaultBtn, vaultSection, vaultLockScreen, stealthLockScreen,
        adblockSection, adblockBtn
    } = elements;

    const isActive = (section === 'extensions' && extensionManager?.classList.contains('active')) ||
        (section === 'cookies' && cookiesManager?.classList.contains('active')) ||
        (section === 'player' && privacyPlayer?.classList.contains('active')) ||
        (section === 'settings' && appSettingsBtn?.classList.contains('active')) ||
        (section === 'history' && historyManagerBtn?.classList.contains('active')) ||
        (section === 'vault' && vaultBtn?.classList.contains('active')) ||
        (section === 'telegram' && elements.telegramDownloaderBtn?.classList.contains('active')) ||
        (section === 'video' && elements.videoDownloaderBtn?.classList.contains('active')) ||
        (section === 'multiAccount' && elements.multiAccountBtn?.classList.contains('active')) ||
        (section === 'tabManager' && elements.tabManagerBtn?.classList.contains('active')) ||
        (section === 'tempMail' && elements.tempMailBtn?.classList.contains('active')) ||
        (section === 'networkShield' && elements.networkShieldBtn?.classList.contains('active')) ||
        (section === 'adblock' && adblockBtn?.classList.contains('active'));

    const allSections = [
        extensionsList, cookiesList, controls, privacySettings, stealthSection, appSettings,
        homeSection, historySection, vaultSection, elements.telegramSection, elements.videoDownloaderSection, elements.multiAccountSection,
        adblockSection, elements.tabManagerSection, elements.tempMailSection, elements.networkShieldSection
    ];
    allSections.forEach(el => el?.classList.remove('show'));

    const allBtns = [
        extensionManager, cookiesManager, privacyPlayer, appSettingsBtn, historyManagerBtn,
        vaultBtn, elements.telegramDownloaderBtn, elements.videoDownloaderBtn, elements.multiAccountBtn,
        adblockBtn, elements.tabManagerBtn, elements.tempMailBtn, elements.networkShieldBtn, document.getElementById('networkShieldNavBtn')
    ];
    allBtns.forEach(el => el?.classList.remove('active'));

    if (isActive && section !== 'home') {
        await toggleSection('home');
        return;
    }

    if (section === 'home') {
        // Reset body dimensions that might have been modified by Privacy Player or other modules
        document.body.style.width = '';
        document.body.style.height = '';
        
        homeSection?.classList.add('show');
        await ModuleLoader.load('dashboard');
        return;
    }

    if (section === 'adblock') {
        adblockBtn?.classList.add('active');
        adblockSection?.classList.add('show');
        await ModuleLoader.load('adblock');
        import('./modules/adblock.js').then(m => m.initAdblockUI());
        return;
    }

    if (section === 'networkShield') {
        elements.networkShieldBtn?.classList.add('active');
        document.getElementById('networkShieldNavBtn')?.classList.add('active');
        elements.networkShieldSection?.classList.add('show');
        await ModuleLoader.load('network');
        return;
    }

    if (section !== 'player') {
        if (stealthLockScreen) stealthLockScreen.classList.remove('show');
        const stealthPassInput = document.getElementById('stealthPassInput');
        if (stealthPassInput) stealthPassInput.value = '';

        if (settings.alwaysRequirePassword) {
            state.isStealthUnlocked = false;
            state.secretCode = null;
            chrome.storage.session?.remove('sessionPassword');
        }

        const stealthPlayer = document.getElementById('stealthPlayer');
        if (stealthPlayer) {
            if (settings.autoClearStealth && stealthPlayer.src && stealthPlayer.src !== 'about:blank') {
                chrome.history.deleteUrl({ url: stealthPlayer.src });
            }
            stealthPlayer.src = 'about:blank';
            const container = document.querySelector('.player-container');
            if (container) container.classList.remove('has-content', 'player-loading');
        }

        const stealthSectionEl = document.getElementById('stealthSection');
        if (stealthSectionEl) stealthSectionEl.classList.remove('focus-mode-active');
        document.body.classList.remove('has-focus-mode');
        const focusModeBtn = document.getElementById('focusModePlayer');
        if (focusModeBtn) {
            focusModeBtn.classList.remove('active');
            focusModeBtn.title = 'Chế độ tập trung (Focus Mode)';
        }
    }

    if (section !== 'vault') {
        if (vaultLockScreen) vaultLockScreen.classList.remove('show');
        const vaultPassInput = document.getElementById('vaultPassInput');
        if (vaultPassInput) vaultPassInput.value = '';

        if (settings.alwaysRequirePassword) {
            state.isVaultUnlocked = false;
            state.secretCode = null;
            chrome.storage.session?.remove('sessionPassword');
        }
    }

    if (section === 'extensions') {
        if (privacySettings) privacySettings.classList.add('show');
        await ModuleLoader.load('extensions');
        import('./modules/extensions.js').then(m => m.renderExtensions());
    } else if (section === 'cookies') {
        if (cookiesList) cookiesList.classList.add('show');
        if (controls) controls.classList.add('show');
        if (cookiesManager) cookiesManager.classList.add('active');
        await ModuleLoader.load('cookies');
        import('./modules/cookies.js').then(m => m.loadCookies('', true));
    } else if (section === 'player') {
        if (stealthSection) stealthSection.classList.add('show');
        if (privacyPlayer) privacyPlayer.classList.add('active');
        
        const isStealthLocked = !state.isStealthUnlocked && (settings.alwaysRequirePassword || !state.secretCode);
        if (isStealthLocked && stealthLockScreen) {
            stealthLockScreen.classList.add('show');
        }
        
        const isLoaded = ModuleLoader.loaded.has('player');
        // Instantly show then load to prevent UI jump
        await ModuleLoader.load('player');
        if (isLoaded) {
            import('./modules/player.js').then(m => m.checkStealthLock());
        }
    } else if (section === 'settings') {
        if (appSettings) appSettings.classList.add('show');
        if (appSettingsBtn) appSettingsBtn.classList.add('active');
        await ModuleLoader.load('settings');
        import('./modules/settings.js').then(m => {
            m.renderSessions?.();
            m.renderSafeUrls?.();
            m.renderCustomBgList?.();
        });
        // Initialize Cloud Sync UI on demand
        import('./modules/sync.js').then(m => m.initSyncUI?.());
    } else if (section === 'history') {
        if (historySection) historySection.classList.add('show');
        if (historyManagerBtn) historyManagerBtn.classList.add('active');
        await ModuleLoader.load('history');
        import('./modules/history.js').then(m => m.loadHistoryAndSessions?.());
    } else if (section === 'vault') {
        if (vaultSection) vaultSection.classList.add('show');
        if (vaultBtn) vaultBtn.classList.add('active');
        
        const isVaultLocked = !state.isVaultUnlocked && (settings.alwaysRequirePassword || !state.secretCode);
        if (isVaultLocked && vaultLockScreen) {
            vaultLockScreen.classList.add('show');
        }
        
        const isLoaded = ModuleLoader.loaded.has('vault');
        await ModuleLoader.load('vault');
        if (isLoaded) {
            import('./modules/vault.js').then(m => m.loadVault?.());
        }
    } else if (section === 'telegram') {
        if (elements.telegramSection) elements.telegramSection.classList.add('show');
        if (elements.telegramDownloaderBtn) elements.telegramDownloaderBtn.classList.add('active');
        await ModuleLoader.load('downloader');
    } else if (section === 'video') {
        if (elements.videoDownloaderSection) elements.videoDownloaderSection.classList.add('show');
        if (elements.videoDownloaderBtn) elements.videoDownloaderBtn.classList.add('active');
        await ModuleLoader.load('downloader');
        import('./modules/downloader.js').then(m => m.loadDetectedVideos?.());
    } else if (section === 'multiAccount') {
        if (elements.multiAccountSection) elements.multiAccountSection.classList.add('show');
        if (elements.multiAccountBtn) elements.multiAccountBtn.classList.add('active');
        await ModuleLoader.load('multiAccount');
        import('./modules/multiAccount.js').then(m => m.loadContainers?.());
    } else if (section === 'tabManager') {
        if (elements.tabManagerSection) elements.tabManagerSection.classList.add('show');
        if (elements.tabManagerBtn) elements.tabManagerBtn.classList.add('active');
        import('./modules/tab-manager.js').then(m => m.renderVerticalTabManager?.());
    } else if (section === 'tempMail') {
        if (elements.tempMailSection) elements.tempMailSection.classList.add('show');
        if (elements.tempMailBtn) elements.tempMailBtn.classList.add('active');
        import('./modules/tempmail.js').then(m => m.initTempMailUI?.());
    }
}

async function updateActiveTabCache() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs?.[0]) activeTab = tabs[0];
    } catch (e) {
        console.warn('[Popup] Active tab cache error:', e);
    }
}

chrome.tabs.onActivated.addListener(updateActiveTabCache);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && tab.windowId === chrome.windows.WINDOW_ID_CURRENT) {
        activeTab = tab;
    }
});

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'tg_stats_update') {
        const { stats } = request;
        if (elements.telegramStats) {
            elements.telegramStats.classList.remove('hidden');
            elements.statParallel.textContent = stats.parallelChunks;
            elements.statChunkSize.textContent = (stats.chunkSize / 1024 / 1024).toFixed(1) + ' MB';
            elements.statRetries.textContent = stats.retries || 0;
            elements.statSpeed.textContent = stats.speed || '--';
        }
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const tooltip = document.createElement('div');
    tooltip.id = 'infoTooltip';
    document.body.appendChild(tooltip);

    document.querySelectorAll('.info-icon').forEach(icon => {
        icon.addEventListener('mouseenter', (e) => {
            const infoText = e.target.dataset.info;
            tooltip.textContent = infoText;
            tooltip.style.display = 'block';

            const rect = e.target.getBoundingClientRect();
            const tooltipWidth = 250;

            let leftPos = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            if (leftPos + tooltipWidth > window.innerWidth - 10) leftPos = window.innerWidth - tooltipWidth - 10;
            if (leftPos < 10) leftPos = 10;
            tooltip.style.left = `${leftPos}px`;

            const tooltipHeight = tooltip.offsetHeight;
            let topPos = rect.top - tooltipHeight - 10;
            if (topPos < 10) topPos = rect.bottom + 10;
            tooltip.style.top = `${topPos}px`;
        });

        icon.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    });

    const { value } = await chrome.privacy.websites.doNotTrackEnabled.get({});
    setTrackStyle(elements.toggleTracking, value);

    updateActiveTabCache();

    chrome.storage.local.get(['stealthPasswordHash', 'stealthSalt', 'appSettings'], async (result) => {
        if (result.appSettings) {
            settings = { ...settings, ...result.appSettings };
            applySettings();

            if (chrome.storage.session) {
                chrome.storage.session.get(['sessionPassword'], async (sessionResult) => {
                    if (sessionResult.sessionPassword) {
                        state.secretCode = sessionResult.sessionPassword;
                    }
                });
            }
        } else {
            chrome.storage.local.set({ appSettings: settings });
            applySettings();
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.appSettings) {
            settings = { ...settings, ...changes.appSettings.newValue };
            applySettings();
        }
    });

    elements.extensionManager.addEventListener('click', () => toggleSection('extensions'));
    elements.cookiesManager.addEventListener('click', () => toggleSection('cookies'));
    elements.privacyPlayer.addEventListener('click', () => toggleSection('player'));
    elements.historyManagerBtn.addEventListener('click', () => toggleSection('history'));
    elements.vaultBtn.addEventListener('click', () => toggleSection('vault'));
    elements.appSettingsBtn.addEventListener('click', () => toggleSection('settings'));
    elements.telegramDownloaderBtn.addEventListener('click', () => toggleSection('telegram'));
    elements.videoDownloaderBtn.addEventListener('click', () => toggleSection('video'));
    elements.multiAccountBtn.addEventListener('click', () => toggleSection('multiAccount'));
    elements.adblockBtn.addEventListener('click', () => toggleSection('adblock'));
    if (elements.networkShieldBtn) {
        elements.networkShieldBtn.addEventListener('click', () => toggleSection('networkShield'));
    }
    
    const networkShieldNavBtn = document.getElementById('networkShieldNavBtn');
    if (networkShieldNavBtn) {
        networkShieldNavBtn.addEventListener('click', () => toggleSection('networkShield'));
    }

    if (elements.tempMailBtn) elements.tempMailBtn.addEventListener('click', () => toggleSection('tempMail'));
    if (elements.tabManagerBtn) {
        elements.tabManagerBtn.addEventListener('click', () => toggleSection('tabManager'));
    }
    
    // Initialize Vertical Tab Manager
    initVerticalTabManager();

    if (elements.cardAdblock) {
        elements.cardAdblock.addEventListener('click', () => toggleSection('adblock'));
    }
    if (elements.lockScreenBackBtn) {
        elements.lockScreenBackBtn.addEventListener('click', () => toggleSection('home'));
    }

    if (elements.switchViewBtn) {
        elements.switchViewBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
        });
    }
    if (elements.vaultLockScreenBackBtn) {
        elements.vaultLockScreenBackBtn.addEventListener('click', () => toggleSection('home'));
    }

    // Horizontal scrolling on mousewheel hover for navigation bar
    const mainControls = document.querySelector('.mainControls');
    if (mainControls) {
        mainControls.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                mainControls.scrollLeft += e.deltaY;
            }
        });
    }

    await ModuleLoader.load('dashboard');
    toggleSection('home');

    // Preload modules in the background during idle time to make future tab switches instant
    setTimeout(() => {
        const modulesToPreload = ['cookies', 'extensions', 'player', 'vault', 'settings', 'history'];
        modulesToPreload.forEach(mod => {
            if (!ModuleLoader.loaded.has(mod)) {
                import(`./modules/${mod}.js`).catch(() => {});
            }
        });
    }, 1000);
});

export function showConfirm(message) {
    return new Promise((resolve) => {
        const overlay = createElement('div', { className: 'custom-confirm-overlay' },
            createElement('div', { className: 'custom-confirm-box' },
                createElement('span', { className: 'custom-confirm-icon' }, '⚠️'),
                createElement('p', {}, message),
                createElement('div', { className: 'custom-confirm-actions' },
                    createElement('button', { className: 'custom-confirm-btn-cancel' }, 'Hủy'),
                    createElement('button', { className: 'custom-confirm-btn-ok' }, 'Đồng ý')
                )
            )
        );
        document.body.appendChild(overlay);

        const btnOk = overlay.querySelector('.custom-confirm-btn-ok');
        const btnCancel = overlay.querySelector('.custom-confirm-btn-cancel');

        const cleanup = (result) => {
            overlay.remove();
            resolve(result);
        };

        btnOk.addEventListener('click', () => cleanup(true));
        btnCancel.addEventListener('click', () => cleanup(false));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup(false);
            }
        });
    });
}

// Backward compatibility helper
export function renderTabManager(searchQuery = '') {
    renderVerticalTabManager();
}

// Network Logger
if (elements.networkLoggerBtn) {
    elements.networkLoggerBtn.addEventListener('click', () => {
        chrome.windows.create({
            url: chrome.runtime.getURL("logger.html"),
            type: "popup",
            width: 1100,
            height: 700
        });
    });
}

// ============ DEVICE PROFILE & SMART USER-AGENT GENERATOR ============
import { DEVICE_PROFILES, getActiveDeviceProfile, setActiveDeviceProfile, generateRandomDeviceProfile } from './modules/deviceProfiles.js';

let customGeneratedProfile = null;

function updateProfilePreviewUI(profile) {
    const previewPlatform = document.getElementById('previewPlatform');
    const previewHardware = document.getElementById('previewHardware');
    const previewScreen = document.getElementById('previewScreen');
    const previewGpu = document.getElementById('previewGpu');
    const activeBadge = document.getElementById('activeProfileBadge');

    if (!profile || profile.id === 'default') {
        if (previewPlatform) previewPlatform.textContent = 'Default System';
        if (previewHardware) previewHardware.textContent = 'Hardware Default';
        if (previewScreen) previewScreen.textContent = 'Current Display';
        if (previewGpu) previewGpu.textContent = 'Native GPU';
        if (activeBadge) {
            activeBadge.textContent = 'Default';
            activeBadge.style.color = '#00cec9';
        }
        return;
    }

    if (previewPlatform) previewPlatform.textContent = `${profile.os} (${profile.platform})`;
    if (previewHardware) previewHardware.textContent = `${profile.deviceMemory}GB RAM • ${profile.hardwareConcurrency} Cores`;
    if (previewScreen) previewScreen.textContent = `${profile.screen.width} x ${profile.screen.height} (@${profile.screen.devicePixelRatio || 1}x)`;
    if (previewGpu) previewGpu.textContent = `${profile.webgl.renderer}`;
    if (activeBadge) {
        activeBadge.textContent = profile.os || 'Active';
        activeBadge.style.color = '#a29bfe';
    }
}

function initDeviceProfilesUI() {
    const profileSelect = document.getElementById('deviceProfileSelect');
    const randomBtn = document.getElementById('randomProfileBtn');
    const applyBtn = document.getElementById('applyProfileBtn');
    const resetBtn = document.getElementById('resetProfileBtn');

    if (!profileSelect) return;

    // Load current active profile
    getActiveDeviceProfile().then(current => {
        if (current) {
            if (DEVICE_PROFILES.some(p => p.id === current.id)) {
                profileSelect.value = current.id;
            } else {
                customGeneratedProfile = current;
            }
            updateProfilePreviewUI(current);
        } else {
            profileSelect.value = 'default';
            updateProfilePreviewUI(null);
        }
    });

    profileSelect.addEventListener('change', () => {
        const val = profileSelect.value;
        if (val === 'default') {
            customGeneratedProfile = null;
            updateProfilePreviewUI(null);
        } else {
            const found = DEVICE_PROFILES.find(p => p.id === val);
            if (found) {
                customGeneratedProfile = null;
                updateProfilePreviewUI(found);
            }
        }
    });

    if (randomBtn) {
        randomBtn.addEventListener('click', () => {
            const rand = generateRandomDeviceProfile();
            customGeneratedProfile = rand;
            updateProfilePreviewUI(rand);
            notify(`🎲 Đã sinh profile ngẫu nhiên: ${rand.name}`, 'info');
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            if (customGeneratedProfile) {
                await chrome.storage.local.set({
                    activeDeviceProfileId: 'custom',
                    customDeviceProfile: customGeneratedProfile
                });
                notify(`⚡ Đã kích hoạt Device Profile: ${customGeneratedProfile.name}!`, 'success');
            } else {
                const val = profileSelect.value;
                await setActiveDeviceProfile(val);
                if (val === 'default') {
                    notify('Đã đưa cấu hình về thiết bị mặc định.', 'info');
                } else {
                    const prof = DEVICE_PROFILES.find(p => p.id === val);
                    notify(`⚡ Đã kích hoạt Device Profile: ${prof?.name || val}!`, 'success');
                }
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            customGeneratedProfile = null;
            profileSelect.value = 'default';
            await setActiveDeviceProfile('default');
            updateProfilePreviewUI(null);
            notify('Đã xóa Device Profile, quay về cấu hình gốc.', 'warning');
        });
    }
}

// Khởi chạy Device Profile UI
initDeviceProfilesUI();
