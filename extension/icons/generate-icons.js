/**
 * Generates icon16.png, icon48.png, and icon128.png using only Node.js
 * built-ins — no npm packages needed.
 * Run once: node extension/icons/generate-icons.js
 */
import zlib from "zlib";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Teal background (#0d6e8a) and white text (#ffffff)
const BG = [0x0d, 0x6e, 0x8a, 0xff];
const FG = [0xff, 0xff, 0xff, 0xff];

// ---- PNG encoding helpers ----

function crc32(buf) {
  const table = crc32.table || (crc32.table = buildCrcTable());
  let crc = 0xffffffff;
  for (const byte of buf) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function makePng(width, height, pixels) {
  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data: filter byte (0) + RGB rows
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.allocUnsafe(1 + width * 3);
    row[0] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixels[y][x];
      row[1 + x * 3] = r;
      row[1 + x * 3 + 1] = g;
      row[1 + x * 3 + 2] = b;
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Icon drawing ----

function drawIcon(size) {
  // Initialize all pixels to background color
  const pixels = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => BG.slice(0, 3))
  );

  // Draw rounded corners by clearing pixels outside the corner radius
  const r = Math.round(size * 0.18);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isOutsideRoundRect(x, y, size, size, r)) {
        pixels[y][x] = [255, 255, 255]; // transparent-ish (white for PNG)
      }
    }
  }

  // Draw "CC" text for larger icons using a simple bitmap font
  if (size >= 48) {
    drawText(pixels, size, "CC");
  }

  return pixels;
}

function isOutsideRoundRect(x, y, w, h, r) {
  // Check four corners
  if (x < r && y < r) return dist(x, y, r, r) > r;
  if (x >= w - r && y < r) return dist(x, y, w - r - 1, r) > r;
  if (x < r && y >= h - r) return dist(x, y, r, h - r - 1) > r;
  if (x >= w - r && y >= h - r) return dist(x, y, w - r - 1, h - r - 1) > r;
  return false;
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Simple 5×7 bitmap glyphs for "C"
const GLYPH_C = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
];

function drawText(pixels, size, text) {
  const glyphW = 5;
  const glyphH = 7;
  const gap = 2; // pixels between glyphs
  const scale = Math.max(1, Math.floor(size / 24));
  const totalW = text.length * glyphW * scale + (text.length - 1) * gap * scale;
  const totalH = glyphH * scale;
  const startX = Math.round((size - totalW) / 2);
  const startY = Math.round((size - totalH) / 2);

  for (let ci = 0; ci < text.length; ci++) {
    const glyph = GLYPH_C; // both characters are "C"
    const glyphStartX = startX + ci * (glyphW + gap) * scale;

    for (let gy = 0; gy < glyphH; gy++) {
      for (let gx = 0; gx < glyphW; gx++) {
        if (!glyph[gy][gx]) continue;
        // Draw scaled pixel block
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = glyphStartX + gx * scale + sx;
            const py = startY + gy * scale + sy;
            if (px >= 0 && px < size && py >= 0 && py < size) {
              pixels[py][px] = FG.slice(0, 3);
            }
          }
        }
      }
    }
  }
}

// ---- Generate icons ----

for (const size of [16, 48, 128]) {
  const pixels = drawIcon(size);
  const png = makePng(size, size, pixels);
  const outPath = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Wrote ${outPath} (${png.length} bytes)`);
}
