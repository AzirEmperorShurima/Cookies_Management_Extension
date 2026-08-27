import { elements, settings, notify, saveSettings, state, activeTab, showConfirm } from '../popup.js';
import { isRestrictedUrl, createElement } from './utils.js';
import { downloadHlsStream } from './hls-downloader.js';

const translations = window.translations;

export async function loadDetectedVideos() {
    const tab = activeTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (!tab) return;

    chrome.runtime.sendMessage({ type: 'getDetectedVideos', tabId: tab.id }, (response) => {
        renderVideoList(response?.videos || []);
    });
}

export function renderVideoList(videos) {
    const list = elements.videoList;
    if (!list) return;

    list.textContent = '';
    state.currentVideos = videos;

    if (videos.length === 0) {
        const lang = settings.language || 'vi';
        const dict = translations[lang] || translations.vi;
        list.appendChild(createElement('p', { className: 'empty-msg' }, dict.noVideos || 'Chưa phát hiện video nào trên trang này.'));
        return;
    }

    videos.forEach((video, index) => {
        const item = document.createElement('div');
        item.className = 'video-item';
        item.dataset.index = index;

        const preview = document.createElement('div');
        preview.className = 'video-item-preview';
        if (video.thumbnail) {
            const img = document.createElement('img');
            img.src = video.thumbnail;
            img.onerror = () => { preview.textContent = '🎥'; };
            preview.appendChild(img);
        } else {
            preview.textContent = video.url.includes('m3u8') ? '📡' : '🎥';
        }

        const info = document.createElement('div');
        info.className = 'video-item-info';

        const title = document.createElement('span');
        title.className = 'video-item-title';
        title.textContent = video.filename || `Video #${index + 1}`;
        title.title = video.url;

        const isStream = video.url.includes('m3u8') || video.url.includes('mpd') || video.url.startsWith('blob:');
        const details = document.createElement('small');
        details.className = 'video-item-details';
        details.textContent = `${video.type.toUpperCase()} • ${video.size || 'Detected'}${isStream ? ' (Stream)' : ''}`;

        info.appendChild(title);
        info.appendChild(details);

        const actions = document.createElement('div');
        actions.className = 'video-item-actions';

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'mini-btn video-download-btn';
        downloadBtn.textContent = isStream ? '📥 Tải Stream' : '📥 Tải về';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'mini-btn secondary video-copy-btn';
        copyBtn.textContent = '🔗 Link';

        actions.appendChild(downloadBtn);
        actions.appendChild(copyBtn);

        item.appendChild(preview);
        item.appendChild(info);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

export function renderTelegramMediaList(items, tabId) {
    const listContainer = elements.telegramMediaList;
    const itemsContainer = elements.telegramMediaItems;
    if (!itemsContainer) return;

    itemsContainer.textContent = '';
    state.currentTelegramItems = items;

    if (!items.length) {
        if (listContainer) listContainer.classList.add('hidden');
        return;
    }
    if (listContainer) listContainer.classList.remove('hidden');

    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'telegram-media-card';
        card.dataset.index = index;
        card.dataset.tabId = tabId;

        const preview = document.createElement('div');
        preview.className = 'media-card-preview';
        preview.style.position = 'relative';
        preview.style.overflow = 'hidden';

        if (item.thumbnail) {
            const img = document.createElement('img');
            img.src = item.thumbnail;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            img.onerror = () => { preview.textContent = item.type === 'video' ? '🎬' : '🖼️'; };
            preview.appendChild(img);
        } else {
            preview.textContent = item.type === 'video' ? '🎬' : '🖼️';
            preview.style.background = '#1a1a2e';
            preview.style.display = 'flex';
            preview.style.alignItems = 'center';
            preview.style.justifyContent = 'center';
            preview.style.fontSize = '2rem';
        }

        if (item.type === 'video') {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position:absolute; top:0; left:0; right:0; bottom:0;
                display:flex; align-items:center; justify-content:center;
                background:rgba(0,0,0,0.3);
            `;
            overlay.appendChild(createElement('span', { style: { fontSize: '1.6rem', color: '#fff', textShadow: '0 0 8px rgba(0,0,0,.9)' } }, '▶'));
            preview.appendChild(overlay);

            if (item.duration) {
                const dur = document.createElement('span');
                dur.style.cssText = 'position:absolute;bottom:4px;right:6px;font-size:0.7rem;color:#fff;background:rgba(0,0,0,.6);padding:1px 4px;border-radius:3px;';
                dur.textContent = item.duration;
                preview.appendChild(dur);
            }
        }

        const info = createElement('div', { className: 'media-card-info' },
            createElement('strong', { style: { fontSize: '0.8rem', wordBreak: 'break-all' } }, item.title || item.filename),
            createElement('br'),
            createElement('small', { style: { color: '#aaa' } }, 
                item.type.toUpperCase() + (item.size ? ` · ${(item.size / 1024 / 1024).toFixed(1)} MB` : '')
            )
        );
        if (item.needsPlay) {
            info.appendChild(createElement('br'));
            info.appendChild(createElement('small', { style: { color: '#ffb74d' } }, '⚠ Cần bấm phát trước'));
        }

        const actions = document.createElement('div');
        actions.className = 'media-card-actions';
        const btn = document.createElement('button');

        if (item.url || item.needsPlay) {
            btn.className = 'mini-btn telegram-download-btn';
            btn.textContent = '📥 Tải';
        } else {
            btn.className = 'mini-btn';
            btn.textContent = '❌ Không có URL';
            btn.disabled = true;
        }

        actions.appendChild(btn);
        card.append(preview, info, actions);
        itemsContainer.appendChild(card);
    });
}

function showTelegramMediaPreview(url, type) {
    renderTelegramMediaList([{
        type: type,
        url: url,
        title: 'Media trích xuất',
        thumb: type === 'image' ? url : null
    }]);
}

async function startTelegramDownload(item, tabId, btn) {
    const { url, filename, type, isBlob, isStream, needsPlay, dataMid } = item;

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tải...'; }

    const needsInternalFetch = isBlob || isStream || needsPlay || (url && url.includes('/stream/'));

    if (needsInternalFetch) {
        const videoId = 'tg_' + Date.now();
        _listenForDownloadResult(videoId, filename, btn);

        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['telegram_content.js']
            });
            await new Promise(r => setTimeout(r, 100));

            if (needsPlay) {
                await chrome.tabs.sendMessage(tabId, {
                    type: 'tg_play_and_download',
                    dataMid,
                    filename: filename || `telegram_video_${Date.now()}.mp4`,
                    videoId
                });
                notify('Đang mở video và chuẩn bị tải...', 'info');
            } else {
                await chrome.tabs.sendMessage(tabId, {
                    type: 'tg_download_stream',
                    url,
                    filename: filename || `telegram_video_${Date.now()}.mp4`,
                    videoId
                });
                notify('Đang tải video... Vui lòng chờ', 'info');
            }
        } catch (e) {
            if (btn) { btn.disabled = false; btn.textContent = '📥 Tải'; }
            notify('Lỗi: ' + e.message, 'error');
        }
    } else {
        const ext = type === 'video' ? 'mp4' : 'jpg';
        chrome.downloads.download({
            url,
            filename: filename || `telegram_media_${Date.now()}.${ext}`,
            saveAs: true
        }, () => {
            if (btn) { btn.disabled = false; btn.textContent = '📥 Tải'; }
            if (chrome.runtime.lastError) {
                notify('Lỗi: ' + chrome.runtime.lastError.message, 'error');
            } else {
                notify('Bắt đầu tải xuống!', 'success');
            }
        });
    }
}

function _listenForDownloadResult(videoId, filename, btn) {
    const handler = (msg) => {
        if (msg.videoId !== videoId) return;

        if (msg.type === 'telegramDownloadProgress') {
            const pct = msg.progress;
            notify(`⏳ Đang tải ${msg.filename || filename}: ${pct}%`, 'info');
            if (btn) btn.textContent = `⏳ ${pct}%`;
        }

        if (msg.type === 'telegramDownloadDone') {
            chrome.runtime.onMessage.removeListener(handler);
            if (btn) { btn.disabled = false; btn.textContent = '📥 Tải'; }

            if (msg.directDownloaded) {
                const sizeMB = msg.size ? (msg.size / 1024 / 1024).toFixed(1) : '?';
                notify(`✅ Tải xong: ${msg.filename || filename} (${sizeMB} MB)`, 'success');
                return;
            }

            if (!msg.blobDataUrl) {
                notify('Lỗi: không nhận được data.', 'error');
                return;
            }

            fetch(msg.blobDataUrl)
                .then(r => r.blob())
                .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    const dlFilename = msg.filename || filename;
                    chrome.downloads.download({
                        url: blobUrl,
                        filename: dlFilename,
                        saveAs: true
                    }, () => {
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                        if (chrome.runtime.lastError) {
                            notify('Lỗi lưu file: ' + chrome.runtime.lastError.message, 'error');
                        } else {
                            const sizeMB = msg.size ? (msg.size / 1024 / 1024).toFixed(1) + ' MB' : '';
                            notify(`✅ Tải xong: ${dlFilename} ${sizeMB}`, 'success');
                        }
                    });
                })
                .catch(e => notify('Lỗi tạo file: ' + e.message, 'error'));
        }

        if (msg.type === 'telegramDownloadError') {
            chrome.runtime.onMessage.removeListener(handler);
            if (btn) { btn.disabled = false; btn.textContent = '📥 Tải'; }
            notify(`❌ Lỗi tải: ${msg.error}`, 'error');
        }
    };

    chrome.runtime.onMessage.addListener(handler);

    setTimeout(() => {
        chrome.runtime.onMessage.removeListener(handler);
        if (btn?.textContent?.startsWith('⏳')) {
            btn.disabled = false;
            btn.textContent = '📥 Tải';
        }
    }, 5 * 60 * 1000);
}

export function init() {
    const {
        scanVideoBtn, videoList, videoDownloaderToggle, videoDownloaderBtn,
        pipToggle, togglePip, scanTelegramMediaBtn, telegramMediaItems,
        extractTelegramBtn, telegramUrlInput
    } = elements;

    if (scanVideoBtn) {
        scanVideoBtn.addEventListener('click', async () => {
            try {
                const tab = activeTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
                if (!tab) return;

                if (isRestrictedUrl(tab.url)) {
                    notify('Không thể quét video trên trang hệ thống trình duyệt.', 'warning');
                    return;
                }

                notify('Đang quét video trên trang...', 'success');

                chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    world: 'MAIN',
                    func: () => {
                        const videos = [];
                        document.querySelectorAll('video').forEach((v, i) => {
                            const src = v.src || v.currentSrc;
                            if (src) {
                                const isBlob = src.startsWith('blob:');
                                videos.push({
                                    url: src,
                                    type: isBlob ? 'Blob/HLS Stream' : 'HTML5 Video',
                                    filename: v.title || document.title || `Video #${i + 1}`,
                                    thumbnail: v.poster || '',
                                    isBlob: isBlob
                                });
                            }
                            v.querySelectorAll('source').forEach((s, si) => {
                                if (s.src) {
                                    videos.push({ url: s.src, type: 'Video Source', filename: `Video #${i + 1} Source #${si + 1}` });
                                }
                            });
                        });

                        if (window.jwplayer) {
                            try {
                                for (let i = 0; i < 10; i++) {
                                    const player = window.jwplayer(i);
                                    if (player && player.getPlaylist) {
                                        const playlist = player.getPlaylist();
                                        if (playlist && playlist[0] && playlist[0].sources) {
                                            playlist[0].sources.forEach((source, si) => {
                                                videos.push({
                                                    url: source.file,
                                                    type: source.type || 'JWPlayer Stream',
                                                    filename: `JWPlayer Video #${i + 1} (${source.label || si + 1})`
                                                });
                                            });
                                        }
                                    }
                                }
                            } catch {}
                        }

                        if (window.videojs) {
                            try {
                                Object.values(window.videojs.players).forEach((player, i) => {
                                    const src = player.src();
                                    if (src) {
                                        videos.push({ url: src, type: 'VideoJS Stream', filename: `VideoJS #${i + 1}` });
                                    }
                                });
                            } catch {}
                        }

                        const videoExts = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'm3u8', 'ts', 'mpd', 'm4s'];
                        document.querySelectorAll('a').forEach(a => {
                            if (a.href) {
                                try {
                                    const url = new URL(a.href);
                                    const path = url.pathname.toLowerCase();
                                    const ext = path.split('.').pop();
                                    if (videoExts.includes(ext)) {
                                        videos.push({ url: a.href, type: ext.toUpperCase(), filename: a.innerText.trim() || `Link ${ext}` });
                                    }
                                } catch {}
                            }
                        });

                        return videos;
                    }
                }, (results) => {
                    if (results && results.length > 0) {
                        let totalFound = 0;
                        results.forEach(frameResult => {
                            if (frameResult && frameResult.result) {
                                const pageVideos = frameResult.result;
                                if (pageVideos.length > 0) {
                                    totalFound += pageVideos.length;
                                    pageVideos.forEach(v => {
                                        chrome.runtime.sendMessage({
                                            type: 'newVideoDetected',
                                            tabId: tab.id,
                                            video: {
                                                ...v,
                                                frameId: frameResult.frameId,
                                                size: v.isBlob ? 'Streaming Data' : 'Scan detected',
                                                timestamp: Date.now()
                                            }
                                        });
                                    });
                                }
                            }
                        });

                        if (totalFound > 0) {
                            notify(`Phát hiện ${totalFound} video mới từ tất cả các khung hình!`, 'success');
                            setTimeout(loadDetectedVideos, 500);
                        } else {
                            notify('Không tìm thấy video nào. Hãy thử bật video chạy trước.', 'info');
                        }
                    }
                });
            } catch (e) {
                notify('Lỗi quét: ' + e.message, 'error');
            }
        });
    }

    if (videoList) {
        videoList.addEventListener('click', async (e) => {
            const itemEl = e.target.closest('.video-item');
            if (!itemEl) return;
            const index = parseInt(itemEl.dataset.index);
            const video = state.currentVideos[index];
            if (!video) return;

            const downloadBtn = e.target.closest('.video-download-btn');
            if (downloadBtn) {
                if (video.url.includes('.m3u8')) {
                    downloadBtn.disabled = true;
                    downloadBtn.textContent = '⏳ 0%';
                    notify('Đang phân tích và tải các phân đoạn stream HLS (Hỗ trợ AES-128)...', 'info');

                    const customFilename = video.filename.includes('.') ? video.filename : `${video.filename}.ts`;
                    const bufferMode = settings.hlsBufferMode || 'smart_ram_controller';
                    const maxRamMb = settings.hlsMaxRamMb || 256;

                    downloadHlsStream(video.url, customFilename, (progress) => {
                        const speedText = progress.speedKbps ? ` • ${progress.speedKbps > 1024 ? (progress.speedKbps / 1024).toFixed(1) + 'MB/s' : progress.speedKbps + 'KB/s'}` : '';
                        const ramText = progress.ramUsageMb !== undefined ? ` • RAM: ${progress.ramUsageMb}MB` : '';
                        const flushText = progress.flushCount > 0 ? ` (Disk: ${progress.flushCount}x)` : '';
                        downloadBtn.textContent = `⏳ ${progress.percentage}% (${progress.current}/${progress.total})${ramText}${flushText}`;
                    }, {
                        bufferMode: bufferMode,
                        maxRamMb: maxRamMb
                    }).then((res) => {
                        downloadBtn.disabled = false;
                        downloadBtn.textContent = '📥 Tải Stream';
                        const sizeMB = (res.sizeBytes / 1024 / 1024).toFixed(1);
                        const flushInfo = res.flushCount > 0 ? ` (Đã xả đệm ${res.flushCount} lần bảo vệ RAM & SSD)` : '';
                        notify(`✅ Đã giải mã & tải xong: ${res.filename} (${sizeMB} MB, ${res.segmentsCount || '?'} segments)${flushInfo}!`, 'success');
                    }).catch((err) => {
                        downloadBtn.disabled = false;
                        downloadBtn.textContent = '📥 Tải Stream';
                        notify(`Lỗi tải HLS: ${err.message}`, 'error');
                    });
                } else if (video.url.startsWith('blob:')) {
                    notify('Đang trích xuất dữ liệu...', 'info');
                    try {
                        const tab = activeTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
                        if (!tab) throw new Error('No active tab');

                        if (isRestrictedUrl(tab.url)) {
                            notify('Không thể truy cập blob từ trang hệ thống.', 'error');
                            return;
                        }

                        chrome.scripting.executeScript({
                            target: { tabId: tab.id, frameIds: [video.frameId || 0] },
                            func: async (blobUrl) => {
                                try {
                                    const response = await fetch(blobUrl);
                                    const blob = await response.blob();
                                    return new Promise((resolve) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => resolve(reader.result);
                                        reader.readAsDataURL(blob);
                                    });
                                } catch (e) {
                                    return { error: e.message };
                                }
                            },
                            args: [video.url]
                        }, (results) => {
                            if (results && results[0] && results[0].result) {
                                const dataUrl = results[0].result;
                                if (dataUrl.error) {
                                    notify('Lỗi trích xuất: ' + dataUrl.error, 'error');
                                } else {
                                    chrome.downloads.download({
                                        url: dataUrl,
                                        filename: video.filename.includes('.') ? video.filename : `${video.filename}.mp4`,
                                        saveAs: true
                                    });
                                    notify('Bắt đầu tải video!', 'success');
                                }
                            }
                        });
                    } catch (err) {
                        notify('Lỗi: ' + err.message, 'error');
                    }
                } else {
                    chrome.downloads.download({
                        url: video.url,
                        filename: video.filename,
                        saveAs: true
                    });
                    notify('Bắt đầu tải xuống!', 'success');
                }
                return;
            }

            const copyBtn = e.target.closest('.video-copy-btn');
            if (copyBtn) {
                navigator.clipboard.writeText(video.url);
                notify('Đã sao chép link video!', 'success');
                return;
            }
        });
    }

    if (videoDownloaderToggle) {
        videoDownloaderToggle.addEventListener('change', (e) => {
            settings.videoDownloaderEnabled = e.target.checked;
            saveSettings();
            if (videoDownloaderBtn) videoDownloaderBtn.classList.toggle('hidden', !settings.videoDownloaderEnabled);
            notify(`Video Downloader ${settings.videoDownloaderEnabled ? 'enabled' : 'disabled'}`, 'success');
            chrome.runtime.sendMessage({ type: 'toggleVideoDetection', enabled: settings.videoDownloaderEnabled });
        });
    }

    if (pipToggle) {
        pipToggle.addEventListener('change', (e) => {
            settings.pipEnabled = e.target.checked;
            saveSettings();
            if (togglePip) togglePip.classList.toggle('hidden', !settings.pipEnabled);
            notify(`Picture-in-Picture ${settings.pipEnabled ? 'enabled' : 'disabled'}`, 'success');
        });
    }

    if (scanTelegramMediaBtn) {
        scanTelegramMediaBtn.addEventListener('click', async () => {
            try {
                const tab = activeTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
                if (!tab) return;

                const isTelegram = ['web.telegram.org', 'webk.telegram.org', 'webz.telegram.org'].some(h => tab.url?.includes(h));

                if (!isTelegram) {
                    notify('Vui lòng mở Telegram Web trước!', 'warning');
                    if (await showConfirm('Mở web.telegram.org ngay bây giờ?')) {
                        chrome.tabs.create({ url: 'https://web.telegram.org/' });
                    }
                    return;
                }

                notify('Đang quét media...', 'info');

                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['telegram_content.js']
                    });
                } catch (e) {
                    notify('Lỗi inject script: ' + e.message, 'error');
                    return;
                }
                await new Promise(r => setTimeout(r, 100));

                let response;
                try {
                    response = await chrome.tabs.sendMessage(tab.id, { type: 'tg_scan' });
                } catch {
                    notify('Không thể kết nối script. Hãy thử lại.', 'error');
                    return;
                }

                const items = response?.items || [];
                renderTelegramMediaList(items, tab.id);

                const vCount = items.filter(i => i.type === 'video').length;
                const iCount = items.filter(i => i.type === 'image').length;
                const needsPlay = items.filter(i => i.needsPlay).length;

                if (items.length > 0) {
                    let msg = `Tìm thấy ${vCount} video, ${iCount} ảnh!`;
                    if (needsPlay > 0) msg += ` (${needsPlay} video cần bấm phát trước)`;
                    notify(msg, 'success');
                } else {
                    notify('Không tìm thấy media. Hãy mở chat có ảnh/video.', 'warning');
                }
            } catch (error) {
                notify('Lỗi: ' + error.message, 'error');
            }
        });
    }

    if (telegramMediaItems) {
        telegramMediaItems.addEventListener('click', (e) => {
            const downloadBtn = e.target.closest('.telegram-download-btn');
            if (!downloadBtn) return;

            const card = downloadBtn.closest('.telegram-media-card');
            if (!card) return;

            const index = parseInt(card.dataset.index);
            const tabId = parseInt(card.dataset.tabId);
            const item = state.currentTelegramItems[index];
            if (!item) return;

            startTelegramDownload(item, tabId, downloadBtn);
        });
    }

    if (extractTelegramBtn) {
        extractTelegramBtn.addEventListener('click', () => {
            if (!telegramUrlInput) return;
            const url = telegramUrlInput.value.trim();
            if (!url) {
                notify('Vui lòng nhập link Telegram', 'warning');
                return;
            }

            if (!url.includes('t.me/')) {
                notify('Link Telegram không hợp lệ', 'error');
                return;
            }

            notify('Đang phân tích link...', 'success');
            chrome.tabs.create({ url: url, active: true }, () => {
                notify('Đã mở link. Vui lòng nhấn "Quét Media" khi trang load xong.', 'info');
            });
        });
    }

    // Register simple listener to handle newVideoDetected messages
    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === 'newVideoDetected') {
            if (elements.videoDownloaderSection?.classList.contains('show')) {
                loadDetectedVideos();
            }
            notify('Phát hiện video mới có thể tải về!', 'info');
        }
    });

    loadDetectedVideos();
}
