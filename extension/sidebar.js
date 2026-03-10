const analyzeBtn = document.getElementById("analyze-btn");
const results = document.getElementById("results");

let currentPageUrl = null;

// Receive the current tab's URL from the content script
window.addEventListener("message", (event) => {
  if (event.data?.type === "INIT_URL") {
    currentPageUrl = event.data.url;
  }
});

// Close button
document.getElementById("close-btn").addEventListener("click", () => {
  window.parent.postMessage({ type: "CLOSE_SIDEBAR" }, "*");
});

// Analyze button
analyzeBtn.addEventListener("click", async () => {
  if (!currentPageUrl) {
    showError("Could not read the current page URL.");
    return;
  }

  setLoading(true);

  try {
    const res = await fetch("http://localhost:3001/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({ url: currentPageUrl }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server error ${res.status}`);
    }

    const { colorDescriptions, screenshot } = await res.json();
    showResults(colorDescriptions, `data:image/png;base64,${screenshot}`);
  } catch (err) {
    console.error("[accessible-colors] Fetch error:", err);
    if (
      err.message.includes("Failed to fetch") ||
      err.message.includes("NetworkError") ||
      err.message.includes("ERR_CONNECTION_REFUSED")
    ) {
      showError(
        "Unable to connect to ColorClear server. Make sure the server is running (npm run server)"
      );
    } else {
      showError(err.message);
    }
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  if (isLoading) {
    results.innerHTML = "";
    const p = document.createElement("p");
    p.className = "loading";
    p.textContent = "Analyzing colors… this may take up to 30 seconds.";
    results.appendChild(p);
  }
}

function showResults(colorDescriptions, previewUrl) {
  results.innerHTML = "";

  const img = document.createElement("img");
  img.className = "product-preview";
  img.src = previewUrl;
  img.alt = "Product image being analyzed";
  results.appendChild(img);

  const descSection = document.createElement("div");
  descSection.className = "color-descriptions";

  const heading = document.createElement("h2");
  heading.textContent = "Color Descriptions";
  descSection.appendChild(heading);

  const list = document.createElement("ul");
  for (const description of colorDescriptions) {
    const li = document.createElement("li");
    li.textContent = description;
    list.appendChild(li);
  }
  descSection.appendChild(list);
  results.appendChild(descSection);
}

function showError(message) {
  results.innerHTML = "";
  const p = document.createElement("p");
  p.className = "error";
  p.textContent = `Error: ${message}`;
  results.appendChild(p);
}
