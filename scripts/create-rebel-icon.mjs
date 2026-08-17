import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const size = 512;
const pixels = Buffer.alloc(size * size * 4);

function mix(base, layer, amount) {
  return Math.round(base + (layer - base) * Math.max(0, Math.min(1, amount)));
}

function paint(x, y, color, alpha = 1) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const offset = (y * size + x) * 4;
  pixels[offset] = mix(pixels[offset], color[0], alpha);
  pixels[offset + 1] = mix(pixels[offset + 1], color[1], alpha);
  pixels[offset + 2] = mix(pixels[offset + 2], color[2], alpha);
  pixels[offset + 3] = 255;
}

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const dx = x - 270;
    const dy = y - 238;
    const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 390);
    const offset = (y * size + x) * 4;
    pixels[offset] = 9 + Math.round(20 * glow);
    pixels[offset + 1] = 16 + Math.round(14 * glow);
    pixels[offset + 2] = 32 + Math.round(50 * glow);
    pixels[offset + 3] = 255;
  }
}

// A strong abstract R: spine, top bowl, and rising diagonal leg.
for (let y = 94; y < 420; y += 1) {
  for (let x = 116; x < 186; x += 1) {
    const intensity = 0.76 + 0.24 * (1 - Math.abs(x - 151) / 35);
    paint(x, y, [124, 92, 252], intensity);
  }
}
for (let y = 90; y < 258; y += 1) {
  for (let x = 148; x < 365; x += 1) {
    const cx = 255;
    const cy = 174;
    const radius = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    const ring = Math.abs(radius - 102) < 31 && x > 145;
    if (ring) paint(x, y, [124, 92, 252], 0.9);
  }
}
for (let t = 0; t < 310; t += 1) {
  const x = 183 + Math.round(t * 0.66);
  const y = 242 + Math.round(t * 0.54);
  for (let oy = -23; oy <= 23; oy += 1) {
    for (let ox = -23; ox <= 23; ox += 1) {
      if (ox * ox + oy * oy < 520) paint(x + ox, y + oy, [124, 92, 252], 0.88);
    }
  }
}

const nodes = [[138, 109], [260, 73], [381, 163], [320, 285], [116, 310], [286, 430], [411, 347], [193, 242]];
for (const [cx, cy] of nodes) {
  for (let y = cy - 10; y <= cy + 10; y += 1) {
    for (let x = cx - 10; x <= cx + 10; x += 1) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= 10) paint(x, y, [68, 215, 255], 1 - d / 15);
    }
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const label = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([length, label, data, checksum]);
}

const rows = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y += 1) {
  const rowOffset = y * (size * 4 + 1);
  rows[rowOffset] = 0;
  pixels.copy(rows, rowOffset + 1, y * size * 4, (y + 1) * size * 4);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
for (const target of ["assets/images/icon.png", "assets/images/splash-icon.png", "assets/images/favicon.png", "assets/images/android-icon-foreground.png"]) {
  writeFileSync(target, png);
}
