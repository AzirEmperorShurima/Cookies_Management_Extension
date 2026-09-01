# 🧤 Thanus — The Ultimate Privacy & Browser Power Gauntlet

<div align="center">

[![Language: English](https://img.shields.io/badge/Language-English-blue.svg)](README.md)
[![Language: Tiếng Việt](https://img.shields.io/badge/Language-Ti%E1%BA%BFng%20Vi%E1%BB%87t-red.svg)](docs/README_VI.md)
[![Language: 简体中文](https://img.shields.io/badge/Language-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-yellow.svg)](docs/README_ZH.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](manifest.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

> *"Dread it. Run from it. Privacy still arrives."*

**[ English ](README.md)** | **[ Tiếng Việt ](docs/README_VI.md)** | **[ 简体中文 ](docs/README_ZH.md)**

</div>

---

**Thanus** is a comprehensive, next-generation browser extension (WebExtension) for Chromium browsers (Chrome, Edge, Brave, Opera, Cốc Cốc) and Firefox. Inspired by the supreme power of the **Infinity Gauntlet** and the **6 Infinity Stones**, Thanus gives you absolute control over your digital footprint: snap away your tracks with one key, distort browser fingerprints, block intrusive ads, and lock down sensitive data.

---

## 💎 The 6 Infinity Power Suites

```
                       ╔═══════════════════════════════╗
                       ║       THANUS GAUNTLET         ║
                       ╚═══════════════════════════════╝
                                      │
       ┌──────────────┬───────────────┼───────────────┬──────────────┬──────────────┐
       ▼              ▼               ▼               ▼              ▼              ▼
   🟣 POWER        🔵 SPACE       🔴 REALITY      🟠 SOUL        🟢 TIME        🟡 MIND
  (Destruction)  (Isolation)     (Spoofing)      (Security)     (Control)     (Automation)
```

---

### 🟣 1. Power Stone (Destruction & Instant Purge)
- **⚡ The Snap (Panic Button `Alt+Shift+X`)**: With a single hotkey, snap away all sensitive tabs, wipe stealth history, close incognito windows, or instantly redirect to a safe URL.
- **🔥 Ephemeral Tab (Self-Destruct Browsing)**: Activate 1-time ephemeral mode on any tab. Once closed, all its Cookies, Cache, LocalStorage, and IndexedDB data are completely obliterated.
- **🧹 Auto-Cookie Destroyer**: Automatically cleans up third-party and tracking cookies the moment you close a tab.
- **⚡ Element Zapper Mode**: Point-and-click to permanently vaporize annoying webpage elements, paired with a visual **Zapper Rule Manager** featuring domain grouping and search.

---

### 🔵 2. Space Stone (Isolation & Multiverse Switching)
- **📺 Privacy Player (PiP Isolated Player)**: A fortified sandbox video player. Watch videos securely in Picture-in-Picture mode without leaving browsing history, stripping cross-site trackers and embedding restrictions.
- **📸 Cookie Snapshot & Profile Switcher**: Instant universe jumping. Save full cookie snapshots per website (e.g. *"Work Profile"*, *"Personal Profile"*) and switch between accounts in 1 click without logging out.
- **👥 Multi-Account Containers**: Isolate cookie storage states across independent work sessions.

---

### 🔴 3. Reality Stone (Anti-Fingerprinting & Reality Bending)
- **🎭 Reality-Bending Spoofing Engine**: Warps browser fingerprint telemetry to deceive advanced trackers and bot detectors:
  - **Canvas & WebGL Spoofing**: Injects non-destructive micro-noise via Two-Tier seeds and spoofs GPU renderer to ANGLE Intel UHD.
  - **AudioContext Spoofing**: Subtly shifts oscillator frequencies to randomize audio fingerprint hashes.
  - **Navigator & Hardware Spoofing**: Standardizes CPU cores (4), device memory (8GB), and language (`en-US`).
  - **Timezone & Fake GPS Geolocation**: Spoofs timezone offsets and GPS coordinates (US, UK, Japan).
  - **Font Enumeration Shield**: Thwarts font enumeration fingerprinting attempts.
  - **Battery API Shield**: Returns standardized dummy battery telemetry (`navigator.getBattery()`).
- **🔄 Client Hints & User-Agent Sync**: Perfectly synchronizes network request headers (`Sec-CH-UA`, `Sec-CH-UA-Platform`, `Sec-CH-UA-Mobile`) with `navigator.userAgentData`.

---

### 🟠 4. Soul Stone (Cookie Security & Data Vault)
- **🔍 Cookie Security Inspector**: Peer into the soul of every cookie with real-time visual security badges:
  - `🔒 Secure` (HTTPS Only) vs `⚠️ Insecure` (Plain HTTP).
  - `🛡️ HttpOnly` (Protected against XSS theft) vs `JS Access`.
  - `🌐 SameSite: Strict / Lax / None` (CSRF defense level).
  - `🧩 CHIPS` (Partitioned state per top-level site).
- **🔐 Secure Vault (AES-GCM Encryption)**: A client-side encrypted vault protecting your sensitive links and notes behind a Master Password.

---

### 🟢 5. Time Stone (Stream Control & Time Manipulation)
- **⏩ SponsorBlock Integration**: Automatically detects and skips sponsored segments, self-promos, long intros, and subscribe reminders in YouTube videos & Privacy Player.
- **🎬 HLS / M3U8 Stream Merger**: Concurrently downloads multi-thread `.ts`/`.m4s` stream chunks with live progress tracking (`⏳ 45%`) and merges them into a complete `.mp4`/`.ts` video file.
- **🧘‍♀️ Zen Mode & Tab Hibernation**: Focus timer that blocks distracting social media and hibernates inactive background tabs to liberate RAM and CPU.

---

### 🟡 6. Mind Stone (Automation & Network Intelligence)
- **🍪 Auto Cookie Consent Dismiss**: Automatically detects 20+ CMP frameworks (OneTrust, CookieBot, Didomi, Quantcast, Complianz, Usercentrics,...), clicks *"Reject All / Necessary Only"*, and unlocks frozen page scrolling.
- **🛡️ Network Shield & DNR Adblock**: Blocs intrusive ads, cryptominers, clickjacking, and thousands of tracking domains using EasyList/EasyPrivacy rules.
- **📧 Disposable Temp Mail**: Generates throwaway email addresses and receives verification codes directly inside the extension.
- **📥 Telegram & Media Sniffer**: Sniffs and extracts video streams and media from regular websites and Telegram Web.

---

## 🚀 Getting Started

1. Clone this repository:
   ```bash
   git clone https://github.com/AzirEmperorShurima/Cookies-ExtensionManagements.git
   ```
2. Open Chrome / Edge / Brave / Opera and navigate to `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the extension directory.
5. Pin **Thanus** to your toolbar and wield the power!

---

## 🏗️ Project Architecture

```
Cookies-ExtensionManagements/
├── background/                  # Service Worker & Background Handlers
│   ├── globals.js               # Single source of truth (Settings, Assets, Cache)
│   ├── init.js                  # Startup initializer & installSeed generator
│   ├── security-rules.js        # DNR rules, Client Hints sync, Clickjacking shield
│   ├── message-handler.js       # Central message dispatcher & domain resolvers
│   ├── tab-manager.js           # Tab lifecycle, Ephemeral tabs & Hibernation
│   ├── media-detector.js        # Video & Tracker sniffer listeners
│   ├── session-vault.js         # Panic, Vault encryption & Session manager
│   ├── network-logger.js        # Real-time network request logging
│   └── network-shield.js        # Proxy & network defense
├── modules/                     # Standalone Feature Modules
│   ├── cookies.js               # Cookie Manager, Security Inspector & Snapshot Switcher
│   ├── hls-downloader.js        # M3U8 playlist parser, multi-thread chunk merger
│   ├── cookie-consent-dismiss.js# Auto CMP Cookie Banner rejector & scroll unlocker
│   ├── spoof-inject.js          # MAIN world deep fingerprinting spoofer
│   ├── spoof-bridge.js          # ISOLATED world bridge with fallback seed
│   ├── adblock.js               # Adblock stats, filter updates & Zapper manager
│   ├── player.js                # Privacy Player & PiP engine
│   ├── vault.js                 # AES-GCM encrypted Vault UI
│   ├── downloader.js            # Video & Telegram media downloader UI
│   ├── tempmail.js              # Disposable email integration
│   ├── zapper-content.js        # Interactive DOM element picker
│   └── window-open-hook.js      # Safe popup/popunder blocker
├── youtube_adblock.js           # YouTube ad stripper & SponsorBlock auto-skip
├── videoDetector.js             # Media sniffer content script
├── popup.html / popup.js        # Main UI & dashboard
├── styles/popup.css             # Design system & component styling
└── manifest.json                # Manifest V3 configuration
```

For technical deep-dives, see **[Architecture Documentation (EN)](docs/architecture.md)** | **[Tài liệu kiến trúc (VI)](docs/architecture_VI.md)** | **[架构设计文档 (ZH)](docs/architecture_ZH.md)**.

---

## 📜 License & Privacy

- Open-source, private by design, and strictly zero telemetry collection.
- Contributions, issues, and feature requests are welcome!

---

<div align="center">
  <sub>Built with 💜 by DrakeDev & Justinan · Powered by The Infinity Gauntlet</sub>
</div>
