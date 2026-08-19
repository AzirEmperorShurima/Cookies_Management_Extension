/**
 * modules/hls-downloader.js
 * Full HLS / M3U8 Playlist Parser, AES-128 Decryption, Multi-thread Segment Fetcher & Blob Merger
 */

/**
 * Resolves a potentially relative URL against a base URL
 */
function resolveUrl(relativeUrl, baseUrl) {
    try {
        return new URL(relativeUrl, baseUrl).href;
    } catch (e) {
        return relativeUrl;
    }
}

/**
 * Parses Hex IV string (e.g. "0x1234...5678") to Uint8Array (16 bytes)
 */
function parseHexIV(hexString) {
    const cleanHex = hexString.replace(/^0x/i, '').padStart(32, '0');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16) || 0;
    }
    return bytes;
}

/**
 * Generates 16-byte Big-Endian IV from segment sequence number (HLS standard fallback)
 */
function createSequenceIV(seqNumber) {
    const iv = new Uint8Array(16);
    const view = new DataView(iv.buffer);
    view.setUint32(12, seqNumber, false); // Big-endian in last 4 bytes
    return iv;
}

/**
 * Decrypts an AES-128-CBC encrypted ArrayBuffer segment using Web Crypto API
 */
async function decryptAes128Segment(encryptedBuffer, keyBuffer, ivBuffer) {
    try {
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-CBC' },
            false,
            ['decrypt']
        );
        return await crypto.subtle.decrypt(
            { name: 'AES-CBC', iv: ivBuffer },
            cryptoKey,
            encryptedBuffer
        );
    } catch (err) {
        console.warn('[HLS Decrypt] Decryption failed, using raw buffer:', err);
        return encryptedBuffer;
    }
}

/**
 * Parses an M3U8 file text to extract segment items and encryption metadata
 */
export async function parseM3U8(content, baseUrl) {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    // 1. Check if master playlist containing variant streams
    const hasVariants = lines.some(l => l.startsWith('#EXT-X-STREAM-INF'));
    if (hasVariants) {
        let bestVariantUrl = null;
        let maxBandwidth = 0;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
                const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
                const nextLine = lines[i + 1];
                if (nextLine && !nextLine.startsWith('#')) {
                    if (bw >= maxBandwidth) {
                        maxBandwidth = bw;
                        bestVariantUrl = resolveUrl(nextLine, baseUrl);
                    }
                }
            }
        }

        if (bestVariantUrl) {
            console.log('[HLS Downloader] Selected best variant stream:', bestVariantUrl);
            const variantRes = await fetch(bestVariantUrl);
            const variantText = await variantRes.text();
            return parseM3U8(variantText, bestVariantUrl);
        }
    }

    // 2. Parse media playlist segments & encryption keys
    const segments = [];
    let currentKeyInfo = null;
    let seqNumber = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
            const seqMatch = line.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
            if (seqMatch) seqNumber = parseInt(seqMatch[1], 10);
            continue;
        }

        if (line.startsWith('#EXT-X-KEY:')) {
            const methodMatch = line.match(/METHOD=([^,\s]+)/);
            const method = methodMatch ? methodMatch[1].toUpperCase() : 'NONE';

            if (method === 'AES-128') {
                const uriMatch = line.match(/URI="([^"]+)"/) || line.match(/URI=([^,\s]+)/);
                const ivMatch = line.match(/IV=([^,\s]+)/);

                currentKeyInfo = {
                    method: 'AES-128',
                    keyUrl: uriMatch ? resolveUrl(uriMatch[1], baseUrl) : null,
                    iv: ivMatch ? parseHexIV(ivMatch[1]) : null
                };
            } else if (method === 'NONE') {
                currentKeyInfo = null;
            }
            continue;
        }

        if (!line.startsWith('#')) {
            segments.push({
                url: resolveUrl(line, baseUrl),
                seq: seqNumber++,
                keyInfo: currentKeyInfo ? { ...currentKeyInfo } : null
            });
        }
    }

    return segments;
}

/**
 * Downloads segments with controlled concurrency, AES-128 decryption & retry logic
 */
async function fetchSegmentsConcurrent(segments, concurrency = 5, onProgress) {
    const results = new Array(segments.length);
    const keyCache = new Map(); // Cache raw key ArrayBuffers
    let completed = 0;
    let nextIndex = 0;
    let totalBytesDownloaded = 0;
    const startTime = Date.now();

    // Helper: fetch encryption key with caching
    async function getKeyBuffer(keyUrl) {
        if (!keyUrl) return null;
        if (keyCache.has(keyUrl)) return keyCache.get(keyUrl);

        try {
            const res = await fetch(keyUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = await res.arrayBuffer();
            keyCache.set(keyUrl, buf);
            return buf;
        } catch (e) {
            console.error('[HLS] Failed to fetch decryption key:', keyUrl, e);
            return null;
        }
    }

    async function worker() {
        while (nextIndex < segments.length) {
            const index = nextIndex++;
            const item = segments[index];
            const url = item.url;

            let attempts = 0;
            let success = false;

            while (attempts < 3 && !success) {
                try {
                    attempts++;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    let segmentBuffer = await res.arrayBuffer();

                    // Decrypt if segment is AES-128 encrypted
                    if (item.keyInfo && item.keyInfo.method === 'AES-128' && item.keyInfo.keyUrl) {
                        const keyBuffer = await getKeyBuffer(item.keyInfo.keyUrl);
                        if (keyBuffer) {
                            const ivBuffer = item.keyInfo.iv || createSequenceIV(item.seq);
                            segmentBuffer = await decryptAes128Segment(segmentBuffer, keyBuffer, ivBuffer);
                        }
                    }

                    results[index] = segmentBuffer;
                    totalBytesDownloaded += segmentBuffer.byteLength;
                    success = true;
                } catch (e) {
                    if (attempts >= 3) {
                        console.warn(`[HLS] Failed to fetch segment ${index}: ${url}`, e);
                        results[index] = new ArrayBuffer(0); // Empty fallback to avoid crashing stream
                        success = true;
                    } else {
                        await new Promise(r => setTimeout(r, 600 * attempts));
                    }
                }
            }

            completed++;
            if (typeof onProgress === 'function') {
                const pct = Math.floor((completed / segments.length) * 100);
                const elapsedSec = (Date.now() - startTime) / 1000;
                const speedKbps = elapsedSec > 0 ? Math.round((totalBytesDownloaded / 1024) / elapsedSec) : 0;
                onProgress({
                    current: completed,
                    total: segments.length,
                    percentage: pct,
                    bytesDownloaded: totalBytesDownloaded,
                    speedKbps
                });
            }
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(concurrency, segments.length); i++) {
        workers.push(worker());
    }

    await Promise.all(workers);
    return results;
}

/**
 * Main Download, Decrypt & Merge function for HLS / M3U8 Streams
 */
export async function downloadHlsStream(m3u8Url, customFilename, onProgress) {
    if (!m3u8Url) throw new Error('M3U8 URL is required');

    // 1. Fetch main m3u8 playlist text
    const res = await fetch(m3u8Url);
    if (!res.ok) throw new Error(`Failed to load M3U8: HTTP ${res.status}`);
    const m3u8Content = await res.text();

    // 2. Parse segment metadata & encryption keys
    const segments = await parseM3U8(m3u8Content, m3u8Url);
    if (!segments || segments.length === 0) {
        throw new Error('No video segments found in M3U8 playlist');
    }

    const isEncrypted = segments.some(s => s.keyInfo && s.keyInfo.method === 'AES-128');
    if (isEncrypted) {
        console.log(`[HLS Downloader] Stream uses AES-128 encryption. Total segments: ${segments.length}`);
    }

    // 3. Concurrently fetch and decrypt all segments (with SW keep-alive port)
    let keepAlivePort = null;
    let segmentBuffers;
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.connect) {
            keepAlivePort = chrome.runtime.connect({ name: 'thanus_media_keepalive' });
        }
        segmentBuffers = await fetchSegmentsConcurrent(segments, 5, onProgress);
    } finally {
        if (keepAlivePort) {
            try { keepAlivePort.disconnect(); } catch (e) {}
        }
    }

    // 4. Merge all ArrayBuffers into a single Blob
    const totalBytes = segmentBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    if (totalBytes === 0) {
        throw new Error('All segments were empty or failed to download');
    }

    const mergedArray = new Uint8Array(totalBytes);
    let offset = 0;
    for (let i = 0; i < segmentBuffers.length; i++) {
        mergedArray.set(new Uint8Array(segmentBuffers[i]), offset);
        offset += segmentBuffers[i].byteLength;
    }

    // Use MPEG-2 Transport Stream MIME
    const videoBlob = new Blob([mergedArray], { type: 'video/mp2t' });
    const blobUrl = URL.createObjectURL(videoBlob);

    // 5. Generate appropriate filename
    let filename = customFilename || `hls_video_${Date.now()}.ts`;
    if (!filename.endsWith('.ts') && !filename.endsWith('.mp4')) {
        filename += '.ts';
    }

    // 6. Trigger Chrome native download
    return new Promise((resolve, reject) => {
        chrome.downloads.download({
            url: blobUrl,
            filename: filename,
            saveAs: true
        }, (downloadId) => {
            setTimeout(() => URL.revokeObjectURL(blobUrl), 180000);
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve({ downloadId, sizeBytes: totalBytes, filename, segmentsCount: segments.length });
            }
        });
    });
}
