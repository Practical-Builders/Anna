import { analyzeImageFromBase64 } from "./claudeAPI.js";

const analyzeBtn = document.getElementById("analyze-btn");
const fileInput = document.getElementById("product-image");
const results = document.getElementById("results");

analyzeBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    showError("Please upload a product image.");
    return;
  }

  setLoading(true);

  try {
    const { base64Data, mediaType, previewUrl } = await readImageFile(file);
    const { colorDescriptions } = await analyzeImageFromBase64(base64Data, mediaType);
    showResults(colorDescriptions, previewUrl);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

/**
 * Reads an image File and returns its base64 data, MIME type, and a local
 * object URL suitable for displaying a preview.
 *
 * @param {File} file
 * @returns {Promise<{ base64Data: string, mediaType: string, previewUrl: string }>}
 */
function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is "data:<mediaType>;base64,<data>" — split off the prefix
      const [prefix, base64Data] = reader.result.split(",");
      const mediaType = prefix.replace("data:", "").replace(";base64", "");
      const previewUrl = URL.createObjectURL(file);
      resolve({ base64Data, mediaType, previewUrl });
    };
    reader.onerror = () => reject(new Error("Failed to read the image file."));
    reader.readAsDataURL(file);
  });
}

function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  if (isLoading) {
    results.innerHTML = "";
    const p = document.createElement("p");
    p.className = "loading";
    p.textContent = "Analyzing colors…";
    results.appendChild(p);
  }
}

function showResults(colorDescriptions, previewUrl) {
  results.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "results-layout";

  const img = document.createElement("img");
  img.className = "product-preview";
  img.src = previewUrl;
  img.alt = "Product image being analyzed";
  layout.appendChild(img);

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

  layout.appendChild(descSection);
  results.appendChild(layout);
}

function showError(message) {
  results.innerHTML = "";
  const p = document.createElement("p");
  p.className = "error";
  p.textContent = `Error: ${message}`;
  results.appendChild(p);
}
