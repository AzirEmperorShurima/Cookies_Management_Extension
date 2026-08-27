/**
 * Thanus Floating Vertical Tab Bar (On-Page Injected Shadow DOM Sidebar)
 * Runs directly on any web page without opening Popup or Side Panel.
 * Includes Full Session Workspace Manager (Save & Restore).
 */

(function () {
    // Avoid double injection
    if (window.__THANUS_FLOATING_TAB_BAR_INJECTED__) return;
    window.__THANUS_FLOATING_TAB_BAR_INJECTED__ = true;

    // Do not inject inside sub-iframes or non-HTML documents
    if (window.self !== window.top || !(document instanceof HTMLDocument)) return;

    // ==========================================
    // EMBEDDED CSS SYSTEM (100% Isolated & Self-Contained)
    // ==========================================
    const EMBEDDED_CSS = `
    :host {
        all: initial !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        color: #f1f5f9 !important;
        box-sizing: border-box !important;
        pointer-events: none !important;
    }

    *, *::before, *::after {
        box-sizing: inherit !important;
        margin: 0 !important;
        padding: 0 !important;
    }

    /* Dock Trigger Handle */
    .thanus-dock-trigger {
        position: fixed !important;
        z-index: 2147483645 !important;
        width: 38px !important;
        height: 64px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 4px !important;
        background: rgba(15, 23, 42, 0.88) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border: 1px solid rgba(0, 242, 254, 0.4) !important;
        color: #00f2fe !important;
        cursor: pointer !important;
        user-select: none !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45), 0 0 12px rgba(0, 242, 254, 0.25) !important;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease !important;
        pointer-events: auto !important;
    }

    .thanus-dock-trigger.dock-left {
        left: 0 !important;
        border-radius: 0 12px 12px 0 !important;
        border-left: none !important;
    }

    .thanus-dock-trigger.dock-right {
        right: 0 !important;
        border-radius: 12px 0 0 12px !important;
        border-right: none !important;
    }

    .thanus-dock-trigger:hover {
        background: rgba(15, 23, 42, 0.96) !important;
        border-color: #00f2fe !important;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.55), 0 0 18px rgba(0, 242, 254, 0.45) !important;
    }

    .thanus-dock-trigger.dock-left:hover { transform: translateX(3px) scale(1.05) !important; }
    .thanus-dock-trigger.dock-right:hover { transform: translateX(-3px) scale(1.05) !important; }

    .thanus-dock-icon { font-size: 16px !important; line-height: 1 !important; }
    .thanus-dock-count {
        font-size: 10px !important;
        font-weight: 700 !important;
        background: linear-gradient(135deg, #00f2fe, #4facfe) !important;
        color: #0b1120 !important;
        padding: 1px 5px !important;
        border-radius: 10px !important;
        line-height: 1.1 !important;
        min-width: 16px !important;
        text-align: center !important;
    }

    .thanus-dock-audio-indicator {
        font-size: 10px !important;
        animation: thanus-pulse-audio 1.4s infinite ease-in-out !important;
    }

    @keyframes thanus-pulse-audio {
        0% { transform: scale(0.9); opacity: 0.7; }
        50% { transform: scale(1.25); opacity: 1; }
        100% { transform: scale(0.9); opacity: 0.7; }
    }

    /* Floating Sidebar Panel */
    .thanus-sidebar-panel {
        position: fixed !important;
        top: 0 !important;
        bottom: 0 !important;
        z-index: 2147483646 !important;
        width: var(--sidebar-width, 340px) !important;
        max-width: 90vw !important;
        min-width: 260px !important;
        height: 100vh !important;
        display: flex !important;
        flex-direction: column !important;
        background: rgba(11, 17, 32, var(--sidebar-opacity, 0.92)) !important;
        backdrop-filter: blur(var(--sidebar-blur, 16px)) !important;
        -webkit-backdrop-filter: blur(var(--sidebar-blur, 16px)) !important;
        box-shadow: 0 0 35px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 242, 254, 0.15) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease !important;
        overflow: hidden !important;
        pointer-events: auto !important;
    }

    .thanus-sidebar-panel.dock-left {
        left: 0 !important;
        border-left: none !important;
        border-top-right-radius: 16px !important;
        border-bottom-right-radius: 16px !important;
        transform: translateX(-105%) !important;
    }

    .thanus-sidebar-panel.dock-right {
        right: 0 !important;
        border-right: none !important;
        border-top-left-radius: 16px !important;
        border-bottom-left-radius: 16px !important;
        transform: translateX(105%) !important;
    }

    .thanus-sidebar-panel.expanded {
        transform: translateX(0) !important;
    }

    /* Resizer Edge */
    .thanus-sidebar-resizer {
        position: absolute !important;
        top: 0 !important;
        bottom: 0 !important;
        width: 6px !important;
        cursor: ew-resize !important;
        z-index: 10 !important;
        transition: background 0.2s ease !important;
    }

    .thanus-sidebar-panel.dock-left .thanus-sidebar-resizer { right: 0 !important; }
    .thanus-sidebar-panel.dock-right .thanus-sidebar-resizer { left: 0 !important; }

    .thanus-sidebar-resizer:hover,
    .thanus-sidebar-resizer.resizing {
        background: rgba(0, 242, 254, 0.5) !important;
        box-shadow: 0 0 10px rgba(0, 242, 254, 0.8) !important;
    }

    /* Header */
    .thanus-header {
        padding: 12px 14px !important;
        background: rgba(255, 255, 255, 0.03) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
        flex-shrink: 0 !important;
    }

    .thanus-header-top {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
    }

    .thanus-header-title {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        background: linear-gradient(135deg, #00f2fe, #4facfe) !important;
        background-clip: text !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        letter-spacing: 0.3px !important;
    }

    .thanus-header-controls {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
    }

    .thanus-icon-btn {
        background: transparent !important;
        border: none !important;
        color: #94a3b8 !important;
        cursor: pointer !important;
        padding: 5px 7px !important;
        border-radius: 6px !important;
        font-size: 13px !important;
        line-height: 1 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.15s ease !important;
    }

    .thanus-icon-btn:hover { background: rgba(255, 255, 255, 0.1) !important; color: #ffffff !important; }
    .thanus-icon-btn.active { background: rgba(0, 242, 254, 0.2) !important; color: #00f2fe !important; }

    /* Search Bar */
    .thanus-search-box {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 6px 10px !important;
        border-radius: 8px !important;
        background: rgba(0, 0, 0, 0.35) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    .thanus-search-box input {
        flex: 1 !important;
        background: transparent !important;
        border: none !important;
        outline: none !important;
        color: #f1f5f9 !important;
        font-size: 12px !important;
    }

    .thanus-search-box input::placeholder { color: #64748b !important; }
    .thanus-search-clear {
        background: none !important;
        border: none !important;
        color: #64748b !important;
        cursor: pointer !important;
        font-size: 11px !important;
        padding: 2px 4px !important;
        display: none !important;
    }
    .thanus-search-clear.visible { display: block !important; }
    .thanus-search-clear:hover { color: #ef4444 !important; }

    /* Appearance Bar */
    .thanus-appearance-bar {
        display: none !important;
        flex-direction: column !important;
        gap: 8px !important;
        padding: 8px 10px !important;
        background: rgba(0, 0, 0, 0.4) !important;
        border-radius: 8px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        font-size: 11px !important;
    }
    .thanus-appearance-bar.show { display: flex !important; }

    .thanus-slider-row {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 8px !important;
    }
    .thanus-slider-row label { color: #94a3b8 !important; min-width: 80px !important; }
    .thanus-slider-row input[type="range"] { flex: 1 !important; accent-color: #00f2fe !important; cursor: pointer !important; height: 4px !important; }

    /* Body */
    .thanus-body {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 10px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
    }

    .thanus-body::-webkit-scrollbar { width: 5px !important; }
    .thanus-body::-webkit-scrollbar-track { background: transparent !important; }
    .thanus-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15) !important; border-radius: 4px !important; }
    .thanus-body::-webkit-scrollbar-thumb:hover { background: rgba(0, 242, 254, 0.4) !important; }

    /* Pinned Grid */
    .thanus-pinned-grid {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 5px !important;
        padding-bottom: 6px !important;
        border-bottom: 1px dashed rgba(255, 255, 255, 0.1) !important;
    }

    .thanus-pinned-pill {
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
        padding: 4px 8px !important;
        border-radius: 16px !important;
        background: rgba(255, 255, 255, 0.06) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        cursor: pointer !important;
        max-width: 130px !important;
        transition: all 0.15s ease !important;
    }

    .thanus-pinned-pill:hover { background: rgba(255, 255, 255, 0.12) !important; border-color: #00f2fe !important; }
    .thanus-pinned-pill.active { background: rgba(0, 242, 254, 0.2) !important; border-color: #00f2fe !important; }
    .thanus-pinned-pill img { width: 14px !important; height: 14px !important; border-radius: 3px !important; flex-shrink: 0 !important; }
    .thanus-pinned-title { font-size: 11px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; color: #f1f5f9 !important; }

    /* Window Cards */
    .thanus-win-card {
        background: rgba(255, 255, 255, 0.03) !important;
        border-radius: 10px !important;
        border: 1px solid rgba(255, 255, 255, 0.07) !important;
        overflow: hidden !important;
    }
    .thanus-win-card.current { border-color: rgba(0, 242, 254, 0.35) !important; }
    .thanus-win-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 6px 10px !important;
        background: rgba(255, 255, 255, 0.04) !important;
        cursor: pointer !important;
        user-select: none !important;
        font-size: 11px !important;
        font-weight: 600 !important;
    }
    .thanus-win-title { display: flex !important; align-items: center !important; gap: 6px !important; }
    .thanus-win-badge {
        font-size: 9px !important;
        padding: 1px 5px !important;
        border-radius: 8px !important;
        background: rgba(16, 185, 129, 0.25) !important;
        color: #10b981 !important;
        font-weight: 700 !important;
    }
    .thanus-win-tabs-list { display: flex !important; flex-direction: column !important; gap: 3px !important; padding: 5px !important; }

    /* Chrome Tab Group */
    .thanus-tab-group { border-radius: 6px !important; border: 1px solid rgba(255, 255, 255, 0.08) !important; margin: 3px 0 !important; overflow: hidden !important; }
    .thanus-tab-group-header { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 5px 8px !important; font-size: 11px !important; font-weight: 700 !important; cursor: pointer !important; }
    .thanus-tab-group-body { display: flex !important; flex-direction: column !important; gap: 3px !important; padding: 4px !important; }

    /* Tab Item */
    .thanus-tab-item {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 5px 8px !important;
        border-radius: 6px !important;
        background: rgba(255, 255, 255, 0.02) !important;
        border: 1px solid transparent !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
        user-select: none !important;
    }

    .thanus-tab-item:hover {
        background: rgba(255, 255, 255, 0.08) !important;
        border-color: rgba(255, 255, 255, 0.12) !important;
        transform: translateX(2px) !important;
    }

    .thanus-tab-item.active {
        background: linear-gradient(90deg, rgba(0, 242, 254, 0.18), rgba(79, 172, 254, 0.06)) !important;
        border-color: rgba(0, 242, 254, 0.45) !important;
        box-shadow: inset 3px 0 0 #00f2fe !important;
    }

    .thanus-tab-item.discarded { opacity: 0.6 !important; }

    .thanus-tab-main {
        display: flex !important;
        align-items: center !important;
        gap: 7px !important;
        flex: 1 !important;
        min-width: 0 !important;
    }

    .thanus-tab-favicon { width: 15px !important; height: 15px !important; border-radius: 3px !important; flex-shrink: 0 !important; }
    .thanus-tab-info { display: flex !important; flex-direction: column !important; min-width: 0 !important; flex: 1 !important; }
    .thanus-tab-title { font-size: 11.5px !important; font-weight: 500 !important; color: #f1f5f9 !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
    .thanus-tab-item.active .thanus-tab-title { font-weight: 700 !important; color: #00f2fe !important; }
    .thanus-tab-domain { font-size: 9.5px !important; color: #94a3b8 !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }

    .thanus-tab-actions { display: flex !important; align-items: center !important; gap: 2px !important; opacity: 0.3 !important; transition: opacity 0.15s ease !important; }
    .thanus-tab-item:hover .thanus-tab-actions { opacity: 1 !important; }
    .thanus-tab-btn { background: none !important; border: none !important; color: #94a3b8 !important; cursor: pointer !important; padding: 2px 4px !important; border-radius: 4px !important; font-size: 11px !important; line-height: 1 !important; transition: all 0.15s ease !important; }
    .thanus-tab-btn:hover { background: rgba(255, 255, 255, 0.15) !important; color: #ffffff !important; }
    .thanus-tab-btn.close:hover { color: #ef4444 !important; background: rgba(239, 68, 68, 0.2) !important; }
    .thanus-tab-btn.audio.playing { color: #10b981 !important; }
    .thanus-tab-btn.audio.muted { color: #ef4444 !important; }

    /* Footer */
    .thanus-footer {
        padding: 8px 12px !important;
        background: rgba(255, 255, 255, 0.03) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
        display: flex !important;
        align-items: center;
        justify-content: space-between !important;
        gap: 6px !important;
        flex-shrink: 0 !important;
    }

    .thanus-footer-btn {
        flex: 1 !important;
        padding: 5px 8px !important;
        border-radius: 6px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        background: rgba(255, 255, 255, 0.04) !important;
        color: #cbd5e1 !important;
        font-size: 11px !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 4px !important;
        white-space: nowrap !important;
        transition: all 0.15s ease !important;
    }
    .thanus-footer-btn:hover { background: rgba(255, 255, 255, 0.1) !important; color: #ffffff !important; border-color: rgba(0, 242, 254, 0.3) !important; }
    .thanus-footer-btn.primary { background: linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(79, 172, 254, 0.2)) !important; border-color: #00f2fe !important; color: #00f2fe !important; font-weight: 700 !important; }

    /* ==========================================
       SESSION WORKSPACE MANAGER VIEW (In-Sidebar)
       ========================================== */
    .thanus-session-panel {
        display: none;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        gap: 12px;
        background: rgba(15, 23, 42, 0.4);
    }
    .thanus-session-panel.show {
        display: flex !important;
    }

    .thanus-session-section-title {
        font-size: 12px;
        font-weight: 700;
        color: #00f2fe;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .thanus-save-box {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .thanus-save-input {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        padding: 6px 10px;
        color: #f1f5f9;
        font-size: 12px;
        outline: none;
    }
    .thanus-save-input:focus {
        border-color: #00f2fe;
    }

    .thanus-save-options {
        display: flex;
        gap: 6px;
    }
    .thanus-save-scope-btn {
        flex: 1;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #94a3b8;
        padding: 4px 6px;
        border-radius: 6px;
        font-size: 11px;
        cursor: pointer;
    }
    .thanus-save-scope-btn.active {
        background: rgba(0, 242, 254, 0.2);
        border-color: #00f2fe;
        color: #00f2fe;
        font-weight: 700;
    }

    .thanus-tab-select-list {
        display: none;
        max-height: 120px;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        padding: 6px;
        flex-direction: column;
        gap: 4px;
    }
    .thanus-tab-select-list.show { display: flex !important; }

    .thanus-tab-checkbox-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #cbd5e1;
        cursor: pointer;
    }
    .thanus-tab-checkbox-row input {
        accent-color: #00f2fe;
    }

    .thanus-save-btn-action {
        background: linear-gradient(135deg, #00f2fe, #4facfe);
        color: #0b1120;
        border: none;
        padding: 7px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.15s ease;
    }
    .thanus-save-btn-action:hover {
        transform: translateY(-1px);
    }

    /* Saved Sessions List */
    .thanus-saved-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .thanus-session-card {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .thanus-session-card:hover {
        border-color: rgba(0, 242, 254, 0.3);
    }

    .thanus-session-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .thanus-session-card-name {
        font-size: 12px;
        font-weight: 700;
        color: #f1f5f9;
    }

    .thanus-session-badge {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 8px;
        background: rgba(0, 242, 254, 0.15);
        color: #00f2fe;
        font-weight: 600;
    }

    .thanus-session-card-meta {
        font-size: 10px;
        color: #64748b;
    }

    .thanus-session-card-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
    }

    .thanus-session-action-btn {
        flex: 1;
        padding: 4px 6px;
        border-radius: 4px;
        font-size: 10.5px;
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.05);
        color: #cbd5e1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }
    .thanus-session-action-btn:hover {
        background: rgba(0, 242, 254, 0.2);
        color: #00f2fe;
        border-color: #00f2fe;
    }
    .thanus-session-action-btn.delete:hover {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
        border-color: #ef4444;
    }

    /* ==========================================
       SPOTLIGHT COMMAND PALETTE (Alt+K)
       ========================================== */
    .thanus-spotlight-backdrop {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(11, 17, 32, 0.72) !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        z-index: 2147483646 !important;
        display: none !important;
        align-items: flex-start !important;
        justify-content: center !important;
        padding-top: 14vh !important;
        pointer-events: auto !important;
        opacity: 0 !important;
        transition: opacity 0.18s ease !important;
    }
    .thanus-spotlight-backdrop.active {
        display: flex !important;
        opacity: 1 !important;
    }
    .thanus-spotlight-box {
        width: 600px !important;
        max-width: 92vw !important;
        background: rgba(15, 23, 42, 0.96) !important;
        border: 1px solid rgba(0, 242, 254, 0.4) !important;
        border-radius: 14px !important;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 28px rgba(0, 242, 254, 0.25) !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        transform: translateY(-8px) scale(0.97) !important;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }
    .thanus-spotlight-backdrop.active .thanus-spotlight-box {
        transform: translateY(0) scale(1) !important;
    }
    .thanus-spotlight-header {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 14px 18px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
    }
    .thanus-spotlight-icon {
        font-size: 20px !important;
        line-height: 1 !important;
    }
    .thanus-spotlight-input {
        flex: 1 !important;
        background: transparent !important;
        border: none !important;
        outline: none !important;
        font-size: 15px !important;
        color: #f1f5f9 !important;
        font-weight: 500 !important;
    }
    .thanus-spotlight-input::placeholder {
        color: #64748b !important;
    }
    .thanus-spotlight-badge {
        font-size: 10px !important;
        padding: 2px 7px !important;
        border-radius: 6px !important;
        background: rgba(0, 242, 254, 0.15) !important;
        color: #00f2fe !important;
        border: 1px solid rgba(0, 242, 254, 0.3) !important;
        font-weight: 700 !important;
    }
    .thanus-spotlight-results {
        max-height: 360px !important;
        overflow-y: auto !important;
        padding: 8px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
    }
    .thanus-spotlight-item {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 9px 12px !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        transition: all 0.12s ease !important;
        color: #e2e8f0 !important;
        font-size: 13px !important;
        user-select: none !important;
    }
    .thanus-spotlight-item.selected,
    .thanus-spotlight-item:hover {
        background: rgba(0, 242, 254, 0.16) !important;
        color: #00f2fe !important;
        transform: translateX(3px) !important;
    }
    .thanus-spotlight-item-left {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        overflow: hidden !important;
    }
    .thanus-spotlight-item-icon {
        font-size: 16px !important;
        width: 20px !important;
        text-align: center !important;
        flex-shrink: 0 !important;
    }
    .thanus-spotlight-item-title {
        font-weight: 500 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
    }
    .thanus-spotlight-item-tag {
        font-size: 10px !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        background: rgba(255, 255, 255, 0.08) !important;
        color: #94a3b8 !important;
        flex-shrink: 0 !important;
    }
    .thanus-spotlight-footer {
        padding: 8px 16px !important;
        background: rgba(0, 0, 0, 0.35) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        font-size: 11px !important;
        color: #64748b !important;
    }
    .thanus-spotlight-footer-shortcuts {
        display: flex !important;
        gap: 12px !important;
    }
    .thanus-spotlight-footer-shortcuts kbd {
        background: rgba(255, 255, 255, 0.1) !important;
        padding: 1px 4px !important;
        border-radius: 3px !important;
        color: #94a3b8 !important;
    }
    `;

    // ==========================================
    // STATE & CONFIG
    // ==========================================
    const DEFAULT_CONFIG = {
        enableFloatingTabBar: true,
        floatingBarPosition: 'left',
        floatingBarOpacity: 0.92,
        floatingBarBlur: 16,
        floatingBarWidth: 340,
        floatingBarTopPercent: 40,
        floatingBarPinned: false
    };

    let config = { ...DEFAULT_CONFIG };
    let isExpanded = false;
    let isSessionViewOpen = false;
    let saveScope = 'all'; // 'all' | 'window' | 'custom'
    let searchQuery = '';
    let shadowRoot = null;
    let hostElement = null;
    let cachedTabsData = { windows: [], tabs: [], currentWindowId: null, groups: {} };
    let cachedSavedSessions = [];

    const GROUP_COLORS = {
        grey: '#5f6368', blue: '#1a73e8', red: '#d93025', yellow: '#f2994a',
        green: '#1e8e3e', pink: '#e52592', purple: '#9334e6', cyan: '#12b5cb', orange: '#fa903e'
    };

    const DEFAULT_FAVICON_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300f2fe'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3C/svg%3E";

    // ==========================================
    // INITIALIZATION
    // ==========================================
    async function init() {
        try {
            const res = await chrome.storage.local.get(['appSettings']);
            const appSettings = res.appSettings || {};
            config = { ...DEFAULT_CONFIG, ...appSettings };
            cachedSavedSessions = appSettings.savedSessions || [];

            if (config.enableFloatingTabBar === false) {
                removeHost();
                return;
            }

            createHostAndShadow();
            bindGlobalListeners();
            fetchTabsAndRender();
        } catch (e) {
            console.warn('[Thanus Floating Tab Bar] Init error:', e);
        }
    }

    function removeHost() {
        const existing = document.getElementById('thanus-vtab-host');
        if (existing) existing.remove();
        hostElement = null;
        shadowRoot = null;
    }

    // ==========================================
    // SHADOW DOM SETUP
    // ==========================================
    function createHostAndShadow() {
        if (document.getElementById('thanus-vtab-host')) return;

        hostElement = document.createElement('thanus-vtab-host');
        hostElement.id = 'thanus-vtab-host';
        hostElement.style.cssText = 'all: initial !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; z-index: 2147483647 !important; pointer-events: none !important;';
        
        shadowRoot = hostElement.attachShadow({ mode: 'open' });

        const styleTag = document.createElement('style');
        styleTag.textContent = EMBEDDED_CSS;
        shadowRoot.appendChild(styleTag);

        const wrapper = document.createElement('div');
        wrapper.id = 'thanus-vtab-wrapper';
        wrapper.innerHTML = `
            <div id="dockTrigger" class="thanus-dock-trigger dock-${config.floatingBarPosition}" 
                 style="top: ${config.floatingBarTopPercent}%;" title="Thanus Vertical Tabs (Alt+T)">
                <span class="thanus-dock-icon">📑</span>
                <span id="dockCountBadge" class="thanus-dock-count">0</span>
                <span id="dockAudioBadge" class="thanus-dock-audio-indicator" style="display: none;">🔊</span>
            </div>

            <aside id="sidebarPanel" class="thanus-sidebar-panel dock-${config.floatingBarPosition}"
                   style="--sidebar-width: ${config.floatingBarWidth}px; --sidebar-opacity: ${config.floatingBarOpacity}; --sidebar-blur: ${config.floatingBarBlur}px;">
                <div id="sidebarResizer" class="thanus-sidebar-resizer"></div>

                <div class="thanus-header">
                    <div class="thanus-header-top">
                        <div class="thanus-header-title">
                            <span>📑</span> Vertical Tabs
                        </div>
                        <div class="thanus-header-controls">
                            <button id="btnSessions" class="thanus-icon-btn" title="Session Workspace Manager">💾</button>
                            <button id="btnSwitchSide" class="thanus-icon-btn" title="Switch Side (Left / Right)">⇄</button>
                            <button id="btnAppearance" class="thanus-icon-btn" title="Adjust Transparency & Blur">🎨</button>
                            <button id="btnPinSidebar" class="thanus-icon-btn ${config.floatingBarPinned ? 'active' : ''}" title="Pin Sidebar (Stay Open)">📌</button>
                            <button id="btnCloseSidebar" class="thanus-icon-btn" title="Close (Esc)">✕</button>
                        </div>
                    </div>

                    <div id="appearanceBar" class="thanus-appearance-bar">
                        <div class="thanus-slider-row">
                            <label>Opacity (${Math.round(config.floatingBarOpacity * 100)}%)</label>
                            <input type="range" id="opacitySlider" min="0.2" max="1" step="0.05" value="${config.floatingBarOpacity}">
                        </div>
                        <div class="thanus-slider-row">
                            <label>Blur (${config.floatingBarBlur}px)</label>
                            <input type="range" id="blurSlider" min="0" max="30" step="2" value="${config.floatingBarBlur}">
                        </div>
                    </div>

                    <div id="searchBarContainer" class="thanus-search-box">
                        <span>🔍</span>
                        <input type="text" id="vtabSearchInput" placeholder="Search open tabs..." autocomplete="off">
                        <button id="vtabSearchClear" class="thanus-search-clear">✕</button>
                    </div>
                </div>

                <!-- Main Tabs List Body -->
                <div id="vtabBody" class="thanus-body"></div>

                <!-- Session Workspace Panel (Toggled View) -->
                <div id="sessionPanel" class="thanus-session-panel">
                    <div class="thanus-session-section-title">
                        <span>💾</span> Save New Workspace
                    </div>
                    <div class="thanus-save-box">
                        <input type="text" id="sessionNameInput" class="thanus-save-input" placeholder="Workspace Name (e.g., Work, Research)...">
                        
                        <div class="thanus-save-options">
                            <button id="btnScopeAll" class="thanus-save-scope-btn active">All Tabs</button>
                            <button id="btnScopeWindow" class="thanus-save-scope-btn">Current Window</button>
                            <button id="btnScopeCustom" class="thanus-save-scope-btn">Select Tabs</button>
                        </div>

                        <div id="tabSelectList" class="thanus-tab-select-list"></div>

                        <button id="btnConfirmSaveSession" class="thanus-save-btn-action">💾 Save Workspace Session</button>
                    </div>

                    <div class="thanus-session-section-title" style="margin-top: 8px;">
                        <span>📂</span> Saved Workspaces (<span id="savedSessionCount">0</span>)
                    </div>
                    <div id="savedSessionsContainer" class="thanus-saved-list"></div>
                </div>

                <div class="thanus-footer">
                    <button id="btnFooterSessions" class="thanus-footer-btn" title="Workspaces & Sessions">
                        <span>💾</span> Sessions
                    </button>
                    <button id="btnFooterDuplicates" class="thanus-footer-btn" title="Close Duplicate Tabs">
                        <span>🧹</span> Duplicates
                    </button>
                    <button id="btnFooterSleep" class="thanus-footer-btn" title="Hibernate Inactive Tabs">
                        <span>💤</span> Sleep All
                    </button>
                    <button id="btnFooterNewTab" class="thanus-footer-btn primary" title="Open New Tab">
                        <span>➕</span> New
                    </button>
                </div>
            </aside>

            <!-- Spotlight Command Palette Overlay (Alt+K) -->
            <div id="spotlightBackdrop" class="thanus-spotlight-backdrop">
                <div class="thanus-spotlight-box">
                    <div class="thanus-spotlight-header">
                        <span class="thanus-spotlight-icon">⚡</span>
                        <input type="text" id="spotlightInput" class="thanus-spotlight-input" placeholder="Type command (> snap, > clear, > zap, > pip) or search open tabs..." autocomplete="off">
                        <span class="thanus-spotlight-badge">Alt + K</span>
                    </div>
                    <div id="spotlightResults" class="thanus-spotlight-results"></div>
                    <div class="thanus-spotlight-footer">
                        <span>Thanus Command Palette</span>
                        <div class="thanus-spotlight-footer-shortcuts">
                            <span><kbd>↑↓</kbd> Navigate</span>
                            <span><kbd>↵</kbd> Execute</span>
                            <span><kbd>Esc</kbd> Close</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        shadowRoot.appendChild(wrapper);
        document.documentElement.appendChild(hostElement);

        bindShadowEvents();
    }

    // ==========================================
    // SHADOW EVENT BINDINGS
    // ==========================================
    function bindShadowEvents() {
        const trigger = shadowRoot.getElementById('dockTrigger');
        const panel = shadowRoot.getElementById('sidebarPanel');
        const searchInput = shadowRoot.getElementById('vtabSearchInput');
        const searchClear = shadowRoot.getElementById('vtabSearchClear');
        const resizer = shadowRoot.getElementById('sidebarResizer');
        const btnSessions = shadowRoot.getElementById('btnSessions');
        const btnSwitchSide = shadowRoot.getElementById('btnSwitchSide');
        const btnAppearance = shadowRoot.getElementById('btnAppearance');
        const appearanceBar = shadowRoot.getElementById('appearanceBar');
        const opacitySlider = shadowRoot.getElementById('opacitySlider');
        const blurSlider = shadowRoot.getElementById('blurSlider');
        const btnPinSidebar = shadowRoot.getElementById('btnPinSidebar');
        const btnCloseSidebar = shadowRoot.getElementById('btnCloseSidebar');
        const btnFooterSessions = shadowRoot.getElementById('btnFooterSessions');
        const btnFooterDuplicates = shadowRoot.getElementById('btnFooterDuplicates');
        const btnFooterSleep = shadowRoot.getElementById('btnFooterSleep');
        const btnFooterNewTab = shadowRoot.getElementById('btnFooterNewTab');

        // Session Elements
        const btnScopeAll = shadowRoot.getElementById('btnScopeAll');
        const btnScopeWindow = shadowRoot.getElementById('btnScopeWindow');
        const btnScopeCustom = shadowRoot.getElementById('btnScopeCustom');
        const btnConfirmSaveSession = shadowRoot.getElementById('btnConfirmSaveSession');

        // Trigger Click
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
        });

        // Trigger Dragging
        let isDraggingTrigger = false;
        let startY = 0;
        let startTopPercent = config.floatingBarTopPercent;

        trigger.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDraggingTrigger = true;
            startY = e.clientY;
            startTopPercent = config.floatingBarTopPercent;
            document.body.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingTrigger) return;
            const deltaY = e.clientY - startY;
            const newPercent = Math.max(10, Math.min(85, startTopPercent + (deltaY / window.innerHeight) * 100));
            trigger.style.top = `${newPercent}%`;
            config.floatingBarTopPercent = Math.round(newPercent);
        });

        window.addEventListener('mouseup', () => {
            if (isDraggingTrigger) {
                isDraggingTrigger = false;
                document.body.style.userSelect = '';
                saveSettingsDebounced();
            }
        });

        // Resizing Sidebar Width
        let isResizing = false;
        let startX = 0;
        let startWidth = config.floatingBarWidth;

        resizer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startWidth = config.floatingBarWidth;
            resizer.classList.add('resizing');
            document.body.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const deltaX = config.floatingBarPosition === 'left' ? (e.clientX - startX) : (startX - e.clientX);
            const newWidth = Math.max(260, Math.min(550, startWidth + deltaX));
            panel.style.setProperty('--sidebar-width', `${newWidth}px`);
            config.floatingBarWidth = newWidth;
        });

        window.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('resizing');
                document.body.style.userSelect = '';
                saveSettingsDebounced();
            }
        });

        // Search Input
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            searchClear.classList.toggle('visible', searchQuery.length > 0);
            renderTabs();
        });

        searchClear.addEventListener('click', (e) => {
            e.stopPropagation();
            searchInput.value = '';
            searchQuery = '';
            searchClear.classList.remove('visible');
            renderTabs();
        });

        // Switch Side
        btnSwitchSide.addEventListener('click', (e) => {
            e.stopPropagation();
            config.floatingBarPosition = config.floatingBarPosition === 'left' ? 'right' : 'left';
            trigger.className = `thanus-dock-trigger dock-${config.floatingBarPosition}`;
            panel.className = `thanus-sidebar-panel dock-${config.floatingBarPosition} ${isExpanded ? 'expanded' : ''}`;
            saveSettingsDebounced();
        });

        // Appearance Dropdown
        btnAppearance.addEventListener('click', (e) => {
            e.stopPropagation();
            appearanceBar.classList.toggle('show');
        });

        // Sliders
        opacitySlider.addEventListener('input', (e) => {
            config.floatingBarOpacity = parseFloat(e.target.value);
            panel.style.setProperty('--sidebar-opacity', config.floatingBarOpacity);
            appearanceBar.querySelector('.thanus-slider-row label').textContent = `Opacity (${Math.round(config.floatingBarOpacity * 100)}%)`;
            saveSettingsDebounced();
        });

        blurSlider.addEventListener('input', (e) => {
            config.floatingBarBlur = parseInt(e.target.value, 10);
            panel.style.setProperty('--sidebar-blur', `${config.floatingBarBlur}px`);
            appearanceBar.querySelectorAll('.thanus-slider-row label')[1].textContent = `Blur (${config.floatingBarBlur}px)`;
            saveSettingsDebounced();
        });

        // Pin Sidebar
        btnPinSidebar.addEventListener('click', (e) => {
            e.stopPropagation();
            config.floatingBarPinned = !config.floatingBarPinned;
            btnPinSidebar.classList.toggle('active', config.floatingBarPinned);
            saveSettingsDebounced();
        });

        // Close Sidebar
        btnCloseSidebar.addEventListener('click', (e) => {
            e.stopPropagation();
            collapseSidebar();
        });

        // Session Toggle
        btnSessions.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSessionView();
        });
        btnFooterSessions.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSessionView();
        });

        // Session Scope Buttons
        btnScopeAll.addEventListener('click', (e) => {
            e.stopPropagation();
            setSessionScope('all');
        });
        btnScopeWindow.addEventListener('click', (e) => {
            e.stopPropagation();
            setSessionScope('window');
        });
        btnScopeCustom.addEventListener('click', (e) => {
            e.stopPropagation();
            setSessionScope('custom');
        });

        // Save Session Action
        btnConfirmSaveSession.addEventListener('click', (e) => {
            e.stopPropagation();
            saveSessionFromFloatingBar();
        });

        // Footer Actions
        btnFooterDuplicates.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.runtime.sendMessage({ type: 'CLOSE_DUPLICATE_TABS' }, () => fetchTabsAndRender());
        });

        btnFooterSleep.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.runtime.sendMessage({ type: 'HIBERNATE_INACTIVE_TABS' }, () => fetchTabsAndRender());
        });

        btnFooterNewTab.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.runtime.sendMessage({ type: 'CREATE_NEW_TAB' });
        });

        // Spotlight Command Palette Events
        const spotlightBackdrop = shadowRoot.getElementById('spotlightBackdrop');
        const spotlightInput = shadowRoot.getElementById('spotlightInput');

        if (spotlightBackdrop) {
            spotlightBackdrop.addEventListener('click', (e) => {
                if (e.target === spotlightBackdrop) closeSpotlight();
            });
        }

        if (spotlightInput) {
            spotlightInput.addEventListener('input', (e) => {
                spotlightSelectedIndex = 0;
                renderSpotlightList(e.target.value);
            });

            spotlightInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (currentSpotlightItems.length > 0) {
                        spotlightSelectedIndex = (spotlightSelectedIndex + 1) % currentSpotlightItems.length;
                        updateSpotlightSelection();
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (currentSpotlightItems.length > 0) {
                        spotlightSelectedIndex = (spotlightSelectedIndex - 1 + currentSpotlightItems.length) % currentSpotlightItems.length;
                        updateSpotlightSelection();
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (currentSpotlightItems.length > 0 && currentSpotlightItems[spotlightSelectedIndex]) {
                        executeSpotlightItem(currentSpotlightItems[spotlightSelectedIndex]);
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeSpotlight();
                }
            });
        }
    }

    // ==========================================
    // SESSION WORKSPACE LOGIC
    // ==========================================
    function toggleSessionView() {
        isSessionViewOpen = !isSessionViewOpen;
        const tabsBody = shadowRoot.getElementById('vtabBody');
        const sessionPanel = shadowRoot.getElementById('sessionPanel');
        const searchBox = shadowRoot.getElementById('searchBarContainer');
        const btnSessions = shadowRoot.getElementById('btnSessions');
        const btnFooterSessions = shadowRoot.getElementById('btnFooterSessions');

        if (isSessionViewOpen) {
            tabsBody.style.display = 'none';
            searchBox.style.display = 'none';
            sessionPanel.classList.add('show');
            btnSessions.classList.add('active');
            btnFooterSessions.classList.add('primary');

            // Set default name with timestamp
            const nameInput = shadowRoot.getElementById('sessionNameInput');
            if (nameInput) {
                const now = new Date();
                nameInput.value = `Workspace (${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
            }
            loadAndRenderSavedSessions();
        } else {
            tabsBody.style.display = 'flex';
            searchBox.style.display = 'flex';
            sessionPanel.classList.remove('show');
            btnSessions.classList.remove('active');
            btnFooterSessions.classList.remove('primary');
        }
    }

    function setSessionScope(scope) {
        saveScope = scope;
        const btnScopeAll = shadowRoot.getElementById('btnScopeAll');
        const btnScopeWindow = shadowRoot.getElementById('btnScopeWindow');
        const btnScopeCustom = shadowRoot.getElementById('btnScopeCustom');
        const tabSelectList = shadowRoot.getElementById('tabSelectList');

        btnScopeAll.classList.toggle('active', scope === 'all');
        btnScopeWindow.classList.toggle('active', scope === 'window');
        btnScopeCustom.classList.toggle('active', scope === 'custom');

        if (scope === 'custom') {
            tabSelectList.classList.add('show');
            renderTabCheckboxes();
        } else {
            tabSelectList.classList.remove('show');
        }
    }

    function renderTabCheckboxes() {
        const list = shadowRoot.getElementById('tabSelectList');
        if (!list) return;
        list.innerHTML = '';

        cachedTabsData.tabs.forEach(tab => {
            const row = document.createElement('label');
            row.className = 'thanus-tab-checkbox-row';
            row.innerHTML = `
                <input type="checkbox" data-tab-id="${tab.id}" checked>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;">${escapeHTML(tab.title || tab.url)}</span>
            `;
            list.appendChild(row);
        });
    }

    async function loadAndRenderSavedSessions() {
        const res = await chrome.storage.local.get(['appSettings']);
        const appSettings = res.appSettings || {};
        cachedSavedSessions = appSettings.savedSessions || [];

        const countBadge = shadowRoot.getElementById('savedSessionCount');
        if (countBadge) countBadge.textContent = cachedSavedSessions.length;

        const container = shadowRoot.getElementById('savedSessionsContainer');
        if (!container) return;
        container.innerHTML = '';

        if (cachedSavedSessions.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 11px; padding: 15px;">No saved workspaces yet.</div>`;
            return;
        }

        cachedSavedSessions.forEach((session, index) => {
            const card = document.createElement('div');
            card.className = 'thanus-session-card';

            const tabCount = session.tabs ? session.tabs.length : 0;
            const dateStr = session.date ? new Date(session.date).toLocaleDateString() : '';

            card.innerHTML = `
                <div class="thanus-session-header-row">
                    <span class="thanus-session-card-name">${index + 1}. ${escapeHTML(session.name || 'Workspace')}</span>
                    <span class="thanus-session-badge">${tabCount} tabs</span>
                </div>
                <div class="thanus-session-card-meta">
                    Saved on ${dateStr} • Type: ${escapeHTML(session.tabType || 'all')}
                </div>
                <div class="thanus-session-card-actions">
                    <button class="thanus-session-action-btn restore" title="Restore Tabs Here">📂 Open</button>
                    <button class="thanus-session-action-btn new-win" title="Restore in New Window">🪟 New Window</button>
                    <button class="thanus-session-action-btn delete" title="Delete Workspace">🗑️</button>
                </div>
            `;

            // Restore in current window
            card.querySelector('.restore').addEventListener('click', (e) => {
                e.stopPropagation();
                chrome.runtime.sendMessage({ type: 'RESTORE_SESSION_TABS', tabs: session.tabs, inNewWindow: false });
                toggleSessionView();
            });

            // Restore in new window
            card.querySelector('.new-win').addEventListener('click', (e) => {
                e.stopPropagation();
                chrome.runtime.sendMessage({ type: 'RESTORE_SESSION_TABS', tabs: session.tabs, inNewWindow: true });
                toggleSessionView();
            });

            // Delete Session
            card.querySelector('.delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                cachedSavedSessions = cachedSavedSessions.filter(s => s.id !== session.id);
                appSettings.savedSessions = cachedSavedSessions;
                await chrome.storage.local.set({ appSettings });
                loadAndRenderSavedSessions();
            });

            container.appendChild(card);
        });
    }

    async function saveSessionFromFloatingBar() {
        const nameInput = shadowRoot.getElementById('sessionNameInput');
        const sessionName = nameInput.value.trim() || `Workspace (${new Date().toLocaleString()})`;

        let tabsToSave = [];
        if (saveScope === 'all') {
            tabsToSave = cachedTabsData.tabs;
        } else if (saveScope === 'window') {
            tabsToSave = cachedTabsData.tabs.filter(t => t.windowId === cachedTabsData.currentWindowId);
        } else if (saveScope === 'custom') {
            const checkboxes = shadowRoot.querySelectorAll('#tabSelectList input[type="checkbox"]:checked');
            const selectedIds = new Set(Array.from(checkboxes).map(cb => parseInt(cb.dataset.tabId, 10)));
            tabsToSave = cachedTabsData.tabs.filter(t => selectedIds.has(t.id));
        }

        if (tabsToSave.length === 0) {
            alert('Please select at least 1 tab to save.');
            return;
        }

        const newSession = {
            id: Date.now(),
            name: sessionName,
            date: new Date().toISOString(),
            tabType: saveScope,
            tabs: tabsToSave.map(t => ({
                url: t.url,
                title: t.title,
                favIconUrl: t.favIconUrl,
                incognito: t.incognito || false
            }))
        };

        const res = await chrome.storage.local.get(['appSettings']);
        const appSettings = res.appSettings || {};
        if (!appSettings.savedSessions) appSettings.savedSessions = [];
        appSettings.savedSessions.unshift(newSession);

        await chrome.storage.local.set({ appSettings });
        cachedSavedSessions = appSettings.savedSessions;

        // Visual feedback
        const saveBtn = shadowRoot.getElementById('btnConfirmSaveSession');
        const origText = saveBtn.textContent;
        saveBtn.textContent = '✔ Saved Successfully!';
        saveBtn.style.background = 'linear-gradient(135deg, #00b09b, #96c93d)';
        setTimeout(() => {
            saveBtn.textContent = origText;
            saveBtn.style.background = '';
            loadAndRenderSavedSessions();
        }, 1200);
    }

    // ==========================================
    // SPOTLIGHT COMMAND PALETTE CONTROLLER
    // ==========================================
    let isSpotlightOpen = false;
    let spotlightSelectedIndex = 0;
    let currentSpotlightItems = [];

    const SPOTLIGHT_COMMANDS = [
        { id: 'snap', icon: '⚡', title: 'Snap Panic Mode', desc: 'Wipe stealth history, close incognito, snap sensitive tabs', tag: 'Action' },
        { id: 'clear', icon: '🧹', title: 'Clear Current Site Data', desc: 'Delete cookies & cache for current domain', tag: 'Privacy' },
        { id: 'zap', icon: '🎯', title: 'Element Zapper', desc: 'Click to permanently vaporize annoying webpage elements', tag: 'Adblock' },
        { id: 'pip', icon: '📺', title: 'Privacy Player PiP', desc: 'Open video sandbox player with SponsorBlock', tag: 'Media' },
        { id: 'tempmail', icon: '📧', title: 'Open Temp Mail', desc: 'Generate disposable email address in extension', tag: 'Identity' },
        { id: 'sleep', icon: '💤', title: 'Hibernate All Inactive Tabs', desc: 'Free RAM by sleeping background tabs', tag: 'System' },
        { id: 'duplicates', icon: '🧹', title: 'Close Duplicate Tabs', desc: 'Deduplicate redundant open tabs across windows', tag: 'Tabs' },
        { id: 'newtab', icon: '➕', title: 'New Tab', desc: 'Open a clean new tab', tag: 'Tabs' }
    ];

    function toggleSpotlight() {
        if (isSpotlightOpen) {
            closeSpotlight();
        } else {
            openSpotlight();
        }
    }

    function openSpotlight() {
        if (!shadowRoot) createHostAndShadow();
        const backdrop = shadowRoot.getElementById('spotlightBackdrop');
        const input = shadowRoot.getElementById('spotlightInput');
        if (!backdrop || !input) return;

        isSpotlightOpen = true;
        backdrop.classList.add('active');
        input.value = '';
        spotlightSelectedIndex = 0;
        input.focus();
        renderSpotlightList('');
    }

    function closeSpotlight() {
        if (!shadowRoot) return;
        const backdrop = shadowRoot.getElementById('spotlightBackdrop');
        if (backdrop) backdrop.classList.remove('active');
        isSpotlightOpen = false;
    }

    function renderSpotlightList(query = '') {
        const resultsContainer = shadowRoot.getElementById('spotlightResults');
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '';

        const q = query.trim().toLowerCase();
        let items = [];

        // 1. Filter Built-in Commands
        if (q.startsWith('>') || q.startsWith('/') || q === '') {
            const cleanQ = q.replace(/^[>/]/, '').trim();
            items = SPOTLIGHT_COMMANDS.filter(cmd => {
                if (!cleanQ) return true;
                return cmd.id.includes(cleanQ) || cmd.title.toLowerCase().includes(cleanQ) || cmd.desc.toLowerCase().includes(cleanQ);
            }).map(c => ({ type: 'command', ...c }));
        }

        // 2. Filter Open Tabs
        if (cachedTabsData && cachedTabsData.tabs && cachedTabsData.tabs.length > 0) {
            const matchingTabs = cachedTabsData.tabs.filter(tab => {
                if (!q || q.startsWith('>') || q.startsWith('/')) return false;
                const title = (tab.title || '').toLowerCase();
                const url = (tab.url || '').toLowerCase();
                return title.includes(q) || url.includes(q);
            }).slice(0, 8).map(t => ({
                type: 'tab',
                id: t.id,
                windowId: t.windowId,
                title: t.title || 'Untitled',
                desc: getDomain(t.url),
                icon: t.favIconUrl || DEFAULT_FAVICON_DATA_URI,
                tag: t.active ? 'Active' : 'Tab'
            }));

            items = items.concat(matchingTabs);
        }

        currentSpotlightItems = items;
        if (spotlightSelectedIndex >= items.length) spotlightSelectedIndex = Math.max(0, items.length - 1);

        if (items.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.style.cssText = 'padding: 16px; text-align: center; color: #64748b; font-size: 13px;';
            emptyEl.textContent = 'No matching commands or open tabs found.';
            resultsContainer.appendChild(emptyEl);
            return;
        }

        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = `thanus-spotlight-item ${index === spotlightSelectedIndex ? 'selected' : ''}`;
            row.dataset.index = index;

            const iconHtml = item.type === 'tab'
                ? `<img src="${item.icon}" style="width:16px;height:16px;border-radius:3px;flex-shrink:0;">`
                : `<span class="thanus-spotlight-item-icon">${item.icon}</span>`;

            row.innerHTML = `
                <div class="thanus-spotlight-item-left">
                    ${iconHtml}
                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                        <span class="thanus-spotlight-item-title">${escapeHTML(item.title)}</span>
                        <span style="font-size:11px; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(item.desc || '')}</span>
                    </div>
                </div>
                <span class="thanus-spotlight-item-tag">${escapeHTML(item.tag)}</span>
            `;

            row.addEventListener('click', (e) => {
                e.stopPropagation();
                executeSpotlightItem(item);
            });

            row.addEventListener('mouseenter', () => {
                spotlightSelectedIndex = index;
                updateSpotlightSelection();
            });

            resultsContainer.appendChild(row);
        });
    }

    function updateSpotlightSelection() {
        const rows = shadowRoot.querySelectorAll('.thanus-spotlight-item');
        rows.forEach((r, idx) => {
            r.classList.toggle('selected', idx === spotlightSelectedIndex);
            if (idx === spotlightSelectedIndex) {
                r.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    function executeSpotlightItem(item) {
        if (!item) return;
        closeSpotlight();

        if (item.type === 'tab') {
            chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId: item.id, windowId: item.windowId });
            return;
        }

        if (item.type === 'command') {
            switch (item.id) {
                case 'snap':
                    chrome.runtime.sendMessage({ type: 'ACTIVATE_PANIC' });
                    break;
                case 'clear':
                    chrome.runtime.sendMessage({ type: 'CLEAR_CURRENT_SITE_DATA', url: window.location.href });
                    break;
                case 'zap':
                    chrome.runtime.sendMessage({ type: 'ACTIVATE_ZAPPER' });
                    break;
                case 'pip':
                    chrome.runtime.sendMessage({ type: 'OPEN_PLAYER_FOR_TAB', url: window.location.href });
                    break;
                case 'tempmail':
                    chrome.runtime.sendMessage({ type: 'OPEN_POPUP_TAB', tab: 'tempMailSection' });
                    break;
                case 'sleep':
                    chrome.runtime.sendMessage({ type: 'HIBERNATE_INACTIVE_TABS' }, () => fetchTabsAndRender());
                    break;
                case 'duplicates':
                    chrome.runtime.sendMessage({ type: 'CLOSE_DUPLICATE_TABS' }, () => fetchTabsAndRender());
                    break;
                case 'newtab':
                    chrome.runtime.sendMessage({ type: 'CREATE_NEW_TAB' });
                    break;
            }
        }
    }

    // ==========================================
    // GLOBAL LISTENERS (Shortcuts & Click Outside)
    // ==========================================
    function bindGlobalListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
                e.preventDefault();
                toggleSpotlight();
            } else if (e.altKey && (e.key === 't' || e.key === 'T' || e.code === 'KeyT')) {
                e.preventDefault();
                toggleSidebar();
            } else if (e.key === 'Escape') {
                if (isSpotlightOpen) {
                    closeSpotlight();
                } else if (isExpanded && !config.floatingBarPinned) {
                    collapseSidebar();
                }
            }
        });

        document.addEventListener('click', (e) => {
            if (isSpotlightOpen && shadowRoot) {
                const spotlightBox = shadowRoot.querySelector('.thanus-spotlight-box');
                if (spotlightBox && !e.composedPath().includes(spotlightBox)) {
                    closeSpotlight();
                }
            }
            if (!isExpanded || config.floatingBarPinned) return;
            if (!e.composedPath().includes(hostElement)) {
                collapseSidebar();
            }
        });

        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === 'BROADCAST_TABS_UPDATED') {
                fetchTabsAndRender();
            } else if (msg.type === 'SET_FLOATING_BAR_ENABLED') {
                if (msg.enabled) {
                    if (!hostElement) createHostAndShadow();
                    fetchTabsAndRender(true);
                } else {
                    removeHost();
                }
            } else if (msg.type === 'TOGGLE_FLOATING_TAB_BAR') {
                toggleSidebar();
            } else if (msg.type === 'TOGGLE_SPOTLIGHT') {
                toggleSpotlight();
            }
        });

        // Listen for settings change directly from storage
        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.appSettings) {
                    const newSettings = changes.appSettings.newValue || {};
                    if (typeof newSettings.enableFloatingTabBar === 'boolean') {
                        config.enableFloatingTabBar = newSettings.enableFloatingTabBar;
                        if (config.enableFloatingTabBar) {
                            if (!hostElement) createHostAndShadow();
                            fetchTabsAndRender();
                        } else {
                            removeHost();
                        }
                    }
                }
            });
        }
    }

    // ==========================================
    // SIDEBAR TOGGLE
    // ==========================================
    function toggleSidebar() {
        if (isExpanded) {
            collapseSidebar();
        } else {
            expandSidebar();
        }
    }

    function expandSidebar() {
        isExpanded = true;
        if (!shadowRoot) createHostAndShadow();
        const panel = shadowRoot ? shadowRoot.getElementById('sidebarPanel') : null;
        if (panel) {
            panel.classList.add('expanded');
            fetchTabsAndRender(true);
        }
    }

    function collapseSidebar() {
        isExpanded = false;
        const panel = shadowRoot ? shadowRoot.getElementById('sidebarPanel') : null;
        if (panel) {
            panel.classList.remove('expanded');
        }
    }

    // ==========================================
    // TABS DATA FETCH & RENDER (Optimized with Lazy Rendering)
    // ==========================================
    function fetchTabsAndRender(forceFullRender = false) {
        chrome.runtime.sendMessage({ type: 'GET_ALL_TABS_FOR_FLOATING_BAR' }, (response) => {
            if (!response || !response.success || !shadowRoot) return;
            cachedTabsData = response.data;

            const totalTabs = cachedTabsData.tabs.length;
            const hasAudio = cachedTabsData.tabs.some(t => t.audible);

            const badge = shadowRoot.getElementById('dockCountBadge');
            const audioBadge = shadowRoot.getElementById('dockAudioBadge');
            if (badge) badge.textContent = totalTabs;
            if (audioBadge) audioBadge.style.display = hasAudio ? 'block' : 'none';

            // Lazy Render: Only render full tabs DOM if sidebar is expanded or force requested
            if ((isExpanded || forceFullRender) && !isSessionViewOpen) {
                renderTabs();
            }

            // Update spotlight results if spotlight palette is active
            if (isSpotlightOpen) {
                const input = shadowRoot.getElementById('spotlightInput');
                renderSpotlightList(input ? input.value : '');
            }
        });
    }

    function renderTabs() {
        const body = shadowRoot ? shadowRoot.getElementById('vtabBody') : null;
        if (!body) return;
        body.innerHTML = '';

        const { windows, tabs, currentWindowId, groups } = cachedTabsData;

        let filteredTabs = tabs;
        if (searchQuery) {
            filteredTabs = tabs.filter(t => 
                (t.title && t.title.toLowerCase().includes(searchQuery)) ||
                (t.url && t.url.toLowerCase().includes(searchQuery))
            );
        }

        if (filteredTabs.length === 0) {
            body.innerHTML = `<div style="text-align: center; color: #64748b; padding: 20px;">No tabs match "${escapeHTML(searchQuery)}"</div>`;
            return;
        }

        // Pinned Tabs
        const pinnedTabs = filteredTabs.filter(t => t.pinned);
        if (pinnedTabs.length > 0) {
            const pinnedGrid = document.createElement('div');
            pinnedGrid.className = 'thanus-pinned-grid';
            pinnedTabs.forEach(tab => {
                pinnedGrid.appendChild(createPinnedPill(tab));
            });
            body.appendChild(pinnedGrid);
        }

        // Normal Tabs
        const unpinnedTabs = filteredTabs.filter(t => !t.pinned);
        const tabsByWindow = {};
        unpinnedTabs.forEach(t => {
            if (!tabsByWindow[t.windowId]) tabsByWindow[t.windowId] = [];
            tabsByWindow[t.windowId].push(t);
        });

        windows.forEach((win, index) => {
            const winTabs = tabsByWindow[win.id] || [];
            if (winTabs.length === 0) return;

            const isCurrentWin = win.id === currentWindowId;
            const winCard = document.createElement('div');
            winCard.className = `thanus-win-card ${isCurrentWin ? 'current' : ''}`;

            winCard.innerHTML = `
                <div class="thanus-win-header">
                    <span class="thanus-win-title">
                        🪟 Window ${index + 1} ${isCurrentWin ? '<span class="thanus-win-badge">Current</span>' : ''}
                    </span>
                    <span style="color: #64748b;">${winTabs.length}</span>
                </div>
                <div class="thanus-win-tabs-list"></div>
            `;

            const list = winCard.querySelector('.thanus-win-tabs-list');

            const renderedGroupIds = new Set();
            winTabs.forEach(tab => {
                const groupId = tab.groupId;
                if (groupId && groupId !== -1 && groups[groupId]) {
                    if (!renderedGroupIds.has(groupId)) {
                        renderedGroupIds.add(groupId);
                        const groupInfo = groups[groupId];
                        const groupTabs = winTabs.filter(t => t.groupId === groupId);
                        list.appendChild(createGroupElement(groupInfo, groupTabs));
                    }
                } else if (!groupId || groupId === -1) {
                    list.appendChild(createTabItem(tab));
                }
            });

            body.appendChild(winCard);
        });
    }

    // ==========================================
    // DOM BUILDERS
    // ==========================================
    function createPinnedPill(tab) {
        const pill = document.createElement('div');
        pill.className = `thanus-pinned-pill ${tab.active ? 'active' : ''}`;
        pill.title = tab.title || '';

        const iconUrl = tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://') ? tab.favIconUrl : DEFAULT_FAVICON_DATA_URI;

        pill.innerHTML = `
            <img src="${iconUrl}" class="thanus-pinned-icon">
            <span class="thanus-pinned-title">${escapeHTML(tab.title || 'Tab')}</span>
        `;

        const img = pill.querySelector('img');
        if (img) {
            img.addEventListener('error', () => { img.src = DEFAULT_FAVICON_DATA_URI; }, { once: true });
        }

        pill.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId: tab.id, windowId: tab.windowId });
        });

        return pill;
    }

    function createGroupElement(groupInfo, groupTabs) {
        const groupCard = document.createElement('div');
        groupCard.className = 'thanus-tab-group';

        const colorHex = GROUP_COLORS[groupInfo.color] || '#1a73e8';
        groupCard.style.borderColor = colorHex;

        const header = document.createElement('div');
        header.className = 'thanus-tab-group-header';
        header.style.backgroundColor = `${colorHex}22`;
        header.style.color = colorHex;
        header.innerHTML = `
            <span>● ${escapeHTML(groupInfo.title || 'Group')} (${groupTabs.length})</span>
            <button class="thanus-tab-btn" title="Close Group" style="color: inherit;">✕</button>
        `;

        header.querySelector('button').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            groupTabs.forEach(t => chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId: t.id }));
        });

        groupCard.appendChild(header);

        const body = document.createElement('div');
        body.className = 'thanus-tab-group-body';
        groupTabs.forEach(tab => {
            body.appendChild(createTabItem(tab));
        });
        groupCard.appendChild(body);

        return groupCard;
    }

    function createTabItem(tab) {
        const item = document.createElement('div');
        item.className = `thanus-tab-item ${tab.active ? 'active' : ''} ${tab.discarded ? 'discarded' : ''}`;

        const iconUrl = tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://') ? tab.favIconUrl : DEFAULT_FAVICON_DATA_URI;
        const domain = getDomain(tab.url);

        item.innerHTML = `
            <div class="thanus-tab-main">
                <img src="${iconUrl}" class="thanus-tab-favicon">
                <div class="thanus-tab-info">
                    <span class="thanus-tab-title" title="${escapeHTML(tab.title || '')}">${escapeHTML(tab.title || 'Untitled')}</span>
                    <span class="thanus-tab-domain">${escapeHTML(domain)}</span>
                </div>
            </div>
            <div class="thanus-tab-actions">
                ${tab.audible || tab.mutedInfo?.muted ? `
                    <button class="thanus-tab-btn audio ${tab.mutedInfo?.muted ? 'muted' : 'playing'}" title="Toggle Mute">
                        ${tab.mutedInfo?.muted ? '🔇' : '🔊'}
                    </button>
                ` : ''}
                ${!tab.discarded && !tab.active ? `
                    <button class="thanus-tab-btn sleep" title="Sleep / Free RAM">💤</button>
                ` : ''}
                <button class="thanus-tab-btn close" title="Close Tab">✕</button>
            </div>
        `;

        const img = item.querySelector('.thanus-tab-favicon');
        if (img) {
            img.addEventListener('error', () => { img.src = DEFAULT_FAVICON_DATA_URI; }, { once: true });
        }

        // Switch to tab (Prevent click bleed-through)
        item.querySelector('.thanus-tab-main').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId: tab.id, windowId: tab.windowId });
        });

        // Audio Mute
        const audioBtn = item.querySelector('.thanus-tab-btn.audio');
        if (audioBtn) {
            audioBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                chrome.runtime.sendMessage({ type: 'MUTE_TAB', tabId: tab.id, muted: !tab.mutedInfo?.muted });
            });
        }

        // Sleep
        const sleepBtn = item.querySelector('.thanus-tab-btn.sleep');
        if (sleepBtn) {
            sleepBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                chrome.runtime.sendMessage({ type: 'DISCARD_TAB', tabId: tab.id });
            });
        }

        // Close
        const closeBtn = item.querySelector('.thanus-tab-btn.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                item.style.opacity = '0';
                chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId: tab.id });
            });
        }

        return item;
    }

    // ==========================================
    // UTILITIES
    // ==========================================
    let saveTimeout = null;
    function saveSettingsDebounced() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const res = await chrome.storage.local.get(['appSettings']);
            const appSettings = res.appSettings || {};
            const updated = { ...appSettings, ...config };
            chrome.storage.local.set({ appSettings: updated });
        }, 300);
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getDomain(urlStr) {
        if (!urlStr) return '';
        try {
            if (urlStr.startsWith('chrome://')) return 'Chrome Internal';
            if (urlStr.startsWith('edge://')) return 'Edge Internal';
            return new URL(urlStr).hostname.replace(/^www\./, '');
        } catch (e) {
            return '';
        }
    }

    // Run on document ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
