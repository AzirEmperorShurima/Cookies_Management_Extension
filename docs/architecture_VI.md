# 🏗️ Thanus — Tài Liệu Kiến Trúc & Cấu Trúc Module

<div align="center">

**[ English ](architecture.md)** | **[ Tiếng Việt ](architecture_VI.md)** | **[ 简体中文 ](architecture_ZH.md)**

</div>

---

Tài liệu này mô tả chi tiết kiến trúc kỹ thuật, hệ thống các module và luồng xử lý dữ liệu của tiện ích mở rộng **Thanus**.

---

## 🏛️ Tổng Quan Kiến Trúc (Architecture Overview)

Thanus được xây dựng theo chuẩn **Chrome Extension Manifest V3** với hiệu năng cao, hoàn toàn không phụ thuộc vào thư viện bundle nặng nề, sử dụng ES6 modules, Background Service Worker bất đồng bộ, Declarative Net Request (DNR) và cơ chế tiêm Content Script ở cả 2 môi trường (`MAIN` và `ISOLATED` execution worlds).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MÔI TRƯỜNG TRÌNH DUYỆT                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐         ┌───────────────────────────────────┐  │
│  │   POPUP UI / DASHBOARD  │ ◄─IPC─► │    BACKGROUND SERVICE WORKER      │  │
│  │   (popup.html / JS)     │         │    (background.js + modules)      │  │
│  └────────────┬────────────┘         └─────────────────┬─────────────────┘  │
│               │                                        │                    │
│               │                               DNR Rules & Trạng thái Tab    │
│               ▼                                        ▼                    │
│  ┌─────────────────────────┐         ┌───────────────────────────────────┐  │
│  │   WEB PAGE (MAIN World) │ ◄─IPC─► │    CONTENT SCRIPT (Isolated World)│  │
│  │   (spoof-inject.js)     │         │    (spoof-bridge.js, consent, etc)│  │
│  └─────────────────────────┘         └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💎 Kiến Trúc 6 Nhóm Module Vô Cực

### 1. 🟣 Nhóm Sức Mạnh (Power Suite — Hủy Diệt & Dọn Dẹp)
- **`background/tab-manager.js`**: Xử lý phím tắt khẩn cấp (`Alt+Shift+X`), đóng nhanh các tab/cửa sổ và thực hiện tính năng **Ephemeral Tab tự hủy dữ liệu** ngay khi đóng tab.
- **`modules/zapper-content.js` & `modules/adblock.js`**: Giao diện chọn phần tử DOM trực quan và trình quản lý quy tắc ẩn phần tử theo domain.

### 2. 🔵 Nhóm Không Gian (Space Suite — Cô Lập & Chuyển Dịch)
- **`modules/player.js` & `videoDetector.js`**: Trình phát PiP cô lập trong sandbox, loại bỏ tracking header và không lưu lịch sử trình duyệt.
- **`modules/cookies.js` (Snapshot Profiles)**: Chụp lại toàn bộ cookie theo từng domain lưu vào `chrome.storage.local` và chuyển đổi profile mượt mà kèm tự động tải lại trang.

### 3. 🔴 Nhóm Thực Tại (Reality Suite — Chống Dấu Vân Tay Anti-Fingerprinting)
- **`modules/spoof-inject.js`** *(Chạy trong MAIN World)*:
  - Chèn micro-noise vào Canvas `toDataURL` và `measureText`.
  - Giả lập tần số âm thanh `AudioContext`.
  - Giả lập WebGL Vendor (`Google Inc.`) và Renderer (`ANGLE Intel UHD`).
  - Chặn quét Font chữ (`document.fonts.check`) và giả lập pin (`navigator.getBattery`).
  - Giả lập `navigator.userAgentData` với hàm `getHighEntropyValues()`.
- **`modules/spoof-bridge.js`** *(Chạy trong ISOLATED World)*:
  - Cầu nối eTLD+1 từ content script sang MAIN world qua `postMessage`.
  - Cơ chế tạo seed dự phòng (fallback seed) ngăn ngừa treo IPC.
- **`background/security-rules.js`**: Thay đổi các header mạng `Sec-CH-UA`, `Sec-CH-UA-Platform`, `Sec-CH-UA-Mobile`.

### 4. 🟠 Nhóm Linh Hồn (Soul Suite — Bảo Mật & Mã Hóa)
- **`modules/cookies.js` (Security Inspector)**: Đánh giá và hiển thị huy hiệu bảo mật: `🔒 Secure`, `🛡️ HttpOnly`, `🌐 SameSite`, `🧩 CHIPS`.
- **`modules/vault.js` & `background/session-vault.js`**: Két sắt mã hóa AES-GCM lưu trữ liên kết và ghi chú với mật khẩu chủ phía client.

### 5. 🟢 Nhóm Thời Gian (Time Suite — Tốc Độ & Luồng Media)
- **`modules/hls-downloader.js`**: Bóc tách playlist M3U8, tải đồng thời đa luồng (5 luồng) và ghép các phân đoạn thành file video `.ts`/`.mp4`.
- **`youtube_adblock.js`**: Lọc payload quảng cáo JSON + **Tích hợp SponsorBlock API** tự động nhảy qua đoạn tài trợ theo sự kiện `timeupdate`.

### 6. 🟡 Nhóm Tâm Trí (Mind Suite — Tự Động Hóa & Thông Minh)
- **`modules/cookie-consent-dismiss.js`**: Tự động nhận diện 20+ nền tảng Cookie CMP (OneTrust, Cookiebot, Didomi,...), tự động click "Từ chối" và mở khóa cuộn trang.
- **`modules/tempmail.js`**: Tích hợp email ảo dùng một lần.

---

## 💾 Cấu Trúc Dữ Liệu Lưu Trữ (`chrome.storage.local`)

| Khóa Lưu Trữ | Mô Tả |
|---|---|
| `appSettings` | Cài đặt chính (dark mode, sponsorBlockEnabled, autoDismissCookieConsent, mức độ bảo vệ) |
| `cookieSnapshots` | Danh sách snapshot cookie theo từng domain (`{ [domain]: [{ id, name, createdAt, cookies }] }`) |
| `userZappedCssRules` | Các CSS selector do người dùng zap để ẩn theo từng domain |
| `vaultData` & `vaultPassword` | Dữ liệu mã hóa AES-GCM và hash mật khẩu chủ |
| `installSeed` | Seed mật mã sinh ngẫu nhiên khi cài đặt extension để tạo noise fingerprint nhất quán |
| `adblockStats` & `stats_YYYY-MM-DD` | Số liệu thống kê quảng cáo và tracker đã chặn theo ngày |

---

<div align="center">
  <sub>Tài liệu kiến trúc chính thức của Thanus WebExtension · Manifest V3</sub>
</div>
