export async function toggleFilterSource(sourceId, enabled) {
  try {
    if (enabled) {
      if (chrome.declarativeNetRequest.getAvailableStaticRuleCount) {
        const availableCount = await chrome.declarativeNetRequest.getAvailableStaticRuleCount();
        console.log(`[AdBlock] Static Rule Pool available: ${availableCount}`);
      }
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: [sourceId]
      });
      console.log(`[AdBlock] Enabled ruleset: ${sourceId}`);
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: [sourceId]
      });
      console.log(`[AdBlock] Disabled ruleset: ${sourceId}`);
    }
  } catch (err) {
    console.error(`[AdBlock] Error toggling ${sourceId}:`, err);
    throw err;
  }
}

export async function isRulesetEnabled(sourceId) {
    const enabledRulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
    return enabledRulesets.includes(sourceId);
}
