// zapper-content.js - Live Preview Element Zapper
(function() {
    if (window._zapperActive) return; // Prevent multiple injections
    window._zapperActive = true;

    // Inject Zapper CSS
    const styleId = 'privacy-manager-zapper-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .pm-zapper-highlight {
                outline: 3px solid #ff4757 !important;
                background-color: rgba(255, 71, 87, 0.2) !important;
                cursor: crosshair !important;
                transition: outline 0.1s, background-color 0.1s;
            }
            .pm-zapper-preview-hidden {
                visibility: hidden !important;
                opacity: 0 !important;
            }
            #pm-zapper-banner {
                position: fixed !important;
                top: 20px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                background: rgba(15, 23, 42, 0.92) !important;
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                color: #fff !important;
                padding: 10px 20px !important;
                border-radius: 40px !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                font-weight: 500 !important;
                font-size: 13px !important;
                border: 1px solid rgba(255, 71, 87, 0.4) !important;
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45) !important;
                z-index: 2147483647 !important;
                pointer-events: auto !important;
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                animation: pm-slide-down 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards !important;
                user-select: none !important;
            }
            .pm-zapper-keybadge {
                background: rgba(255, 255, 255, 0.15) !important;
                border: 1px solid rgba(255, 255, 255, 0.25) !important;
                padding: 2px 7px !important;
                border-radius: 5px !important;
                font-size: 11px !important;
                font-family: monospace !important;
                font-weight: 700 !important;
                color: #00f2fe !important;
            }
            #pm-zapper-hud {
                position: fixed !important;
                pointer-events: none !important;
                background: rgba(15, 23, 42, 0.95) !important;
                backdrop-filter: blur(8px) !important;
                color: #fff !important;
                padding: 6px 12px !important;
                border-radius: 8px !important;
                font-family: monospace !important;
                font-size: 11px !important;
                border: 1px solid #ff4757 !important;
                box-shadow: 0 8px 20px rgba(0,0,0,0.4) !important;
                z-index: 2147483646 !important;
                transition: opacity 0.15s ease, transform 0.15s ease !important;
                max-width: 380px !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
                display: none;
            }
            @keyframes pm-slide-down {
                0% { top: -50px !important; opacity: 0 !important; }
                100% { top: 20px !important; opacity: 1 !important; }
            }
        `;
        document.head.appendChild(style);
        
        // Add Banner
        const banner = document.createElement('div');
        banner.id = 'pm-zapper-banner';
        banner.innerHTML = `
            <span style="color: #ff4757; font-weight: 700;">🎯 Live Zapper</span>
            <span style="opacity: 0.3;">|</span>
            <span><span class="pm-zapper-keybadge">Click</span> Xóa</span>
            <span><span class="pm-zapper-keybadge">Space</span> Xem trước</span>
            <span><span class="pm-zapper-keybadge">W/S</span> Cha/Con</span>
            <span><span class="pm-zapper-keybadge">ESC</span> Thoát</span>
            <span id="pm-zapper-close-btn" style="cursor:pointer; margin-left:6px; background:rgba(255,255,255,0.15); padding:2px 7px; border-radius:50%; font-weight:bold; font-size:12px;" title="Thoát Zapper">&times;</span>
        `;
        
        banner.querySelector('#pm-zapper-close-btn').onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            exitZapper();
        };
        
        document.documentElement.appendChild(banner);

        // Add Floating HUD
        const hud = document.createElement('div');
        hud.id = 'pm-zapper-hud';
        document.documentElement.appendChild(hud);
    }

    let currentTarget = null;
    let isPreviewHidden = false;

    function getCssSelector(el) {
        if (!(el instanceof Element)) return '';
        const path = [];
        let curr = el;
        while (curr && curr.nodeType === Node.ELEMENT_NODE) {
            let selector = curr.nodeName.toLowerCase();
            if (curr.id) {
                selector += '#' + CSS.escape(curr.id);
                path.unshift(selector);
                break;
            } else {
                let sib = curr, nth = 1;
                while (sib = sib.previousElementSibling) {
                    if (sib.nodeName.toLowerCase() === selector) nth++;
                }
                if (nth !== 1) selector += ":nth-of-type(" + nth + ")";
            }
            path.unshift(selector);
            curr = curr.parentNode;
            if (curr && curr.nodeName.toLowerCase() === 'body') {
                path.unshift('body');
                break;
            }
        }
        return path.join(' > ');
    }

    function updateHUD(el) {
        const hud = document.getElementById('pm-zapper-hud');
        if (!hud || !el || !(el instanceof Element)) {
            if (hud) hud.style.display = 'none';
            return;
        }

        const rect = el.getBoundingClientRect();
        const tag = el.tagName.toLowerCase();
        const idStr = el.id ? `#${el.id}` : '';
        const classStr = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
        const dims = `${Math.round(rect.width)}x${Math.round(rect.height)}`;

        hud.innerHTML = `<span style="color:#00f2fe;">&lt;${tag}${idStr}${classStr}&gt;</span> <span style="color:#a4b0be;">(${dims})</span> ${isPreviewHidden ? '<span style="color:#ff4757; font-weight:bold;">[PREVIEW ẨN]</span>' : ''}`;
        
        let top = rect.top - 32;
        if (top < 10) top = rect.bottom + 8;
        let left = Math.max(10, Math.min(window.innerWidth - 390, rect.left));

        hud.style.top = `${top}px`;
        hud.style.left = `${left}px`;
        hud.style.display = 'block';
    }

    function setTarget(newEl) {
        if (!newEl || newEl === document.documentElement || newEl === document.body) return;
        if (newEl.id === 'pm-zapper-banner' || newEl.closest('#pm-zapper-banner') || newEl.id === 'pm-zapper-hud') return;

        if (currentTarget) {
            currentTarget.classList.remove('pm-zapper-highlight');
            if (isPreviewHidden) {
                currentTarget.classList.remove('pm-zapper-preview-hidden');
            }
        }

        currentTarget = newEl;
        isPreviewHidden = false;
        currentTarget.classList.add('pm-zapper-highlight');
        updateHUD(currentTarget);
    }

    function onMouseOver(e) {
        setTarget(e.target);
    }

    function onMouseOut(e) {
        // Only clear if leaving window
        if (!e.relatedTarget) {
            if (currentTarget) {
                currentTarget.classList.remove('pm-zapper-highlight', 'pm-zapper-preview-hidden');
                currentTarget = null;
            }
            const hud = document.getElementById('pm-zapper-hud');
            if (hud) hud.style.display = 'none';
        }
    }

    function onClick(e) {
        if (e.target.closest('#pm-zapper-banner')) return;
        e.preventDefault();
        e.stopPropagation();

        if (currentTarget) {
            currentTarget.classList.remove('pm-zapper-highlight', 'pm-zapper-preview-hidden');
            const selector = getCssSelector(currentTarget);
            
            // Immediately hide element
            currentTarget.style.display = 'none';

            // Send rule to background to save
            chrome.runtime.sendMessage({
                type: 'ZAP_ELEMENT',
                selector: selector,
                domain: window.location.hostname
            });

            exitZapper();
        }
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            exitZapper();
        } else if (e.code === 'Space') {
            e.preventDefault();
            e.stopPropagation();
            if (currentTarget) {
                isPreviewHidden = !isPreviewHidden;
                currentTarget.classList.toggle('pm-zapper-preview-hidden', isPreviewHidden);
                updateHUD(currentTarget);
            }
        } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
            // Traverse up to parent
            e.preventDefault();
            if (currentTarget && currentTarget.parentElement && currentTarget.parentElement !== document.body && currentTarget.parentElement !== document.documentElement) {
                setTarget(currentTarget.parentElement);
            }
        } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
            // Traverse down to first element child
            e.preventDefault();
            if (currentTarget && currentTarget.firstElementChild) {
                setTarget(currentTarget.firstElementChild);
            }
        }
    }

    function exitZapper() {
        document.removeEventListener('mouseover', onMouseOver, true);
        document.removeEventListener('mouseout', onMouseOut, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeyDown, true);
        
        const style = document.getElementById(styleId);
        if (style) style.remove();
        
        const banner = document.getElementById('pm-zapper-banner');
        if (banner) banner.remove();

        const hud = document.getElementById('pm-zapper-hud');
        if (hud) hud.remove();
        
        if (currentTarget) {
            currentTarget.classList.remove('pm-zapper-highlight', 'pm-zapper-preview-hidden');
            currentTarget = null;
        }
        window._zapperActive = false;
        
        chrome.runtime.sendMessage({ type: 'ZAP_EXITED' });
    }

    // Attach events in capture phase
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
})();
