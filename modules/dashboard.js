import { elements, settings, notify, saveSettings, updateUILanguage, toggleSection, showConfirm } from '../popup.js';
import { createElement, ASSETS, escapeHTML } from './utils.js';

const translations = window.translations;
let dashboardUpdateTimeout = null;

export async function updateDashboard() {
    if (dashboardUpdateTimeout) clearTimeout(dashboardUpdateTimeout);

    dashboardUpdateTimeout = setTimeout(async () => {
        const { statCookies, statExtensions, statTrackers, permanentBar, sessionBar, permanentCount, sessionCount } = elements;

        chrome.cookies.getAll({}, (cookies) => {
            const total = cookies.length;
            if (statCookies) statCookies.textContent = total;

            let permanent = 0;
            let session = 0;
            const now = Date.now() / 1000;
            const oneWeekInSeconds = 7 * 24 * 60 * 60;

            cookies.forEach(c => {
                if (c.session || (c.expirationDate && (c.expirationDate - now) < oneWeekInSeconds)) {
                    session++;
                } else {
                    permanent++;
                }
            });

            if (permanentCount) permanentCount.textContent = permanent;
            if (sessionCount) sessionCount.textContent = session;

            if (total > 0) {
                const permanentPercent = (permanent / total) * 100;
                const sessionPercent = (session / total) * 100;
                if (permanentBar) permanentBar.style.width = `${permanentPercent}%`;
                if (sessionBar) sessionBar.style.width = `${sessionPercent}%`;
            } else {
                if (permanentBar) permanentBar.style.width = '0%';
                if (sessionBar) sessionBar.style.width = '0%';
            }

            renderInsights(total, permanent, settings.trackerCount || 0);
        });

        chrome.management.getAll((extensions) => {
            const activeExts = extensions.filter(ext => ext.enabled && ext.type === 'extension').length;
            if (statExtensions) statExtensions.textContent = activeExts;
        });

        chrome.storage.local.get(['adsBlockedCount'], (res) => {
            if (elements.statAdsBlocked) {
                elements.statAdsBlocked.textContent = res.adsBlockedCount || 0;
            }
        });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.runtime.sendMessage({ type: 'getTrackerCount', tabId: tabs[0].id }, (response) => {
                    const count = response ? response.count : 0;
                    const list = response ? response.list : [];
                    if (statTrackers) statTrackers.textContent = count;
                    settings.trackerCount = count;
                    settings.currentTrackers = list;
                });
            }
        });

        calculatePrivacyGrade();
    }, 100);
}

export async function calculatePrivacyGrade() {
    const { statCookies, statExtensions, statTrackers, privacyGradeValue, healthScoreText, healthStatusText, healthBarFill, fixPrivacyBtn } = elements;

    const cookieCount = (statCookies ? parseInt(statCookies.textContent) : 0) || 0;
    const trackerCount = (statTrackers ? parseInt(statTrackers.textContent) : 0) || 0;

    let score = 100;
    const issues = [];

    if (cookieCount > 200) score -= 10;
    if (cookieCount > 800) score -= 15;
    if (trackerCount > 0) score -= Math.min(30, trackerCount * 5);

    if (!settings.cookieDestroyer) {
        score -= 10;
        issues.push('enableAutoCleanup');
    }
    if (!settings.realTimeProtection) {
        score -= 10;
        issues.push('enableRealTime');
    }
    if (!settings.blockClickjacking || !settings.blockCryptoMining) {
        score -= 10;
        issues.push('enableAdvancedBlocking');
    }
    if (settings.protectionLevel !== 'enhanced') {
        score -= 10;
        issues.push('upgradeProtectionLevel');
    }
    if (!settings.autoClearStealth) {
        score -= 5;
        issues.push('enableAutoClearStealth');
    }
    if (!settings.adblockEnabled || !settings.easylistEnabled) {
        score -= 15;
        issues.push('enableAdblock');
    }

    try {
        const dnt = await chrome.privacy.websites.doNotTrackEnabled.get({});
        if (!dnt.value) {
            score -= 5;
            issues.push('enableDNT');
        }
    } catch {}

    score = Math.max(0, Math.min(100, score));

    let grade = 'F';
    let status = 'Critical';
    let color = '#ef4444';

    if (score >= 90) { grade = 'A+'; status = 'Excellent'; color = '#10b981'; }
    else if (score >= 80) { grade = 'A'; status = 'Very Good'; color = '#10b981'; }
    else if (score >= 70) { grade = 'B+'; status = 'Good'; color = '#3b82f6'; }
    else if (score >= 60) { grade = 'B'; status = 'Fair'; color = '#3b82f6'; }
    else if (score >= 50) { grade = 'C'; status = 'Average'; color = '#f59e0b'; }
    else if (score >= 40) { grade = 'D'; status = 'Poor'; color = '#ef4444'; }

    if (privacyGradeValue) privacyGradeValue.textContent = grade;
    if (healthScoreText) healthScoreText.textContent = `${score}/100`;
    if (healthStatusText) {
        healthStatusText.textContent = status;
        healthStatusText.style.background = color;
    }
    if (healthBarFill) {
        healthBarFill.style.width = `${score}%`;
        healthBarFill.style.background = color;
    }

    if (fixPrivacyBtn) {
        const lang = settings.language || 'vi';
        const dict = translations[lang] || translations.vi;

        if (score < 90 && issues.length > 0) {
            fixPrivacyBtn.classList.remove('hidden');

            let issuesContainer = elements.gradeCard.querySelector('.grade-issues-list');
            if (!issuesContainer) {
                issuesContainer = document.createElement('div');
                issuesContainer.className = 'grade-issues-list';
                elements.gradeCard.appendChild(issuesContainer);
            }

            issuesContainer.textContent = '';
            issuesContainer.appendChild(createElement('div', { className: 'fix-summary' }, (dict.fixSummary || 'Cần khắc phục') + ':'));
            issues.forEach(issue => {
                const item = createElement('div', { className: 'issue-item' },
                    createElement('span', { className: 'issue-dot' }),
                    ' ',
                    createElement('span', {}, dict[issue] || issue)
                );
                issuesContainer.appendChild(item);
            });

            fixPrivacyBtn.onclick = () => fixPrivacyIssues(issues);
        } else {
            fixPrivacyBtn.classList.add('hidden');
            const issuesContainer = elements.gradeCard.querySelector('.grade-issues-list');
            if (issuesContainer) issuesContainer.remove();
        }
    }
}

export async function fixPrivacyIssues(issues) {
    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;

    for (const issue of issues) {
        switch (issue) {
            case 'enableAutoCleanup':
                settings.cookieDestroyer = true;
                break;
            case 'enableRealTime':
                settings.realTimeProtection = true;
                break;
            case 'enableAdvancedBlocking':
                settings.blockClickjacking = true;
                settings.blockCryptoMining = true;
                break;
            case 'upgradeProtectionLevel':
                settings.protectionLevel = 'enhanced';
                break;
            case 'enableAutoClearStealth':
                settings.autoClearStealth = true;
                break;
            case 'enableAdblock':
                settings.adblockEnabled = true;
                settings.easylistEnabled = true;
                chrome.runtime.sendMessage({ type: 'updateSecurityRules' });
                // We also try to toggle the static rulesets if the background script is listening,
                // but the message to updateSecurityRules will handle the dynamic ones. 
                // Let's directly invoke declarativeNetRequest if available to enable the static ones quickly.
                try {
                    chrome.declarativeNetRequest.updateEnabledRulesets({
                        enableRulesetIds: ['easylist_1', 'easylist_2', 'easyprivacy_1', 'easyprivacy_2']
                    }).catch(()=>{});
                } catch(e) {}
                break;
            case 'enableDNT':
                try {
                    await chrome.privacy.websites.doNotTrackEnabled.set({ value: true });
                } catch {}
                break;
        }
    }

    saveSettings();
    updateUILanguage();
    notify(dict.fixSuccess || 'Privacy upgraded successfully!', 'success');

    setTimeout(() => calculatePrivacyGrade(), 500);
}

export function renderInsights(totalCookies, permanentCookies, trackers) {
    const { privacyInsightsList } = elements;
    if (!privacyInsightsList) return;

    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;

    privacyInsightsList.textContent = '';
    const insights = [];

    if (trackers > 5) {
        insights.push({
            text: dict.trackersWarning || `Phát hiện ${trackers} tracker trên trang này. Hãy cẩn thận!`,
            type: 'warning'
        });
    }

    if (permanentCookies > totalCookies * 0.5 && totalCookies > 0) {
        insights.push({
            text: dict.permanentCookiesWarning || 'Quá nhiều cookie vĩnh viễn có thể dùng để theo dõi bạn.',
            type: 'warning'
        });
    }

    if (settings.cookieDestroyer) {
        insights.push({
            text: dict.autoCleanupActive || 'Chế độ Auto-Cleanup đang bảo vệ bạn.',
            type: 'success'
        });
    } else {
        insights.push({
            text: dict.enableAutoCleanup || 'Bật Auto-Cleanup để tự động dọn dẹp dấu vết.',
            type: 'info'
        });
    }

    insights.slice(0, 3).forEach(insight => {
        const div = document.createElement('div');
        div.className = `insight-item ${insight.type || ''}`;
        div.textContent = insight.text;
        privacyInsightsList.appendChild(div);
    });
}

export function showTrackerDetails(trackers) {
    const { trackerModal, trackerDetailsList } = elements;
    if (!trackerDetailsList) return;

    trackerDetailsList.textContent = '';

    if (!trackers || trackers.length === 0) {
        trackerDetailsList.appendChild(createElement('p', { className: 'empty-msg' }, 'No trackers detected on this page.'));
    } else {
        const sortedTrackers = [...trackers].sort((a, b) => b.count - a.count);

        sortedTrackers.forEach(t => {
            const lastSeenTime = new Date(t.lastSeen).toLocaleTimeString();
            const item = createElement('div', { className: 'tracker-detail-item' },
                createElement('div', { className: 'tracker-info' },
                    createElement('span', { className: 'tracker-domain' }, t.domain),
                    createElement('span', { className: 'tracker-time' }, `Last seen: ${lastSeenTime}`)
                ),
                createElement('span', { className: 'tracker-count-badge' }, t.count.toString())
            );
            trackerDetailsList.appendChild(item);
        });
    }

    if (trackerModal) trackerModal.classList.remove('hidden');
}

export function setTrackStyle(element, status) {
    const trackingIcon = document.getElementById('trackingprotectionicon');
    if (trackingIcon) {
        trackingIcon.src = status ? ASSETS.icons.skincell : ASSETS.icons.trackingProtection;
    }
    if (element) {
        element.className = `tracking-button ${status ? 'enabled' : 'disabled'}`;
        element.textContent = `Tracking Protection: ${status ? 'Enabled' : 'Disabled'}`;
    }
}

export function init() {
    const {
        cardCookies, cardTrackers, cardExtensions, closeTrackerModal,
        quickFocusMode, quickClearAll,
        zenModeBtn, zenModeModal, closeZenModal, zenTimerInput, startZenModeBtn, zenActiveState, zenCountdown, stopZenModeBtn
    } = elements;

    if (zenModeBtn) {
        zenModeBtn.addEventListener('click', () => {
            zenModeModal?.classList.remove('hidden');
            checkZenStatus();
        });
    }
    if (closeZenModal) {
        closeZenModal.addEventListener('click', () => zenModeModal?.classList.add('hidden'));
    }

    let zenInterval;
    const checkZenStatus = () => {
        chrome.storage.local.get(['zenEndTime', 'zenTotalSeconds'], (res) => {
            if (res.zenEndTime && res.zenEndTime > Date.now()) {
                if (zenInactiveState) zenInactiveState.classList.add('hidden');
                if (zenActiveState) zenActiveState.classList.remove('hidden');
                if (startZenModeBtn) startZenModeBtn.classList.add('hidden');
                updateZenTimer(res.zenEndTime, res.zenTotalSeconds || 1500);
            } else {
                if (zenInactiveState) zenInactiveState.classList.remove('hidden');
                if (zenActiveState) zenActiveState.classList.add('hidden');
                if (startZenModeBtn) startZenModeBtn.classList.remove('hidden');
            }
        });
    };

    const updateZenTimer = (endTime, totalSeconds) => {
        if (zenInterval) clearInterval(zenInterval);
        
        const draw = () => {
            const left = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            const m = Math.floor(left / 60).toString().padStart(2, '0');
            const s = (left % 60).toString().padStart(2, '0');
            if (zenCountdown) zenCountdown.textContent = `${m}:${s}`;
            
            const circle = document.getElementById('zenProgressCircle');
            if (circle && totalSeconds) {
                const fraction = left / totalSeconds;
                circle.style.strokeDashoffset = 283 * (1 - fraction);
            }
            return left;
        };
        
        let remaining = draw();
        if (remaining <= 0) {
            checkZenStatus();
            return;
        }
        
        zenInterval = setInterval(() => {
            const left = draw();
            if (left <= 0) {
                clearInterval(zenInterval);
                checkZenStatus();
            }
        }, 1000);
    };

    const zenCustomUrlInput = document.getElementById('zenCustomUrlInput');
    const zenAddCustomUrlBtn = document.getElementById('zenAddCustomUrlBtn');
    const zenCustomUrlsList = document.getElementById('zenCustomUrlsList');

    const zenToggleListBtn = document.getElementById('zenToggleListBtn');
    const zenCustomUrlsContainer = document.getElementById('zenCustomUrlsContainer');

    if (zenToggleListBtn && zenCustomUrlsContainer) {
        zenToggleListBtn.addEventListener('click', () => {
            const isHidden = zenCustomUrlsContainer.style.display === 'none';
            zenCustomUrlsContainer.style.display = isHidden ? 'block' : 'none';
            zenToggleListBtn.textContent = `Manage (${zenCustomUrlsList.children.length}) ${isHidden ? '▲' : '▼'}`;
        });
    }

    const DEFAULT_ZEN_URLS = ['facebook.com', 'twitter.com', 'x.com', 'reddit.com', 'tiktok.com', 'instagram.com', 'netflix.com', 'youtube.com'];

    const renderZenCustomUrls = () => {
        chrome.storage.local.get(['zenCustomUrls'], (res) => {
            const urls = res.zenCustomUrls !== undefined ? res.zenCustomUrls : DEFAULT_ZEN_URLS;
            if (zenToggleListBtn) {
                const isHidden = zenCustomUrlsContainer.style.display === 'none';
                zenToggleListBtn.textContent = `Manage (${urls.length}) ${isHidden ? '▼' : '▲'}`;
            }
            if (zenCustomUrlsList) {
                const htmlParts = urls.map(url => {
                    const escapedUrl = escapeHTML(url);
                    return `<li class="zen-custom-item"><span>${escapedUrl}</span><span class="zen-custom-item-remove" data-url="${escapedUrl}">✕</span></li>`;
                });
                zenCustomUrlsList.innerHTML = htmlParts.join('');
            }
        });
    };

    if (zenCustomUrlsList) {
        zenCustomUrlsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('zen-custom-item-remove')) {
                const targetUrl = e.target.getAttribute('data-url');
                chrome.storage.local.get(['zenCustomUrls'], (res) => {
                    const urls = res.zenCustomUrls !== undefined ? res.zenCustomUrls : DEFAULT_ZEN_URLS;
                    const newUrls = urls.filter(u => u !== targetUrl);
                    chrome.storage.local.set({ zenCustomUrls: newUrls }, renderZenCustomUrls);
                });
            }
        });
    }

    if (zenAddCustomUrlBtn && zenCustomUrlInput) {
        const addUrl = () => {
            const val = zenCustomUrlInput.value.trim().toLowerCase();
            if (val) {
                chrome.storage.local.get(['zenCustomUrls'], (res) => {
                    const urls = res.zenCustomUrls !== undefined ? res.zenCustomUrls : DEFAULT_ZEN_URLS.slice();
                    if (!urls.includes(val)) {
                        urls.push(val);
                        chrome.storage.local.set({ zenCustomUrls: urls }, () => {
                            zenCustomUrlInput.value = '';
                            renderZenCustomUrls();
                        });
                    }
                });
            }
        };
        zenAddCustomUrlBtn.addEventListener('click', addUrl);
        zenCustomUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addUrl();
        });
        renderZenCustomUrls();
    }

    // Schedule logic
    const zenScheduleEnable = document.getElementById('zenScheduleEnable');
    const zenScheduleSettings = document.getElementById('zenScheduleSettings');
    const zenScheduleTime = document.getElementById('zenScheduleTime');
    const zenScheduleDuration = document.getElementById('zenScheduleDuration');

    if (zenScheduleEnable) {
        chrome.storage.local.get(['zenSchedule'], (res) => {
            const schedule = res.zenSchedule || { enabled: false, time: '08:00', duration: 60 };
            zenScheduleEnable.checked = schedule.enabled;
            zenScheduleTime.value = schedule.time;
            zenScheduleDuration.value = schedule.duration;
            zenScheduleSettings.style.display = schedule.enabled ? 'flex' : 'none';
        });

        const saveSchedule = () => {
            const schedule = {
                enabled: zenScheduleEnable.checked,
                time: zenScheduleTime.value || '08:00',
                duration: parseInt(zenScheduleDuration.value) || 60
            };
            zenScheduleSettings.style.display = schedule.enabled ? 'flex' : 'none';
            chrome.storage.local.set({ zenSchedule: schedule }, () => {
                chrome.runtime.sendMessage({ type: 'UPDATE_ZEN_SCHEDULE' });
            });
        };

        zenScheduleEnable.addEventListener('change', saveSchedule);
        zenScheduleTime.addEventListener('change', saveSchedule);
        zenScheduleDuration.addEventListener('change', saveSchedule);
    }

    const setupFocusSoundsBtn = document.getElementById('setupFocusSoundsBtn');
    if (setupFocusSoundsBtn) {
        setupFocusSoundsBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('playlist.html') });
        });
    }

    if (startZenModeBtn) {
        startZenModeBtn.addEventListener('click', () => {
            const mins = parseInt(zenTimerInput?.value) || 25;
            chrome.runtime.sendMessage({ type: 'START_ZEN', minutes: mins }, () => {
                checkZenStatus();
            });
        });
    }

    if (stopZenModeBtn) {
        stopZenModeBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'STOP_ZEN' }, () => {
                checkZenStatus();
            });
        });
    }

    if (elements.cardEphemeral) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
                const domain = new URL(tabs[0].url).hostname;
                chrome.storage.local.get(['ephemeralDomains'], (res) => {
                    const eps = res.ephemeralDomains || [];
                    const isEps = eps.includes(domain);
                    if(elements.ephemeralStatus) {
                        elements.ephemeralStatus.textContent = isEps ? 'BẬT' : 'TẮT';
                        elements.ephemeralStatus.style.color = isEps ? '#ff4757' : '#ff9f43';
                    }
                    elements.cardEphemeral.style.borderColor = isEps ? 'rgba(255, 71, 87, 0.5)' : 'rgba(255, 159, 67, 0.3)';
                });
            } else {
                if(elements.ephemeralStatus) {
                    elements.ephemeralStatus.textContent = 'Không hỗ trợ';
                    elements.ephemeralStatus.style.color = 'var(--text-muted)';
                    elements.cardEphemeral.style.borderColor = 'var(--border-color)';
                }
            }
        });

        elements.cardEphemeral.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
                    const domain = new URL(tabs[0].url).hostname;
                    chrome.storage.local.get(['ephemeralDomains'], (res) => {
                        let eps = res.ephemeralDomains || [];
                        if (eps.includes(domain)) {
                            eps = eps.filter(d => d !== domain);
                        } else {
                            eps.push(domain);
                        }
                        chrome.storage.local.set({ ephemeralDomains: eps }, () => {
                            const isEps = eps.includes(domain);
                            if(elements.ephemeralStatus) {
                                elements.ephemeralStatus.textContent = isEps ? 'BẬT' : 'TẮT';
                                elements.ephemeralStatus.style.color = isEps ? '#ff4757' : '#ff9f43';
                            }
                            elements.cardEphemeral.style.borderColor = isEps ? 'rgba(255, 71, 87, 0.5)' : 'rgba(255, 159, 67, 0.3)';
                        });
                    });
                }
            });
        });
    }

    if (cardCookies) {
        cardCookies.addEventListener('click', () => toggleSection('cookies'));
    }

    if (cardTrackers) {
        cardTrackers.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.runtime.sendMessage({ type: 'getTrackerCount', tabId: tabs[0].id }, (response) => {
                        showTrackerDetails(response ? response.list : []);
                    });
                }
            });
        });
    }

    if (cardExtensions) {
        cardExtensions.addEventListener('click', () => toggleSection('extensions'));
    }

    if (closeTrackerModal) {
        closeTrackerModal.addEventListener('click', () => {
            elements.trackerModal?.classList.add('hidden');
        });
    }

    if (quickFocusMode) {
        quickFocusMode.addEventListener('click', () => {
            chrome.management.getAll((extensions) => {
                const toDisable = extensions.filter(ext =>
                    ext.enabled &&
                    ext.type === 'extension' &&
                    ext.id !== chrome.runtime.id
                );

                if (toDisable.length === 0) {
                    notify('Focus Mode already active!', 'warning');
                    return;
                }

                let disabledCount = 0;
                toDisable.forEach(ext => {
                    chrome.management.setEnabled(ext.id, false, () => {
                        disabledCount++;
                        if (disabledCount === toDisable.length) {
                            notify(`Focus Mode: Disabled ${disabledCount} extensions`, 'success');
                            updateDashboard();
                            if (elements.extensionsList?.classList.contains('show')) {
                                import('./extensions.js').then(m => m.renderExtensions());
                            }
                        }
                    });
                });
            });
        });
    }

    if (quickClearAll) {
        quickClearAll.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.url) throw new Error('Không thể xác định trang web hiện tại');

                const url = new URL(tab.url);
                const domain = url.hostname;

                if (await showConfirm(`Bạn có chắc muốn xóa sạch Cookie và Lịch sử của trang "${domain}"?`)) {
                    const cookies = await chrome.cookies.getAll({ domain: domain });
                    await Promise.all(
                        cookies.map(c => {
                            const cookieUrl = `http${c.secure ? 's' : ''}://${c.domain}${c.path}`;
                            return chrome.cookies.remove({ url: cookieUrl, name: c.name });
                        })
                    );

                    chrome.history.search({ text: domain, maxResults: 1000, startTime: 0 }, (items) => {
                        items.forEach(item => {
                            if (item.url.includes(domain)) {
                                chrome.history.deleteUrl({ url: item.url });
                            }
                        });

                        notify(`Đã dọn dẹp sạch dữ liệu của "${domain}"`, 'success');
                        updateDashboard();

                        if (elements.historySection?.classList.contains('show')) {
                            import('./history.js').then(m => m.loadHistoryAndSessions());
                        }
                    });
                }
            } catch (error) {
                notify(`Lỗi: ${error.message}`, 'error');
            }
        });
    }

    updateDashboard();
}
