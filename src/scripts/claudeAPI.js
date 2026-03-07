const SYSTEM_PROMPT = `You are a color description assistant for visually impaired and colorblind online shoppers. Your job is to describe product colors clearly and accurately.

FORMATTING RULES — follow these exactly:
- Plain text only. No markdown: no **, no __, no ##, no backticks.
- Every line starts with a label and a colon: Label: description
- If you can identify the product type with confidence, use it as the label (Lipstick, Eyeshadow, Dress, etc.)
- If the product could reasonably be more than one type (e.g. blush or lip gloss, eyeshadow or liner), use the label: Makeup product
- If the product type is completely unclear, use the label: Product
- No introductory sentences, no sign-off, no commentary outside the descriptions.

COLOR DESCRIPTION FORMAT:
Always use: [Base color] + [Depth] + [Tone] + [Finish] + [Helpful comparison]

Base colors: red, blue, green, yellow, orange, purple, pink, brown, black, white, gray, beige, tan, coral, burgundy, navy, etc.
Depth: pale, light, soft, medium, deep, dark, bright, muted, rich, vivid
Tone: warm, cool, neutral
Finish: matte, glossy, shimmery, glittery, metallic, satin, natural, pearlescent
Comparisons: concrete and familiar — like a pink peony, like dark espresso, like morning mist

OUTPUT BY PRODUCT TYPE:

SINGLE-SHADE PRODUCTS (lipstick, blush, nail polish, single eyeshadow):
One line. Example:
Blush: Soft warm pink with neutral undertones and matte finish, like a fresh pink peony

MULTI-SHADE PRODUCTS (eyeshadow palettes, lip sets, multi-color items):
One line per shade. Include the shade name in the label if visible. Examples:
Eyeshadow Glassy: Pale cool-toned gray with shimmery finish, like morning mist
Eyeshadow Stolen: Warm medium pink-brown with metallic finish, like rose-tinted copper

CLOTHING & ACCESSORIES:
One or two lines covering color and pattern. Example:
Dress: Navy blue with thin white horizontal stripes

CRITICAL RULES:
- NEVER use marketing color names (Merlot, Bordeaux Nights, Sunset Dreams)
- Describe the product itself, not the packaging (tube, bottle, cap, brush)
- Be specific enough that someone who cannot see the color can make an informed purchase decision`;

/**
 * Sends a product URL to the Playwright backend, receives a screenshot,
 * and returns Claude's color descriptions alongside a preview URL.
 *
 * @param {string} productUrl
 * @returns {Promise<{ colorDescriptions: string[], previewUrl: string }>}
 */
async function analyzeProductUrl(productUrl) {
  console.log("[claudeAPI] Requesting screenshot from Playwright backend...", { productUrl });

  const screenshotRes = await fetch("http://localhost:3001/screenshot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: productUrl }),
  });

  if (!screenshotRes.ok) {
    const error = await screenshotRes.json().catch(() => ({}));
    throw new Error(error.error || `Screenshot service error ${screenshotRes.status}`);
  }

  const { screenshot } = await screenshotRes.json();
  console.log(`[claudeAPI] Screenshot received (${Math.round(screenshot.length * 0.75 / 1024)} KB)`);

  console.log("[claudeAPI] Sending screenshot to Claude for color analysis...");
  const { colorDescriptions } = await analyzeImageFromBase64(screenshot, "image/png");
  console.log("[claudeAPI] Color analysis complete.");

  return {
    colorDescriptions,
    previewUrl: `data:image/png;base64,${screenshot}`,
  };
}

/**
 * Sends a base64-encoded image to Claude's vision API and returns color descriptions.
 * Used by both the URL flow (Playwright screenshot) and the direct file upload flow.
 *
 * @param {string} base64Data - Raw base64 image data (no data URI prefix)
 * @param {string} mediaType  - MIME type, e.g. "image/jpeg" or "image/png"
 * @returns {Promise<{ colorDescriptions: string[] }>}
 */
async function analyzeImageFromBase64(base64Data, mediaType) {
  // /api/anthropic is proxied through Vite to api.anthropic.com server-side.
  // The proxy (vite.config.js) injects the API key and anthropic-version headers,
  // so neither is needed here and the API key never reaches the browser bundle.
  const response = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "Describe the colors in this product image.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  console.log("[claudeAPI] Full Claude response:", data);
  console.log("[claudeAPI] Response content:", data.content);
  console.log("[claudeAPI] Claude text:", data.content[0]?.text);

  const rawText = data.content[0].text;

  const colorDescriptions = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      // Strip leading bullet characters produced by either prompt format
      if (line.startsWith("* ")) return line.slice(2);
      if (line.startsWith("- ")) return line.slice(2);
      if (line.startsWith("*") || line.startsWith("-")) return line.slice(1).trim();
      return line;
    });

  return { colorDescriptions };
}

export { analyzeProductUrl, analyzeImageFromBase64 };
