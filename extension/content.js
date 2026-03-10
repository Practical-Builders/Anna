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
    // Root container that holds overlay + iframe
    const root = document.createElement("div");
    root.id = "accessible-colors-root";
    root.style.cssText = `
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
    `;

    // Semi-transparent overlay (clicking it closes the sidebar)
    const overlay = document.createElement("div");
    overlay.id = "accessible-colors-overlay";
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.35);
      pointer-events: all;
      cursor: pointer;
    `;
    overlay.addEventListener("click", () => root.remove());

    // Sidebar iframe — isolated from the host page styles/scripts
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("sidebar.html");
    iframe.id = "accessible-colors-iframe";
    iframe.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 350px;
      height: 100%;
      border: none;
      pointer-events: all;
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.25);
    `;

    root.appendChild(overlay);
    root.appendChild(iframe);
    document.body.appendChild(root);

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
