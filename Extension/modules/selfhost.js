/**
 * modules/selfhost.js
 * Client-Side API & Communication Engine for Thanus Self-Hosted VPS
 */

import { encryptSyncPayload as encryptPayload, decryptSyncPayload as decryptPayload } from './utils.js';

/**
 * Pings the self-hosted VPS server to verify reachability, authentication and latency.
 * @param {string} serverUrl - VPS base URL (e.g. https://vps.example.com)
 * @param {string} apiToken - API Secret Token
 * @returns {Promise<{ success: boolean, latencyMs: number, info: any }>}
 */
export async function pingSelfHost(serverUrl, apiToken) {
    if (!serverUrl) throw new Error('VPS Server URL is required');
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const startTime = performance.now();

    const headers = { 'Accept': 'application/json' };
    if (apiToken) headers['X-Thanus-Token'] = apiToken;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const res = await fetch(`${cleanUrl}/api/v1/health`, {
            method: 'GET',
            headers,
            signal: controller.signal
        });
        clearTimeout(timeout);
        const latencyMs = Math.round(performance.now() - startTime);

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`Server returned HTTP ${res.status}: ${errText.substring(0, 100)}`);
        }

        const data = await res.json();
        return {
            success: true,
            latencyMs,
            info: data,
            authenticated: Boolean(data.authenticated)
        };
    } catch (err) {
        clearTimeout(timeout);
        throw new Error(`Cannot connect to VPS (${cleanUrl}): ${err.message}`);
    }
}

/**
 * Encrypts and uploads all extension data to Self-Hosted VPS.
 * @param {string} serverUrl
 * @param {string} apiToken
 * @param {string} password - E2EE master encryption password
 * @param {object} syncData - Gathered sync data
 */
export async function uploadToSelfHost(serverUrl, apiToken, password, syncData) {
    if (!serverUrl) throw new Error('VPS Server URL is required');
    if (!apiToken) throw new Error('VPS API Token is required');
    if (!password) throw new Error('Encryption password is required');

    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const payload = await encryptPayload(syncData, password);

    const body = JSON.stringify({
        payload,
        timestamp: Date.now(),
        version: 2,
        clientInfo: 'Thanus Extension v2.2.1'
    });

    const res = await fetch(`${cleanUrl}/api/v1/sync/upload`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Thanus-Token': apiToken
        },
        body
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Upload failed (HTTP ${res.status})`);
    }

    const data = await res.json();
    return {
        success: true,
        size: payload.length,
        meta: data.meta
    };
}

/**
 * Downloads and decrypts the latest backup from Self-Hosted VPS.
 * @param {string} serverUrl
 * @param {string} apiToken
 * @param {string} password - E2EE master encryption password
 */
export async function restoreFromSelfHost(serverUrl, apiToken, password) {
    if (!serverUrl) throw new Error('VPS Server URL is required');
    if (!apiToken) throw new Error('VPS API Token is required');
    if (!password) throw new Error('Decryption password is required');

    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/v1/sync/download`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-Thanus-Token': apiToken
        }
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Download failed (HTTP ${res.status})`);
    }

    const json = await res.json();
    if (!json.payload) throw new Error('Server returned empty backup payload');

    const decryptedData = await decryptPayload(json.payload, password);
    return {
        success: true,
        data: decryptedData,
        meta: json.meta
    };
}

/**
 * Retrieves the backup history revisions from Self-Hosted VPS.
 */
export async function getSelfHostBackupHistory(serverUrl, apiToken) {
    if (!serverUrl || !apiToken) return [];
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    try {
        const res = await fetch(`${cleanUrl}/api/v1/sync/history`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Thanus-Token': apiToken
            }
        });
        if (!res.ok) return [];
        const json = await res.json();
        return json.history || [];
    } catch {
        return [];
    }
}

/**
 * Generates an ephemeral email address using the Self-Hosted VPS domain.
 */
export async function generateSelfHostEmail(serverUrl, apiToken) {
    if (!serverUrl) throw new Error('VPS Server URL is required');
    const cleanUrl = serverUrl.replace(/\/+$/, '');

    const res = await fetch(`${cleanUrl}/api/v1/mail/generate`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-Thanus-Token': apiToken || ''
        }
    });

    if (!res.ok) {
        throw new Error(`Failed to generate self-hosted email (HTTP ${res.status})`);
    }

    const data = await res.json();
    return {
        email: data.address,
        provider: 'selfhost',
        user: data.user,
        domain: data.domain,
        createdAt: data.createdAt
    };
}

/**
 * Fetches messages and OTP codes from the Self-Hosted VPS inbox.
 */
export async function fetchSelfHostInbox(serverUrl, apiToken, address) {
    if (!serverUrl || !address) return [];
    const cleanUrl = serverUrl.replace(/\/+$/, '');

    const res = await fetch(`${cleanUrl}/api/v1/mail/inbox?address=${encodeURIComponent(address)}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-Thanus-Token': apiToken || ''
        }
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
}

/**
 * Constructs a relay stream URL to bypass CORS and hotlink protection.
 */
export function getRelayStreamUrl(serverUrl, apiToken, originalUrl, options = {}) {
    if (!serverUrl || !originalUrl) return originalUrl;
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const params = new URLSearchParams({
        url: originalUrl,
        token: apiToken || ''
    });

    if (options.referer) params.set('referer', options.referer);
    if (options.origin) params.set('origin', options.origin);
    if (options.ua) params.set('ua', options.ua);

    return `${cleanUrl}/api/v1/stream/relay?${params.toString()}`;
}
