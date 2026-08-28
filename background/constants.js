/**
 * constants.js — Single source of truth for background system IDs and rule boundaries
 */

const DNR_RULE_IDS = {
    // System Security Rules (1000 - 2999)
    CLICKJACKING: 1001,
    REALTIME_PROTECTION: 1002,
    NOSCRIPT: 1003,
    ADBLOCK_POPUP_START: 1004,
    ADBLOCK_POPUP_END: 1021,
    CLIENT_HINTS_SYNC: 1025,

    // Session Rules
    PRIVACY_PLAYER_EMBED: 2003,

    // Whitelist Rules
    YT_LIVE_CHAT_WHITELIST: 2005,
    YT_HEARTBEAT_WHITELIST: 2006,

    // Dynamic Compiled Rules Ranges
    SYSTEM_MAX_ID: 2999,
    COMPILED_ADBLOCK_START: 3000,
    COMPILED_ADBLOCK_END: 8999,
    MAX_COMPILED_ADBLOCK_RULES: 3500,

    // Zen Focus Mode Range
    ZEN_MODE_START: 9000,
    ZEN_MODE_END: 9999
};

// Export for Node.js test environments if applicable
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DNR_RULE_IDS };
}
