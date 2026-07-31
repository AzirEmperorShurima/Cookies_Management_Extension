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

let currentEmail = null;
let currentLogin = null;
let currentDomain = null;

let isInitialized = false;
export async function initTempMailUI() {
    if (isInitialized) return;
    isInitialized = true;
    // Load from storage
    chrome.storage.local.get(['virtualEmail'], (res) => {
        if (res.virtualEmail) {
            setEmail(res.virtualEmail);
            fetchInbox();
        } else {
            generateNewEmail();
        }
    });

    elements.generateTempMailBtn?.addEventListener('click', generateNewEmail);
    elements.refreshTempMailBtn?.addEventListener('click', fetchInbox);

    elements.copyTempMailBtn?.addEventListener('click', () => {
        if (!currentEmail) return;
        navigator.clipboard.writeText(currentEmail).then(() => {
            const originalIcon = elements.copyTempMailBtn.innerHTML;
            elements.copyTempMailBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            setTimeout(() => {
                elements.copyTempMailBtn.innerHTML = originalIcon;
            }, 2000);
        });
    });

    elements.backToInboxBtn?.addEventListener('click', () => {
        elements.tempMailDetailView.style.display = 'none';
        elements.tempMailInboxView.style.display = 'block';
    });
}

function setEmail(email) {
    currentEmail = email;
    const parts = email.split('@');
    currentLogin = parts[0];
    currentDomain = parts[1];
    if (elements.currentTempMail) {
        elements.currentTempMail.textContent = email;
    }
}

async function generateNewEmail() {
    if (elements.currentTempMail) {
        elements.currentTempMail.textContent = 'Generating...';
    }
    try {
        const response = await fetch('https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1');
        if (!response.ok) throw new Error('API server error');
        
        let data;
        try {
            data = await response.json();
        } catch (err) {
            throw new Error('API returned invalid format. Service might be down.');
        }

        if (data && data.length > 0) {
            const newEmail = data[0];
            setEmail(newEmail);
            chrome.storage.local.set({ virtualEmail: newEmail });
            fetchInbox();
        }
    } catch (e) {
        console.error("Failed to generate temp mail:", e);
        if (elements.currentTempMail) {
            elements.currentTempMail.textContent = 'Error. Try again.';
        }
    }
}

async function fetchInbox() {
    if (!currentLogin || !currentDomain) return;

    // UI Loading state
    if (elements.tempMailListContainer) {
        elements.tempMailListContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Checking inbox...</div>';
    }

    // Rotate refresh icon
    const refreshSvg = elements.refreshTempMailBtn?.querySelector('svg');
    if (refreshSvg) {
        refreshSvg.style.transition = 'transform 0.5s';
        refreshSvg.style.transform = 'rotate(360deg)';
        setTimeout(() => refreshSvg.style.transform = '', 500);
    }

    try {
        const response = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${currentLogin}&domain=${currentDomain}`);
        if (!response.ok) throw new Error('API server error');
        
        let messages;
        try {
            messages = await response.json();
        } catch (err) {
            throw new Error('API returned invalid format. Service might be down.');
        }

        elements.tempMailListContainer.innerHTML = '';
        if (messages.length === 0) {
            elements.tempMailListContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Inbox is empty</div>';
            return;
        }

        const htmlParts = messages.map(msg => {
            return `
                <div class="email-item" data-id="${msg.id}">
                    <div class="email-item-header">
                        <span class="email-sender">${escapeHTML(msg.from)}</span>
                        <span class="email-time">${formatTime(msg.date)}</span>
                    </div>
                    <div class="email-subject">${escapeHTML(msg.subject || 'No Subject')}</div>
                </div>
            `;
        });
        
        elements.tempMailListContainer.innerHTML = htmlParts.join('');

        // Ensure we only attach this listener once
        if (!elements.tempMailListContainer._hasClickListener) {
            elements.tempMailListContainer.addEventListener('click', (e) => {
                const item = e.target.closest('.email-item');
                if (item) {
                    openMessage(item.getAttribute('data-id'));
                }
            });
            elements.tempMailListContainer._hasClickListener = true;
        }

    } catch (e) {
        console.error("Failed to fetch inbox:", e);
        if (elements.tempMailListContainer) {
            elements.tempMailListContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Failed to load.</div>';
        }
    }
}

async function openMessage(id) {
    if (!currentLogin || !currentDomain) return;

    elements.tempMailInboxView.style.display = 'none';
    elements.tempMailDetailView.style.display = 'flex';

    elements.detailSubject.textContent = 'Loading...';
    elements.detailFrom.textContent = '';
    elements.detailDate.textContent = '';
    
    elements.detailBody.textContent = '';
    const loadingDiv = createElement('div', { style: { textAlign: 'center', padding: '20px' } }, 'Loading message...');
    elements.detailBody.appendChild(loadingDiv);

    try {
        const response = await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${currentLogin}&domain=${currentDomain}&id=${id}`);
        const msg = await response.json();
        elements.detailSubject.textContent = msg.subject || 'No Subject';
        elements.detailFrom.textContent = msg.from;
        elements.detailDate.textContent = formatTime(msg.date);

        elements.detailBody.textContent = '';
        
        // Render HTML safely inside sandbox or fallback to text
        if (msg.htmlBody) {
            const iframe = createElement('iframe', {
                sandbox: '',
                style: { width: '100%', height: '400px', border: 'none', background: '#fff', borderRadius: '4px' },
                srcdoc: msg.htmlBody
            });
            elements.detailBody.appendChild(iframe);
        } else if (msg.textBody) {
            elements.detailBody.textContent = msg.textBody;
        } else {
            const em = createElement('em', {}, 'Empty message');
            elements.detailBody.appendChild(em);
        }
    } catch (e) {
        elements.detailBody.textContent = '';
        const errDiv = createElement('div', { style: { color: 'red' } }, 'Error loading message.');
        elements.detailBody.appendChild(errDiv);
    }
}

function createElement(tag, props = {}, text = '') {
    const el = document.createElement(tag);
    Object.assign(el, props);
    if (props.style) Object.assign(el.style, props.style);
    if (text) el.textContent = text;
    return el;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

function formatTime(dateString) {
    try {
        const date = new Date(dateString.replace(' ', 'T')); // 1secmail returns 'YYYY-MM-DD HH:MM:SS'
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateString;
    }
}
