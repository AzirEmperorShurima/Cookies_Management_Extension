/**
 * cookie-destroyer.js
 * 
 * NOTE: Ephemeral tab tracking (onUpdated, onRemoved) has been CONSOLIDATED into tab-manager.js
 *       to avoid duplicate event listener registration.
 *
 * NOTE: Zen Mode context menu creation and click handler have been CONSOLIDATED into context-menu.js.
 *
 * NOTE: safeGetDomain() is defined in globals.js (single source of truth with tldts support).
 *
 * This file is retained in background.js import list but is now intentionally minimal.
 * All active logic has been moved to their canonical homes.
 */
