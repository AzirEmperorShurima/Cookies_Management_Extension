# 🧤 Thanus — 终极隐私保护与浏览器掌控手套

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

**Thanus** 是一款功能强大、全面的新一代浏览器扩展程序（WebExtension），适用于 Chromium 内核浏览器（Chrome、Edge、Brave、Opera、360 等）以及 Firefox。灵感源自灭霸的**无限手套（Infinity Gauntlet）**与 **6 颗无限原石**，Thanus 赋予用户对数字隐私的绝对掌控权：一键响指抹除痕迹、扭曲浏览器指纹、阻止恼人广告并深度保护敏感数据。

---

## 💎 6 大无限原石能力系统（功能体系）

```
                       ╔═══════════════════════════════╗
                       ║       THANUS GAUNTLET         ║
                       ╚═══════════════════════════════╝
                                      │
       ┌──────────────┬───────────────┼───────────────┬──────────────┬──────────────┐
       ▼              ▼               ▼               ▼              ▼              ▼
   🟣 力量之石        🔵 空间之石      🔴 现实之石      🟠 灵魂之石      🟢 时间之石      🟡 心灵之石
  (销毁与清理)      (隔离与多维)     (指纹防追踪)     (加密与检测)     (流媒体与跳过)   (自动化与拦截)
```

---

### 🟣 1. 力量之石（Power Stone — 毁灭与瞬间清除）
- **⚡ 灭霸响指（紧急键 `Alt+Shift+X`）**：按下单个快捷键，瞬间关闭所有敏感标签页、清除隐身历史、关闭窗口或秒级重定向至安全网页。
- **🔥 短暂标签页（阅后即焚模式）**：为当前标签页开启阅后即焚模式。标签页关闭时，其所有 Cookie、缓存、LocalStorage 及 IndexedDB 数据将被彻底粉碎。
- **🧹 Cookie 自动销毁器**：在标签页关闭的瞬间，自动清理第三方跟踪 Cookie 及指定网站 Cookie。
- **⚡ 元素灭霸模式（Element Zapper）**：即点即消，永久抹除网页上碍眼的浮窗与模块，附带支持域名分组与搜索的 **Zapper 规则管理器**。

---

### 🔵 2. 空间之石（Space Stone — 隔离与多维切换）
- **📺 隐私播放器（PiP 沙盒播放器）**：完全隔离的画中画视频播放空间。在不留下任何浏览历史的情况下观看视频，并自动剥离跨站追踪与内嵌限制。
- **📸 Cookie 快照与配置切换器（Profile Switcher）**：瞬间跨越账户空间。为网站保存 Cookie 快照（例如“工作账号”、“个人账号”），一键切换多账号，无需反复退出登录。
- **👥 多账号容器（Multi-Account Containers）**：在独立的会话空间中物理隔离 Cookie 存储。

---

### 🔴 3. 现实之石（Reality Stone — 扭曲指纹 Anti-Fingerprinting）
- **🎭 现实扭曲欺骗引擎（Reality-Bending Spoofing Engine）**：全面伪造并扭曲浏览器指纹，让追踪系统与 Bot 检测器彻底失效：
  - **Canvas 与 WebGL 伪造**：注入基于 Two-Tier Seed 的微量噪点，并将 GPU 渲染器伪装为 ANGLE Intel UHD。
  - **AudioContext 伪造**：微调音频振荡器频率，随机化音频指纹哈希。
  - **硬件与导航器伪装**：标准化 CPU 核心数（4核）、设备内存（8GB）及语言（`en-US`）。
  - **时区与虚假 GPS 定位**：安全伪造时区偏移与地理位置坐标（美国、英国、日本）。
  - **字体枚举防护（Font Enumeration Shield）**：拦截字体探测脚本对操作系统字体列表的扫描。
  - **电池 API 防护（Battery API Shield）**：返回标准化虚假电池状态（`navigator.getBattery()`）。
- **🔄 客户端提示与 UA 同步（Client Hints Sync）**：100% 同步网络请求头（`Sec-CH-UA`、`Sec-CH-UA-Platform`、`Sec-CH-UA-Mobile`）与 JS API `navigator.userAgentData`。

---

### 🟠 4. 灵魂之石（Soul Stone — 洞悉与数据金库）
- **🔍 Cookie 安全检测仪（Security Inspector）**：通过实时可视化标签看透每个 Cookie 的安全本质：
  - `🔒 Secure`（仅限 HTTPS）vs `⚠️ Insecure`（明文 HTTP）。
  - `🛡️ HttpOnly`（免疫 XSS 窃取）vs `JS Access`。
  - `🌐 SameSite: Strict / Lax / None`（CSRF 防御等级）。
  - `🧩 CHIPS`（独立分区状态）。
- **🔐 密码金库（AES-GCM 军级加密）**：在客户端通过主密码（Master Password）加密保护敏感书签与私密笔记。

---

### 🟢 5. 时间之石（Time Stone — 控制流与时间操纵）
- **⏩ SponsorBlock 片段自动跳过**：自动识别并跳过 YouTube 视频及隐私播放器中创作者植入的赞助广告、自我宣传、超长片头与求关注片段。
- **🎬 HLS / M3U8 视频流完整合并下载**：以并发多线程下载 `.ts`/`.m4s` 视频切片，实时展示进度百分比（`⏳ 45%`），并在本地无缝合并为完整的 `.mp4`/`.ts` 视频文件。
- **🧘‍♀️ 禅模式与标签页休眠**：定时专注工作（屏蔽分心社交媒体），自动冻结后台闲置标签页以大幅释放内存与 CPU。

---

### 🟡 6. 心灵之石（Mind Stone — 智能拦截与自动化）
- **🍪 Cookie 授权弹窗自动拒绝（Auto Cookie Consent Dismiss）**：自动识别全球 20 余种 CMP 框架（OneTrust、CookieBot、Didomi、Quantcast、Complianz、Usercentrics 等），自动点击“全部拒绝/仅必要”，并解除被冻结的网页滚动条。
- **🛡️ 网络防御与 DNR 广告拦截**：基于 EasyList/EasyPrivacy 规则，全面拦截广告、挖矿脚本（Cryptomining）、点击劫持及数千个追踪域名。
- **📧 临时邮箱（Temp Mail）**：直接在插件内生成一次性临时邮箱并接收验证码，远离垃圾邮件骚扰。
- **📥 媒体嗅探器（Media Sniffer）**：自动捕获并提取网页及 Telegram Web 上的视频流与媒体资源。

---

## 🚀 安装与使用指南

1. 克隆代码仓库：
   ```bash
   git clone https://github.com/AzirEmperorShurima/Cookies-ExtensionManagements.git
   ```
2. 打开 Chrome / Edge / Brave / Opera，进入扩展管理页面 `chrome://extensions/`（或 `edge://extensions/`）。
3. 开启右上角的 **开发者模式（Developer mode）**。
4. 点击 **加载已解压的扩展程序（Load unpacked）**，选择本项目文件夹。
5. 将 **Thanus** 图标固定至工具栏，即可立即体验！

---

## 🏗️ 架构与技术文档

详细的模块结构和数据流请参阅 **[架构设计文档 (ZH)](architecture_ZH.md)** | **[Architecture Documentation (EN)](architecture.md)** | **[Tài liệu kiến trúc (VI)](architecture_VI.md)**。

---

<div align="center">
  <sub>Built with 💜 by DrakeDev & Justinan · Powered by The Infinity Gauntlet</sub>
</div>
