# 🏗️ Thanus Architecture & Module Documentation

<div align="center">

**[ English ](architecture.md)** | **[ Tiếng Việt ](architecture_VI.md)** | **[ 简体中文 ](architecture_ZH.md)**

</div>

---

This document outlines the architecture, module system, and data flow of **Thanus** (formerly Privacy & Cookies Manager).

---

## 🏛️ Overall Architecture

Thanus is engineered as a high-performance **Chrome Extension Manifest V3** with zero external runtime bundle dependencies, utilizing modular ES6 modules, an asynchronous background service worker, Declarative Net Request (DNR), and deep-level content script injection (`MAIN` & `ISOLATED` execution worlds).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER ENVIRONMENT                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐         ┌───────────────────────────────────┐  │
│  │   POPUP UI / DASHBOARD  │ ◄─IPC─► │    BACKGROUND SERVICE WORKER      │  │
│  │   (popup.html / JS)     │         │    (background.js + modules)      │  │
│  └────────────┬────────────┘         └─────────────────┬─────────────────┘  │
│               │                                        │                    │
│               │                               DNR Rules & Tab State         │
│               ▼                                        ▼                    │
│  ┌─────────────────────────┐         ┌───────────────────────────────────┐  │
│  │   WEB PAGE (MAIN World) │ ◄─IPC─► │    CONTENT SCRIPT (Isolated World)│  │
│  │   (spoof-inject.js)     │         │    (spoof-bridge.js, consent, etc)│  │
│  └─────────────────────────┘         └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💎 The 6 Power Modules Architecture

### 1. 🟣 Power Suite (Destruction & Purge)
- **`background/tab-manager.js`**: Listens for the panic keybinding (`Alt+Shift+X`), rapidly closes target windows/tabs, and implements **Ephemeral Tab auto-purge** upon tab closure.
- **`modules/zapper-content.js` & `modules/adblock.js`**: Interactive DOM picker and visual rule manager for hiding annoying page elements.

### 2. 🔵 Space Suite (Isolation & Switching)
- **`modules/player.js` & `videoDetector.js`**: PiP player with sandbox frame isolation, stripping tracking headers and preventing history storage.
- **`modules/cookies.js` (Snapshot Profiles)**: Captures complete cookie snapshots per domain into `chrome.storage.local` and seamlessly switches active profiles with tab reload.

### 3. 🔴 Reality Suite (Anti-Fingerprinting & Spoofing)
- **`modules/spoof-inject.js`** *(Runs in MAIN World)*:
  - Injects micro-noise to Canvas `toDataURL` and `measureText`.
  - Spoofs `AudioContext` oscillator frequencies.
  - Spoofs WebGL Vendor (`Google Inc.`) and Renderer (`ANGLE Intel UHD`).
  - Shields Font Enumeration (`document.fonts.check`) and Battery API (`navigator.getBattery`).
  - Spoofs `navigator.userAgentData` with `getHighEntropyValues()`.
- **`modules/spoof-bridge.js`** *(Runs in ISOLATED World)*:
  - Bridges top-level domain eTLD+1 to MAIN world via `postMessage`.
  - Fallback seed resilience to prevent infinite wait loops.
- **`background/security-rules.js`**: Modifies network request headers `Sec-CH-UA`, `Sec-CH-UA-Platform`, and `Sec-CH-UA-Mobile`.

### 4. 🟠 Soul Suite (Security & Encryption)
- **`modules/cookies.js` (Security Inspector)**: Renders real-time security badges: `🔒 Secure`, `🛡️ HttpOnly`, `🌐 SameSite`, `🧩 CHIPS`.
- **`modules/vault.js` & `background/session-vault.js`**: AES-GCM encrypted link and notes vault with client-side key derivation.

### 5. 🟢 Time Suite (Speed & Stream Control)
- **`modules/hls-downloader.js`**: Parses M3U8 Master/Media playlists, executes concurrent 5-thread segment chunk downloads, and merges ArrayBuffers into `.ts`/`.mp4` video files.
- **`youtube_adblock.js`**: JSON ad payload stripper + **SponsorBlock API integration** with automatic `timeupdate` fast-forwarding.

### 6. 🟡 Mind Suite (Automation & Intelligence)
- **`modules/cookie-consent-dismiss.js`**: Auto-detects 20+ CMP frameworks (OneTrust, Cookiebot, Didomi, etc.), clicks "Reject All / Necessary Only", hides banners, and unlocks page scrolling.
- **`modules/tempmail.js`**: Disposable email integration.

---

## 💾 Storage Schema (`chrome.storage.local`)

| Storage Key | Description |
|---|---|
| `appSettings` | Core preferences (dark mode, sponsorBlockEnabled, autoDismissCookieConsent, protection level) |
| `cookieSnapshots` | Domain-grouped cookie profile snapshots (`{ [domain]: [{ id, name, createdAt, cookies }] }`) |
| `userZappedCssRules` | Custom user-defined CSS selectors to hide per domain |
| `vaultData` & `vaultPassword` | AES-GCM encrypted payload and master password hash |
| `installSeed` | Unique installation cryptographic seed for deterministic fingerprint noise |
| `adblockStats` & `stats_YYYY-MM-DD` | Real-time analytics of blocked ads and trackers |

---

<div align="center">
  <sub>Document maintained for Thanus WebExtension · Manifest V3</sub>
</div>
