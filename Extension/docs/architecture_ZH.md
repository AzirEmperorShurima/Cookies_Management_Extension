# 🏗️ Thanus — 架构设计与模块文档

<div align="center">

**[ English ](architecture.md)** | **[ Tiếng Việt ](architecture_VI.md)** | **[ 简体中文 ](architecture_ZH.md)**

</div>

---

本文档详细阐述了 **Thanus**（浏览器隐私与控制手套）的技术架构、模块划分及核心数据流。

---

## 🏛️ 总体架构（Architecture Overview）

Thanus 基于现代 **Chrome Extension Manifest V3** 规范构建，具备极高的运行性能与零冗余依赖。整体架构采用 ES6 模块化系统、异步 Background Service Worker、声明式网络请求（DNR）以及跨环境的双执行域脚本注入（`MAIN` 与 `ISOLATED` execution worlds）。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                浏览器运行时环境                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐         ┌───────────────────────────────────┐  │
│  │   POPUP UI / 控制看板   │ ◄─IPC─► │    BACKGROUND SERVICE WORKER      │  │
│  │   (popup.html / JS)     │         │    (background.js + 模块集合)     │  │
│  └────────────┬────────────┘         └─────────────────┬─────────────────┘  │
│               │                                        │                    │
│               │                               DNR 规则 & 标签页状态管理      │
│               ▼                                        ▼                    │
│  ┌─────────────────────────┐         ┌───────────────────────────────────┐  │
│  │   网页主域 (MAIN World) │ ◄─IPC─► │    内容脚本 (ISOLATED World)      │  │
│  │   (spoof-inject.js)     │         │    (spoof-bridge.js, 弹窗拦截等)  │  │
│  └─────────────────────────┘         └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💎 6 大无限原石能力模块设计

### 1. 🟣 力量模块（Power Suite — 销毁与清除）
- **`background/tab-manager.js`**：响应紧急热键（`Alt+Shift+X`），实现标签页/窗口秒级关闭，并在标签页关闭时执行 **Ephemeral Tab 数据阅后即焚**。
- **`modules/zapper-content.js` 与 `modules/adblock.js`**：交互式 DOM 元素选择器与支持按域名分组的 Zapper 规则管理器。

### 2. 空间模块（Space Suite — 隔离与切换）
- **`modules/player.js` 与 `videoDetector.js`**：沙盒隔离的画中画视频播放器，自动剥离追踪头信息且不产生历史记录。
- **`modules/cookies.js` (Snapshot Profiles)**：将站点 Cookie 完整快照保存至 `chrome.storage.local`，支持一键热切换多账号并自动刷新标签页。

### 3. 🔴 现实模块（Reality Suite — 防指纹追踪 Anti-Fingerprinting）
- **`modules/spoof-inject.js`** *(运行于 MAIN World)*：
  - 向 Canvas `toDataURL` 和 `measureText` 注入确定性微噪点。
  - 动态偏移 `AudioContext` 振荡器频率。
  - 伪装 WebGL Vendor（`Google Inc.`）与 Renderer（`ANGLE Intel UHD`）。
  - 拦截系统字体探测（`document.fonts.check`）并伪装电池状态（`navigator.getBattery`）。
  - 深度代理 `navigator.userAgentData` 及 `getHighEntropyValues()`。
- **`modules/spoof-bridge.js`** *(运行于 ISOLATED World)*：
  - 通过 `postMessage` 向 MAIN world 安全桥接顶级域名 eTLD+1。
  - 具备 Fallback Seed 容错逻辑，杜绝 IPC 死锁。
- **`background/security-rules.js`**：在网络底层同步 `Sec-CH-UA`、`Sec-CH-UA-Platform`、`Sec-CH-UA-Mobile` 请求头。

### 4. 🟠 灵魂模块（Soul Suite — 安全与加密）
- **`modules/cookies.js` (Security Inspector)**：实时评估并渲染 Cookie 安全徽章：`🔒 Secure`、`🛡️ HttpOnly`、`🌐 SameSite`、`🧩 CHIPS`。
- **`modules/vault.js` 与 `background/session-vault.js`**：客户端 AES-GCM 高强度加密金库，使用主密码保护隐私链接与笔记。

### 5. 🟢 时间模块（Time Suite — 流媒体与时间操纵）
- **`modules/hls-downloader.js`**：解析 M3U8 播放列表，并发 5 线程高速下载 `.ts` 分片，无缝拼接为完整 `.mp4`/`.ts` 视频文件。
- **`youtube_adblock.js`**：JSON 广告数据剥离 + **SponsorBlock API 深度集成**，依据 `timeupdate` 事件毫秒级自动跳过创作者赞助片段。

### 6. 🟡 心灵模块（Mind Suite — 自动化与智能拦截）
- **`modules/cookie-consent-dismiss.js`**：自动识别全球 20 余种 CMP 授权弹窗（OneTrust、Cookiebot、Didomi 等），自动点击“全部拒绝/仅必要”，并解除页面滚动条锁定。
- **`modules/tempmail.js`**：内置临时一次性邮箱服务。

---

## 💾 存储数据结构规范 (`chrome.storage.local`)

| Storage Key | 描述 |
|---|---|
| `appSettings` | 核心全局配置（深色模式、SponsorBlock 开关、Cookie 弹窗自动拒绝、防护级别） |
| `cookieSnapshots` | 按域名分组的 Cookie 快照配置（`{ [domain]: [{ id, name, createdAt, cookies }] }`） |
| `userZappedCssRules` | 用户通过 Zapper 自定义消除的 CSS 规则 |
| `vaultData` & `vaultPassword` | AES-GCM 加密载荷及主密码哈希 |
| `installSeed` | 扩展安装时生成的独立密码学种子，用于保持指纹微噪点的一致性 |
| `adblockStats` & `stats_YYYY-MM-DD` | 拦截广告与跟踪器的每日实时统计数据 |

---

<div align="center">
  <sub>Thanus WebExtension 官方架构设计文档 · Manifest V3</sub>
</div>
