// tempmail.js - Multi-Provider Temp Mail with OTP Auto-Extraction
export const elements = {
    tempMailSection: document.getElementById('tempMailSection'),
    currentTempMail: document.getElementById('currentTempMail'),
    copyTempMailBtn: document.getElementById('copyTempMailBtn'),
    generateTempMailBtn: document.getElementById('generateTempMailBtn'),
    refreshTempMailBtn: document.getElementById('refreshTempMailBtn'),
    tempMailInboxView: document.getElementById('tempMailInboxView'),
    tempMailListContainer: document.getElementById('tempMailListContainer'),
    tempMailDetailView: document.getElementById('tempMailDetailView'),
    backToInboxBtn: document.getElementById('backToInboxBtn'),
    detailSubject: document.getElementById('detailSubject'),
    detailFrom: document.getElementById('detailFrom'),
    detailDate: document.getElementById('detailDate'),
    detailBody: document.getElementById('detailBody'),
};

let currentAccount = {
    email: null,
    provider: '1secmail', // '1secmail' | 'mailtm'
    token: null,          // For Mail.tm
    id: null,
    login: null,
    domain: null
};

let autoPollInterval = null;
let lastKnownMessageIds = new Set();
let isInitialized = false;

export async function initTempMailUI() {
    if (isInitialized) return;
    isInitialized = true;

    // Load cached temp mail state & cached inbox
    chrome.storage.local.get(['virtualAccount', 'tempMailCachedInbox'], async (res) => {
        if (res.virtualAccount && res.virtualAccount.email) {
            currentAccount = res.virtualAccount;
            if (elements.currentTempMail) {
                elements.currentTempMail.textContent = currentAccount.email;
            }
            if (Array.isArray(res.tempMailCachedInbox) && res.tempMailCachedInbox.length > 0) {
                renderInboxMessages(res.tempMailCachedInbox);
            }
            fetchInbox();
        } else {
            await generateNewEmail();
        }
    });

    elements.generateTempMailBtn?.addEventListener('click', () => generateNewEmail());
    elements.refreshTempMailBtn?.addEventListener('click', () => fetchInbox());

    elements.copyTempMailBtn?.addEventListener('click', () => {
        if (!currentAccount.email) return;
        navigator.clipboard.writeText(currentAccount.email).then(() => {
            const originalSvg = elements.copyTempMailBtn.innerHTML;
            elements.copyTempMailBtn.innerHTML = '<span>✔</span>';
            setTimeout(() => {
                elements.copyTempMailBtn.innerHTML = originalSvg;
            }, 1800);
        });
    });

    elements.backToInboxBtn?.addEventListener('click', () => {
        if (elements.tempMailDetailView) elements.tempMailDetailView.style.display = 'none';
        if (elements.tempMailInboxView) elements.tempMailInboxView.style.display = 'block';
    });

    // Auto-poll inbox every 12 seconds when popup is active
    if (!autoPollInterval) {
        autoPollInterval = setInterval(() => {
            if (currentAccount.email) fetchInbox(true);
        }, 12000);
    }
}

// ----------------- Providers -----------------

async function generateWith1SecMail() {
    const response = await fetch('https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1');
    if (!response.ok) throw new Error('1secmail server error');
    const data = await response.json();
    if (!data || !data[0]) throw new Error('Empty response from 1secmail');

    const email = data[0];
    const [login, domain] = email.split('@');
    return {
        email: email,
        provider: '1secmail',
        login: login,
        domain: domain,
        token: null
    };
}

async function generateWithMailTm() {
    // 1. Fetch active domains from Mail.tm
    const domainRes = await fetch('https://api.mail.tm/domains?page=1');
    if (!domainRes.ok) throw new Error('Mail.tm domain error');
    const domainData = await domainRes.json();
    const availableDomains = domainData['hydra:member'];
    if (!availableDomains || availableDomains.length === 0) throw new Error('No Mail.tm domains available');

    const chosenDomain = availableDomains[0].domain;
    const randomUser = 'user_' + Math.random().toString(36).substring(2, 10);
    const email = `${randomUser}@${chosenDomain}`;
    const password = 'Pass_' + Math.random().toString(36).substring(2, 12);

    // 2. Register account
    const regRes = await fetch('https://api.mail.tm/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: email, password: password })
    });
    if (!regRes.ok) throw new Error('Mail.tm account registration failed');
    const regData = await regRes.json();

    // 3. Acquire Token
    const authRes = await fetch('https://api.mail.tm/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: email, password: password })
    });
    if (!authRes.ok) throw new Error('Mail.tm auth failed');
    const authData = await authRes.json();

    return {
        email: email,
        provider: 'mailtm',
        login: randomUser,
        domain: chosenDomain,
        token: authData.token,
        id: regData.id
    };
}

async function generateNewEmail() {
    if (elements.currentTempMail) {
        elements.currentTempMail.textContent = 'Generating address...';
    }

    try {
        // Try 1secmail first
        currentAccount = await generateWith1SecMail();
    } catch (e1) {
        console.warn('1secmail failed, falling back to Mail.tm:', e1);
        try {
            currentAccount = await generateWithMailTm();
        } catch (e2) {
            console.error('All providers failed:', e2);
            if (elements.currentTempMail) {
                elements.currentTempMail.textContent = 'Error connecting to Temp Mail service';
            }
            return;
        }
    }

    lastKnownMessageIds.clear();
    chrome.storage.local.set({ virtualAccount: currentAccount });

    if (elements.currentTempMail) {
        elements.currentTempMail.textContent = currentAccount.email;
    }

    fetchInbox();
}

// ----------------- OTP Extractor -----------------

function extractOtp(text) {
    if (!text) return null;
    // Regex matches common OTP patterns (4 to 8 digits)
    const contextMatch = text.match(/(?:code|otp|verification|passcode|mã|xác nhận|pin)[\s\:\-\#]*([0-9]{4,8})\b/i);
    if (contextMatch && contextMatch[1]) {
        return contextMatch[1];
    }
    const genericMatch = text.match(/\b([0-9]{4,8})\b/);
    if (genericMatch && genericMatch[1]) {
        return genericMatch[1];
    }
    return null;
}

// ----------------- Fetch & Render Inbox -----------------

async function fetchInbox(isBackgroundPoll = false) {
    if (!currentAccount.email) return;

    if (!isBackgroundPoll && elements.tempMailListContainer) {
        elements.tempMailListContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Checking inbox...</div>';
    }

    // Animate refresh icon
    const refreshSvg = elements.refreshTempMailBtn?.querySelector('svg');
    if (refreshSvg && !isBackgroundPoll) {
        refreshSvg.style.transition = 'transform 0.5s';
        refreshSvg.style.transform = 'rotate(360deg)';
        setTimeout(() => { if (refreshSvg) refreshSvg.style.transform = ''; }, 500);
    }

    try {
        let messages = [];

        if (currentAccount.provider === '1secmail') {
            const res = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${currentAccount.login}&domain=${currentAccount.domain}`);
            if (res.ok) {
                messages = await res.json();
            }
        } else if (currentAccount.provider === 'mailtm') {
            const res = await fetch('https://api.mail.tm/messages?page=1', {
                headers: { 'Authorization': `Bearer ${currentAccount.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                messages = (data['hydra:member'] || []).map(m => ({
                    id: m.id,
                    from: m.from?.address || m.from?.name || 'Unknown',
                    subject: m.subject || 'No Subject',
                    date: m.createdAt,
                    intro: m.intro || ''
                }));
            }
        }

        // Notify if new incoming emails detected
        if (messages.length > 0) {
            messages.forEach(msg => {
                if (!lastKnownMessageIds.has(String(msg.id))) {
                    lastKnownMessageIds.add(String(msg.id));
                    if (isBackgroundPoll) {
                        chrome.runtime.sendMessage({
                            type: 'createNotification',
                            options: {
                                type: 'basic',
                                title: 'New Temp Email Received!',
                                message: `From: ${msg.from}\n${msg.subject}`
                            }
                        }).catch(() => {});
                    }
                }
            });
        }

        // Cache fresh messages in storage
        if (Array.isArray(messages)) {
            chrome.storage.local.set({ tempMailCachedInbox: messages });
        }

        renderInboxMessages(messages);

    } catch (e) {
        console.error("Failed to fetch inbox:", e);
        if (elements.tempMailListContainer && !isBackgroundPoll) {
            // If container has cached messages, don't wipe it out on transient network error
            if (!elements.tempMailListContainer.children || elements.tempMailListContainer.children.length === 0) {
                elements.tempMailListContainer.textContent = '';
                const errDiv = document.createElement('div');
                errDiv.style.cssText = 'text-align:center; padding: 20px; color: var(--text-muted);';
                errDiv.textContent = 'Failed to load inbox. Tap refresh to retry.';
                elements.tempMailListContainer.appendChild(errDiv);
            }
        }
    }
}

function renderInboxMessages(messages) {
    if (!elements.tempMailListContainer || !Array.isArray(messages)) return;

    elements.tempMailListContainer.innerHTML = '';
    if (messages.length === 0) {
        elements.tempMailListContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Inbox is empty</div>';
        return;
    }

    const fragment = document.createDocumentFragment();

    messages.forEach(msg => {
        const otpCode = extractOtp(`${msg.subject} ${msg.intro || ''}`);
        const itemDiv = document.createElement('div');
        itemDiv.className = 'email-item';
        itemDiv.dataset.id = msg.id;
        itemDiv.style.cssText = `
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 10px 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            gap: 5px;
        `;
        const safeFrom = escapeHTML(msg.from || 'Unknown Sender');
        const safeSubject = escapeHTML(msg.subject || 'No Subject');
        const safeOtp = otpCode ? escapeHTML(otpCode) : '';

        itemDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                <span style="font-weight: 600; color: #00f2fe; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeFrom}</span>
                <span style="color: var(--text-muted); font-size: 10px;">${formatTime(msg.date)}</span>
            </div>
            <div style="font-size: 12px; font-weight: 500; color: var(--text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeSubject}</div>
            ${safeOtp ? `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px; padding: 4px 8px; background: rgba(0, 242, 254, 0.1); border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 6px;">
                    <span style="font-size: 11px; color: #00f2fe; font-weight: bold;">🔑 Mã OTP: <span style="font-family: monospace; font-size: 13px; color: #fff;">${safeOtp}</span></span>
                    <button class="otp-copy-btn" data-otp="${safeOtp}" style="background: linear-gradient(135deg, #00f2fe, #4facfe); border: none; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer;">Sao chép</button>
                </div>
            ` : ''}
        `;

        const copyOtpBtn = itemDiv.querySelector('.otp-copy-btn');
        if (copyOtpBtn) {
            copyOtpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const code = copyOtpBtn.getAttribute('data-otp');
                navigator.clipboard.writeText(code);
                copyOtpBtn.textContent = 'Đã chép!';
                setTimeout(() => { copyOtpBtn.textContent = 'Sao chép'; }, 1500);
            });
        }

        itemDiv.addEventListener('click', () => {
            openMessage(msg.id);
        });

        fragment.appendChild(itemDiv);
    });

    elements.tempMailListContainer.appendChild(fragment);
}

async function openMessage(id) {
    if (!currentAccount.email) return;

    if (elements.tempMailInboxView) elements.tempMailInboxView.style.display = 'none';
    if (elements.tempMailDetailView) elements.tempMailDetailView.style.display = 'flex';

    if (elements.detailSubject) elements.detailSubject.textContent = 'Loading message...';
    if (elements.detailFrom) elements.detailFrom.textContent = '';
    if (elements.detailDate) elements.detailDate.textContent = '';
    if (elements.detailBody) {
        elements.detailBody.textContent = '';
        const loadingDiv = document.createElement('div');
        loadingDiv.style.cssText = 'text-align: center; padding: 20px; color: var(--text-muted);';
        loadingDiv.textContent = 'Loading content...';
        elements.detailBody.appendChild(loadingDiv);
    }

    try {
        let msg = null;

        if (currentAccount.provider === '1secmail') {
            const response = await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${currentAccount.login}&domain=${currentAccount.domain}&id=${id}`);
            msg = await response.json();
        } else if (currentAccount.provider === 'mailtm') {
            const response = await fetch(`https://api.mail.tm/messages/${id}`, {
                headers: { 'Authorization': `Bearer ${currentAccount.token}` }
            });
            const data = await response.json();
            msg = {
                subject: data.subject,
                from: data.from?.address || data.from?.name,
                date: data.createdAt,
                htmlBody: data.html ? data.html.join('') : null,
                textBody: data.text
            };
        }

        if (!msg) throw new Error('Could not load email content');

        if (elements.detailSubject) elements.detailSubject.textContent = msg.subject || 'No Subject';
        if (elements.detailFrom) elements.detailFrom.textContent = msg.from;
        if (elements.detailDate) elements.detailDate.textContent = formatTime(msg.date);

        if (elements.detailBody) {
            elements.detailBody.textContent = '';
            
            const otpCode = extractOtp(`${msg.subject} ${msg.textBody || ''} ${msg.htmlBody || ''}`);
            if (otpCode) {
                const otpBanner = document.createElement('div');
                otpBanner.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; margin-bottom: 12px; background: rgba(0, 242, 254, 0.15); border: 1px solid #00f2fe; border-radius: 8px;';
                
                const otpLabel = document.createElement('span');
                otpLabel.style.cssText = 'color: #00f2fe; font-weight: bold; font-size: 13px;';
                otpLabel.textContent = '🔑 Mã OTP tìm thấy: ';

                const otpSpan = document.createElement('span');
                otpSpan.style.cssText = 'font-family: monospace; font-size: 16px; color: #fff; letter-spacing: 2px;';
                otpSpan.textContent = otpCode;
                otpLabel.appendChild(otpSpan);

                const copyBtn = document.createElement('button');
                copyBtn.id = 'detailCopyOtpBtn';
                copyBtn.style.cssText = 'background: linear-gradient(135deg, #00f2fe, #4facfe); border: none; color: #fff; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer;';
                copyBtn.textContent = 'Sao chép mã';

                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(otpCode);
                    copyBtn.textContent = 'Đã sao chép!';
                    setTimeout(() => { copyBtn.textContent = 'Sao chép mã'; }, 1500);
                };

                otpBanner.appendChild(otpLabel);
                otpBanner.appendChild(copyBtn);
                elements.detailBody.appendChild(otpBanner);
            }

            if (msg.htmlBody) {
                const iframe = document.createElement('iframe');
                iframe.sandbox = '';
                iframe.style.cssText = 'width: 100%; height: 350px; border: none; background: #fff; border-radius: 6px;';
                iframe.srcdoc = msg.htmlBody;
                elements.detailBody.appendChild(iframe);
            } else if (msg.textBody) {
                const pre = document.createElement('pre');
                pre.style.cssText = 'white-space: pre-wrap; font-family: inherit; font-size: 12px; line-height: 1.5; color: var(--text-color);';
                pre.textContent = msg.textBody;
                elements.detailBody.appendChild(pre);
            } else {
                const emptyEm = document.createElement('em');
                emptyEm.style.color = 'var(--text-muted)';
                emptyEm.textContent = 'Email body is empty';
                elements.detailBody.appendChild(emptyEm);
            }
        }
    } catch (e) {
        console.error('Error loading email details:', e);
        if (elements.detailBody) {
            elements.detailBody.textContent = '';
            const errDiv = document.createElement('div');
            errDiv.style.cssText = 'color: #ff4757; text-align: center; padding: 20px;';
            errDiv.textContent = 'Lỗi khi tải chi tiết thư.';
            elements.detailBody.appendChild(errDiv);
        }
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

function formatTime(dateString) {
    try {
        const date = new Date(String(dateString).replace(' ', 'T'));
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    } catch {
        return dateString || '';
    }
}
