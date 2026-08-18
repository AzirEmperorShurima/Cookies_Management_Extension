# 🧤 Thanus — Găng Tay Vô Cực Bảo Vệ Quyền Riêng Tư & Kiểm Soát Trình Duyệt

<div align="center">

[![Language: English](https://img.shields.io/badge/Language-English-blue.svg)](../README.md)
[![Language: Tiếng Việt](https://img.shields.io/badge/Language-Ti%E1%BA%BFng%20Vi%E1%BB%87t-red.svg)](README_VI.md)
[![Language: 简体中文](https://img.shields.io/badge/Language-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-yellow.svg)](README_ZH.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](../manifest.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](../LICENSE)

> *"Dread it. Run from it. Privacy still arrives."*

**[ English ](../README.md)** | **[ Tiếng Việt ](README_VI.md)** | **[ 简体中文 ](README_ZH.md)**

</div>

---

**Thanus** là một tiện ích mở rộng (WebExtension) toàn diện và mạnh mẽ bậc nhất dành cho các trình duyệt Chromium (Chrome, Edge, Brave, Opera, Cốc Cốc) và Firefox. Lấy cảm hứng từ sức mạnh tối thượng của chiếc găng tay vô cực (**Infinity Gauntlet**) và **6 viên đá vô cực**, Thanus mang lại quyền kiểm soát tuyệt đối cho người dùng: búng tay tiêu hủy dấu vết, bóp méo dấu vân tay theo dõi, chặn đứng quảng cáo và bảo vệ dữ liệu cá nhân toàn diện.

---

## 💎 6 Viên Đá Vô Cực (Hệ Thống Tính Năng)

```
                       ╔═══════════════════════════════╗
                       ║       THANUS GAUNTLET         ║
                       ╚═══════════════════════════════╝
                                      │
       ┌──────────────┬───────────────┼───────────────┬──────────────┬──────────────┐
       ▼              ▼               ▼               ▼              ▼              ▼
   🟣 POWER        🔵 SPACE       🔴 REALITY      🟠 SOUL        🟢 TIME        🟡 MIND
  (Hủy diệt)     (Cô lập)       (Bóp méo)       (Bảo mật)     (Kiểm soát)    (Tự động)
```

---

### 🟣 1. Power Stone (Viên Đá Sức Mạnh — Hủy Diệt & Dọn Sạch Dấu Vết)
- **⚡ The Snap (Panic Button `Alt+Shift+X`)**: Chỉ với 1 phím tắt, búng tay đóng ngay lập tức các tab nhạy cảm, xóa lịch sử ẩn, đóng cửa sổ hoặc chuyển hướng tức thì sang trang web an toàn.
- **🔥 Ephemeral Tab (Duyệt web tự hủy)**: Kích hoạt chế độ dùng 1 lần cho tab hiện tại. Khi đóng tab, toàn bộ Cookie, Cache, LocalStorage và dữ liệu trang web sẽ tự hủy sạch sẽ.
- **🧹 Auto-Cookie Destroyer**: Tự động dọn sạch Cookie của bên thứ 3 và các trang web khi đóng tab.
- **⚡ Element Zapper Mode**: Trỏ và xóa sổ vĩnh viễn các phần tử web, banner gây khó chịu. Đi kèm **Trình Quản Lý Zapped Elements** trực quan, tìm kiếm nhanh và xóa theo nhóm domain.

---

### 🔵 2. Space Stone (Viên Đá Không Gian — Cô Lập & Chuyển Dịch Đa Chiều)
- **📺 Privacy Player (PiP Isolated Player)**: Không gian phát video cô lập chống theo dõi. Xem video dưới dạng Picture-in-Picture không để lại lịch sử và tự động gỡ bỏ các rào cản nhúng frame.
- **📸 Cookie Snapshot & Profile Switcher**: Chuyển dịch không gian tài khoản trong nháy mắt. Lưu lại snapshot trạng thái cookie của website (VD: *"Work Profile"*, *"Personal Profile"*) và chuyển đổi giữa nhiều tài khoản mà không cần đăng xuất.
- **👥 Multi-Account Containers**: Tách biệt không gian lưu trữ cookie giữa các phiên làm việc độc lập.

---

### 🔴 3. Reality Stone (Viên Đá Thực Tại — Bóp Méo Dấu Vân Tay Anti-Fingerprinting)
- **🎭 Reality Bending Spoofing Engine**: Bóp méo toàn bộ dữ liệu nhận diện của trình duyệt đối với các hệ thống Fingerprinting & Bot Detector:
  - **Canvas & WebGL Spoofing**: Chèn nhiễu vi mô ngẫu nhiên theo Two-Tier Seed và giả lập GPU ANGLE Intel UHD.
  - **AudioContext Spoofing**: Làm sai lệch tần số Oscillator khiến mã băm âm thanh không thể bị theo dõi chéo.
  - **Navigator & Hardware Spoofing**: Giả lập số nhân CPU (4 Cores), dung lượng RAM (8GB), Ngôn ngữ (`en-US`).
  - **Timezone & Fake GPS Geolocation**: Đổi múi giờ và vị trí địa lý giả lập (US, UK, Japan) an toàn.
  - **Font Enumeration Shield**: Chặn các kỹ thuật quét danh sách Font chữ cài đặt trên hệ điều hành.
  - **Battery API Shield**: Giả lập trạng thái pin chuẩn (`navigator.getBattery()`) tránh rò rỉ thông số pin.
- **🔄 Client Hints & User-Agent Sync**: Đồng bộ hóa 100% giữa header mạng (`Sec-CH-UA`, `Sec-CH-UA-Platform`, `Sec-CH-UA-Mobile`) và API `navigator.userAgentData`.

---

### 🟠 4. Soul Stone (Viên Đá Linh Hồn — Thấu Suốt & Khóa Chặt Dữ Liệu)
- **🔍 Cookie Security Inspector**: Nhìn thấu bản chất và mức độ bảo mật của từng Cookie với hệ thống huy hiệu trực quan:
  - `🔒 Secure` (HTTPS) vs `⚠️ Insecure` (HTTP).
  - `🛡️ HttpOnly` (Chống XSS đánh cắp cookie) vs `JS Access`.
  - `🌐 SameSite: Strict / Lax / None` (Chống tấn công CSRF).
  - `🧩 CHIPS` (Partitioned state cô lập theo top-level domain).
- **🔐 Secure Vault (Mã Hóa AES-GCM)**: Két sắt bảo mật lưu trữ danh bạ liên kết, ghi chú nhạy cảm được mã hóa chuẩn quân đội phía client bằng Mật khẩu chủ (Master Password).

---

### 🟢 5. Time Stone (Viên Đá Thời Gian — Kiểm Soát Luồng & Bẻ Cong Thời Gian)
- **⏩ SponsorBlock Integration**: Tự động nhận diện và tua nhanh qua các phân đoạn quảng cáo, tài trợ (Sponsor, Self-promo, Intro dài, Outro, Like/Sub reminder) lồng ghép trong video YouTube & Privacy Player.
- **🎬 HLS / M3U8 Stream Merger**: Tải đa luồng (concurrent queue) toàn bộ các phân đoạn `.ts`/`.m4s` của video stream HLS kèm thanh tiến trình trực quan (`⏳ 45%`) và ghép nối thành file video hoàn chỉnh tải về máy.
- **🧘‍♀️ Zen Mode & Tab Hibernation**: Hẹn giờ tập trung làm việc (chặn mạng xã hội gây xao nhãng) và tự động đóng băng các tab không hoạt động để giải phóng RAM/CPU.

---

### 🟡 6. Mind Stone (Viên Đá Tâm Trí — Trí Tuệ Lọc & Tự Động Hóa)
- **🍪 Auto Cookie Consent Banner Dismiss**: Tự động nhận diện hơn 20 nền tảng Cookie CMP (OneTrust, CookieBot, Didomi, Quantcast, Complianz, Usercentrics,...), tự động bấm *"Từ chối tất cả / Reject All"* và mở khóa cuộn trang.
- **🛡️ Network Shield & DNR Adblock**: Chặn đứng quảng cáo, mã độc đào coin (cryptomining), clickjacking và hàng nghìn tracker theo quy tắc EasyList/EasyPrivacy.
- **📧 Disposable Temp Mail**: Tạo và nhận mã xác thực từ email ảo dùng 1 lần ngay trong extension để chống thư rác.
- **📥 Telegram & Media Sniffer**: Tự động phát hiện và trích xuất video, stream media trên các trang web và Telegram Web.

---

## 🚀 Hướng Dẫn Cài Đặt & Sử Dụng

1. Clone repository về máy:
   ```bash
   git clone https://github.com/AzirEmperorShurima/Cookies-ExtensionManagements.git
   ```
2. Mở trình duyệt Chrome / Edge / Brave / Cốc Cốc và truy cập `chrome://extensions/` (hoặc `edge://extensions/`).
3. Bật **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
4. Nhấn **Tải tiện ích đã giải nén (Load unpacked)** và chọn thư mục dự án này.
5. Ghim biểu tượng **Thanus** lên thanh công cụ trình duyệt và trải nghiệm!

---

## 🏗️ Cấu Trúc Dự Án

Chi tiết kiến trúc và luồng dữ liệu kỹ thuật có thể xem tại **[Tài liệu kiến trúc (VI)](architecture_VI.md)** | **[Architecture Documentation (EN)](architecture.md)** | **[架构设计文档 (ZH)](architecture_ZH.md)**.

---

<div align="center">
  <sub>Built with 💜 by DrakeDev & Justinan · Powered by The Infinity Gauntlet</sub>
</div>
