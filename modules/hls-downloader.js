/**
 * modules/hls-downloader.js
 * Full HLS / M3U8 Playlist Parser, Multi-thread Segment Fetcher & Blob Merger
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
 * Parses an M3U8 file text to extract segment URLs
 */
async function parseM3U8(content, baseUrl) {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    // Check if master playlist containing variant streams
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
            const variantRes = await fetch(bestVariantUrl);
            const variantText = await variantRes.text();
            return parseM3U8(variantText, bestVariantUrl);
        }
    }

    // Parse media playlist segments
    const segments = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.startsWith('#')) {
            segments.push(resolveUrl(line, baseUrl));
        }
    }

    return segments;
}

/**
 * Downloads segments with controlled concurrency
 */
async function fetchSegmentsConcurrent(segmentUrls, concurrency = 4, onProgress) {
    const results = new Array(segmentUrls.length);
    let completed = 0;
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < segmentUrls.length) {
            const index = nextIndex++;
            const url = segmentUrls[index];
            
            let attempts = 0;
            let success = false;
            while (attempts < 3 && !success) {
                try {
                    attempts++;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    results[index] = await res.arrayBuffer();
                    success = true;
                } catch (e) {
                    if (attempts >= 3) {
                        console.warn(`[HLS] Failed to fetch segment ${index}: ${url}`, e);
                        // Allocate empty buffer on failure to keep stream flowing
                        results[index] = new ArrayBuffer(0);
                        success = true;
                    } else {
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            }

            completed++;
            if (typeof onProgress === 'function') {
                const pct = Math.floor((completed / segmentUrls.length) * 100);
                onProgress({ current: completed, total: segmentUrls.length, percentage: pct });
            }
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(concurrency, segmentUrls.length); i++) {
        workers.push(worker());
    }

    await Promise.all(workers);
    return results;
}

/**
 * Main Download & Merge function
 */
export async function downloadHlsStream(m3u8Url, customFilename, onProgress) {
    if (!m3u8Url) throw new Error('M3U8 URL is required');

    // 1. Fetch main m3u8 playlist
    const res = await fetch(m3u8Url);
    if (!res.ok) throw new Error(`Failed to load M3U8: HTTP ${res.status}`);
    const m3u8Content = await res.text();

    // 2. Parse segment URLs
    const segmentUrls = await parseM3U8(m3u8Content, m3u8Url);
    if (!segmentUrls || segmentUrls.length === 0) {
        throw new Error('No video segments found in M3U8 playlist');
    }

    // 3. Concurrently fetch all segments
    const segmentBuffers = await fetchSegmentsConcurrent(segmentUrls, 5, onProgress);

    // 4. Merge all ArrayBuffers into a single Blob
    const totalBytes = segmentBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const mergedArray = new Uint8Array(totalBytes);
    let offset = 0;
    for (let i = 0; i < segmentBuffers.length; i++) {
        mergedArray.set(new Uint8Array(segmentBuffers[i]), offset);
        offset += segmentBuffers[i].byteLength;
    }

    const videoBlob = new Blob([mergedArray], { type: 'video/mp2t' });
    const blobUrl = URL.createObjectURL(videoBlob);

    // 5. Generate filename
    let filename = customFilename || `stream_video_${Date.now()}.ts`;
    if (!filename.endsWith('.ts') && !filename.endsWith('.mp4')) {
        filename += '.ts';
    }

    // 6. Download to user's machine
    return new Promise((resolve, reject) => {
        chrome.downloads.download({
            url: blobUrl,
            filename: filename,
            saveAs: true
        }, (downloadId) => {
            setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve({ downloadId, sizeBytes: totalBytes, filename });
            }
        });
    });
}
