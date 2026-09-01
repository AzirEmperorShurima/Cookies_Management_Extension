import { elements, settings, notify, saveSettings, state, showConfirm } from '../popup.js';
import { isValidUrl, createElement, ASSETS } from './utils.js';

const translations = window.translations;
const getDict = () => translations[settings.language || 'vi'] || translations.vi;

let playerWidth = 600;
let playerHeight = 400;
let playerHistory = [];
let currentUrlIndex = -1;
let isNavigating = false;
let _messageListenerAdded = false;
let currentBoostSpeed = 1.0;
let currentBoostVolume = 1.0;
let currentFilterMode = 'none';
let preFocusWidth = 600;
let preFocusHeight = 400;

// Search engine map - dùng settings.searchEngine của user
const SEARCH_ENGINES = {
    google: 'https://www.google.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    bing: 'https://www.bing.com/search?q=',
    yahoo: 'https://search.yahoo.com/search?p=',
    startpage: 'https://www.startpage.com/sp/search?query=',
    brave: 'https://search.brave.com/search?q=',
    ecosia: 'https://www.ecosia.org/search?q=',
    qwant: 'https://www.qwant.com/?q=',
    yandex: 'https://yandex.com/search/?text=',
    swisscows: 'https://swisscows.com/web?query=',
    kagi: 'https://kagi.com/search?q=',
    baidu: 'https://www.baidu.com/s?wd=',
    coccoc: 'https://coccoc.com/search?query=',
    tor: 'https://duckduckgogg42xjoc72x3spihqvjkiqx2i6f52q2lq4h4nht5q2q.onion/?q='
};

// ─── URL Helpers ──────────────────────────────────────────────────────────────
function normalizeInputUrl(input) {
    if (!input) return '';
    const trimmed = input.trim();
    if (isValidUrl(trimmed)) return trimmed;
    if (/^[a-z0-9-]+(\.[a-z]{2,})/i.test(trimmed) && !trimmed.includes(' ')) {
        const withProtocol = 'https://' + trimmed;
        if (isValidUrl(withProtocol)) return withProtocol;
    }
    return trimmed;
}

function enforcePrivacyUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
    try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();

        // Enforce SafeSearch & anti-personalization on Google searches
        if (host.includes('google.') && (parsed.pathname.includes('/search') || parsed.pathname === '/')) {
            const safeMode = settings.googleSafeSearch || 'active';
            if (parsed.pathname.includes('/search')) {
                parsed.searchParams.set('safe', safeMode);
                parsed.searchParams.set('pws', '0'); // Disable past account search history personalization
            }
            return parsed.toString();
        }

        // Enforce SafeSearch on DuckDuckGo
        if (host.includes('duckduckgo.com')) {
            const safeMode = settings.googleSafeSearch || 'active';
            parsed.searchParams.set('kp', safeMode === 'off' ? '-1' : '1');
            return parsed.toString();
        }

        // Enforce SafeSearch on Bing
        if (host.includes('bing.com') && parsed.pathname.includes('/search')) {
            const safeMode = settings.googleSafeSearch || 'active';
            parsed.searchParams.set('adlt', safeMode === 'off' ? 'off' : 'strict');
            return parsed.toString();
        }

        return rawUrl;
    } catch (e) {
        return rawUrl;
    }
}

function buildSearchUrl(query) {
    const engine = settings.searchEngine || 'google';
    const base = SEARCH_ENGINES[engine] || SEARCH_ENGINES.google;
    const url = `${base}${encodeURIComponent(query)}`;
    return enforcePrivacyUrl(url);
}

function normalizeForHistory(u) {
    try {
        const parsed = new URL(u);
        return parsed.origin + parsed.pathname + parsed.search;
    } catch { return u; }
}

// ─── Loading State ────────────────────────────────────────────────────────────
function setPlayerLoading(isLoading) {
    const container = elements.playerContainer;
    if (!container) return;
    container.classList.toggle('player-loading', isLoading);
}

// ─── Info Bar ─────────────────────────────────────────────────────────────────
function updateInfoBar(url) {
    const bar = document.getElementById('playerInfoBar');
    if (!bar) return;
    if (!url || url === 'about:blank') {
        bar.classList.add('hidden');
        return;
    }
    try {
        const parsed = new URL(url);
        const isSecure = parsed.protocol === 'https:';
        bar.textContent = '';
        bar.appendChild(createElement('span', { className: 'info-bar-lock' }, isSecure ? '🔒' : '⚠️'));
        bar.appendChild(createElement('span', { className: 'info-bar-domain' }, parsed.hostname));
        bar.classList.remove('hidden');
    } catch {
        bar.classList.add('hidden');
    }
}

// ─── History Persistence ──────────────────────────────────────────────────────
function persistHistory() {
    const toStore = playerHistory.slice(-50);
    chrome.storage.local.set({ stealthHistory: toStore, stealthHistoryIndex: currentUrlIndex });
}

// ─── Inline Confirm (replaces native confirm() blocked by CSP) ────────────────
function showInlineConfirm(message, onConfirm) {
    showConfirm(message).then(confirmed => {
        if (confirmed) onConfirm();
    });
}

// ─── Internal: load URL into iframe ──────────────────────────────────────────
function _loadIntoPlayer(url) {
    const { stealthPlayer, playerContainer } = elements;
    if (!stealthPlayer || !url || url === 'undefined' || url === 'null') return;
    const finalUrl = enforcePrivacyUrl(url);
    setPlayerLoading(true);
    stealthPlayer.src = finalUrl;
    updateInfoBar(finalUrl);
    playerContainer?.classList.add('has-content');
    chrome.storage.local.set({ lastPlayerUrl: finalUrl });
}

// ─── Internal: add URL to history ────────────────────────────────────────────
function _addToHistory(url) {
    const normalized = normalizeForHistory(url);
    const currentNorm = playerHistory[currentUrlIndex] ? normalizeForHistory(playerHistory[currentUrlIndex]) : null;
    if (normalized === currentNorm) return;

    playerHistory = playerHistory.slice(0, currentUrlIndex + 1);
    playerHistory.push(url);
    if (playerHistory.length > 50) playerHistory.shift();
    currentUrlIndex = playerHistory.length - 1;
    updatePlayerNavState();
    persistHistory();
}

// ─── Open Stealth Window (MV3 compatible) ────────────────────────────────────
function openStealthWindowInternal(url) {
    if (!url) {
        notify('Vui lòng nhập URL trước.', 'warning');
        return;
    }
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;

    // MV3: chrome.extension.isAllowedIncognitoAccess is deprecated
    chrome.windows.create({ url: formattedUrl, type: 'popup', width: 1024, height: 768, incognito: true }, () => {
        if (chrome.runtime.lastError) {
            chrome.windows.create({ url: formattedUrl, type: 'popup', width: 1024, height: 768 }, () => {
                setTimeout(() => {
                    chrome.history.deleteUrl({ url: formattedUrl });
                    notify('Stealth Window mở (không có Incognito, đã xóa lịch sử).', 'warning');
                }, 3000);
            });
        } else {
            notify('Incognito Stealth Window đã mở!', 'success');
        }
    });
}


// ─── Add current page to favorites ───────────────────────────────────────────
function addCurrentPageToFavorites() {
    const url = elements.stealthUrl?.value.trim();
    if (!url || !isValidUrl(url)) {
        notify('Không có URL hợp lệ để thêm vào yêu thích.', 'warning');
        return;
    }
    try {
        const hostname = new URL(url).hostname.replace('www.', '');
        if (settings.favoriteWebsites.some(f => f.url === url)) {
            notify('Trang này đã có trong danh sách yêu thích!', 'warning');
            return;
        }
        settings.favoriteWebsites.push({ name: hostname, url });
        saveSettings();
        renderFavoriteWebsites();
        notify(`Đã thêm "${hostname}" vào yêu thích!`, 'success');
    } catch {
        notify('Không thể thêm URL này.', 'error');
    }
}

// ─── Core: Load Content ───────────────────────────────────────────────────────
export function loadPlayerContent() {
    const { stealthUrl, stealthPlayer } = elements;
    if (!stealthUrl || !stealthPlayer) return;

    const raw = stealthUrl.value.trim();

    if (!raw) {
        if (!settings.autoClearStealth) {
            chrome.storage.local.get(['stealthHistory', 'stealthHistoryIndex', 'lastPlayerUrl'], (result) => {
                const history = result.stealthHistory || [];
                if (history.length > 0) {
                    playerHistory = history;
                    currentUrlIndex = result.stealthHistoryIndex ?? history.length - 1;
                    const lastUrl = playerHistory[currentUrlIndex];
                    stealthUrl.value = lastUrl;
                    _loadIntoPlayer(lastUrl);
                    updatePlayerNavState();
                    notify('Privacy Player: Đã khôi phục lịch sử', 'success');
                } else if (result.lastPlayerUrl && result.lastPlayerUrl !== 'undefined' && result.lastPlayerUrl !== 'null') {
                    playerHistory = [result.lastPlayerUrl];
                    currentUrlIndex = 0;
                    stealthUrl.value = result.lastPlayerUrl;
                    _loadIntoPlayer(result.lastPlayerUrl);
                    updatePlayerNavState();
                }
            });
        } else {
            chrome.storage.local.remove(['stealthHistory', 'stealthHistoryIndex', 'lastPlayerUrl']);
            playerHistory = [];
            currentUrlIndex = -1;
            stealthPlayer.src = 'about:blank';
            elements.playerContainer?.classList.remove('has-content');
            updateInfoBar('');
            updatePlayerNavState();
        }
        return;
    }

    const url = normalizeInputUrl(raw);
    stealthUrl.value = url;

    if (isValidUrl(url)) {
        _addToHistory(url);
        _loadIntoPlayer(url);
        notify('Privacy Player: Đang tải...', 'success');
    } else {
        const searchUrl = buildSearchUrl(raw);
        stealthUrl.value = searchUrl; // Fix: Update the address bar to the loaded URL
        _addToHistory(searchUrl);
        _loadIntoPlayer(searchUrl);
        notify('Privacy Player: Đang tìm kiếm...', 'success');
    }
}

// ─── Sandbox ──────────────────────────────────────────────────────────────────
export function updatePlayerSandbox() {
    const { stealthPlayer } = elements;
    if (!stealthPlayer) return;
    stealthPlayer.setAttribute('sandbox', [
        'allow-scripts', 'allow-same-origin', 'allow-forms',
        'allow-presentation', 'allow-downloads', 'allow-modals',
        'allow-popups', 'allow-popups-to-escape-sandbox',
        'allow-storage-access-by-user-activation'
    ].join(' '));
}

// ─── Size ─────────────────────────────────────────────────────────────────────
export function updatePlayerSize() {
    const { playerContainer } = elements;
    if (!playerContainer) return;

    // User setting to force 100% width/height (mutually exclusive with Follow Size)
    const isForce100Percent = settings.force100Percent === true;

    if (isForce100Percent) {
        document.body.classList.add('is-panel');
        document.body.style.width = '';
        document.body.style.height = '';

        const stealthSection = document.getElementById('stealthSection');
        if (stealthSection) stealthSection.style.width = '';

        playerContainer.style.width = '100%';
        playerContainer.style.height = `${playerHeight}px`;
    } else {
        document.body.classList.remove('is-panel');
        // Do not resize body horizontally to avoid squashing tabs and title.
        // Let body use its max-width: 800px natively.
        document.body.style.width = '';

        const extraHeight = Math.max(0, playerHeight - 400);
        const targetHeight = Math.min(650, 500 + extraHeight);
        document.body.style.height = 'auto';

        // Resize the white stealth-section outer frame
        const stealthSection = document.getElementById('stealthSection');
        if (stealthSection) stealthSection.style.width = `${playerWidth}px`;

        playerContainer.style.width = '100%';
        playerContainer.style.marginLeft = '0';
        playerContainer.style.height = `${playerHeight}px`;
    }
}

// ─── Nav State ────────────────────────────────────────────────────────────────
export function updatePlayerNavState() {
    const { goBackPlayer, goForwardPlayer } = elements;
    if (goBackPlayer) goBackPlayer.disabled = currentUrlIndex <= 0;
    if (goForwardPlayer) goForwardPlayer.disabled = currentUrlIndex >= playerHistory.length - 1;
}

// ─── Render Favorites ─────────────────────────────────────────────────────────
export function renderFavoriteWebsites() {
    const { favoriteWebsitesList } = elements;
    if (!favoriteWebsitesList) return;

    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;
    favoriteWebsitesList.textContent = '';

    if (!settings.favoriteWebsites || settings.favoriteWebsites.length === 0) {
        favoriteWebsitesList.appendChild(createElement('p', { className: 'empty-favorites-card' }, dict.noFavorites || '✨ Chưa có trang yêu thích nào.'));
        return;
    }

    const fragment = document.createDocumentFragment();
    settings.favoriteWebsites.forEach((fav, index) => {
        const div = document.createElement('div');
        div.className = 'favorite-item';

        const favicon = document.createElement('img');
        favicon.className = 'favorite-favicon';
        favicon.width = 16;
        favicon.height = 16;
        try {
            const origin = new URL(fav.url).origin;
            favicon.src = `${origin}/favicon.ico`;
        } catch { favicon.src = ASSETS.icons.aboutUs; }
        favicon.onerror = () => { favicon.src = ASSETS.icons.aboutUs; };

        const nameSpan = document.createElement('span');
        nameSpan.className = 'favorite-name';
        nameSpan.title = fav.url;
        nameSpan.textContent = fav.name;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'favorite-actions';

        const goButton = document.createElement('button');
        goButton.className = 'favorite-go-btn';
        goButton.dataset.url = fav.url;
        goButton.title = `Mo ${fav.name}`;
        goButton.textContent = '🚀';

        const deleteButton = document.createElement('button');
        deleteButton.className = 'favorite-delete-btn';
        deleteButton.dataset.index = index;
        deleteButton.title = `Xoa ${fav.name}`;
        deleteButton.textContent = '🗑️';

        actionsDiv.appendChild(goButton);
        actionsDiv.appendChild(deleteButton);
        div.appendChild(favicon);
        div.appendChild(nameSpan);
        div.appendChild(actionsDiv);
        fragment.appendChild(div);
    });
    favoriteWebsitesList.appendChild(fragment);
}

// ─── Lock Screen ──────────────────────────────────────────────────────────────
export function checkStealthLock() {
    const { stealthLockScreen, stealthPassInput, unlockStealth } = elements;

    const proceedLoad = () => {
        state.isStealthUnlocked = true;
        if (stealthLockScreen) stealthLockScreen.classList.remove('show');

        const { stealthPlayer } = elements;
        if (stealthPlayer && (!stealthPlayer.src || stealthPlayer.src === 'about:blank' || stealthPlayer.src === location.href)) {
            chrome.storage.local.get(['lastPlayerUrl'], (res) => {
                if (res.lastPlayerUrl && res.lastPlayerUrl !== 'undefined' && res.lastPlayerUrl !== 'null') {
                    _loadIntoPlayer(res.lastPlayerUrl);
                    if (elements.stealthUrl) elements.stealthUrl.value = res.lastPlayerUrl;
                    if (!playerHistory.includes(res.lastPlayerUrl)) {
                        playerHistory.push(res.lastPlayerUrl);
                        currentUrlIndex = playerHistory.length - 1;
                        updatePlayerNavState();
                    }
                    notify(getDict().restoringContent || 'Đang khôi phục nội dung...', 'success');
                }
            });
        }
    };

    if (!state.isStealthUnlocked) {
        if (!settings.alwaysRequirePassword && chrome.storage.session) {
            chrome.storage.session.get(['sessionPassword'], (result) => {
                if (result.sessionPassword) {
                    state.secretCode = result.sessionPassword;
                    proceedLoad();
                } else {
                    if (stealthLockScreen) stealthLockScreen.classList.add('show');
                    import('../popup.js').then(popup => {
                        popup.setupUnifiedLockScreen(stealthLockScreen, stealthPassInput, unlockStealth, proceedLoad);
                    });
                }
            });
        } else {
            if (stealthLockScreen) stealthLockScreen.classList.add('show');
            import('../popup.js').then(popup => {
                popup.setupUnifiedLockScreen(stealthLockScreen, stealthPassInput, unlockStealth, proceedLoad);
            });
        }
    } else {
        proceedLoad();
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export function init() {
    const {
        stealthPlayer, loadStealth, openStealthWindow, enlargePlayer, shrinkPlayer,
        resetPlayer, goBackPlayer, goForwardPlayer, reloadPlayer, toggleTheaterMode,
        togglePip, addFavoriteBtn, newFavoriteName, newFavoriteUrl
    } = elements;

    updatePlayerSandbox();
    import('./settings.js').then(m => {
        if (typeof m.applyPlayerBackground === 'function') m.applyPlayerBackground();
    }).catch(() => { });

    if (settings.followDefaultPlayerSize) {
        playerWidth = settings.defaultPlayerWidth || 600;
        if (playerWidth <= 100) playerWidth = 600;
        playerHeight = settings.defaultPlayerHeight || 400;
    }
    updatePlayerSize();
    checkStealthLock();

    // Khôi phục giá trị speed và volume từ storage
    chrome.storage.local.get(['privacyPlayerSpeed', 'privacyPlayerVolume', 'privacyPlayerGeoMode'], (res) => {
        if (res.privacyPlayerSpeed !== undefined) {
            currentBoostSpeed = res.privacyPlayerSpeed;
            applySpeed(currentBoostSpeed);

            // Sync dropdown if it matches a preset
            const sDropdown = document.getElementById('speedDropdown');
            if (sDropdown) {
                const options = Array.from(sDropdown.options).map(o => o.value);
                if (options.includes(currentBoostSpeed.toString())) {
                    sDropdown.value = currentBoostSpeed.toString();
                    document.getElementById('customSpeedWrapper')?.classList.add('hidden');
                } else {
                    sDropdown.value = 'custom';
                    document.getElementById('customSpeedWrapper')?.classList.remove('hidden');
                }
            }
        }
        if (res.privacyPlayerVolume !== undefined) {
            currentBoostVolume = res.privacyPlayerVolume;
            const volumePercent = Math.round(currentBoostVolume * 100);
            applyVolume(volumePercent);

            // Sync dropdown if it matches a preset
            const vDropdown = document.getElementById('volumeDropdown');
            if (vDropdown) {
                const options = Array.from(vDropdown.options).map(o => o.value);
                if (options.includes(volumePercent.toString())) {
                    vDropdown.value = volumePercent.toString();
                    document.getElementById('customVolumeWrapper')?.classList.add('hidden');
                } else {
                    vDropdown.value = 'custom';
                    document.getElementById('customVolumeWrapper')?.classList.remove('hidden');
                }
            }
        }
        if (res.privacyPlayerGeoMode !== undefined) {
            const geoDropdown = document.getElementById('geoDropdown');
            if (geoDropdown) {
                geoDropdown.value = res.privacyPlayerGeoMode;
            }
        }
    });

    // Enter key in URL bar
    const stealthUrlInput = elements.stealthUrl;
    if (stealthUrlInput) {
        stealthUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); loadPlayerContent(); }
        });
    }

    if (loadStealth) loadStealth.addEventListener('click', () => loadPlayerContent());

    if (stealthPlayer) {
        stealthPlayer.addEventListener('load', () => {
            setPlayerLoading(false);
            setTimeout(() => { isNavigating = false; }, 500);
            if (stealthPlayer.src && stealthPlayer.src !== 'about:blank' && stealthPlayer.src !== location.href) {
                elements.playerContainer?.classList.add('has-content');
                updateInfoBar(stealthPlayer.src);
                applySpeed(currentBoostSpeed);
                applyVolume(Math.round(currentBoostVolume * 100));

                // Cập nhật lại UI của slider và dropdowns
                const sSlider = document.getElementById('speedSlider');
                const sVal = document.getElementById('speedVal');
                const vSlider = document.getElementById('volumeSlider');
                const vVal = document.getElementById('volumeVal');
                const sDropdown = document.getElementById('speedDropdown');
                const vDropdown = document.getElementById('volumeDropdown');
                const cSpeedWrapper = document.getElementById('customSpeedWrapper');
                const cVolumeWrapper = document.getElementById('customVolumeWrapper');

                if (sSlider) {
                    sSlider.value = currentBoostSpeed;
                    if (sVal) sVal.textContent = `${currentBoostSpeed.toFixed(2)}x`;
                }
                if (vSlider) {
                    vSlider.value = Math.round(currentBoostVolume * 100);
                    if (vVal) vVal.textContent = `${Math.round(currentBoostVolume * 100)}%`;
                }

                const commonSpeeds = ['0.5', '1.0', '1.25', '1.5', '2.0', '3.0'];
                if (sDropdown) {
                    const speedStr = currentBoostSpeed.toFixed(1);
                    const speedStr2 = currentBoostSpeed.toFixed(2);
                    let matchedSpeed = commonSpeeds.find(s => parseFloat(s) === currentBoostSpeed);
                    if (matchedSpeed) {
                        sDropdown.value = matchedSpeed;
                        if (cSpeedWrapper) cSpeedWrapper.classList.add('hidden');
                    } else {
                        sDropdown.value = 'custom';
                        if (cSpeedWrapper) cSpeedWrapper.classList.remove('hidden');
                    }
                }

                const commonVolumes = ['100', '150', '200', '250', '300'];
                if (vDropdown) {
                    const volPercentStr = Math.round(currentBoostVolume * 100).toString();
                    if (commonVolumes.includes(volPercentStr)) {
                        vDropdown.value = volPercentStr;
                        if (cVolumeWrapper) cVolumeWrapper.classList.add('hidden');
                    } else {
                        vDropdown.value = 'custom';
                        if (cVolumeWrapper) cVolumeWrapper.classList.remove('hidden');
                    }
                }
            }
        });
        stealthPlayer.addEventListener('error', () => setPlayerLoading(false));
    }

    if (openStealthWindow) {
        openStealthWindow.addEventListener('click', () => {
            const url = elements.stealthUrl?.value.trim();
            openStealthWindowInternal(url);
        });
    }

    if (enlargePlayer) {
        enlargePlayer.addEventListener('click', () => {
            if (playerHeight < 800) {
                playerHeight += 35;
                if (playerWidth < 800) playerWidth += 50;
                updatePlayerSize();
                notify(getDict().playerEnlarged || 'Đã phóng to player.', 'success');
                if (!settings.followDefaultPlayerSize) {
                    settings.defaultPlayerHeight = playerHeight;
                    settings.defaultPlayerWidth = playerWidth;
                    saveSettings();
                }
            } else {
                notify('Đã đạt kích thước tối đa.', 'warning');
            }
        });
    }

    if (shrinkPlayer) {
        shrinkPlayer.addEventListener('click', () => {
            if (playerHeight > 250) {
                playerHeight -= 35;
                if (playerWidth > 400) playerWidth -= 50;
                updatePlayerSize();
                notify(getDict().playerShrunk || 'Đã thu nhỏ player.', 'success');
                if (!settings.followDefaultPlayerSize) {
                    settings.defaultPlayerHeight = playerHeight;
                    settings.defaultPlayerWidth = playerWidth;
                    saveSettings();
                }
            } else {
                notify('Đã đạt kích thước tối thiểu.', 'warning');
            }
        });
    }

    if (resetPlayer) {
        resetPlayer.addEventListener('click', () => {
            if (stealthPlayer) stealthPlayer.src = 'about:blank';
            if (elements.stealthUrl) elements.stealthUrl.value = '';
            elements.playerContainer?.classList.remove('has-content', 'player-loading');
            updateInfoBar('');
            playerHistory = [];
            currentUrlIndex = -1;
            updatePlayerNavState();
            chrome.storage.local.remove(['lastPlayerUrl']);

            playerWidth = 600;
            playerHeight = 400;
            updatePlayerSize();

            notify('Player đã reset!', 'success');
        });
    }

    if (goBackPlayer) {
        goBackPlayer.addEventListener('click', () => {
            if (currentUrlIndex > 0) {
                isNavigating = true;
                currentUrlIndex--;
                const prevUrl = playerHistory[currentUrlIndex];
                _loadIntoPlayer(prevUrl);
                if (elements.stealthUrl) elements.stealthUrl.value = prevUrl;
                updatePlayerNavState();
                setTimeout(() => { isNavigating = false; }, 1500);
            }
        });
    }

    if (goForwardPlayer) {
        goForwardPlayer.addEventListener('click', () => {
            if (currentUrlIndex < playerHistory.length - 1) {
                isNavigating = true;
                currentUrlIndex++;
                const nextUrl = playerHistory[currentUrlIndex];
                _loadIntoPlayer(nextUrl);
                if (elements.stealthUrl) elements.stealthUrl.value = nextUrl;
                updatePlayerNavState();
                setTimeout(() => { isNavigating = false; }, 1500);
            }
        });
    }

    if (reloadPlayer) {
        reloadPlayer.addEventListener('click', () => {
            const currentUrl = elements.stealthUrl?.value.trim();
            if (currentUrl && currentUrl !== 'about:blank' && stealthPlayer) {
                setPlayerLoading(true);
                stealthPlayer.src = currentUrl;
            }
        });
    }

    if (toggleTheaterMode) {
        toggleTheaterMode.addEventListener('click', () => {
            try { stealthPlayer?.contentWindow?.postMessage({ type: 'toggleTheaterMode' }, '*'); } catch { }
            toggleTheaterMode.classList.toggle('active');
        });
    }

    if (togglePip) {
        togglePip.addEventListener('click', () => {
            try {
                stealthPlayer?.contentWindow?.postMessage({ type: 'togglePip' }, '*');
                notify('Dang yeu cau Picture-in-Picture...', 'success');
            } catch { }
        });
    }

    const focusModeBtn = document.getElementById('focusModePlayer');
    const exitFocusModeBtn = document.getElementById('exitFocusModeBtn');
    if (focusModeBtn) {
        focusModeBtn.addEventListener('click', () => {
            const stealthSection = document.getElementById('stealthSection');
            if (stealthSection) {
                const isActive = stealthSection.classList.toggle('focus-mode-active');
                document.body.classList.toggle('has-focus-mode', isActive);
                focusModeBtn.classList.toggle('active', isActive);
                focusModeBtn.title = isActive ? 'Tắt Chế độ tập trung' : 'Chế độ tập trung (Focus Mode)';
                if (exitFocusModeBtn) {
                    exitFocusModeBtn.classList.toggle('hidden', !isActive);
                }

                if (isActive) {
                    // Save pre-focus dimensions
                    preFocusWidth = playerWidth;
                    preFocusHeight = playerHeight;
                    // Maximize width and height for immersive experience
                    playerWidth = 800;
                    playerHeight = 600;
                    updatePlayerSize();
                } else {
                    // Restore dimensions
                    playerWidth = preFocusWidth;
                    playerHeight = preFocusHeight;
                    updatePlayerSize();
                }
                notify(isActive ? 'Đã bật Chế độ tập trung' : 'Đã tắt Chế độ tập trung', 'success');
            }
        });
    }

    if (exitFocusModeBtn) {
        exitFocusModeBtn.addEventListener('click', () => {
            if (focusModeBtn) focusModeBtn.click();
        });
    }
    let isFullscreen = false;
    document.addEventListener('fullscreenchange', () => {
        isFullscreen = !!document.fullscreenElement;
        const fsBtn = document.getElementById('fullscreenPlayer') || document.getElementById('toggleFullscreen');
        if (fsBtn) {
            fsBtn.title = isFullscreen ? 'Thoát Toàn Màn Hình' : 'Toàn Màn Hình';
            fsBtn.classList.toggle('active', isFullscreen);
        }
    });

    const addCurrentBtn = document.getElementById('addCurrentToFavorite');
    if (addCurrentBtn) addCurrentBtn.addEventListener('click', addCurrentPageToFavorites);

    const clearHistoryBtn = document.getElementById('clearPlayerHistory');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            playerHistory = [];
            currentUrlIndex = -1;
            updatePlayerNavState();
            chrome.storage.local.remove(['stealthHistory', 'stealthHistoryIndex', 'lastPlayerUrl']);
            notify('Da xoa lich su Player.', 'success');
        });
    }

    const clearIdentityBtn = document.getElementById('clearPlayerIdentity');
    if (clearIdentityBtn) {
        clearIdentityBtn.addEventListener('click', () => {
            const currentUrl = elements.stealthUrl?.value.trim() || (elements.stealthPlayer && elements.stealthPlayer.src);
            if (currentUrl && currentUrl.startsWith('http')) {
                try {
                    const parsedUrl = new URL(currentUrl);
                    const domain = parsedUrl.hostname;
                    chrome.cookies.getAll({}, (cookies) => {
                        let count = 0;
                        cookies.forEach((cookie) => {
                            const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                            if (domain === cookieDomain || domain.endsWith('.' + cookieDomain) || cookieDomain.endsWith('.' + domain)) {
                                const protocol = cookie.secure ? "https:" : "http:";
                                const cookieUrl = `${protocol}//${cookieDomain}${cookie.path}`;
                                chrome.cookies.remove({ url: cookieUrl, name: cookie.name });
                                count++;
                            }
                        });
                        const lang = settings.language || 'vi';
                        const msg = lang === 'en'
                            ? `Created new identity for ${domain}. Cleared ${count} cookies.`
                            : `Đã tạo danh tính mới cho ${domain}. Đã xóa ${count} cookies.`;
                        notify(msg, 'success');
                    });

                    // Reload player
                    if (elements.stealthPlayer) {
                        setPlayerLoading(true);
                        elements.stealthPlayer.src = currentUrl;
                    }
                } catch (e) {
                    console.error(e);
                    const lang = settings.language || 'vi';
                    const msg = lang === 'en' ? 'Error clearing cookies.' : 'Lỗi khi xóa cookies.';
                    notify(msg, 'error');
                }
            } else {
                const lang = settings.language || 'vi';
                const msg = lang === 'en'
                    ? 'No website is currently open to clear identity.'
                    : 'Không có trang web nào đang mở để xóa danh tính.';
                notify(msg, 'warning');
            }
        });
    }

    const speedSlider = document.getElementById('speedSlider');
    const speedVal = document.getElementById('speedVal');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeVal = document.getElementById('volumeVal');
    const speedDropdown = document.getElementById('speedDropdown');
    const volumeDropdown = document.getElementById('volumeDropdown');
    const customSpeedWrapper = document.getElementById('customSpeedWrapper');
    const customVolumeWrapper = document.getElementById('customVolumeWrapper');
    const playerSettingsTrigger = document.getElementById('playerSettingsTrigger');
    const playerSettingsMenu = document.getElementById('playerSettingsMenu');
    const playerOverlayControls = document.getElementById('playerOverlayControls');
    const playerContainer = document.querySelector('.player-container');

    // 1. Auto-hide logic
    let overlayHideTimeout = null;

    function resetOverlayHideTimeout() {
        if (overlayHideTimeout) clearTimeout(overlayHideTimeout);
        overlayHideTimeout = setTimeout(() => {
            if (playerSettingsMenu && playerSettingsMenu.classList.contains('hidden') && playerOverlayControls) {
                playerOverlayControls.classList.remove('active');
            }
        }, 3000);
    }

    function showOverlayControls() {
        if (playerOverlayControls) {
            playerOverlayControls.classList.add('active');
        }
        resetOverlayHideTimeout();
    }

    if (playerContainer) {
        playerContainer.addEventListener('mousemove', showOverlayControls);
        playerContainer.addEventListener('mouseleave', () => {
            if (overlayHideTimeout) clearTimeout(overlayHideTimeout);
            overlayHideTimeout = setTimeout(() => {
                if (playerSettingsMenu && playerSettingsMenu.classList.contains('hidden') && playerOverlayControls) {
                    playerOverlayControls.classList.remove('active');
                }
            }, 1000);
        });
    }

    if (playerOverlayControls) {
        playerOverlayControls.addEventListener('mouseenter', () => {
            if (overlayHideTimeout) clearTimeout(overlayHideTimeout);
        });
        playerOverlayControls.addEventListener('mouseleave', () => {
            resetOverlayHideTimeout();
        });
    }

    // 2. Trigger dropdown menu
    if (playerSettingsTrigger && playerSettingsMenu) {
        playerSettingsTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            playerSettingsMenu.classList.toggle('hidden');
            if (!playerSettingsMenu.classList.contains('hidden')) {
                if (overlayHideTimeout) clearTimeout(overlayHideTimeout);
            } else {
                resetOverlayHideTimeout();
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (playerSettingsMenu && !playerSettingsMenu.classList.contains('hidden')) {
            if (!playerSettingsMenu.contains(e.target) && !playerSettingsTrigger.contains(e.target)) {
                playerSettingsMenu.classList.add('hidden');
                resetOverlayHideTimeout();
            }
        }
    });

    // Helper to apply speed
    function applySpeed(speed) {
        currentBoostSpeed = speed;
        if (speedSlider) speedSlider.value = speed;
        if (speedVal) speedVal.textContent = `${speed.toFixed(2)}x`;
        const playerFrame = document.getElementById('stealthPlayer');
        if (playerFrame && playerFrame.contentWindow) {
            playerFrame.contentWindow.postMessage({ type: 'boostVideoSpeed', speed: currentBoostSpeed }, '*');
        }
        chrome.storage.local.set({ privacyPlayerSpeed: currentBoostSpeed });
    }

    // Helper to apply filter
    function applyFilter(filterMode) {
        currentFilterMode = filterMode;
        const filterDropdown = document.getElementById('playerFilterDropdown');
        if (filterDropdown) filterDropdown.value = filterMode;
        const playerFrame = document.getElementById('stealthPlayer');
        if (playerFrame && playerFrame.contentWindow) {
            playerFrame.contentWindow.postMessage({ type: 'applyPlayerFilter', filterMode: currentFilterMode }, '*');
        }
        chrome.storage.local.set({ privacyPlayerFilter: currentFilterMode });
    }

    // Helper to apply volume
    function applyVolume(volumePercent) {
        currentBoostVolume = volumePercent / 100;
        if (volumeSlider) volumeSlider.value = volumePercent;
        if (volumeVal) volumeVal.textContent = `${volumePercent}%`;
        const playerFrame = document.getElementById('stealthPlayer');
        if (playerFrame && playerFrame.contentWindow) {
            playerFrame.contentWindow.postMessage({ type: 'boostVideoVolume', volume: currentBoostVolume }, '*');
        }
        chrome.storage.local.set({ privacyPlayerVolume: currentBoostVolume });
    }

    const playerFilterDropdown = document.getElementById('playerFilterDropdown');
    if (playerFilterDropdown) {
        playerFilterDropdown.addEventListener('change', (e) => {
            applyFilter(e.target.value);
        });
    }

    const togglePlayerFilterBtn = document.getElementById('togglePlayerFilterBtn');
    if (togglePlayerFilterBtn) {
        const filterModes = ['none', 'dark', 'night', 'contrast', 'grayscale'];
        togglePlayerFilterBtn.addEventListener('click', () => {
            const nextIdx = (filterModes.indexOf(currentFilterMode) + 1) % filterModes.length;
            const nextMode = filterModes[nextIdx];
            applyFilter(nextMode);
            const modeLabels = { none: 'Mặc định', dark: 'Dark Mode Invert', night: 'Night Shield', contrast: 'Video Enhancer', grayscale: 'Grayscale Focus' };
            notify(`Đã chuyển bộ lọc: ${modeLabels[nextMode] || nextMode}`, 'info');
        });
    }

    // 3. Dropdowns changes
    if (speedDropdown) {
        speedDropdown.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'custom') {
                if (customSpeedWrapper) customSpeedWrapper.classList.remove('hidden');
            } else {
                if (customSpeedWrapper) customSpeedWrapper.classList.add('hidden');
                applySpeed(parseFloat(val));
            }
        });
    }

    if (volumeDropdown) {
        volumeDropdown.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'custom') {
                if (customVolumeWrapper) customVolumeWrapper.classList.remove('hidden');
            } else {
                if (customVolumeWrapper) customVolumeWrapper.classList.add('hidden');
                applyVolume(parseInt(val));
            }
        });
    }

    const geoDropdown = document.getElementById('geoDropdown');
    if (geoDropdown) {
        geoDropdown.addEventListener('change', (e) => {
            const val = e.target.value;
            chrome.storage.local.set({ privacyPlayerGeoMode: val });
            notify('Đã cập nhật vị trí giả lập!', 'success');
        });
    }

    const overlaySearchEngine = document.getElementById('overlaySearchEngine');
    if (overlaySearchEngine) {
        overlaySearchEngine.addEventListener('change', (e) => {
            settings.searchEngine = e.target.value;
            saveSettings();
            if (elements.searchEngineSelect) elements.searchEngineSelect.value = settings.searchEngine;
            notify('Đã cập nhật công cụ tìm kiếm', 'success');
        });
    }

    // Link Click Behavior & Applied Link Type Dropdowns
    const linkClickDropdown = document.getElementById('linkClickBehaviorDropdown');
    if (linkClickDropdown) {
        linkClickDropdown.value = settings.linkClickBehavior || 'inside';
        linkClickDropdown.addEventListener('change', (e) => {
            settings.linkClickBehavior = e.target.value;
            saveSettings();
            const settingEl = document.getElementById('playerLinkBehavior');
            if (settingEl) settingEl.value = settings.linkClickBehavior;
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

    const appliedLinkDropdown = document.getElementById('appliedLinkTypeDropdown');
    if (appliedLinkDropdown) {
        appliedLinkDropdown.value = settings.appliedLinkType || 'all';
        appliedLinkDropdown.addEventListener('change', (e) => {
            settings.appliedLinkType = e.target.value;
            saveSettings();
            const settingEl = document.getElementById('playerLinkFilter');
            if (settingEl) settingEl.value = settings.appliedLinkType;
            const scopeNames = {
                all: 'Tất cả liên kết (All)',
                externalOnly: 'Chỉ liên kết ngoài (External)',
                targetBlankOnly: 'Chỉ link Blank / Popup'
            };
            notify(`Đã đặt phạm vi áp dụng: ${scopeNames[e.target.value] || e.target.value}`, 'success');
        });
    }

    const playerAntiTabunderToggle = document.getElementById('playerAntiTabunderToggle');
    if (playerAntiTabunderToggle) {
        playerAntiTabunderToggle.checked = settings.antiTabunderEnabled ?? true;
        playerAntiTabunderToggle.addEventListener('change', (e) => {
            settings.antiTabunderEnabled = e.target.checked;
            saveSettings();
            const settingToggle = document.getElementById('antiTabunderToggle');
            if (settingToggle) settingToggle.checked = settings.antiTabunderEnabled;
            notify(settings.antiTabunderEnabled ? 'Đã bật Anti-Tabunder Shield (Chống cướp tab cũ)' : 'Đã tắt Anti-Tabunder Shield', 'success');
        });
    }

    // 4. Sliders inputs (for Custom mode)
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            applySpeed(parseFloat(e.target.value));
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            applyVolume(parseInt(e.target.value));
        });
    }

    if (addFavoriteBtn) {
        addFavoriteBtn.addEventListener('click', () => {
            if (!newFavoriteName || !newFavoriteUrl) return;
            const name = newFavoriteName.value.trim();
            const url = newFavoriteUrl.value.trim();
            if (!name || !url) { notify('Vui long nhap ten va URL.', 'warning'); return; }
            const normalizedUrl = normalizeInputUrl(url);
            if (!isValidUrl(normalizedUrl)) { notify('URL khong hop le.', 'error'); return; }
            if (settings.favoriteWebsites.some(f => f.url === normalizedUrl)) {
                notify('Trang nay da co trong danh sach!', 'warning'); return;
            }
            settings.favoriteWebsites.push({ name, url: normalizedUrl });
            saveSettings();
            renderFavoriteWebsites();
            newFavoriteName.value = '';
            newFavoriteUrl.value = '';
            notify(`Da them "${name}" vao yeu thich!`, 'success');
        });
    }

    const favoriteWebsitesList = document.getElementById('favoriteWebsitesList');
    if (favoriteWebsitesList) {
        favoriteWebsitesList.addEventListener('click', (e) => {
            const goBtn = e.target.closest('.favorite-go-btn');
            if (goBtn) {
                if (elements.stealthUrl) elements.stealthUrl.value = goBtn.dataset.url;
                loadPlayerContent();
                return;
            }
            const deleteBtn = e.target.closest('.favorite-delete-btn');
            if (deleteBtn) {
                const index = parseInt(deleteBtn.dataset.index);
                const fav = settings.favoriteWebsites[index];
                if (!fav) return;
                showInlineConfirm(`Xoa "${fav.name}" khoi danh sach yeu thich?`, () => {
                    settings.favoriteWebsites.splice(index, 1);
                    saveSettings();
                    renderFavoriteWebsites();
                    notify('Da xoa khoi danh sach yeu thich.', 'warning');
                });
            }
        });
    }

    const AD_GAMBLING_PATTERNS = [
        'tsyndicate', 'tsyndicads', 'adsterra', 'propellerads', 'popads', 'popcash',
        'monetag', 'clickadu', 'hilltopads', 'onclickads', 'trafficstars', 'exoclick',
        'juicyads', 'mgid', 'adnxs', 'criteo', 'doubleclick', 'linkroyal', 'linkvertise',
        'workers.dev', 'pages.dev', 'hi88', 'shbet', 'jun88', '789bet', '789club',
        'new88', 'f8bet', 'okvip', 'mb66', 'kubet', 'thabet', 'bk8', 'fb88', 'm88',
        '188bet', 'dafabet', 'ae888', 'sv388', 'sodo', 'sin88', 'debet', 'may88',
        'red88', 'zbet', 'oxbet', 'five88', 'taixiu', 'nohu', 'banca', 'gamebai'
    ];

    function isSafePlayerUrl(targetUrl) {
        if (!targetUrl || typeof targetUrl !== 'string') return false;
        try {
            const parsed = new URL(targetUrl);
            const lower = parsed.href.toLowerCase();
            if (AD_GAMBLING_PATTERNS.some(p => lower.includes(p))) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    if (!_messageListenerAdded) {
        _messageListenerAdded = true;
        chrome.runtime.onMessage.addListener((message) => {
            const { stealthPlayer: player } = elements;

            if (message.type === 'privacyPlayerLinkClicked') {
                const { url, action } = message;
                if (!isSafePlayerUrl(url)) {
                    notify('Đã chặn chuyển hướng quảng cáo / web cờ bạc độc hại.', 'warning');
                    return;
                }
                if (action === 'block') { notify('Link bi chan theo cai dat.', 'warning'); return; }
                if (action === 'newTab') { chrome.tabs.create({ url }); notify('Da mo trong tab moi!', 'success'); return; }
                if (action === 'incognito') { openStealthWindowInternal(url); return; }

                isNavigating = true;
                _addToHistory(url);
                if (player) player.src = url;
                if (elements.stealthUrl) elements.stealthUrl.value = url;
                updateInfoBar(url);
                setTimeout(() => { isNavigating = false; }, 1500);

            } else if (message.type === 'iframeNavigated') {
                // Ignore navigations from normal browser tabs (tabId !== -1)
                if (message.tabId !== undefined && message.tabId !== -1) return;

                const targetUrl = message.url;
                if (!targetUrl || targetUrl === 'about:blank' || targetUrl.startsWith('chrome')) return;

                const ignoredPaths = ['/analytics', '/pixel', '/collect', '/telemetry', '/beacon', '/event', '/track', '/tr/', '/ads/', '/advertising/', '/doubleclick/', '/gtm/', '/gtag/'];
                const ignoredExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'css', 'js', 'ico', 'woff', 'woff2', 'mp4', 'webm', 'ogg', 'mp3'];

                try {
                    const parsed = new URL(targetUrl);
                    const path = parsed.pathname.toLowerCase();
                    if (ignoredPaths.some(p => path.includes(p))) return;
                    if (ignoredExts.includes(path.split('.').pop())) return;
                    if (path.includes('/embed/') || path.includes('/player/')) return;
                    if (parsed.hostname.includes('duckduckgo.com') && path.includes('/post')) return;
                } catch { return; }

                if (!isNavigating) {
                    const normTarget = normalizeForHistory(targetUrl);
                    const normCurrent = normalizeForHistory(playerHistory[currentUrlIndex] || '');
                    if (normTarget !== normCurrent) {
                        if (elements.stealthUrl) elements.stealthUrl.value = targetUrl;
                        updateInfoBar(targetUrl);
                        _addToHistory(targetUrl);
                    }
                }
            }
        });
    }

    // 5. Wheel scroll for stealth-controls
    const stealthControls = document.querySelector('.stealth-controls');
    if (stealthControls) {
        stealthControls.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0 && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
                e.preventDefault();
                const delta = e.deltaMode === 1 ? e.deltaY * 33 : (e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY);
                stealthControls.scrollLeft += delta;
            }
        }, { passive: false });
    }

    renderFavoriteWebsites();
    loadPlayerContent();
}
