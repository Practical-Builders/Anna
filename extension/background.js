console.log("[ColorClear] Background script loaded");

// Listen for extension icon clicks and inject the sidebar into the active tab.
chrome.action.onClicked.addListener(async (tab) => {
  console.log("[ColorClear] Extension icon clicked", tab);
  if (!tab.id) {
    console.error("[ColorClear] No tab ID found");
    return;
  }

  try {
    console.log("[ColorClear] Injecting content script");
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    console.log("[ColorClear] Content script injected successfully");
  } catch (err) {
    console.error("[ColorClear] Failed to inject content script:", err);
  }
});
