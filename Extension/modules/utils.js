export function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function createElement(tag, attributes = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
        if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'className') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key === 'dataset' && typeof value === 'object') {
            for (const [dataKey, dataVal] of Object.entries(value)) {
                el.dataset[dataKey] = dataVal;
            }
        } else {
            el.setAttribute(key, value);
        }
    }
    for (const child of children) {
        if (child == null || typeof child === 'boolean') continue;
        if (typeof child === 'string' || typeof child === 'number') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        } else if (Array.isArray(child)) {
            child.forEach(c => {
                if (c instanceof Node) el.appendChild(c);
                else if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(c));
            });
        }
    }
    return el;
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Atomic helper to read, modify, and save any storage key with a serial Promise queue
 * to eliminate race conditions across components.
 */
const _storageMutationQueues = new Map();

export function atomicUpdateStorage(key, updaterFn, area = 'local') {
    const queueKey = `${area}:${key}`;
    let queue = _storageMutationQueues.get(queueKey) || Promise.resolve();

    const nextPromise = queue.then(async () => {
        try {
            const storageArea = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
            const res = await storageArea.get([key]);
            const current = res[key];
            const updated = (typeof updaterFn === 'function') ? await updaterFn(current) : updaterFn;
            if (updated !== undefined) {
                await storageArea.set({ [key]: updated });
            }
            return updated;
        } catch (err) {
            console.error(`[Utils] Error in atomicUpdateStorage for ${queueKey}:`, err);
            return null;
        }
    }).catch(err => {
        console.error(`[Utils] Uncaught queue error for ${queueKey}:`, err);
        return null;
    });

    _storageMutationQueues.set(queueKey, nextPromise);
    return nextPromise;
}

/**
 * Atomic helper to read, modify, and save appSettings with a Promise queue
 * to eliminate race conditions across components.
 */
export function updateAppSettings(updaterFn) {
    return atomicUpdateStorage('appSettings', updaterFn, 'local');
}

export function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

export function isRestrictedUrl(url) {
    if (!url) return true;
    const restrictedProtocols = ['chrome:', 'edge:', 'about:', 'chrome-extension:', 'view-source:', 'data:'];
    return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

export function uint8ArrayToBase64(uint8) {
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i += 8192) {
        binary += String.fromCharCode(...uint8.subarray(i, Math.min(i + 8192, len)));
    }
    return btoa(binary);
}

export function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export async function encryptData(data, password) {
    try {
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const baseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedData = encoder.encode(JSON.stringify(data));
        const encryptedContent = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encodedData
        );

        return {
            kdf: 'pbkdf2-v2',
            format: 'base64',
            iv: uint8ArrayToBase64(iv),
            salt: uint8ArrayToBase64(salt),
            content: uint8ArrayToBase64(new Uint8Array(encryptedContent))
        };
    } catch (e) {
        console.error('Encryption error:', e);
        return null;
    }
}

export function parseByteArray(val, format) {
    if (!val) return null;
    if (val instanceof Uint8Array) return val;
    if (Array.isArray(val)) return new Uint8Array(val);
    if (typeof val === 'string') {
        if (format === 'base64') {
            try { return base64ToUint8Array(val); } catch (e) {}
        }
        // Check for pure hex representation (legacy)
        if (/^[0-9a-fA-F]+$/.test(val) && val.length % 2 === 0) {
            const matches = val.match(/.{1,2}/g);
            if (matches) return new Uint8Array(matches.map(b => parseInt(b, 16)));
        }
        try {
            return base64ToUint8Array(val);
        } catch (e) {
            const matches = val.match(/.{1,2}/g);
            if (matches) return new Uint8Array(matches.map(b => parseInt(b, 16)));
        }
    }
    return null;
}

export async function decryptData(encryptedObj, password) {
    try {
        if (!encryptedObj || !encryptedObj.iv || !encryptedObj.content) return null;
        const format = encryptedObj.format;
        let key;
        if (encryptedObj.kdf === 'pbkdf2-v2' || encryptedObj.salt) {
            const encoder = new TextEncoder();
            const baseKey = await crypto.subtle.importKey(
                'raw',
                encoder.encode(password),
                'PBKDF2',
                false,
                ['deriveKey']
            );
            const saltArray = parseByteArray(encryptedObj.salt, format);
            if (!saltArray) return null;
            key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: saltArray,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                baseKey,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
        } else {
            // Tương thích ngược với SHA-256 đơn giản
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hash = await crypto.subtle.digest('SHA-256', data);
            key = await crypto.subtle.importKey(
                'raw',
                hash,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );
        }

        const iv = parseByteArray(encryptedObj.iv, format);
        const content = parseByteArray(encryptedObj.content, format);
        if (!iv || !content) return null;
        const decryptedContent = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            content
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedContent));
    } catch (e) {
        console.warn('[Crypto] Decryption failed (invalid key or corrupted ciphertext)');
        return null;
    }
}

export async function hashPassword(password, salt, iterations = 100000) {
    if (!password) return '';
    try {
        const encoder = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        const saltBytes = encoder.encode(salt || 'thanus_default_salt_2026');
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBytes,
                iterations: iterations,
                hash: 'SHA-256'
            },
            baseKey,
            256
        );
        const hashArray = Array.from(new Uint8Array(derivedBits));
        return 'pbkdf2$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
        console.error('[Crypto] PBKDF2 hashing failed, falling back:', err);
        const encoder = new TextEncoder();
        const data = encoder.encode(password + (salt || ''));
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

export async function verifyPassword(password, salt, storedHash) {
    if (!storedHash || !password) return false;
    if (storedHash.startsWith('pbkdf2$')) {
        const computed = await hashPassword(password, salt);
        return computed === storedHash;
    }
    // Legacy fallback (SHA-256 single hash)
    const encoder = new TextEncoder();
    const data = encoder.encode(password + (salt || ''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const legacyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return legacyHash === storedHash;
}

// ─────────────────── Unified E2EE Cloud Sync Crypto Engine ───────────────────
const APP_SYNC_PEPPER   = 'PCM_v2_$3cur!ty_p3pp3r_Kx9mL3qR_2024';
const SYNC_VERSION      = 2;

async function _deriveSyncKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password + APP_SYNC_PEPPER),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name:       'PBKDF2',
            salt:       salt,
            iterations: 310_000,
            hash:       'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptSyncPayload(data, password) {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await _deriveSyncKey(password, salt);

    const plaintext  = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
    );

    const packed = new Uint8Array(1 + 32 + 12 + ciphertext.length);
    packed[0] = SYNC_VERSION;
    packed.set(salt,       1);
    packed.set(iv,         33);
    packed.set(ciphertext, 45);

    let binary = '';
    for (let i = 0; i < packed.length; i += 8192) {
        binary += String.fromCharCode(...packed.subarray(i, Math.min(i + 8192, packed.length)));
    }
    return btoa(binary);
}

export async function decryptSyncPayload(base64String, password) {
    const binary = atob(base64String);
    const packed = Uint8Array.from(binary, c => c.charCodeAt(0));

    const version = packed[0];
    if (version > SYNC_VERSION) {
        throw new Error(
            `Sync format v${version} requires a newer extension. Currently supports up to v${SYNC_VERSION}.`
        );
    }

    const salt       = packed.slice(1,  33);
    const iv         = packed.slice(33, 45);
    const ciphertext = packed.slice(45);
    const key        = await _deriveSyncKey(password, salt);

    try {
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
        throw new Error('Wrong password or corrupted data');
    }
}

export function throttle(func, limit) {
    let inThrottle = false;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => { inThrottle = false; }, limit);
        }
    };
}

export async function generateMasterKey() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function parseHTML(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const fragment = document.createDocumentFragment();
    while (doc.body.firstChild) {
        fragment.appendChild(doc.body.firstChild);
    }
    return fragment;
}


export const ASSETS = {
    icons: {
        default: "icons/icon48.png",
        icon128: "icons/icon128.png",
        extension: "icons/extension.png",
        extensionDefault: "icons/extension-default.png",
        dev: "icons/dev.png",
        store: "icons/store.png",
        admin: "icons/admin.png",
        other: "icons/other.png",
        aboutUs: "icons/about-us.png",
        skincell: "icons/skincell.png",
        trackingProtection: "icons/tracking_protection.png",
        copy: "icons/copy.png",
        clear: "icons/clear.png"
    },
    images: {
        defaultBg: "images/anh-phong-canh-66-1.jpg"
    }
};

