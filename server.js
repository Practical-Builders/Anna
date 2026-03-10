import "dotenv/config";
import express from "express";
import cors from "cors";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());
import fs from "fs";

const PORT = 3001;
const TIMEOUT_MS = 30_000;

// Ordered list of CSS selectors to try when looking for the main product image.
// More specific / semantic selectors are tried first.
const PRODUCT_IMAGE_SELECTORS = [
  "img[itemprop='image']",
  "[data-testid='product-image'] img",
  "[data-testid='hero-image'] img",
  ".ProductImage img",
  ".ProductImage",
  ".product-image img",
  ".product-image",
  ".product__image",
  ".pdp-image img",
  ".hero-image img",
  "#product-image img",
  "#product-image",
];

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

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests from the Vite dev server and any Chrome extension
      if (
        !origin ||
        origin === "http://localhost:5173" ||
        origin.startsWith("chrome-extension://")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);
app.use(express.json());

/**
 * Takes a screenshot of the product image on a given URL.
 * Returns a Buffer with the PNG data.
 */
async function takeScreenshot(url) {
  console.log("[server] Launching headless Chromium with stealth settings...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      deviceScaleFactor: 2, // retina-quality captures
    });

    const page = await context.newPage();

    // Navigate waiting only for initial DOM — more reliable than networkidle on
    // JS-heavy retail sites that keep firing network requests indefinitely.
    console.log("[server] Navigating (waiting for domcontentloaded)...");
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
      console.log("[server] DOM ready. Waiting 3s for JS rendering...");
      await page.waitForTimeout(3000);
    } catch (navErr) {
      console.warn(
        `[server] Navigation did not fully complete (${navErr.message}). Attempting screenshot anyway...`
      );
    }

    // --- Try to screenshot just the product image element ---
    let screenshotBuffer;

    for (const selector of PRODUCT_IMAGE_SELECTORS) {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (!isVisible) continue;

      console.log(`[server] Found product image element via: ${selector}`);
      try {
        screenshotBuffer = await element.screenshot();
        console.log(
          `[server] Element screenshot captured (${Math.round(screenshotBuffer.length / 1024)} KB).`
        );
        break;
      } catch (elErr) {
        console.warn(
          `[server] Element screenshot failed for "${selector}": ${elErr.message}`
        );
      }
    }

    // --- Fallback: find the largest <img> by natural dimensions ---
    if (!screenshotBuffer) {
      console.log(
        "[server] No selector matched. Searching for largest image by natural dimensions..."
      );

      const largestImgSrc = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll("img"));
        const best = imgs.reduce(
          (prev, img) => {
            const area = img.naturalWidth * img.naturalHeight;
            return area > prev.area ? { area, src: img.src } : prev;
          },
          { area: 0, src: null }
        );
        return best.src;
      });

      if (largestImgSrc) {
        console.log(`[server] Largest image found: ${largestImgSrc}`);
        const element = page.locator(`img[src="${largestImgSrc}"]`).first();
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          try {
            screenshotBuffer = await element.screenshot();
            console.log(
              `[server] Largest-image screenshot captured (${Math.round(screenshotBuffer.length / 1024)} KB).`
            );
          } catch (elErr) {
            console.warn(
              `[server] Largest-image screenshot failed: ${elErr.message}`
            );
          }
        }
      }
    }

    // --- Final fallback: full-page screenshot ---
    if (!screenshotBuffer) {
      console.warn(
        "[server] Could not isolate a product image — falling back to full-page screenshot."
      );
      screenshotBuffer = await page.screenshot({ fullPage: true });
      console.log(
        `[server] Full-page screenshot captured (${Math.round(screenshotBuffer.length / 1024)} KB).`
      );
    }

    fs.writeFileSync("screenshot-debug.png", screenshotBuffer);
    console.log("[server] Debug screenshot saved to screenshot-debug.png");

    return screenshotBuffer;
  } finally {
    await browser.close();
    console.log("[server] Browser closed.");
  }
}

// --- /screenshot: returns raw base64 PNG (used by the Vite web app) ---
app.post("/screenshot", async (req, res) => {
  const { url } = req.body;
  console.log(`[server] Screenshot request received for: ${url}`);

  if (!url || !URL.canParse(url)) {
    return res.status(400).json({ error: "A valid URL is required." });
  }

  try {
    const screenshotBuffer = await takeScreenshot(url);
    res.json({ screenshot: screenshotBuffer.toString("base64") });
  } catch (err) {
    console.error("[server] Fatal error during screenshot:", err.message);
    res.status(502).json({ error: "Could not load the page. The site may be unreachable." });
  }
});

// --- /analyze: screenshots the URL then calls Claude API (used by the extension) ---
app.post("/analyze", async (req, res) => {
  const { url } = req.body;
  console.log(`[server] Analyze request received for: ${url}`);

  if (!url || !URL.canParse(url)) {
    return res.status(400).json({ error: "A valid URL is required." });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server." });
  }

  try {
    const screenshotBuffer = await takeScreenshot(url);
    const base64Image = screenshotBuffer.toString("base64");

    console.log("[server] Sending screenshot to Claude for color analysis...");
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
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
                  media_type: "image/png",
                  data: base64Image,
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

    if (!claudeRes.ok) {
      const error = await claudeRes.json().catch(() => ({}));
      throw new Error(error.error?.message || `Claude API error ${claudeRes.status}`);
    }

    const data = await claudeRes.json();
    const rawText = data.content[0].text;

    const colorDescriptions = rawText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        if (line.startsWith("* ")) return line.slice(2);
        if (line.startsWith("- ")) return line.slice(2);
        if (line.startsWith("*") || line.startsWith("-")) return line.slice(1).trim();
        return line;
      });

    console.log("[server] Color analysis complete.");
    res.json({
      colorDescriptions,
      screenshot: base64Image,
    });
  } catch (err) {
    console.error("[server] Fatal error during analyze:", err.message);
    res.status(502).json({ error: err.message || "Could not analyze the page." });
  }
});

app.listen(PORT, () => {
  console.log(`[server] Screenshot service running at http://localhost:${PORT}`);
});
