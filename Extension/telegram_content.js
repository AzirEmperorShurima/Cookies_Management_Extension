/**
 * telegram_content.js - v11
 * Sử dụng phương pháp tiêm Script từ URL của Extension để vượt qua CSP của Telegram.
 * File được tiêm là template/tel_download.js.
 */
(function () {
  if (window.__tgDownloaderContentScript) return;
  window.__tgDownloaderContentScript = true;

  const logger = {
    info: (message, fileName = null) => {
      console.log(`[Extension Bridge] ${fileName ? `${fileName}: ` : ""}${message}`);
    },
    error: (message, fileName = null) => {
      console.error(`[Extension Bridge] ${fileName ? `${fileName}: ` : ""}${message}`);
    },
  };

  /**
   * Tiêm file template/TelegramAdaptiveEngine.js vào Main World.
   * CSP của Telegram cho phép nạp script từ chrome-extension://.
   */
  function injectMainScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('template/TelegramAdaptiveEngine.js');
      
      script.onload = () => {
        logger.info("Main script injected successfully from Extension URL.");
        script.remove();
      };

      script.onerror = (err) => {
        logger.error("Failed to inject main script. CSP might still be blocking it.");
        console.error(err);
      };

      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      logger.error("Injection error: " + e.message);
    }
  }

  // Thực thi tiêm
  injectMainScript();

  function checkContextValidity() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      return false;
    }
    return true;
  }

  // BRIDGE: Xử lý tin nhắn từ Extension Popup gửi tới Content Script
  function messageListener(msg, sender, reply) {
    if (!checkContextValidity()) {
      try { chrome.runtime.onMessage.removeListener(messageListener); } catch (e) {}
      return;
    }
    if (msg.type === 'tg_download_stream') {
      // Gửi tiếp tin nhắn vào Main World để script tel_download.js xử lý
      window.postMessage({ type: 'TG_START_DOWNLOAD_MAIN', url: msg.url }, '*');
      reply({ started: true });
      return;
    }
    if (msg.type === 'tg_play_and_download') {
      window.postMessage({ type: 'TG_START_DOWNLOAD_MAIN', type: 'video_mid', dataMid: msg.dataMid, filename: msg.filename }, '*');
      reply({ started: true });
      return;
    }
    if (msg.type === 'tg_scan') {
      const items = [];
      const seen = new Set();

      // 1. Quét các video đã nạp URL (Stream)
      document.querySelectorAll('video').forEach((v, idx) => {
        const src = v.src || v.currentSrc;
        if (!src || src.startsWith('data:') || seen.has(src)) return;
        seen.add(src);

        let filename = `video_${idx}.mp4`;
        try {
          if (src.includes('/stream/')) {
            const parts = src.split('/');
            const meta = JSON.parse(decodeURIComponent(parts[parts.length - 1]));
            if (meta.fileName) filename = meta.fileName;
          }
        } catch (e) {}

        items.push({ 
          type: 'video', 
          url: src, 
          filename: filename, 
          isStream: true,
          thumbnail: v.poster || ''
        });
      });

      // 2. Quét các video chưa nạp (dựa trên data-mid)
      document.querySelectorAll('[data-mid]').forEach(el => {
        const mid = el.getAttribute('data-mid');
        if (!mid || seen.has('mid_' + mid)) return;

        // Chỉ lấy nếu có biểu tượng video hoặc thời lượng video
        const isVideo = el.querySelector('.video-time') || 
                        el.classList.contains('video-message') || 
                        el.querySelector('.tgico-play');
        
        if (isVideo) {
          seen.add('mid_' + mid);
          
          // Thử lấy tên file từ caption hoặc text xung quanh
          let filename = `video_${mid}.mp4`;
          const caption = el.querySelector('.caption, .message-text');
          if (caption && caption.innerText.trim()) {
            filename = caption.innerText.trim().substring(0, 30) + ".mp4";
          }

          items.push({ 
            type: 'video', 
            url: null, 
            dataMid: mid, 
            needsPlay: true, 
            filename: filename,
            title: filename
          });
        }
      });

      reply({ items });
      return;
    }
  }

  chrome.runtime.onMessage.addListener(messageListener);

  console.log('[TG Downloader] Content Script v11 (Injected Mode) ✓');
})();
