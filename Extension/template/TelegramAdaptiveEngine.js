(function () {
  "use strict";

  // ─── Static Constants ─────────────────────────────────────────────────────

  const DOWNLOAD_ICON    = "\ue977";
  const FORWARD_ICON     = "\ue995";
  const CONTENT_RANGE_RE = /^bytes (\d+)-(\d+)\/(\d+)$/;
  const REDIRECT_CODES   = new Set([301, 302, 307, 308]);
  const REFRESH_DELAY    = 500;
  const IS_K_APP         = location.pathname.startsWith("/k/");

  // ─── Adaptive Engine Config ───────────────────────────────────────────────
  // Tất cả thông số được tự động điều chỉnh trong quá trình tải.
  // Đây chỉ là giá trị khởi tạo.

  const ADAPTIVE = {
    // Số worker song song. Tự tăng/giảm theo tốc độ thực tế.
    parallelChunks: 4,
    parallelMin: 1,
    parallelMax: 8,

    // Kích thước mỗi chunk (bytes). Tự điều chỉnh theo điều kiện mạng.
    chunkSize: 1 * 1024 * 1024,   // 1 MB khởi đầu
    chunkSizeMin: 256 * 1024,      // 256 KB - khi mạng yếu / SW bận
    chunkSizeMax: 4 * 1024 * 1024, // 4 MB - khi mạng mạnh ổn định

    // Retry
    maxRetries: 5,
    retryDelayMs: 600,
    retryBackoffFactor: 1.8,       // delay nhân hệ số này sau mỗi lần thất bại

    // Timeout per chunk (ms). Tự điều chỉnh nếu hay bị timeout.
    chunkTimeoutMs: 30_000,
    chunkTimeoutMax: 90_000,

    // SW "no such download" cooldown: tạm dừng trước khi thử lại
    swCooldownMs: 1200,

    // Thống kê realtime để tự điều chỉnh
    _recentChunkMs: [],            // thời gian hoàn thành N chunk gần nhất
    _consecutiveErrors: 0,
    _consecutiveSuccess: 0,
  };

  // ─── Utils ─────────────────────────────────────────────────────────────────

  const isDarkMode = () =>
    document.documentElement.classList.contains("night") ||
    document.documentElement.classList.contains("theme-dark");

  const hashCode = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };

  const randomId = () =>
    (Math.random() + 1).toString(36).substring(2, 10) + "_" + Date.now();

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const logger = {
    info:  (msg, tag = null) => console.log(`[TelDL]${tag ? ` [${tag}]` : ""} ${msg}`),
    warn:  (msg, tag = null) => console.warn(`[TelDL]${tag ? ` [${tag}]` : ""} ${msg}`),
    error: (msg, tag = null) => console.error(`[TelDL]${tag ? ` [${tag}]` : ""} ${msg}`),
  };

  // ─── Adaptive Tuner ───────────────────────────────────────────────────────
  // Tự động điều chỉnh ADAPTIVE sau mỗi chunk dựa trên tình trạng thực tế.

  const tuner = {
    // Ghi nhận chunk thành công
    onSuccess(chunkMs) {
      ADAPTIVE._consecutiveErrors  = 0;
      ADAPTIVE._consecutiveSuccess = Math.min(ADAPTIVE._consecutiveSuccess + 1, 20);
      ADAPTIVE._recentChunkMs.push(chunkMs);
      if (ADAPTIVE._recentChunkMs.length > 8) ADAPTIVE._recentChunkMs.shift();
      this._tune();
    },

    // Ghi nhận lỗi (SW error, timeout, network)
    onError(isSwError = false) {
      ADAPTIVE._consecutiveErrors++;
      ADAPTIVE._consecutiveSuccess = 0;

      // Khi gặp lỗi SW: giảm chunk size ngay, chờ SW "hạ nhiệt"
      if (isSwError) {
        ADAPTIVE.chunkSize = clamp(
          Math.floor(ADAPTIVE.chunkSize * 0.5),
          ADAPTIVE.chunkSizeMin,
          ADAPTIVE.chunkSizeMax
        );
        ADAPTIVE.parallelChunks = clamp(ADAPTIVE.parallelChunks - 1, ADAPTIVE.parallelMin, ADAPTIVE.parallelMax);
        logger.warn(`SW error → chunkSize=${_fmtBytes(ADAPTIVE.chunkSize)}, parallel=${ADAPTIVE.parallelChunks}`);
        return;
      }

      // Lỗi thông thường liên tiếp: giảm dần
      if (ADAPTIVE._consecutiveErrors >= 2) {
        ADAPTIVE.parallelChunks = clamp(ADAPTIVE.parallelChunks - 1, ADAPTIVE.parallelMin, ADAPTIVE.parallelMax);
        ADAPTIVE.chunkTimeoutMs = clamp(ADAPTIVE.chunkTimeoutMs * 1.5, 0, ADAPTIVE.chunkTimeoutMax);
        logger.warn(`Errors=${ADAPTIVE._consecutiveErrors} → parallel=${ADAPTIVE.parallelChunks}, timeout=${ADAPTIVE.chunkTimeoutMs}ms`);
      }
    },

    // Tự điều chỉnh thông số dựa trên tốc độ gần nhất
    _tune() {
      const samples = ADAPTIVE._recentChunkMs;
      if (samples.length < 3) return;

      const avgMs = samples.reduce((a, b) => a + b, 0) / samples.length;
      const throughputMBs = ADAPTIVE.chunkSize / 1024 / 1024 / (avgMs / 1000);

      // Mạng nhanh: tăng dần chunk size và parallelism
      if (throughputMBs > 3 && ADAPTIVE._consecutiveSuccess >= 4) {
        ADAPTIVE.chunkSize = clamp(
          Math.floor(ADAPTIVE.chunkSize * 1.3),
          ADAPTIVE.chunkSizeMin,
          ADAPTIVE.chunkSizeMax
        );
        if (ADAPTIVE._consecutiveSuccess >= 6) {
          ADAPTIVE.parallelChunks = clamp(ADAPTIVE.parallelChunks + 1, ADAPTIVE.parallelMin, ADAPTIVE.parallelMax);
          ADAPTIVE._consecutiveSuccess = 0;
        }
        logger.info(`Fast (${throughputMBs.toFixed(1)} MB/s) → chunkSize=${_fmtBytes(ADAPTIVE.chunkSize)}, parallel=${ADAPTIVE.parallelChunks}`);
        return;
      }

      // Mạng chậm: giảm chunk để tránh timeout
      if (throughputMBs < 0.5 && ADAPTIVE._consecutiveSuccess >= 2) {
        ADAPTIVE.chunkSize = clamp(
          Math.floor(ADAPTIVE.chunkSize * 0.7),
          ADAPTIVE.chunkSizeMin,
          ADAPTIVE.chunkSizeMax
        );
        logger.info(`Slow (${throughputMBs.toFixed(1)} MB/s) → chunkSize=${_fmtBytes(ADAPTIVE.chunkSize)}`);
      }
    },
  };

  const _fmtBytes = (b) => b >= 1024 * 1024
    ? (b / 1024 / 1024).toFixed(1) + " MB"
    : (b / 1024).toFixed(0) + " KB";

  // ─── SW-aware URL resolution ──────────────────────────────────────────────
  // Telegram /k/ dùng Service Worker để serve stream URLs dạng /k/d/XXXXXXXX.
  // SW có thể trả lỗi "no such download" nếu SW chưa register stream đó.
  // Hàm này thử resolve URL thật qua HEAD với retry + cooldown đặc biệt.

  const SW_URL_RE = /\/k\/d\/\d+/;

  const isSwStreamUrl = (url) => SW_URL_RE.test(url);

  const resolveSwUrl = async (url, maxWaitMs = 8000) => {
    if (!isSwStreamUrl(url)) return url;

    const deadline = Date.now() + maxWaitMs;
    let delay = 300;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          cache: "no-store",
        });

        // SW lỗi thường trả 404 hoặc network error
        if (res.ok || res.status === 206) {
          logger.info(`SW stream ready: ${url}`);
          return res.url || url;
        }

        if (res.status === 404) {
          logger.warn(`SW not ready (404), retry in ${delay}ms…`);
        }
      } catch (e) {
        logger.warn(`SW HEAD failed: ${e.message}, retry in ${delay}ms…`);
      }

      await sleep(delay);
      delay = Math.min(delay * 1.5, 2000);
    }

    logger.warn("SW stream never became ready, proceeding anyway");
    return url;
  };

  // ─── Progress UI ───────────────────────────────────────────────────────────

  const setupProgressContainer = () => {
    const el = document.createElement("div");
    el.id = "tel-dl-progress-container";
    Object.assign(el.style, {
      position: "fixed", bottom: "0", right: "0",
      zIndex: IS_K_APP ? "4" : "1600",
    });
    document.body.appendChild(el);
  };

  const createProgressBar = (id, fileName) => {
    const container = document.getElementById("tel-dl-progress-container");
    const dark = isDarkMode();

    const wrap = document.createElement("div");
    wrap.id = `tel-dl-progress-${id}`;
    Object.assign(wrap.style, {
      width: "23rem", marginTop: "0.4rem", padding: "0.6rem",
      backgroundColor: dark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.65)",
      borderRadius: "6px", fontFamily: "monospace",
    });

    const header = document.createElement("div");
    Object.assign(header.style, { display: "flex", justifyContent: "space-between", marginBottom: "4px", gap: "6px" });

    const title = document.createElement("p");
    title.className = "tel-dl-filename";
    Object.assign(title.style, {
      margin: "0", color: "white", fontSize: "0.78rem",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1",
    });
    title.textContent = fileName;

    const meta = document.createElement("span");
    meta.className = "tel-dl-meta";
    Object.assign(meta.style, { color: "#aaa", fontSize: "0.72rem", whiteSpace: "nowrap" });

    const close = document.createElement("div");
    Object.assign(close.style, { cursor: "pointer", fontSize: "1.2rem", color: dark ? "#8a8a8a" : "white", lineHeight: "1" });
    close.innerHTML = "&times;";
    close.onclick = () => container.removeChild(wrap);

    const bar = document.createElement("div");
    Object.assign(bar.style, {
      position: "relative", width: "100%", height: "1.4rem",
      borderRadius: "2rem", overflow: "hidden", backgroundColor: "#333",
    });

    const label = document.createElement("p");
    Object.assign(label.style, {
      position: "absolute", zIndex: "5", left: "50%", top: "50%",
      transform: "translate(-50%, -50%)", margin: "0", color: "white", fontSize: "0.72rem",
    });

    const fill = document.createElement("div");
    Object.assign(fill.style, {
      position: "absolute", height: "100%", width: "0%",
      backgroundColor: "#6093B5", transition: "width 0.25s ease",
    });

    // Segunda linha: info adaptativa
    const infoLine = document.createElement("div");
    infoLine.className = "tel-dl-info";
    Object.assign(infoLine.style, {
      marginTop: "3px", fontSize: "0.68rem", color: "#888",
      display: "flex", justifyContent: "space-between",
    });

    bar.append(label, fill);
    header.append(title, meta, close);
    wrap.append(header, bar, infoLine);
    container.appendChild(wrap);
  };

  const getProgressEl = (id) => document.getElementById(`tel-dl-progress-${id}`);

  const updateProgress = (id, pct, speedStr, adaptiveInfo = "") => {
    const wrap = getProgressEl(id);
    if (!wrap) return;
    wrap.querySelector("div p").textContent        = pct + "%";
    wrap.querySelector("div div").style.width      = pct + "%";
    if (speedStr) wrap.querySelector(".tel-dl-meta").textContent = speedStr;
    if (adaptiveInfo) wrap.querySelector(".tel-dl-info").textContent = adaptiveInfo;
  };

  const finishProgress = (id, success, summary = "") => {
    const wrap = getProgressEl(id);
    if (!wrap) return;
    const fill  = wrap.querySelector("div div");
    const label = wrap.querySelector("div p");
    label.textContent           = success ? "✓ Done" : "✗ Failed";
    fill.style.width            = "100%";
    fill.style.backgroundColor  = success ? "#5aab61" : "#c0392b";
    fill.style.transition       = "none";
    wrap.querySelector(".tel-dl-meta").textContent = summary;
    wrap.querySelector(".tel-dl-info").textContent = "";
  };

  const setProgressStatus = (id, text) => {
    const wrap = getProgressEl(id);
    if (!wrap) return;
    wrap.querySelector(".tel-dl-info").textContent = text;
  };

  // ─── HEAD probe ───────────────────────────────────────────────────────────

  const probeFile = async (url) => {
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow", cache: "no-store" });
      const total      = parseInt(res.headers.get("Content-Length") || "0");
      const accepts    = res.headers.get("Accept-Ranges") === "bytes";
      if (total > 0 && accepts) {
        return {
          resolvedUrl: res.url || url,
          totalSize:   total,
          contentType: res.headers.get("Content-Type") || "",
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // ─── Single chunk fetch with timeout + SW-aware error classification ───────

  const fetchChunk = async (url, start, end, signal) => {
    const ctrl    = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), ADAPTIVE.chunkTimeoutMs);
    const linked  = signal?.addEventListener("abort", () => ctrl.abort());

    try {
      const t0  = Date.now();
      const res = await fetch(url, {
        method: "GET",
        headers: { Range: `bytes=${start}-${end}` },
        redirect: "follow",
        signal: ctrl.signal,
        cache: "no-store",
      });

      if (![200, 206].includes(res.status)) {
        const isSwErr = res.status === 404 && isSwStreamUrl(url);
        throw Object.assign(new Error(`HTTP ${res.status}`), { isSwError: isSwErr });
      }

      const buf    = await res.arrayBuffer();
      const ms     = Date.now() - t0;
      tuner.onSuccess(ms);
      return buf;
    } catch (e) {
      if (e.name === "AbortError" && signal?.aborted) throw e;

      // Classify: SW "no such download" → isSwError flag
      const isSwErr = e.isSwError || (e.message || "").includes("no such download");
      tuner.onError(isSwErr);

      if (isSwErr) {
        logger.warn(`SW error on chunk [${start}-${end}], cooling ${ADAPTIVE.swCooldownMs}ms`);
        await sleep(ADAPTIVE.swCooldownMs);
        // Escalating cooldown
        ADAPTIVE.swCooldownMs = Math.min(ADAPTIVE.swCooldownMs * 1.5, 8000);
      }

      throw Object.assign(e, { isSwError: isSwErr });
    } finally {
      clearTimeout(timeout);
      if (linked) signal?.removeEventListener("abort", linked);
    }
  };

  // ─── Chunk fetch with adaptive retry ──────────────────────────────────────

  const fetchChunkWithRetry = async (url, start, end, progressId, signal) => {
    let lastErr;
    let delay = ADAPTIVE.retryDelayMs;

    for (let attempt = 0; attempt < ADAPTIVE.maxRetries; attempt++) {
      try {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        return await fetchChunk(url, start, end, signal);
      } catch (e) {
        if (e.name === "AbortError") throw e;
        lastErr = e;

        const chunkInfo = `[${_fmtBytes(start)}–${_fmtBytes(end)}]`;
        logger.warn(`Chunk ${chunkInfo} attempt ${attempt + 1}/${ADAPTIVE.maxRetries}: ${e.message}`);

        if (progressId) {
          setProgressStatus(progressId,
            `Retry ${attempt + 1}/${ADAPTIVE.maxRetries} chunk ${chunkInfo} | ` +
            `parallel=${ADAPTIVE.parallelChunks} chunk=${_fmtBytes(ADAPTIVE.chunkSize)}`
          );
        }

        if (attempt < ADAPTIVE.maxRetries - 1) {
          await sleep(delay);
          delay = Math.floor(delay * ADAPTIVE.retryBackoffFactor);
        }
      }
    }
    throw lastErr;
  };

  // ─── Adaptive Parallel Download Engine ────────────────────────────────────

  const downloadAdaptive = async (initialUrl, fileName, mimeType, progressId) => {
    // Step 1: resolve SW URL nếu cần
    setProgressStatus(progressId, "Checking stream…");
    const resolvedInitial = await resolveSwUrl(initialUrl);

    // Step 2: HEAD probe để lấy total size và resolved URL
    const probe = await probeFile(resolvedInitial);

    if (!probe) {
      logger.info("Range not supported → sequential fallback", fileName);
      setProgressStatus(progressId, "Sequential mode (server doesn't support range)");
      return downloadSequential(resolvedInitial, fileName, mimeType, progressId);
    }

    let { resolvedUrl, totalSize, contentType } = probe;

    if (!fileName.includes(".")) {
      const mime = contentType.split(";")[0];
      if (mime.startsWith("video/"))      fileName += "." + mime.split("/")[1];
      else if (mime.startsWith("audio/")) fileName += "." + mime.split("/")[1];
    }

    logger.info(
      `Adaptive parallel: ${_fmtBytes(totalSize)} | ` +
      `init chunk=${_fmtBytes(ADAPTIVE.chunkSize)} | workers=${ADAPTIVE.parallelChunks}`,
      fileName
    );

    const totalChunksEst = Math.ceil(totalSize / ADAPTIVE.chunkSize);
    const buffers        = [];
    let   bytesLoaded    = 0;
    let   chunkIndex     = 0;
    const startTime      = Date.now();
    const abortCtrl      = new AbortController();

    // Queue-based worker: mỗi worker tự lấy chunk tiếp theo
    // chunk index là global, nhưng chunkSize có thể thay đổi giữa các chunk
    const chunkOffsets = [];
    let offsetCursor = 0;
    while (offsetCursor < totalSize) {
      const size  = ADAPTIVE.chunkSize; // snapshot tại thời điểm plan
      const start = offsetCursor;
      const end   = Math.min(start + size - 1, totalSize - 1);
      chunkOffsets.push({ start, end, index: chunkOffsets.length });
      offsetCursor = end + 1;
    }

    // Re-plan: nếu chunkSize thay đổi, rebuild dynamically
    // Dùng shared pointer thay vì pre-built list để hỗ trợ dynamic chunk size
    let nextStart = 0;
    let chunkSeq  = 0;

    const getNextChunk = () => {
      if (nextStart >= totalSize) return null;
      const idx   = chunkSeq++;
      const start = nextStart;
      const end   = Math.min(start + ADAPTIVE.chunkSize - 1, totalSize - 1);
      nextStart   = end + 1;
      return { idx, start, end };
    };

    // buffers indexed by chunk sequence
    const chunkBuffers = new Map();

    const worker = async () => {
      while (true) {
        const chunk = getNextChunk();
        if (!chunk) break;

        const buf = await fetchChunkWithRetry(
          resolvedUrl, chunk.start, chunk.end, progressId, abortCtrl.signal
        );

        chunkBuffers.set(chunk.idx, buf);
        bytesLoaded += buf.byteLength;

        const pct      = Math.min(((bytesLoaded / totalSize) * 100).toFixed(0), 99);
        const elapsed  = (Date.now() - startTime) / 1000;
        const speedMBs = (bytesLoaded / 1024 / 1024 / elapsed).toFixed(1);
        const eta      = elapsed / (bytesLoaded / totalSize) - elapsed;

        // Gửi thông số về Extension (Popup) để hiển thị trong Dashboard (Kiểm tra an toàn)
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({
            type: "tg_stats_update",
            stats: {
              parallelChunks: ADAPTIVE.parallelChunks,
              chunkSize: ADAPTIVE.chunkSize,
              retries: ADAPTIVE._consecutiveErrors,
              speed: `${speedMBs} MB/s`,
              progress: pct,
              eta: eta > 0 ? eta.toFixed(0) + "s" : "…"
            }
          }).catch(() => {});
        }

        updateProgress(
          progressId, pct,
          `${speedMBs} MB/s  ETA ${eta > 0 ? eta.toFixed(0) + "s" : "…"}`,
          `workers=${ADAPTIVE.parallelChunks}  chunk=${_fmtBytes(ADAPTIVE.chunkSize)}  retries=${ADAPTIVE._consecutiveErrors}`
        );
      }
    };

    try {
      // Dynamically adjustable workers: bắt đầu với parallelChunks hiện tại
      // Workers sẽ tự kết thúc khi hết chunk; không cần restart khi parallel thay đổi
      await Promise.all(
        Array.from({ length: ADAPTIVE.parallelChunks }, worker)
      );
    } catch (e) {
      abortCtrl.abort();
      finishProgress(progressId, false, e.message);
      logger.error("Adaptive download failed: " + e.message, fileName);
      return;
    }

    const elapsed  = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgSpeed = (totalSize / 1024 / 1024 / elapsed).toFixed(1);

    finishProgress(progressId, true, `${elapsed}s  avg ${avgSpeed} MB/s`);
    logger.info(`Done in ${elapsed}s @ ${avgSpeed} MB/s`, fileName);

    // Merge in order
    const sortedKeys = [...chunkBuffers.keys()].sort((a, b) => a - b);
    const merged     = new Uint8Array(totalSize);
    let   offset     = 0;
    for (const k of sortedKeys) {
      const buf = chunkBuffers.get(k);
      merged.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    triggerBlobDownload(merged, fileName, mimeType);
  };

  // ─── Sequential fallback ───────────────────────────────────────────────────

  const downloadSequential = async (url, fileName, mimeType, progressId) => {
    const blobs     = [];
    let offset      = 0;
    let total       = null;
    let current     = url;
    const startTime = Date.now();

    while (true) {
      let res;
      try {
        res = await fetch(current, {
          method: "GET",
          headers: { Range: `bytes=${offset}-` },
          redirect: "follow",
          cache: "no-store",
        });
      } catch (e) {
        // SW error in sequential mode: wait and retry from current offset
        const isSwErr = isSwStreamUrl(current);
        if (isSwErr) {
          logger.warn(`SW error in sequential, cooldown ${ADAPTIVE.swCooldownMs}ms`);
          setProgressStatus(progressId, `SW error, waiting ${(ADAPTIVE.swCooldownMs / 1000).toFixed(1)}s…`);
          await sleep(ADAPTIVE.swCooldownMs);
          ADAPTIVE.swCooldownMs = Math.min(ADAPTIVE.swCooldownMs * 1.5, 8000);
          continue;
        }
        throw e;
      }

      if (REDIRECT_CODES.has(res.status)) {
        const loc = res.headers.get("Location");
        if (loc) { current = loc; continue; }
      }

      if (![200, 206].includes(res.status)) {
        if (res.status === 404 && isSwStreamUrl(current)) {
          logger.warn(`SW 404 sequential, cooldown…`);
          await sleep(ADAPTIVE.swCooldownMs);
          ADAPTIVE.swCooldownMs = Math.min(ADAPTIVE.swCooldownMs * 1.5, 8000);
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      if (offset === 0) {
        const ct = (res.headers.get("Content-Type") || "").split(";")[0];
        if (ct === "text/html") throw new Error("Got HTML page");
        if (!fileName.includes(".")) {
          if (ct.startsWith("video/"))      fileName += "." + ct.split("/")[1];
          else if (ct.startsWith("audio/")) fileName += "." + ct.split("/")[1];
        }
      }

      const match = res.headers.get("Content-Range")?.match(CONTENT_RANGE_RE);
      const cLen  = parseInt(res.headers.get("Content-Length") || "0");
      const start = match ? parseInt(match[1]) : 0;
      const end   = match ? parseInt(match[2]) : cLen - 1;
      total       = match ? parseInt(match[3]) : cLen;

      if (start !== offset) throw new Error(`Gap: expected ${offset}, got ${start}`);

      blobs.push(await res.blob());
      offset = end + 1;

      const pct   = Math.min(((offset / total) * 100).toFixed(0), 99);
      const secs  = (Date.now() - startTime) / 1000;
      const speed = (offset / 1024 / 1024 / secs).toFixed(1);
      updateProgress(progressId, pct, `${speed} MB/s`, "Sequential mode");

      if (offset >= total) break;
    }

    finishProgress(progressId, true, `${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    triggerBlobDownload(new Blob(blobs), fileName, mimeType);
    logger.info("Sequential complete", fileName);
  };

  // ─── Blob Trigger ──────────────────────────────────────────────────────────

  const triggerBlobDownload = (data, fileName, mimeType) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: fileName });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logger.info("Triggered", fileName);
  };

  // ─── Public Download API ───────────────────────────────────────────────────

  const tel_download_video = (url) => {
    let fileName = hashCode(url) + ".mp4";
    try {
      const meta = JSON.parse(decodeURIComponent(url.split("/").pop()));
      if (meta.fileName) fileName = meta.fileName;
    } catch {}

    const id = randomId();
    createProgressBar(id, fileName);
    logger.info(`Video: ${url}`, fileName);
    downloadAdaptive(url, fileName, "video/mp4", id).catch((e) => {
      logger.error(e, fileName);
      finishProgress(id, false, e.message);
    });
  };

  const tel_download_audio = (url) => {
    const fileName = hashCode(url) + ".ogg";
    const id       = randomId();
    createProgressBar(id, fileName);
    logger.info(`Audio: ${url}`, fileName);
    downloadAdaptive(url, fileName, "audio/ogg", id).catch((e) => {
      logger.error(e, fileName);
      finishProgress(id, false, e.message);
    });
  };

  const tel_download_image = (url) => {
    const fileName = randomId() + ".jpeg";
    const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    logger.info("Image triggered", fileName);
  };

  // ─── Button Factory ────────────────────────────────────────────────────────

  const makeButton = ({ className, title, innerHTML, onClick }) => {
    const btn = document.createElement("button");
    btn.className = className;
    btn.type      = "button";
    btn.title     = title;
    btn.setAttribute("aria-label", title);
    btn.innerHTML = innerHTML;
    btn.onclick   = onClick;
    return btn;
  };

  // ─── Message Bridge ────────────────────────────────────────────────────────

  window.addEventListener("message", ({ data }) => {
    if (data?.type !== "TG_START_DOWNLOAD_MAIN") return;
    const { url, type, dataMid } = data;

    if (type === "video_mid" && dataMid) {
      const el = document.querySelector(`[data-mid="${dataMid}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        (el.querySelector(".video-time, .icon-play, .media-video-icon") || el).click();
        let attempts = 0;
        const poll = setInterval(() => {
          const vid = document.querySelector(".media-viewer-whole video, #MediaViewer video");
          if (vid?.src?.includes("/stream/")) { clearInterval(poll); tel_download_video(vid.src); }
          if (++attempts > 50) clearInterval(poll);
        }, 200);
      }, 1000);
    } else if (url) {
      tel_download_video(url);
    }
  });

  // ─── /a/ (webz) Handlers ──────────────────────────────────────────────────

  const handleWebzStories = () => {
    const stories = document.getElementById("StoryViewer");
    if (!stories || stories.querySelector(".tel-download")) return;
    const header = stories.querySelector(".GrsJNw3y") || stories.querySelector(".DropdownMenu")?.parentNode;
    if (!header) return;
    header.insertBefore(
      makeButton({
        className: "Button TkphaPyQ tiny translucent-white round tel-download",
        title: "Download",
        innerHTML: '<i class="icon icon-download"></i>',
        onClick: () => {
          const video = stories.querySelector("video");
          const src   = video?.currentSrc || video?.src || video?.querySelector("source")?.src;
          if (src) return tel_download_video(src);
          const img = [...stories.querySelectorAll("img.PVZ8TOWS")].pop();
          if (img?.src) tel_download_image(img.src);
        },
      }),
      header.querySelector("button")
    );
  };

  const handleWebzMediaViewer = () => {
    const slide   = document.querySelector("#MediaViewer .MediaViewerSlide--active");
    const actions = document.querySelector("#MediaViewer .MediaViewerActions");
    if (!slide || !actions) return;

    const videoPlayer = slide.querySelector(".MediaViewerContent > .VideoPlayer");
    const img         = slide.querySelector(".MediaViewerContent > div > img");

    const newIconBtn = (onClick) => {
      const btn = makeButton({
        className: "Button smaller translucent-white round tel-download",
        title: "Download", innerHTML: "", onClick,
      });
      btn.appendChild(Object.assign(document.createElement("i"), { className: "icon icon-download" }));
      return btn;
    };

    const syncActionBtn = (getUrl, handler) => {
      const existing     = actions.querySelector("button.tel-download");
      const hasNativeBtn = actions.querySelectorAll('button[title="Download"]').length > 1;
      if (hasNativeBtn) { existing?.remove(); return; }
      const currentUrl = getUrl();
      if (existing) {
        if (existing.dataset.url !== currentUrl) { existing.onclick = handler; existing.dataset.url = currentUrl; }
        return;
      }
      if (!actions.querySelector('button[title="Download"]')) {
        const btn = newIconBtn(handler);
        btn.dataset.url = currentUrl;
        actions.prepend(btn);
      }
    };

    if (videoPlayer) {
      const getUrl  = () => videoPlayer.querySelector("video")?.currentSrc;
      const handler = () => tel_download_video(getUrl());
      const controls = videoPlayer.querySelector(".VideoPlayerControls .buttons");
      if (controls && !controls.querySelector("button.tel-download"))
        controls.querySelector(".spacer")?.after(newIconBtn(handler));
      syncActionBtn(getUrl, handler);
    } else if (img?.src) {
      syncActionBtn(() => img.src, () => tel_download_image(img.src));
    }
  };

  // ─── /k/ (webk) Handlers ──────────────────────────────────────────────────

  const handleWebkPinnedAudio = () => {
    const pinned = document.querySelector(".pinned-audio");
    if (!pinned) return;
    const dataMid = pinned.getAttribute("data-mid");
    if (!dataMid) return;
    const existing = document.querySelector("._tel_dl_pinned");
    if (existing?.dataset.mid === dataMid) return;
    const audioEl = [...document.querySelectorAll("audio-element")].find(
      (el) => el.getAttribute("data-mid") === dataMid
    );
    const link = audioEl?.audio?.getAttribute("src");
    if (!link) return;
    const isAudio = audioEl.audio instanceof HTMLAudioElement;
    const btn = makeButton({
      className: "btn-icon tgico-download _tel_dl_pinned",
      title: "Download",
      innerHTML: `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`,
      onClick: (e) => { e.stopPropagation(); isAudio ? tel_download_audio(link) : tel_download_video(link); },
    });
    btn.dataset.mid = dataMid;
    existing?.remove();
    pinned.querySelector(".pinned-container-wrapper-utils")?.appendChild(btn);
  };

  const handleWebkStories = () => {
    const stories = document.getElementById("stories-viewer");
    if (!stories) return;
    const createBtn = () => makeButton({
      className: "btn-icon rp tel-download",
      title: "Download",
      innerHTML: `<span class="tgico">${DOWNLOAD_ICON}</span><div class="c-ripple"></div>`,
      onClick: () => {
        const video = stories.querySelector("video.media-video");
        const src   = video?.src || video?.currentSrc;
        if (src) return tel_download_video(src);
        const img = stories.querySelector("img.media-photo");
        if (img?.src) tel_download_image(img.src);
      },
    });
    const header = stories.querySelector("[class^='_ViewerStoryHeaderRight']");
    if (header && !header.querySelector(".tel-download")) header.prepend(createBtn());
    const footer = stories.querySelector("[class^='_ViewerStoryFooterRight']");
    if (footer && !footer.querySelector(".tel-download")) footer.prepend(createBtn());
  };

  const handleWebkMediaViewer = () => {
    const viewer   = document.querySelector(".media-viewer-whole");
    if (!viewer) return;
    const aspecter = viewer.querySelector(".media-viewer-movers .media-viewer-aspecter");
    const buttons  = viewer.querySelector(".media-viewer-topbar .media-viewer-buttons");
    if (!aspecter || !buttons) return;

    let onDownload = null;
    buttons.querySelectorAll("button.btn-icon.hide").forEach((btn) => {
      btn.classList.remove("hide");
      if (btn.textContent === FORWARD_ICON)  btn.classList.add("tgico-forward");
      if (btn.textContent === DOWNLOAD_ICON) { btn.classList.add("tgico-download"); onDownload = () => btn.click(); }
    });

    const makeWebkBtn = (handler) => makeButton({
      className: "btn-icon tgico-download tel-download",
      title: "Download",
      innerHTML: `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`,
      onClick: onDownload || handler,
    });

    if (aspecter.querySelector(".ckin__player")) {
      const controls = aspecter.querySelector(".default__controls.ckin__controls");
      if (controls && !controls.querySelector(".tel-download"))
        controls.querySelector(".bottom-controls .right-controls")?.prepend(
          makeWebkBtn(() => tel_download_video(aspecter.querySelector("video")?.src))
        );
    } else if (aspecter.querySelector("video")) {
      if (!buttons.querySelector("button.btn-icon.tgico-download"))
        buttons.prepend(makeWebkBtn(() => tel_download_video(aspecter.querySelector("video")?.src)));
    } else if (!buttons.querySelector("button.btn-icon.tgico-download")) {
      const thumb = aspecter.querySelector("img.thumbnail");
      if (thumb?.src) buttons.prepend(makeWebkBtn(() => tel_download_image(thumb.src)));
    }
  };

  // ─── Init ──────────────────────────────────────────────────────────────────

  setupProgressContainer();

  setInterval(() => {
    try { handleWebzStories(); }     catch (e) { logger.error(e); }
    try { handleWebzMediaViewer(); } catch (e) { logger.error(e); }
  }, REFRESH_DELAY);

  setInterval(() => {
    try { handleWebkPinnedAudio(); } catch (e) { logger.error(e); }
    try { handleWebkStories(); }     catch (e) { logger.error(e); }
    try { handleWebkMediaViewer(); } catch (e) { logger.error(e); }
  }, REFRESH_DELAY);

  logger.info("Ready (adaptive engine v4.0).");
})();