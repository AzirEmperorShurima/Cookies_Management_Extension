/**
 * default-css-rules.js
 * Pre-bundled Standard EasyList & Popular Sites CSS Element Hiding Rules.
 * Ensures the extension immediately has powerful cosmetic filtering without requiring manual downloads.
 */

export const DEFAULT_EASYLIST_CSS_RULES = {
    "global": [
        "div[id^=\"ad_\"]",
        "div[id^=\"google_ads_\"]",
        "div[id^=\"dfp-ad-\"]",
        "div[class*=\"ad-container\"]",
        "div[class*=\"ad-wrapper\"]",
        "div[class*=\"ad_wrapper\"]",
        "div[class*=\"banner-ad\"]",
        "div[class*=\"banner_ad\"]",
        "div[class*=\"sponsor-banner\"]",
        "div[class*=\"sponsored-post\"]",
        "div[class*=\"advertisement\"]",
        "div[class*=\"advert-block\"]",
        "div[class*=\"sticky-ad\"]",
        "div[class*=\"floating-ad\"]",
        "div[class*=\"bottom-sticky-ad\"]",
        "div[class*=\"popup-ad\"]",
        "div[id*=\"taboola\"]",
        "div[class*=\"taboola\"]",
        "div[id*=\"outbrain\"]",
        "div[class*=\"outbrain\"]",
        "div[id*=\"mgid\"]",
        "div[class*=\"mgid\"]",
        "div[class*=\"ad-slot\"]",
        "div[class*=\"ads-holder\"]",
        "div[data-ad-unit]",
        "div[data-ad-slot]",
        "div[data-ad-client]",
        "div[data-google-query-id]",
        "ins.adsbygoogle",
        "amp-ad",
        "amp-embed[type=\"taboola\"]",
        "amp-embed[type=\"outbrain\"]",
        "amp-embed[type=\"mgid\"]",
        "iframe[id^=\"google_ads_iframe\"]",
        "iframe[src*=\"doubleclick.net\"]",
        "iframe[src*=\"googlesyndication.com\"]",
        "iframe[src*=\"adnxs.com\"]",
        "iframe[src*=\"criteo.com\"]",
        "iframe[src*=\"adservice.google\"]",
        "iframe[src*=\"adsterra.com\"]",
        "iframe[src*=\"tsyndicate.com\"]",
        "iframe[src*=\"exoclick.com\"]",
        "iframe[src*=\"trafficstars.com\"]",
        "iframe[src*=\"popads.net\"]",
        "iframe[src*=\"propellerads.com\"]",
        "iframe[src*=\"monetag.com\"]",
        "a[href*=\"/click.php?\"]",
        "a[href*=\"adclick\"]",
        "a[href*=\"doubleclick.net/clk\"]",
        "aside[class*=\"ad-\"]",
        "aside[class*=\"ads-\"]",
        "section[class*=\"ad-box\"]",
        "section[class*=\"ad-banner\"]"
    ],
    "youtube.com": [
        "ytd-ad-slot-renderer",
        "ytd-in-feed-ad-layout-renderer",
        "ytd-banner-promo-renderer",
        "ytd-rich-item-renderer:has(> ytd-ad-slot-renderer)",
        "ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer)",
        "ytd-item-section-renderer:has(> #contents > ytd-ad-slot-renderer)",
        ".ytp-ad-overlay-container",
        ".ytp-ad-overlay-slot",
        ".ytp-ad-message-container",
        ".ytp-ad-action-interstitial-background",
        ".ytp-ad-progress-list",
        "#masthead-ad",
        "#player-ads",
        "#panels-ad-badge",
        "ytd-promoted-sparkles-web-renderer",
        "ytd-promoted-video-renderer",
        "ytd-player-legacy-desktop-watch-ads-renderer",
        "ytd-engagement-panel-section-list-renderer[target-id=\"engagement-panel-ads\"]",
        "ytd-merch-shelf-renderer",
        "div#root.ytd-display-ad-renderer",
        "#panels:has(ytd-ad-slot-renderer)",
        "yt-mealbar-promo-renderer"
    ],
    "google.com": [
        "#tads",
        "#tadsb",
        "#pla-ad-block",
        "div[data-text-ad]",
        ".commercial-unit-desktop-top",
        ".commercial-unit-desktop-rhs",
        "#bottomads",
        "div[aria-label=\"Ads\"]",
        "div[aria-label=\"Quảng cáo\"]"
    ],
    "facebook.com": [
        "div[data-pagelet*=\"FeedUnit\"]:has(a[href*=\"/__ad/\"])",
        "div[data-pagelet*=\"FeedUnit\"]:has(a[href*=\"/ad_\"])",
        "div[data-pagelet*=\"FeedUnit\"]:has(span:contains(\"Sponsored\"))",
        "div[data-pagelet*=\"FeedUnit\"]:has(span:contains(\"Được tài trợ\"))",
        "div[data-pagelet=\"RightRail\"]:has(div[aria-label*=\"Advertiser\"])",
        "div[data-pagelet=\"RightRail\"]:has(div[aria-label*=\"Được tài trợ\"])"
    ],
    "twitter.com": [
        "article:has(span:contains(\"Promoted\"))",
        "article:has(span:contains(\"Được quảng bá\"))",
        "div[data-testid=\"placementTracking\"]",
        "div[data-testid=\"sidebarColumn\"] aside[aria-label*=\"Who to follow\"]"
    ],
    "x.com": [
        "article:has(span:contains(\"Promoted\"))",
        "article:has(span:contains(\"Được quảng bá\"))",
        "div[data-testid=\"placementTracking\"]",
        "div[data-testid=\"sidebarColumn\"] aside[aria-label*=\"Who to follow\"]"
    ],
    "reddit.com": [
        "div.promotedlink",
        "div[data-promoted=\"true\"]",
        "shreddit-ad-post",
        "div[data-adclicklocation]",
        "div.premium-banner"
    ],
    "vnexpress.net": [
        ".banner_top",
        ".banner_sticky",
        ".banner-box",
        ".box-banner",
        ".banner_right",
        ".wrapper_box_banner",
        ".box_category_banner",
        "#box_banner_middle",
        ".banner_bottom",
        "div[id*=\"adm_container\"]",
        "div[id*=\"admicro\"]"
    ],
    "dantri.com.vn": [
        ".banner-container",
        ".banner-fixed",
        ".banner-middle",
        ".banner-bottom",
        ".ad-container",
        ".ad-holder",
        "div[data-name*=\"banner\"]",
        "div[id*=\"dantri_ad\"]"
    ],
    "tuoitre.vn": [
        ".banner-top",
        ".banner-bottom",
        ".banner-center",
        ".box-ad",
        ".ad-holder",
        "div[id*=\"adm_container\"]",
        "div[id*=\"adv_\"]"
    ],
    "thanhnien.vn": [
        ".zone-banner",
        ".banner-top",
        ".banner-bottom",
        ".ad-banner",
        "div[id*=\"banner_\"]",
        "div[id*=\"adm_container\"]"
    ],
    "24h.com.vn": [
        ".banner-top",
        ".banner-sticky",
        ".banner-right",
        ".ad-24h",
        ".banner_ads",
        "div[id*=\"adm_container\"]"
    ],
    "zingnews.vn": [
        ".banner-top",
        ".banner-bottom",
        ".banner-inner",
        ".ad-wrapper",
        "div[id*=\"zing_ad\"]"
    ],
    "kenh14.vn": [
        ".banner-top",
        ".banner-middle",
        ".banner-bottom",
        ".adv-sticky",
        ".ad-content",
        "div[id*=\"adm_container\"]"
    ],
    "shopee.vn": [
        ".shopee-header-section--banner",
        ".shopee-popup__container",
        ".shopee-banner-popup",
        ".home-banner-popup",
        ".banner-full-width"
    ],
    "lazada.vn": [
        ".lzd-act-popup",
        ".lzd-banner-popup",
        ".hp-mod-card:has(.lzd-ad-tag)",
        ".banner-layer"
    ],
    "tiktok.com": [
        "div[data-e2e=\"feed-ad\"]",
        "div[class*=\"DivAdCard\"]",
        "div[class*=\"DivAdBanner\"]",
        "div[class*=\"SponsoredTag\"]"
    ],
    "twitch.tv": [
        ".top-nav__ad-container",
        ".stream-display-ad__wrapper",
        ".ad-banner",
        "div[data-test-selector=\"ad-banner-selector\"]"
    ],
    "fptplay.vn": [
        ".banner-ads",
        ".ads-banner",
        ".video-ads-container",
        "div[id*=\"fpt_ads\"]"
    ],
    "vieon.vn": [
        ".vieon-banner-ad",
        ".ads-wrapper",
        ".banner-sticky-wrapper"
    ],
    "vtvgo.vn": [
        ".vtvgo-ads",
        ".banner-ad-box",
        ".ads-overlay"
    ]
};
