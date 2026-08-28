/**
 * modules/cookie-consent-dismiss.js
 * Automatically dismisses & rejects GDPR / CMP Cookie Consent banners & unlocks page scrolling
 */

(function () {
    'use strict';

    let isEnabled = true;

    try {
        chrome.storage.local.get(['appSettings'], (res) => {
            if (res && res.appSettings && res.appSettings.autoDismissCookieConsent === false) {
                isEnabled = false;
            }
        });

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.appSettings) {
                isEnabled = changes.appSettings.newValue ? (changes.appSettings.newValue.autoDismissCookieConsent !== false) : true;
            }
        });
    } catch (e) {}

    // Popular Reject / Dismiss button selectors across CMP frameworks
    const REJECT_BUTTON_SELECTORS = [
        // OneTrust
        '#onetrust-reject-all-handler',
        'button#onetrust-reject-all-handler',
        '.onetrust-close-btn-handler',
        // CookieBot
        '#CybotCookiebotDialogBodyButtonDecline',
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
        // Didomi
        '#didomi-notice-disagree-button',
        '.didomi-continue-without-agreeing',
        // Quantcast
        '.qc-cmp2-buttons button[mode="secondary"]',
        'button.qc-cmp2-footer-btn',
        // Usercentrics
        'button[data-testid="uc-deny-all-button"]',
        'button[data-testid="uc-accept-essential-button"]',
        // Complianz
        '.cmplz-btn.cmplz-deny',
        '.cmplz-btn.cmplz-dismiss',
        // TrustArc
        '.trustarc-banner-actions .trustarc-reject-all',
        // Generic reject patterns
        'button[id*="reject" i]',
        'button[class*="reject" i]',
        'button[id*="decline" i]',
        'button[class*="decline" i]',
        'button[id*="refuse" i]',
        'a[class*="reject" i]',
        'a[class*="decline" i]',
        'button[aria-label*="reject" i]',
        'button[aria-label*="decline" i]',
        '.cookie-banner button.deny',
        '.cookie-consent button.deny',
        '#cookie-notice .btn-deny',
        '#tarteaucitronAllDenied2'
    ];

    // Popular CMP Container & Overlay selectors
    const BANNER_CONTAINER_SELECTORS = [
        '#onetrust-banner-sdk',
        '#onetrust-consent-sdk',
        '#CybotCookiebotDialog',
        '#CybotCookiebotDialogBodyUnderlay',
        '#didomi-host',
        '#didomi-popup',
        '#qc-cmp2-container',
        '#usercentrics-root',
        '.cmplz-cookiebanner',
        '.cc-window',
        '.cc-banner',
        '#cookie-law-info-bar',
        '#cookie-law-info-again',
        '#cookie-consent-banner',
        '.cookie-consent-banner',
        '.cookie-notice-container',
        '#truste-consent-track',
        '.osano-cm-window',
        '.iubenda-cs-container',
        '#axeptio_overlay'
    ];

    function unlockScroll() {
        try {
            const html = document.documentElement;
            const body = document.body;
            if (html && getComputedStyle(html).overflow === 'hidden') {
                html.style.setProperty('overflow', 'auto', 'important');
            }
            if (body && getComputedStyle(body).overflow === 'hidden') {
                body.style.setProperty('overflow', 'auto', 'important');
            }
        } catch(e) {}
    }

    let bannerDismissedCount = 0;
    let observer = null;

    function dismissConsentBanners() {
        if (!isEnabled) return;

        let actionTaken = false;

        // 1. Try to click Reject / Decline button
        for (const selector of REJECT_BUTTON_SELECTORS) {
            try {
                const btn = document.querySelector(selector);
                if (btn && btn.offsetParent !== null) { // Visible button
                    btn.click();
                    actionTaken = true;
                    bannerDismissedCount++;
                    console.log('[Privacy Guard] Auto-clicked Cookie Reject button:', selector);
                    break;
                }
            } catch (e) {}
        }

        // 2. Hide container banners if still present
        for (const selector of BANNER_CONTAINER_SELECTORS) {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el && el.style.display !== 'none' && el.offsetParent !== null) {
                        el.style.setProperty('display', 'none', 'important');
                        el.style.setProperty('visibility', 'hidden', 'important');
                        el.style.setProperty('opacity', '0', 'important');
                        el.style.setProperty('pointer-events', 'none', 'important');
                        actionTaken = true;
                        bannerDismissedCount++;
                    }
                });
            } catch (e) {}
        }

        // 3. Unlock scrolling if banner was dismissed/hidden
        if (actionTaken) {
            unlockScroll();
            // If banner was dismissed, disconnect observer after 3 seconds of stabilization
            setTimeout(() => {
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
            }, 3000);
        }
    }

    // Run on start
    dismissConsentBanners();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', dismissConsentBanners);
    }

    // Run periodically after load to catch async CMP popups
    setTimeout(dismissConsentBanners, 500);
    setTimeout(dismissConsentBanners, 1500);
    setTimeout(dismissConsentBanners, 3000);

    // MutationObserver to catch dynamically injected CMP dialogs with auto-disconnect
    let debounceTimer = null;
    observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(dismissConsentBanners, 200);
    });

    const rootTarget = document.documentElement || document.body;
    if (rootTarget) {
        observer.observe(rootTarget, {
            childList: true,
            subtree: true
        });
    }

    // Global safety timeout: automatically disconnect observer after 12s to free CPU
    setTimeout(() => {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }, 12000);

})();
