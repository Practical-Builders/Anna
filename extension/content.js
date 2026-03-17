// Wrap in IIFE so top-level `const` declarations don't conflict when Chrome
// re-injects this script on subsequent icon clicks.
(() => {
  console.log("[ColorClear] Content script loaded");

  // Prevent double-injection: if the sidebar already exists, remove it (toggle behavior).
  const existingSidebar = document.getElementById("accessible-colors-root");
  if (existingSidebar) {
    console.log("[ColorClear] Sidebar already present — removing (toggle off)");
    existingSidebar.remove();
    return;
  }

  console.log("[ColorClear] Showing sidebar");
  injectSidebar();

  function injectSidebar() {
    // Popup iframe — isolated from the host page styles/scripts
    const root = document.createElement("iframe");
    root.src = chrome.runtime.getURL("sidebar.html");
    root.id = "accessible-colors-root";
    root.style.cssText = `
      all: initial;
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      height: 560px;
      border: none;
      border-radius: 4px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      z-index: 2147483647;
    `;

    document.body.appendChild(root);

    // iframe is both root and the element we reference below
    const iframe = root;

    // Pass the current page URL to the sidebar once it loads
    iframe.addEventListener("load", () => {
      console.log("[ColorClear] Calling API with URL:", window.location.href);
      iframe.contentWindow.postMessage(
        { type: "INIT_URL", url: window.location.href },
        "*"
      );
    });

    // Listen for close requests from the sidebar
    window.addEventListener("message", (event) => {
      console.log("[ColorClear] Message received:", event.data);
      if (event.data?.type === "CLOSE_SIDEBAR") {
        root.remove();
      }
    });

    // Escape key closes the sidebar
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") root.remove();
      },
      { once: true }
    );
  }
})();
