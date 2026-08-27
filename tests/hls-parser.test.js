const assert = require('assert');

// Simple M3U8 parser logic mirroring modules/hls-downloader.js
function resolveUrl(relativeUrl, baseUrl) {
    try {
        return new URL(relativeUrl, baseUrl).href;
    } catch (e) {
        return relativeUrl;
    }
}

function parseHexIV(hexString) {
    if (!hexString) return null;
    const cleanHex = hexString.replace(/^0x/i, '').padStart(32, '0');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16) || 0;
    }
    return bytes;
}

function parseM3U8Segments(content, baseUrl) {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const segments = [];
    let currentKeyInfo = null;
    let seqNumber = 0;
    let initSegmentUrl = null;
    let pendingByteRange = null;
    let lastByteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
            const seqMatch = line.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
            if (seqMatch) seqNumber = parseInt(seqMatch[1], 10);
            continue;
        }

        if (line.startsWith('#EXT-X-MAP:')) {
            const uriMatch = line.match(/URI="([^"]+)"/) || line.match(/URI=([^,\s]+)/);
            if (uriMatch) initSegmentUrl = resolveUrl(uriMatch[1], baseUrl);
            continue;
        }

        if (line.startsWith('#EXT-X-BYTERANGE:')) {
            const rangeStr = line.replace('#EXT-X-BYTERANGE:', '').trim();
            const [lengthStr, offsetStr] = rangeStr.split('@');
            const length = parseInt(lengthStr, 10);
            const offset = offsetStr !== undefined ? parseInt(offsetStr, 10) : lastByteOffset;
            lastByteOffset = offset + length;
            pendingByteRange = { offset, length };
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
                keyInfo: currentKeyInfo ? { ...currentKeyInfo } : null,
                byteRange: pendingByteRange ? { ...pendingByteRange } : null
            });
            pendingByteRange = null;
        }
    }

    if (initSegmentUrl) {
        segments.unshift({
            url: initSegmentUrl,
            seq: -1,
            isInitSegment: true,
            keyInfo: null,
            byteRange: null
        });
    }

    return segments;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

console.log('Testing HLS/M3U8 Parser...');

// Test 1: Standard AES-128 Stream
const sampleM3U8 = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:100
#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/key.bin",IV=0x1234567890abcdef1234567890abcdef
#EXTINF:10.0,
segment_100.ts
#EXTINF:10.0,
https://cdn.example.com/segment_101.ts
#EXT-X-KEY:METHOD=NONE
#EXTINF:10.0,
segment_102.ts
#EXT-X-ENDLIST
`;

const baseUrl = 'https://example.com/stream/playlist.m3u8';
const segments = parseM3U8Segments(sampleM3U8, baseUrl);

assert.strictEqual(segments.length, 3, 'Should extract exactly 3 segments');
assert.strictEqual(segments[0].url, 'https://example.com/stream/segment_100.ts');
assert.strictEqual(segments[0].seq, 100);
assert.strictEqual(segments[0].keyInfo.method, 'AES-128');
assert.strictEqual(segments[0].keyInfo.keyUrl, 'https://example.com/key.bin');
assert(segments[0].keyInfo.iv instanceof Uint8Array, 'IV must be a Uint8Array');
assert.strictEqual(segments[0].keyInfo.iv.length, 16, 'IV must be 16 bytes');

// Test 2: fMP4 Stream with EXT-X-MAP and EXT-X-BYTERANGE
const sampleFmp4M3U8 = `
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-MAP:URI="init.mp4"
#EXT-X-BYTERANGE:500000@0
#EXTINF:6.0,
main.mp4
#EXT-X-BYTERANGE:520000@500000
#EXTINF:6.0,
main.mp4
#EXT-X-ENDLIST
`;

const fmp4Segments = parseM3U8Segments(sampleFmp4M3U8, baseUrl);
assert.strictEqual(fmp4Segments.length, 3, 'Should have init segment + 2 media chunks');
assert.strictEqual(fmp4Segments[0].isInitSegment, true, 'First segment must be init segment');
assert.strictEqual(fmp4Segments[0].url, 'https://example.com/stream/init.mp4');
assert.deepStrictEqual(fmp4Segments[1].byteRange, { offset: 0, length: 500000 });
assert.deepStrictEqual(fmp4Segments[2].byteRange, { offset: 500000, length: 520000 });

console.log('✅ All HLS Parser Tests (AES-128, fMP4 EXT-X-MAP, ByteRange) Passed Successfully!');

// Segment 2 (Absolute URL & Encrypted)
assert.strictEqual(segments[1].url, 'https://cdn.example.com/segment_101.ts');
assert.strictEqual(segments[1].seq, 101);
assert.strictEqual(segments[1].keyInfo.method, 'AES-128');

// Segment 3 (Unencrypted after METHOD=NONE)
assert.strictEqual(segments[2].url, 'https://example.com/stream/segment_102.ts');
assert.strictEqual(segments[2].seq, 102);
assert.strictEqual(segments[2].keyInfo, null, 'Key info must be null after METHOD=NONE');

console.log('✅ All HLS Parser Tests Passed Successfully!');
