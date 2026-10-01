'use strict';

/**
 * Generates the PWA / app-store icons for DocExpire.
 *
 * The icons are produced programmatically rather than committed as binaries so
 * they stay in sync with the brand colour and can be regenerated at any size:
 *
 *   node scripts/generate-icons.js
 *
 * Output: client/public/icons/*.png
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT_DIR = path.resolve(__dirname, '..', 'client', 'public', 'icons');
const RESOURCES_DIR = path.resolve(__dirname, '..', 'resources');

const BRAND = {
  background: [13, 27, 42], // deep navy, matches --color-navy
  accent: [45, 212, 191], // teal, matches --color-accent
  surface: [255, 255, 255],
  danger: [248, 113, 113],
};

const SIZES = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
  { file: 'favicon-64.png', size: 64, maskable: false },
  // Source for the native icon/splash generators, which resize from here.
  { file: 'icon-1024.png', size: 1024, maskable: false },
];

/* ------------------------------------------------------------------ png ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Encodes an RGBA pixel buffer as a PNG. */
function encodePng(rgba, width, height) {
  const stride = width * 4;
  // Each scanline is prefixed with a filter byte; 0 means "no filter".
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------- drawing ---- */

function createCanvas(size) {
  return { size, data: Buffer.alloc(size * size * 4) };
}

function setPixel(canvas, x, y, [r, g, b], alpha = 255) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
  const i = (y * canvas.size + x) * 4;
  // Simple source-over compositing so shapes can be layered.
  const src = alpha / 255;
  const dstA = canvas.data[i + 3] / 255;
  const outA = src + dstA * (1 - src);
  if (outA === 0) return;
  canvas.data[i] = Math.round((r * src + canvas.data[i] * dstA * (1 - src)) / outA);
  canvas.data[i + 1] = Math.round((g * src + canvas.data[i + 1] * dstA * (1 - src)) / outA);
  canvas.data[i + 2] = Math.round((b * src + canvas.data[i + 2] * dstA * (1 - src)) / outA);
  canvas.data[i + 3] = Math.round(outA * 255);
}

/** Signed distance to a rounded rectangle, used for cheap anti-aliasing. */
function roundedRectDistance(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

function fillRoundedRect(canvas, { cx, cy, halfW, halfH, radius }, colour, alpha = 255) {
  for (let y = 0; y < canvas.size; y += 1) {
    for (let x = 0; x < canvas.size; x += 1) {
      const distance = roundedRectDistance(x + 0.5, y + 0.5, cx, cy, halfW, halfH, radius);
      // One pixel of falloff gives smooth edges without a rasteriser.
      const coverage = Math.min(1, Math.max(0, 0.5 - distance));
      if (coverage > 0) setPixel(canvas, x, y, colour, Math.round(alpha * coverage));
    }
  }
}

function fillCircle(canvas, { cx, cy, radius }, colour, alpha = 255) {
  for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y += 1) {
    for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - radius;
      const coverage = Math.min(1, Math.max(0, 0.5 - distance));
      if (coverage > 0) setPixel(canvas, x, y, colour, Math.round(alpha * coverage));
    }
  }
}

/** A clock face: two hands drawn as thin rounded bars. */
function drawClock(canvas, cx, cy, radius, colour) {
  const handWidth = Math.max(2, radius * 0.16);
  fillRoundedRect(canvas, { cx, cy: cy - radius * 0.32, halfW: handWidth / 2, halfH: radius * 0.4, radius: handWidth / 2 }, colour);
  fillRoundedRect(canvas, { cx: cx + radius * 0.26, cy, halfW: radius * 0.34, halfH: handWidth / 2, radius: handWidth / 2 }, colour);
  fillCircle(canvas, { cx, cy, radius: handWidth * 0.62 }, colour);
}

function drawIcon(size, { maskable }) {
  const canvas = createCanvas(size);
  const u = size / 512; // all geometry is authored against a 512 grid

  if (maskable) {
    // Maskable icons must survive an aggressive circular crop, so the artwork
    // is inset into the safe zone and the background fills the whole square.
    fillRoundedRect(canvas, { cx: size / 2, cy: size / 2, halfW: size / 2, halfH: size / 2, radius: 0 }, BRAND.background);
  } else {
    fillRoundedRect(canvas, { cx: size / 2, cy: size / 2, halfW: size * 0.5, halfH: size * 0.5, radius: 112 * u }, BRAND.background);
  }

  drawArtwork(canvas, size, 1);
  return canvas;
}

/**
 * The native app icon.
 *
 * iOS rejects icons that contain an alpha channel, and both platforms apply
 * their own rounded or masked shape, so this variant is a full-bleed opaque
 * square with the artwork scaled down into the safe zone.
 */
function drawNativeIcon(size) {
  const canvas = createCanvas(size);
  fillRoundedRect(
    canvas,
    { cx: size / 2, cy: size / 2, halfW: size / 2, halfH: size / 2, radius: 0 },
    BRAND.background,
  );
  drawArtwork(canvas, size, 0.66);
  return canvas;
}

/** Draws the document sheet with its clock badge, scaled around the centre. */
function drawArtwork(canvas, size, scale) {
  const u = (size / 512) * scale;
  const cx = size / 2;
  const cy = size / 2;

  const sheetCx = cx - 26 * u;
  const sheetCy = cy - 14 * u;
  fillRoundedRect(
    canvas,
    { cx: sheetCx, cy: sheetCy, halfW: 104 * u, halfH: 130 * u, radius: 20 * u },
    BRAND.surface,
  );

  for (let i = 0; i < 3; i += 1) {
    const lineY = sheetCy - 58 * u + i * 34 * u;
    const lineWidth = i === 2 ? 52 * u : 76 * u;
    fillRoundedRect(
      canvas,
      { cx: sheetCx, cy: lineY, halfW: lineWidth, halfH: 9 * u, radius: 5 * u },
      i === 0 ? BRAND.danger : [203, 213, 225],
    );
  }

  const badgeCx = sheetCx + 96 * u;
  const badgeCy = sheetCy + 104 * u;
  const badgeRadius = 62 * u;
  fillCircle(canvas, { cx: badgeCx, cy: badgeCy, radius: badgeRadius + 10 * u }, BRAND.background);
  fillCircle(canvas, { cx: badgeCx, cy: badgeCy, radius: badgeRadius }, BRAND.accent);
  drawClock(canvas, badgeCx, badgeCy, badgeRadius * 0.62, BRAND.background);
}

/* ------------------------------------------------------------------ main ---- */

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(RESOURCES_DIR, { recursive: true });

  for (const { file, size, maskable } of SIZES) {
    const canvas = drawIcon(size, { maskable });
    const png = encodePng(canvas.data, canvas.size, canvas.size);
    fs.writeFileSync(path.join(OUT_DIR, file), png);
    console.log(`[icons] ${file} (${canvas.size}x${canvas.size}, ${png.length} bytes)`);
  }

  // Native source art for @capacitor/assets, which resizes it into the
  // platform icon and splash sets.
  const native = drawNativeIcon(1024);
  const nativePng = encodePng(native.data, native.size, native.size);
  fs.writeFileSync(path.join(RESOURCES_DIR, 'icon.png'), nativePng);
  console.log(`[icons] resources/icon.png (1024x1024, opaque, ${nativePng.length} bytes)`);

  const splash = drawNativeIcon(2732);
  const splashPng = encodePng(splash.data, splash.size, splash.size);
  fs.writeFileSync(path.join(RESOURCES_DIR, 'splash.png'), splashPng);
  console.log(`[icons] resources/splash.png (2732x2732, opaque, ${splashPng.length} bytes)`);
}

main();