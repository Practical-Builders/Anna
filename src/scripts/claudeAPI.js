const SYSTEM_PROMPT = `You are a color description specialist focused on accessibility for visually impaired shoppers.

When shown a product image, identify and describe each distinct color you see.

For each color use this format:
- Start with a base color name. Use only these words: red, blue, green, yellow, orange, purple, pink, brown, black, white, gray, beige
- Add depth descriptors where relevant: light, dark, deep, bright, pale, muted, soft
- Add tone when it helps: warm, cool, neutral
- Include finish if visible: matte, glossy, shimmery, metallic
- Add a familiar comparison when it helps clarity: "like red wine", "like a peach", "like the sky"

NEVER use marketing or fancy color names such as: Merlot, Bordeaux Nights, Sage, Champagne, Ivory, Nude, Blush, Taupe, Ecru, Oatmeal, Mushroom, Slate, Cobblestone, etc.

Good examples:
- "Deep burgundy red with cool undertones and matte finish, like red wine"
- "Soft coral pink with warm tones, like a peach"
- "Bright cobalt blue with a glossy finish"
- "Light warm beige, like natural sand"

Return only the list of color descriptions, one per line, each starting with a dash (-). List the name of object being explained like "Dress: ". No other commentary or explanation. Do not list the color of the background.`;

// =============================================================================
// URL FETCHING — disabled while building backend proxy
// Major e-commerce sites (Sephora, Amazon, etc.) block public CORS proxies
// with bot protection (Akamai/Cloudflare). Will re-enable once a server-side
// proxy is in place that can handle authenticated or proxied requests.
// =============================================================================

/*
function isAccessDenied(html) {
  const lower = html.toLowerCase().slice(0, 2000);
  return (
    lower.includes("<title>access denied</title>") ||
    lower.includes("<h1>access denied</h1>") ||
    lower.includes("you don't have permission") ||
    lower.includes("403 forbidden") ||
    lower.includes("robot check") ||
    lower.includes("automated access") ||
    lower.includes("captcha")
  );
}

async function fetchProductPage(url) {
  const proxies = [
    {
      name: "allorigins",
      fetch: async () => {
        const res = await fetch(
          `https://api.allorigins.win/get?disableCache=true&url=${encodeURIComponent(url)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.contents;
      },
    },
    {
      name: "corsproxy.io",
      fetch: async () => {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      },
    },
  ];

  for (const proxy of proxies) {
    try {
      const html = await proxy.fetch();
      if (!html) continue;
      if (isAccessDenied(html)) continue;
      return html;
    } catch {
      // try next proxy
    }
  }

  throw new Error(
    "This site is blocking automated access. Try a different product URL — sites like ASOS, H&M, or Zara tend to work."
  );
}

function getRawSrc(img) {
  return (
    img.getAttribute("data-src") ||
    img.getAttribute("data-lazy-src") ||
    img.getAttribute("data-lazy") ||
    img.getAttribute("data-original") ||
    img.getAttribute("data-image-src") ||
    img.getAttribute("data-zoom-image") ||
    img.getAttribute("srcset")?.split(",")[0]?.trim()?.split(" ")[0] ||
    img.getAttribute("src") ||
    null
  );
}

function resolveImageUrl(imageUrl, pageUrl) {
  if (!imageUrl) return null;
  try {
    return new URL(imageUrl, pageUrl).href;
  } catch {
    return imageUrl;
  }
}

function looksLikeProductImage(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  const isImage = /\.(jpe?g|png|webp|avif)(\?|$)/.test(lower) || lower.includes("/image") || lower.includes("/photo") || lower.includes("/product");
  const isJunk = lower.includes("logo") || lower.includes("icon") || lower.includes("sprite") || lower.includes("pixel") || lower.includes("tracking") || lower.includes("1x1");
  return isImage && !isJunk;
}

function extractProductImage(html, pageUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const ogImage = doc.querySelector('meta[property="og:image"]');
  const ogContent = ogImage?.getAttribute("content");
  if (ogContent) return resolveImageUrl(ogContent, pageUrl);

  const twitterImage = doc.querySelector('meta[name="twitter:image"], meta[name="twitter:image:src"]');
  const twitterContent = twitterImage?.getAttribute("content");
  if (twitterContent) return resolveImageUrl(twitterContent, pageUrl);

  const jsonLdScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent);
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        const imgUrl = entry.image?.[0] ?? entry.image;
        if (typeof imgUrl === "string" && imgUrl.startsWith("http")) return imgUrl;
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }

  const schemaImage = doc.querySelector('[itemprop="image"]');
  const schemaSrc = schemaImage?.getAttribute("content") || getRawSrc(schemaImage);
  if (schemaSrc) return resolveImageUrl(schemaSrc, pageUrl);

  const productSelectors = [
    '[data-testid="product-image"] img',
    '[data-testid="hero-image"] img',
    "#product-image",
    "img#product-image",
    ".product-image img",
    ".product__image",
    "img.product__image",
    ".product-image",
    "img.product-image",
    "#product-image img",
    ".gallery__image img",
    ".product-gallery img",
    ".pdp-image img",
    '[data-zoom-image]',
  ];
  for (const selector of productSelectors) {
    const el = doc.querySelector(selector);
    const rawSrc = el ? getRawSrc(el) : null;
    if (rawSrc) return resolveImageUrl(rawSrc, pageUrl);
  }

  const candidates = Array.from(doc.querySelectorAll("img"))
    .map((img) => ({
      resolved: resolveImageUrl(getRawSrc(img), pageUrl),
      htmlWidth: img.getAttribute("width"),
      htmlHeight: img.getAttribute("height"),
    }))
    .filter(({ resolved }) => resolved && looksLikeProductImage(resolved));

  if (candidates.length === 0) throw new Error("Could not find a product image on this page.");

  const withDimensions = candidates.filter((c) => c.htmlWidth && c.htmlHeight);
  const pool = withDimensions.length > 0 ? withDimensions : candidates;
  pool.sort((a, b) => Number(b.htmlWidth || 0) - Number(a.htmlWidth || 0));
  return pool[0].resolved;
}

async function analyzeProductColors(productPageUrl) {
  const html = await fetchProductPage(productPageUrl);
  const imageUrl = extractProductImage(html, productPageUrl);
  return analyzeImageFromBase64(...(await urlImageToBase64(imageUrl)), imageUrl);
}
*/

// =============================================================================
// ACTIVE: Direct image upload — bypasses CORS entirely
// =============================================================================

/**
 * Sends a base64-encoded image to Claude's vision API and returns color descriptions.
 *
 * @param {string} base64Data - Raw base64 image data (no data URI prefix)
 * @param {string} mediaType  - MIME type, e.g. "image/jpeg"
 * @returns {Promise<{ colorDescriptions: string[] }>}
 */
async function analyzeImageFromBase64(base64Data, mediaType) {
  // /api/anthropic is proxied through Vite to api.anthropic.com server-side.
  // The proxy (vite.config.js) injects the API key and anthropic-version headers,
  // so neither is needed here and the API key never reaches the browser bundle.
  const response = await fetch("/api/anthropic", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
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
  const rawText = data.content[0].text;

  const colorDescriptions = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map((line) => line.slice(1).trim());

  return { colorDescriptions };
}

export { analyzeImageFromBase64 };
