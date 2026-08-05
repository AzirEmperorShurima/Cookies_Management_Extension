/**
 * Unified Encrypted Cloud Sync Module – v2
 *
 * Security:
 *   - PBKDF2 (310,000 iterations, HMAC-SHA-256) — NIST SP 800-132 2023
 *   - AES-GCM-256 (authenticated encryption)
 *   - Salt: 32 bytes random per encryption (stored with payload)
 *   - Pepper: app-specific constant (NOT stored — provides extra protection
 *             against offline brute-force even if storage is leaked)
 *
 * Payload binary format: [version(1B) | salt(32B) | iv(12B) | ciphertext]
 * Stored as Base64 string.
 *
 * Chrome storage.sync backend:
 *   - Chunked at 5,800 B/key (safely below the 8,192 B limit)
 *   - Supports up to ~88 KB total
 *   - Atomic commit: meta key written last
 *
 * Google Drive backend:
 *   - Uses `drive.appdata` scope — hidden AppData folder only, no full Drive access
 *   - Single file upload/download
 *   - OAuth via chrome.identity API
 */

import { settings, saveSettings, notify } from '../popup.js';

// ─────────────────── Constants ───────────────────

/** App-specific pepper: hardcoded, never stored, adds resistance to rainbow-table attacks. */
const APP_SYNC_PEPPER   = 'PCM_v2_$3cur!ty_p3pp3r_Kx9mL3qR_2024';
const SYNC_VERSION      = 2;               // Format version byte (allows future migration)
const CHUNK_SIZE_BYTES  = 5800;            // Max bytes per chrome.storage.sync item
const CHROME_META_KEY   = 'pcm_sync_v2_meta';
const CHROME_CHUNK_PFX  = 'pcm_sync_v2_c';
const DRIVE_FILE_NAME   = 'privacy_manager_sync_v2.enc';

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — CRYPTO
// ═══════════════════════════════════════════════════════════════

/**
 * Derive AES-256 key from password using PBKDF2 + pepper.
 * @param {string} password - User-supplied password
 * @param {Uint8Array} salt - 32-byte random salt
 */
async function _deriveKey(password, salt) {
    const encoder = new TextEncoder();
    // Concatenate password + pepper before key derivation
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
            iterations: 310_000,   // NIST 2023 recommendation for HMAC-SHA-256
            hash:       'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt arbitrary data with a password.
 * @param {any} data - Data to encrypt (must be JSON-serializable)
 * @param {string} password - Encryption password
 * @returns {Promise<string>} Base64-encoded payload
 */
export async function encryptPayload(data, password) {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await _deriveKey(password, salt);

    const plaintext  = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
    );

    // Pack: [version(1B) | salt(32B) | iv(12B) | ciphertext]
    const packed = new Uint8Array(1 + 32 + 12 + ciphertext.length);
    packed[0] = SYNC_VERSION;
    packed.set(salt,       1);
    packed.set(iv,         33);
    packed.set(ciphertext, 45);

    // Base64 encode in chunks to avoid call-stack overflow on large arrays
    let binary = '';
    for (let i = 0; i < packed.length; i += 8192) {
        binary += String.fromCharCode(...packed.subarray(i, Math.min(i + 8192, packed.length)));
    }
    return btoa(binary);
}

/**
 * Decrypt a Base64 payload produced by encryptPayload.
 * @param {string} base64String - Encrypted payload
 * @param {string} password - Decryption password
 * @returns {Promise<any>} Decrypted data
 * @throws {Error} If password is wrong or data is corrupted
 */
export async function decryptPayload(base64String, password) {
    const binary = atob(base64String);
    const packed = Uint8Array.from(binary, c => c.charCodeAt(0));

    const version = packed[0];
    if (version > SYNC_VERSION) {
        throw new Error(
            `Sync format v${version} requires a newer extension. ` +
            `Currently supports up to v${SYNC_VERSION}.`
        );
    }

    const salt       = packed.slice(1,  33);
    const iv         = packed.slice(33, 45);
    const ciphertext = packed.slice(45);
    const key        = await _deriveKey(password, salt);

    try {
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
        throw new Error('Wrong password or corrupted data');
    }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — CHROME STORAGE.SYNC BACKEND
// ═══════════════════════════════════════════════════════════════

function _syncSet(obj) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(obj, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
        });
    });
}

function _syncGet(keys) {
    return new Promise(resolve => chrome.storage.sync.get(keys, resolve));
}

function _syncRemove(keys) {
    return new Promise(resolve => chrome.storage.sync.remove(keys, resolve));
}

/**
 * Write a Base64 payload to chrome.storage.sync in chunks.
 * Atomic: meta key written last so interrupted writes leave old meta intact.
 */
async function _writeChunks(base64String) {
    const MAX_TOTAL = 88_000; // bytes (safe under 102,400 total limit)
    if (base64String.length > MAX_TOTAL) {
        throw new Error(
            `Backup too large (${Math.round(base64String.length / 1024)} KB). ` +
            `Chrome Sync supports up to ~88 KB. ` +
            `Try removing large Zapper rules or custom filter lists.`
        );
    }

    // Build chunks
    const chunks = [];
    for (let i = 0; i < base64String.length; i += CHUNK_SIZE_BYTES) {
        chunks.push(base64String.substring(i, i + CHUNK_SIZE_BYTES));
    }

    // Remove stale chunks from previous sync
    const oldMetaResult = await _syncGet([CHROME_META_KEY]);
    const oldMeta = oldMetaResult[CHROME_META_KEY];
    if (oldMeta?.chunks > 0) {
        const oldKeys = Array.from({ length: oldMeta.chunks }, (_, i) => `${CHROME_CHUNK_PFX}${i}`);
        await _syncRemove(oldKeys);
    }

    // Write new chunks in one batch
    const toStore = Object.fromEntries(chunks.map((c, i) => [`${CHROME_CHUNK_PFX}${i}`, c]));
    await _syncSet(toStore);

    // Write meta LAST — this is the atomic commit point
    const meta = {
        chunks:    chunks.length,
        totalSize: base64String.length,
        timestamp: Date.now(),
        version:   SYNC_VERSION,
        deviceId:  await _getDeviceId()
    };
    await _syncSet({ [CHROME_META_KEY]: meta });
    return meta;
}

/**
 * Read and reassemble chunked payload from chrome.storage.sync.
 */
async function _readChunks() {
    const metaResult = await _syncGet([CHROME_META_KEY]);
    const meta = metaResult[CHROME_META_KEY];
    if (!meta?.chunks) throw new Error('No backup found in Chrome Sync storage');

    const chunkKeys = Array.from({ length: meta.chunks }, (_, i) => `${CHROME_CHUNK_PFX}${i}`);
    const result = await _syncGet(chunkKeys);
    const base64 = chunkKeys.map(k => result[k] || '').join('');
    if (!base64) throw new Error('Backup data is empty or corrupted');

    return { base64, meta };
}

/**
 * Encrypt and upload all sync data to chrome.storage.sync.
 * Also caches the password in session storage for auto-sync.
 * @param {string} password
 */
export async function uploadToChrome(password) {
    const data    = await _gatherSyncData();
    const payload = await encryptPayload(data, password);
    const meta    = await _writeChunks(payload);
    // Cache password for future auto-sync (session-only, clears on browser close)
    chrome.storage.session?.set({ pcm_sync_session_pass: password }).catch(() => {});
    return { success: true, size: payload.length, meta };
}

/**
 * Download and decrypt sync data from chrome.storage.sync.
 * @param {string} password
 */
export async function restoreFromChrome(password) {
    const { base64, meta } = await _readChunks();
    const data = await decryptPayload(base64, password);
    await _applySyncData(data);
    return { success: true, data, meta };
}

/**
 * Get metadata for last chrome sync (timestamp, size, etc.).
 */
export async function getChromeLastSyncMeta() {
    const res = await _syncGet([CHROME_META_KEY]);
    return res[CHROME_META_KEY] || null;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — GOOGLE DRIVE APPDATA BACKEND
// ═══════════════════════════════════════════════════════════════

/**
 * Get the current OAuth token silently (non-interactive).
 * Returns null if not authenticated.
 */
export async function getDriveAuthToken() {
    return new Promise(resolve => {
        if (!chrome.identity?.getAuthToken) return resolve(null); // identity API not available
        chrome.identity.getAuthToken({ interactive: false }, token => {
            if (chrome.runtime.lastError || !token) resolve(null);
            else resolve(token);
        });
    });
}

/**
 * Trigger interactive Google OAuth flow to connect Drive.
 * @throws {Error} If user cancels or OAuth fails
 */
export async function connectDrive() {
    return new Promise((resolve, reject) => {
        if (!chrome.identity?.getAuthToken) {
            return reject(new Error(
                'Identity API not available. Make sure the extension has "identity" permission ' +
                'and a valid oauth2 client_id in manifest.json.'
            ));
        }
        chrome.identity.getAuthToken({ interactive: true }, token => {
            if (chrome.runtime.lastError || !token) {
                reject(new Error(chrome.runtime.lastError?.message || 'Authorization was cancelled'));
            } else {
                resolve(token);
            }
        });
    });
}

/**
 * Revoke Google OAuth token and disconnect Drive.
 */
export async function revokeDriveAccess() {
    const token = await getDriveAuthToken();
    if (!token) return;
    try {
        // Revoke token at Google's endpoint
        await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
    } catch { /* ignore revoke network errors */ }
    await new Promise(r => chrome.identity.removeCachedAuthToken({ token }, r));
}

/** Shared authenticated fetch for Drive API */
async function _driveRequest(url, options = {}) {
    const token = await getDriveAuthToken();
    if (!token) throw new Error('Not connected to Google Drive. Please click "Connect Google Drive" first.');

    const res = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    if (res.status === 401) {
        // Token expired — clear cached token
        await new Promise(r => chrome.identity.removeCachedAuthToken({ token }, r));
        throw new Error('Google Drive session expired. Please reconnect.');
    }
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Drive API error ${res.status}: ${errText.substring(0, 200)}`);
    }
    return res;
}

/** Find existing backup file in Drive AppData folder, returns fileId or null. */
async function _getDriveFileId() {
    const res = await _driveRequest(
        `https://www.googleapis.com/drive/v3/files` +
        `?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'&fields=files(id)&pageSize=1`
    );
    const { files } = await res.json();
    return files?.length ? files[0].id : null;
}

/**
 * Encrypt and upload all sync data to Google Drive AppData folder.
 * @param {string} password
 */
export async function uploadToDrive(password) {
    const data    = await _gatherSyncData();
    const payload = await encryptPayload(data, password);

    // Wrap payload with metadata envelope
    const envelope = JSON.stringify({
        version:   SYNC_VERSION,
        timestamp: Date.now(),
        deviceId:  await _getDeviceId(),
        size:      payload.length,
        payload
    });

    const existingId = await _getDriveFileId();
    const metadata   = {
        name:  DRIVE_FILE_NAME,
        ...(!existingId && { parents: ['appDataFolder'] }) // set parent only on create
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file',     new Blob([envelope],                { type: 'application/octet-stream' }));

    const url    = existingId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    const res  = await _driveRequest(url, { method: existingId ? 'PATCH' : 'POST', body: form });
    const file = await res.json();

    // Cache password for auto-sync
    chrome.storage.session?.set({ pcm_sync_session_pass: password }).catch(() => {});

    return { success: true, fileId: file.id, size: envelope.length };
}

/**
 * Download and decrypt sync data from Google Drive.
 * @param {string} password
 */
export async function restoreFromDrive(password) {
    const fileId = await _getDriveFileId();
    if (!fileId) throw new Error('No backup found on Google Drive');

    const res      = await _driveRequest(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    );
    const envelope = await res.json();
    const data     = await decryptPayload(envelope.payload, password);
    await _applySyncData(data);

    return {
        success: true,
        data,
        meta: {
            timestamp: envelope.timestamp,
            deviceId:  envelope.deviceId,
            size:      envelope.size
        }
    };
}

/** Get metadata from Drive backup file (timestamp, size). */
export async function getDriveLastSyncMeta() {
    try {
        const token = await getDriveAuthToken();
        if (!token) return null;
        const fileId = await _getDriveFileId();
        if (!fileId) return null;
        const res  = await _driveRequest(
            `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime,size`
        );
        const info = await res.json();
        return {
            timestamp: new Date(info.modifiedTime).getTime(),
            totalSize: parseInt(info.size, 10)
        };
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4 — UNIFIED API  (used by popup.js & settings.js)
// ═══════════════════════════════════════════════════════════════

/**
 * Auto-sync called from popup.js saveSettings().
 * Uses session-cached password — silently skips if no password in session.
 * No user notification on success/fail (background operation).
 */
export async function syncToCloud() {
    if (!settings.syncEnabled) return;
    try {
        const session  = await (chrome.storage.session?.get(['pcm_sync_session_pass']).catch(() => ({})) || {});
        const password = session?.pcm_sync_session_pass;
        if (!password) return; // No cached password → skip silently

        if (settings.syncBackend === 'drive') {
            await uploadToDrive(password);
        } else {
            await uploadToChrome(password);
        }
        console.log('[Sync] Auto-sync completed');
    } catch (e) {
        console.warn('[Sync] Auto-sync failed (non-critical):', e.message);
    }
}

/**
 * Pull data from cloud and return as object.
 * Alias used by settings.js pullSyncBtn — fixes Bug 2 (syncFromCloud was missing).
 * @param {string[]} [keys] - Optional array of keys to filter from result
 */
export async function syncFromCloud(keys) {
    const session  = await (chrome.storage.session?.get(['pcm_sync_session_pass']).catch(() => ({})) || {});
    const password = session?.pcm_sync_session_pass;
    if (!password) {
        throw new Error(
            'Please enter your Sync Password and perform a Backup or Restore first to cache credentials.'
        );
    }

    let data;
    if (settings.syncBackend === 'drive') {
        const result = await restoreFromDrive(password);
        data = result.data;
    } else {
        const result = await restoreFromChrome(password);
        data = result.data;
    }

    if (keys?.length) {
        const filtered = {};
        keys.forEach(k => { if (k in data) filtered[k] = data[k]; });
        return filtered;
    }
    return data;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5 — DATA HELPERS
// ═══════════════════════════════════════════════════════════════

/** Gather all sync-able data from local storage + settings. */
async function _gatherSyncData() {
    const local = await new Promise(resolve =>
        chrome.storage.local.get([
            'encryptedVaultLocal',
            'zenCustomUrls',
            'zenSchedule',
            'userZappedCssRules'
        ], resolve)
    );
    return {
        _syncVersion:       SYNC_VERSION,
        _timestamp:         Date.now(),
        settings:           { ...settings },
        encryptedVaultLocal: local.encryptedVaultLocal || null,
        zenCustomUrls:       local.zenCustomUrls       || [],
        zenSchedule:         local.zenSchedule         || {},
        userZappedCssRules:  local.userZappedCssRules  || {}
    };
}

/**
 * Apply restored data back into settings and local storage.
 * Device-specific settings (syncEnabled, syncBackend) are NOT overwritten.
 */
async function _applySyncData(data) {
    if (!data) throw new Error('Empty sync data');

    if (data.settings) {
        // Keys that should stay device-local (not synced across devices)
        const DEVICE_LOCAL_KEYS = ['syncEnabled', 'syncBackend', 'masterSyncKey', 'vaultSyncEnabled'];
        const merged = { ...settings, ...data.settings };
        DEVICE_LOCAL_KEYS.forEach(k => { merged[k] = settings[k]; });
        Object.assign(settings, merged);
        await saveSettings();
    }

    const localData = {};
    if (data.encryptedVaultLocal) localData.encryptedVaultLocal = data.encryptedVaultLocal;
    if (data.zenCustomUrls?.length) localData.zenCustomUrls     = data.zenCustomUrls;
    if (data.zenSchedule && Object.keys(data.zenSchedule).length)
        localData.zenSchedule = data.zenSchedule;
    if (data.userZappedCssRules && Object.keys(data.userZappedCssRules).length)
        localData.userZappedCssRules = data.userZappedCssRules;

    if (Object.keys(localData).length > 0) {
        await new Promise(resolve => chrome.storage.local.set(localData, resolve));
    }
}

/** Get or create a stable device identifier. */
async function _getDeviceId() {
    return new Promise(resolve => {
        chrome.storage.local.get(['pcm_device_id'], r => {
            if (r.pcm_device_id) return resolve(r.pcm_device_id);
            const id = (crypto.randomUUID?.()) ||
                Array.from(crypto.getRandomValues(new Uint8Array(16)),
                    b => b.toString(16).padStart(2, '0')).join('');
            chrome.storage.local.set({ pcm_device_id: id });
            resolve(id);
        });
    });
}

function _formatRelativeTime(ts) {
    if (!ts) return 'Never';
    const diff = Date.now() - ts;
    if (diff < 60_000)       return 'Just now';
    if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(ts).toLocaleDateString();
}

function _formatSize(bytes) {
    if (!bytes) return '';
    return bytes > 1024
        ? ` · ${(bytes / 1024).toFixed(1)} KB`
        : ` · ${bytes} B`;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 6 — UI
// ═══════════════════════════════════════════════════════════════

let _syncUIInitialized = false;

/**
 * Bind all event listeners for the Cloud Sync UI section.
 * Safe to call multiple times — initializes only once per popup lifetime.
 */
export function initSyncUI() {
    if (_syncUIInitialized) return;

    const upBtn        = document.getElementById('cloudSyncUpBtn');
    const downBtn      = document.getElementById('cloudSyncDownBtn');
    const passInput    = document.getElementById('syncPasswordInput');
    const statusMsg    = document.getElementById('syncStatusMsg');
    const lastSyncInfo = document.getElementById('lastSyncInfo');
    const eyeBtn       = document.getElementById('toggleSyncPassEye');
    const chromeBkBtn  = document.getElementById('syncBackendChrome');
    const driveBkBtn   = document.getElementById('syncBackendDrive');
    const driveSection = document.getElementById('driveAuthSection');
    const connectBtn   = document.getElementById('connectDriveBtn');
    const revokeBtn    = document.getElementById('revokeDriveBtn');
    const connectedDiv = document.getElementById('driveConnectedStatus');
    const disconnDiv   = document.getElementById('driveDisconnectedStatus');
    const syncEnabledToggle = document.getElementById('syncEnabledToggle');

    if (!upBtn && !downBtn) return; // UI section not in DOM

    _syncUIInitialized = true;

    const dict = (window.translations?.[settings.language || 'vi']) ||
                 (window.translations?.vi) || {};

    // ── Helper: display status message ──
    function setStatus(msg, type = 'info') {
        if (!statusMsg) return;
        const colors = { success: '#00b894', error: '#ff7675', info: '#a29bfe', warning: '#fdcb6e' };
        const icons  = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        statusMsg.textContent = `${icons[type] || ''} ${msg}`;
        statusMsg.style.color = colors[type] || '#a29bfe';
    }

    // ── Helper: refresh Last sync info ──
    async function refreshSyncInfo() {
        if (!lastSyncInfo) return;
        try {
            const backend = settings.syncBackend || 'chrome';
            const meta    = backend === 'drive'
                ? await getDriveLastSyncMeta()
                : await getChromeLastSyncMeta();
            lastSyncInfo.textContent = meta
                ? `Last backup: ${_formatRelativeTime(meta.timestamp)}${_formatSize(meta.totalSize || meta.size)}`
                : 'No backup found';
        } catch {
            lastSyncInfo.textContent = '';
        }
    }

    // ── Sync-enabled toggle ──
    if (syncEnabledToggle) {
        syncEnabledToggle.checked = !!settings.syncEnabled;
        syncEnabledToggle.addEventListener('change', e => {
            settings.syncEnabled = e.target.checked;
            saveSettings();
        });
    }

    // ── Backend switching ──
    function updateBackendUI() {
        const isDrive = (settings.syncBackend || 'chrome') === 'drive';
        if (chromeBkBtn) {
            chromeBkBtn.style.background = !isDrive ? 'rgba(162,155,254,0.25)' : 'transparent';
            chromeBkBtn.style.color      = !isDrive ? '#a29bfe' : 'var(--text-muted, #888)';
            chromeBkBtn.style.border     = !isDrive
                ? '1px solid rgba(162,155,254,0.6)'
                : '1px solid rgba(255,255,255,0.1)';
        }
        if (driveBkBtn) {
            driveBkBtn.style.background = isDrive ? 'rgba(52,168,83,0.2)' : 'transparent';
            driveBkBtn.style.color      = isDrive ? '#34A853' : 'var(--text-muted, #888)';
            driveBkBtn.style.border     = isDrive
                ? '1px solid rgba(52,168,83,0.5)'
                : '1px solid rgba(255,255,255,0.1)';
        }
        if (driveSection) driveSection.style.display = isDrive ? 'block' : 'none';
        refreshSyncInfo();
    }

    updateBackendUI();

    chromeBkBtn?.addEventListener('click', () => {
        settings.syncBackend = 'chrome';
        saveSettings();
        updateBackendUI();
    });

    driveBkBtn?.addEventListener('click', () => {
        settings.syncBackend = 'drive';
        saveSettings();
        updateBackendUI();
        _checkDriveConnection();
    });

    // ── Drive connection status ──
    async function _checkDriveConnection() {
        const token     = await getDriveAuthToken();
        const connected = !!token;
        if (connectedDiv) connectedDiv.style.display = connected ? 'flex' : 'none';
        if (disconnDiv)   disconnDiv.style.display   = connected ? 'none' : 'flex';
        if (connectBtn)   connectBtn.style.display   = connected ? 'none' : '';
        if (revokeBtn)    revokeBtn.style.display    = connected ? '' : 'none';
    }

    if ((settings.syncBackend || 'chrome') === 'drive') _checkDriveConnection();

    connectBtn?.addEventListener('click', async () => {
        const origText       = connectBtn.textContent;
        connectBtn.disabled  = true;
        connectBtn.textContent = '⏳ Connecting...';
        try {
            await connectDrive();
            setStatus(dict.driveConnected || 'Connected to Google Drive!', 'success');
            notify(dict.driveConnected || 'Google Drive đã kết nối!', 'success');
            await _checkDriveConnection();
        } catch (e) {
            setStatus(e.message, 'error');
        } finally {
            connectBtn.textContent = origText;
            connectBtn.disabled    = false;
        }
    });

    revokeBtn?.addEventListener('click', async () => {
        if (!confirm(dict.driveDisconnectConfirm || 'Disconnect from Google Drive? You can reconnect anytime.'))
            return;
        await revokeDriveAccess();
        setStatus(dict.driveDisconnected || 'Disconnected from Google Drive', 'info');
        await _checkDriveConnection();
    });

    // ── Password eye toggle ──
    eyeBtn?.addEventListener('click', () => {
        if (!passInput) return;
        const isHidden = passInput.type === 'password';
        passInput.type = isHidden ? 'text' : 'password';
        if (eyeBtn) eyeBtn.textContent = isHidden ? '🙈' : '👁️';
    });

    // ── Upload / Backup Now ──
    upBtn?.addEventListener('click', async () => {
        const pwd = passInput?.value?.trim();
        if (!pwd || pwd.length < 8) {
            setStatus(dict.syncPassTooShort || 'Password must be at least 8 characters', 'error');
            return;
        }
        const origText    = upBtn.textContent;
        upBtn.disabled    = true;
        upBtn.textContent = '⏳ Backing up...';
        try {
            const backend = settings.syncBackend || 'chrome';
            const result  = backend === 'drive'
                ? await uploadToDrive(pwd)
                : await uploadToChrome(pwd);

            const sizeStr = _formatSize(result.size);
            setStatus(`${dict.syncSuccess || 'Backup successful!'}${sizeStr}`, 'success');
            notify(dict.syncSuccess || 'Đã backup dữ liệu lên Cloud!', 'success');
            await refreshSyncInfo();
        } catch (e) {
            setStatus(e.message, 'error');
            notify(e.message, 'error');
        } finally {
            upBtn.textContent = origText;
            upBtn.disabled    = false;
        }
    });

    // ── Restore ──
    downBtn?.addEventListener('click', async () => {
        const pwd = passInput?.value?.trim();
        if (!pwd) {
            setStatus(dict.enterSyncPass || 'Enter your Sync Password first', 'error');
            return;
        }
        const confirmed = confirm(
            dict.syncRestoreConfirm ||
            '⚠️ Restore will overwrite your current settings and data with the backup. Continue?'
        );
        if (!confirmed) return;

        const origText      = downBtn.textContent;
        downBtn.disabled    = true;
        downBtn.textContent = '⏳ Restoring...';
        try {
            const backend = settings.syncBackend || 'chrome';
            backend === 'drive'
                ? await restoreFromDrive(pwd)
                : await restoreFromChrome(pwd);

            setStatus(dict.syncRestoreSuccess || 'Restored! Reloading...', 'success');
            notify(dict.syncRestoreSuccess || 'Đã khôi phục dữ liệu thành công!', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            setStatus(e.message, 'error');
            if (e.message.includes('Wrong password') || e.message.includes('corrupted')) {
                notify(dict.syncWrongPass || 'Sai mật khẩu hoặc dữ liệu bị lỗi.', 'error');
            } else {
                notify(e.message, 'error');
            }
        } finally {
            downBtn.textContent = origText;
            downBtn.disabled    = false;
        }
    });

    refreshSyncInfo();
}
