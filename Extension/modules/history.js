import { elements, settings, notify, toggleSection, showConfirm } from '../popup.js';
import { debounce, createElement, ASSETS } from './utils.js';

const translations = window.translations;

let historyItemsBuffer = [];
let currentHistoryIndex = 0;
const historyChunkSize = 50;
let isLoadingHistoryChunks = false;
let lastRenderedDate = '';

function createHistoryItemUI(item, type) {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.dataset.url = item.url;
    div.dataset.id = item.id || '';
    div.dataset.type = type;

    let hostname = 'unknown';
    try { hostname = new URL(item.url).hostname; } catch {}

    const favicon = `https://www.google.com/s2/favicons?domain=${hostname}`;
    const visitDate = item.lastVisitTime ? new Date(item.lastVisitTime) : null;
    const visitTime = visitDate ? visitDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';

    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;

    div.textContent = '';
    const imgNode = createElement('img', { src: favicon, className: 'history-icon' });
    imgNode.onerror = () => { imgNode.onerror = null; imgNode.src = ASSETS.icons.extension; };
    div.appendChild(imgNode);
    div.appendChild(
        createElement('div', { className: 'history-info' },
            createElement('div', { className: 'history-top-line' },
                createElement('span', { className: 'history-title', title: item.title || item.url }, item.title || 'No Title'),
                visitTime ? createElement('span', { className: 'history-time' }, visitTime) : null
            ),
            createElement('span', { className: 'history-url' }, item.url)
        )
    );
    div.appendChild(
        createElement('div', { className: 'history-item-actions' },
            createElement('button', { className: 'history-play-btn', dataset: { action: 'play' }, title: dict.openInPrivacyPlayer || 'Open in Privacy Player' }, '🛡️'),
            createElement('button', { className: 'history-copy-btn', dataset: { action: 'copy' }, title: 'Copy Link' }, '🔗'),
            createElement('button', { className: 'history-delete-btn', dataset: { action: 'delete' }, title: 'Delete' }, '🗑️')
        )
    );

    const img = div.querySelector('.history-icon');
    if (img) {
        img.onerror = () => { img.onerror = null; img.src = ASSETS.icons.extension; };
    }

    return div;
}

export async function handleHistoryListClick(e) {
    const itemEl = e.target.closest('.history-item');
    if (!itemEl) return;

    const url = itemEl.dataset.url;
    const id = itemEl.dataset.id;
    const type = itemEl.dataset.type;

    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        if (action === 'play') {
            if (elements.stealthUrl) elements.stealthUrl.value = url;
            toggleSection('player');
            if (elements.loadStealth) elements.loadStealth.click();
        } else if (action === 'copy') {
            navigator.clipboard.writeText(url);
            notify('Link copied to clipboard', 'success');
        } else if (action === 'delete') {
            if (await showConfirm('Are you sure you want to delete this item?')) {
                if (type === 'history') {
                    chrome.history.deleteUrl({ url }, () => {
                        itemEl.remove();
                        notify('Deleted from history', 'success');
                    });
                } else if (type === 'bookmark') {
                    chrome.bookmarks.remove(id, () => {
                        itemEl.remove();
                        notify('Deleted from bookmarks', 'success');
                    });
                } else if (type === 'readingList') {
                    chrome.readingList.removeEntry({ url }).then(() => {
                        itemEl.remove();
                        notify('Deleted from reading list', 'success');
                    });
                }
            }
        }
        return;
    }

    if (settings.historyIncognito) {
        chrome.windows.create({ url, incognito: true, type: 'normal' });
        notify('Opening in Incognito window...', 'success');
    } else {
        chrome.tabs.create({ url });
    }
}

export async function loadHistoryAndSessions(query = '') {
    const { historyList, deviceList, historyRestrictedOverlay } = elements;
    if (!historyList || !deviceList) return;

    historyList.textContent = '';
    deviceList.textContent = '';
    if (historyRestrictedOverlay) historyRestrictedOverlay.classList.add('hidden');

    historyItemsBuffer = [];
    currentHistoryIndex = 0;
    lastRenderedDate = '';

    if (!chrome.history) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-container';
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-msg';
        emptyMsg.textContent = 'History API not available.';
        const hintText = createElement('p', { className: 'hint-text' },
            'Vui lòng vào ',
            createElement('b', {}, 'chrome://extensions'),
            ' và nhấn nút ',
            createElement('b', {}, 'Reload'),
            ' (🔄) của extension này để cấp quyền truy cập lịch sử.'
        );
        errorContainer.appendChild(emptyMsg);
        errorContainer.appendChild(hintText);
        historyList.appendChild(errorContainer);
        return;
    }

    const loadingHistory = document.createElement('p');
    loadingHistory.className = 'loading';
    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;
    loadingHistory.textContent = dict.loadingHistory || 'Loading history...';
    historyList.appendChild(loadingHistory);

    chrome.history.search({ text: query, maxResults: 2000, startTime: 0 }, (items) => {
        historyList.textContent = '';
        if (items.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'empty-msg';
            emptyMsg.textContent = dict.noHistory || 'No history found.';
            historyList.appendChild(emptyMsg);
            return;
        }

        historyItemsBuffer = items;
        renderNextHistoryChunk();
    });

    const loadingDevices = document.createElement('p');
    loadingDevices.className = 'loading';
    loadingDevices.textContent = dict.loadingDevices || 'Loading devices...';
    deviceList.appendChild(loadingDevices);

    if (chrome.sessions) {
        chrome.sessions.getDevices({ maxResults: 10 }, (devices) => {
            deviceList.textContent = '';
            if (devices.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.className = 'empty-msg';
                emptyMsg.textContent = dict.noDevices || 'No other devices found or sync is disabled.';
                deviceList.appendChild(emptyMsg);
                return;
            }
            devices.forEach(device => {
                const deviceDiv = document.createElement('div');
                deviceDiv.className = 'device-group';
                const deviceHeader = document.createElement('h4');
                deviceHeader.className = 'device-header';

                const deviceName = device.deviceName.toLowerCase();
                let icon = '📱';
                if (deviceName.includes('pc') || deviceName.includes('desktop') || deviceName.includes('mac') || deviceName.includes('windows')) icon = '💻';
                if (deviceName.includes('tablet') || deviceName.includes('ipad')) icon = '📠';

                deviceHeader.textContent = '';
                deviceHeader.appendChild(createElement('span', { className: 'device-type-icon' }, icon));
                deviceHeader.appendChild(document.createTextNode(' ' + device.deviceName));
                deviceDiv.appendChild(deviceHeader);

                device.sessions.forEach(session => {
                    let tabs = [];
                    if (session.tab) {
                        tabs.push(session.tab);
                    } else if (session.window && session.window.tabs) {
                        tabs = session.window.tabs;
                    }

                    tabs.forEach(tab => {
                        const item = document.createElement('div');
                        item.className = 'device-item';

                        let hostname = 'unknown';
                        try { hostname = new URL(tab.url).hostname; } catch {}

                        const favicon = `https://www.google.com/s2/favicons?domain=${hostname}`;
                        const img = document.createElement('img');
                        img.src = favicon;
                        img.className = 'device-icon';
                        img.onerror = function () { this.onerror = null; this.src = ASSETS.icons.extension; };
                        item.appendChild(img);

                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'history-info';

                        const nameSpan = document.createElement('span');
                        nameSpan.className = 'device-name';
                        nameSpan.title = tab.title || tab.url;
                        nameSpan.textContent = tab.title || 'No Title';
                        infoDiv.appendChild(nameSpan);

                        const urlSpan = document.createElement('span');
                        urlSpan.className = 'device-details';
                        urlSpan.textContent = tab.url;
                        infoDiv.appendChild(urlSpan);
                        item.appendChild(infoDiv);

                        item.dataset.url = tab.url;
                        deviceDiv.appendChild(item);
                    });
                });
                deviceList.appendChild(deviceDiv);
            });
        });
    } else {
        const errorMsg = document.createElement('p');
        errorMsg.className = 'empty-msg';
        errorMsg.textContent = 'Sessions API not available.';
        deviceList.appendChild(errorMsg);
    }
}

export function renderNextHistoryChunk() {
    if (isLoadingHistoryChunks || currentHistoryIndex >= historyItemsBuffer.length) return;

    isLoadingHistoryChunks = true;
    const { historyList } = elements;
    if (!historyList) return;

    const oldLoader = document.getElementById('historyLoadMore');
    if (oldLoader) oldLoader.remove();

    const itemsToRender = historyItemsBuffer.slice(currentHistoryIndex, currentHistoryIndex + historyChunkSize);
    const fragment = document.createDocumentFragment();

    itemsToRender.forEach((item, index) => {
        const date = new Date(item.lastVisitTime);
        const dateKey = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

        let displayDate = dateKey;
        const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

        if (dateKey === today) displayDate = 'Today';
        else if (dateKey === yesterday) displayDate = 'Yesterday';

        if (displayDate !== lastRenderedDate) {
            const dateHeader = document.createElement('div');
            dateHeader.className = 'history-date-header';
            dateHeader.textContent = displayDate;
            fragment.appendChild(dateHeader);
            lastRenderedDate = displayDate;
        }

        const div = createHistoryItemUI(item, 'history');
        div.style.animationDelay = `${(index % historyChunkSize) * 0.02}s`;
        fragment.appendChild(div);
    });

    historyList.appendChild(fragment);
    currentHistoryIndex += historyChunkSize;
    isLoadingHistoryChunks = false;

    if (currentHistoryIndex < historyItemsBuffer.length) {
        const loadMoreIndicator = document.createElement('div');
        loadMoreIndicator.id = 'historyLoadMore';
        loadMoreIndicator.className = 'loading-small';
        historyList.appendChild(loadMoreIndicator);
    }

    if (historyList.scrollHeight <= historyList.clientHeight && currentHistoryIndex < historyItemsBuffer.length) {
        renderNextHistoryChunk();
    }
}

export async function loadBookmarks(query = '') {
    const { bookmarksList } = elements;
    if (!bookmarksList) return;

    if (!chrome.bookmarks) {
        bookmarksList.textContent = '';
        bookmarksList.appendChild(createElement('p', { className: 'empty-msg' }, 'Bookmarks API not available.'));
        return;
    }

    bookmarksList.textContent = '';
    bookmarksList.appendChild(createElement('p', { className: 'loading' }, 'Loading bookmarks...'));

    const handleResults = (items) => {
        bookmarksList.textContent = '';
        const bookmarks = items.filter(item => item.url);

        if (bookmarks.length === 0) {
            const lang = settings.language || 'vi';
            const dict = translations[lang] || translations.vi;
            bookmarksList.appendChild(createElement('p', { className: 'empty-msg' }, dict.noBookmarks || 'No bookmarks found.'));
            return;
        }

        const fragment = document.createDocumentFragment();
        bookmarks.forEach(bookmark => {
            const div = createHistoryItemUI(bookmark, 'bookmark');
            fragment.appendChild(div);
        });
        bookmarksList.appendChild(fragment);
    };

    if (query.trim() === '') {
        chrome.bookmarks.getRecent(1000, handleResults);
    } else {
        chrome.bookmarks.search(query, handleResults);
    }
}

export async function loadReadingList() {
    const { readingListContainer } = elements;
    if (!readingListContainer) return;

    if (!chrome.readingList) {
        readingListContainer.textContent = '';
        readingListContainer.appendChild(createElement('p', { className: 'empty-msg' }, 'Reading List API not available.'));
        return;
    }

    readingListContainer.textContent = '';
    readingListContainer.appendChild(createElement('p', { className: 'loading' }, 'Loading reading list...'));

    try {
        const items = await chrome.readingList.query({});
        readingListContainer.textContent = '';

        if (items.length === 0) {
            const lang = settings.language || 'vi';
            const dict = translations[lang] || translations.vi;
            readingListContainer.appendChild(createElement('p', { className: 'empty-msg' }, dict.noReadingList || 'Reading list is empty.'));
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const div = createHistoryItemUI(item, 'readingList');
            fragment.appendChild(div);
        });
        readingListContainer.appendChild(fragment);
    } catch (e) {
        readingListContainer.textContent = '';
        readingListContainer.appendChild(createElement('p', { className: 'empty-msg' }, `Error loading reading list: ${e.message}`));
    }
}

export function init() {
    const {
        historyList, bookmarksList, readingListContainer,
        historySearchInput, bookmarksSearchInput, clearHistorySearch
    } = elements;

    if (historyList) historyList.addEventListener('click', handleHistoryListClick);
    if (bookmarksList) bookmarksList.addEventListener('click', handleHistoryListClick);
    if (readingListContainer) readingListContainer.addEventListener('click', handleHistoryListClick);

    if (elements.deviceList) {
        elements.deviceList.addEventListener('click', (e) => {
            const item = e.target.closest('.device-item');
            if (item) {
                const url = item.dataset.url;
                if (url) {
                    if (settings.historyIncognito) {
                        chrome.windows.create({
                            url: url,
                            incognito: true,
                            type: 'normal'
                        });
                        notify('Opening in Incognito window...', 'success');
                    } else {
                        chrome.tabs.create({ url: url });
                    }
                }
            }
        });
    }

    document.querySelectorAll('.history-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.history-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.history-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            const contentEl = document.getElementById(tabId);
            if (contentEl) contentEl.classList.add('active');

            if (tabId === 'bookmarksTab') {
                loadBookmarks();
            } else if (tabId === 'readingListTab') {
                loadReadingList();
            } else if (tabId === 'localHistory') {
                loadHistoryAndSessions();
            }
        });
    });

    if (historySearchInput) {
        historySearchInput.addEventListener('input', debounce((e) => {
            loadHistoryAndSessions(e.target.value);
        }, 200));
    }

    if (bookmarksSearchInput) {
        bookmarksSearchInput.addEventListener('input', debounce((e) => {
            loadBookmarks(e.target.value);
        }, 200));
    }

    if (clearHistorySearch) {
        clearHistorySearch.addEventListener('click', () => {
            if (historySearchInput) historySearchInput.value = '';
            loadHistoryAndSessions();
        });
    }

    if (historyList) {
        historyList.addEventListener('scroll', () => {
            const scrollThreshold = 100;
            if (historyList.scrollHeight - historyList.scrollTop - historyList.clientHeight < scrollThreshold) {
                renderNextHistoryChunk();
            }
        });
    }

    loadHistoryAndSessions();
}
