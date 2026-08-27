import { readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { MaxRectsPacker } from "maxrects-packer";

const assetsDir = resolve("assets");

// Font metadata
const fontMeta = JSON.parse(readFileSync("font-meta.json", "utf-8"));
const FONT_CHARS = fontMeta.chars;

// Font glyphs (pre-split in assets/)
const FONT_SPRITES = fontMeta.widths.map((w, i) => ({
  id: `char${String(i).padStart(2, "0")}`,
  file: `char${String(i).padStart(2, "0")}.gif`,
  w,
  h: fontMeta.height,
}));

// Animation frames (order matters: stand=0, run1..4=1..4)
const FRAME_SPRITES = [
  { id: "stand", file: "stand.gif" },
  { id: "run1", file: "run-1.gif" },
  { id: "run2", file: "run-2.gif" },
  { id: "run3", file: "run-3.gif" },
  { id: "run4", file: "run-4.gif" },
];

// Other sprites
const OTHER_SPRITES = [
  { id: "spike", file: "spike.gif" },
  { id: "cloud", file: "cloud.gif" },
  { id: "star1", file: "star1.gif" },
  { id: "star2", file: "star2.gif" },
  { id: "star3", file: "star3.gif" },
  { id: "star4", file: "star4.gif" },
  { id: "star5", file: "star5.gif" },
  { id: "star6", file: "star6.gif" },
];

// Read GIF dimensions from header (bytes 6-9, little-endian)
function gifSize(filePath) {
  const buf = readFileSync(filePath);
  return { w: buf[6] | (buf[7] << 8), h: buf[8] | (buf[9] << 8) };
}

// Build sprite list with dimensions
const ALL_SPRITES = [...FRAME_SPRITES, ...OTHER_SPRITES].map((s) => {
  const filePath = resolve(assetsDir, s.file);
  const { w, h } = gifSize(filePath);
  return { ...s, filePath, w, h };
}).concat(FONT_SPRITES.map((s) => ({
  ...s,
  filePath: resolve(assetsDir, s.file),
})));

console.log("Input sprites:");
for (const s of ALL_SPRITES) {
  console.log(`  ${s.id}: ${s.w}x${s.h}`);
}

// Pack sprites
const packer = new MaxRectsPacker(512, 512, 1, {
  smart: true,
  pot: false,
  square: false,
  allowRotation: false,
});

packer.addArray(
  ALL_SPRITES.map((s) => ({ width: s.w, height: s.h, data: s }))
);

const bin = packer.bins[0];
console.log(`\nPacked size: ${bin.width}x${bin.height}`);

console.log("\nLayout:");
for (const r of bin.rects) {
  console.log(`  ${r.data.id}: (${r.x}, ${r.y}) ${r.width}x${r.height}`);
}

// Composite with sharp
const composites = await Promise.all(
  bin.rects.map(async (rect) => ({
    input: await sharp(rect.data.filePath).ensureAlpha().raw().toBuffer(),
    raw: { width: rect.width, height: rect.height, channels: 4 },
    left: rect.x,
    top: rect.y,
  }))
);

const outPath = resolve("sprites.gif");
await sharp({
  create: {
    width: bin.width,
    height: bin.height,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .gif()
  .toFile(outPath);

const fileSize = statSync(outPath).size;
console.log(`\nOutput: ${outPath}`);
console.log(`Size: ${bin.width}x${bin.height}, ${fileSize} bytes`);

// Generate sprites.ts
const lookup = new Map(bin.rects.map((r) => [r.data.id, r]));
const fmt = (s) => {
  const r = lookup.get(s.id);
  return `  [${r.x},${r.y},${r.width},${r.height}],`;
};

const tsContent = `// Auto-generated - do not edit
export const ATLAS = [
${ALL_SPRITES.map(fmt).join("\n")}
] as const;
export const FONT_CHARS = "${FONT_CHARS}";
export const SPRITE_START = ${FRAME_SPRITES.length};
export const FONT_START = ${FRAME_SPRITES.length + OTHER_SPRITES.length};
`;

const tsPath = resolve("sprites.ts");
writeFileSync(tsPath, tsContent);
console.log(`\nGenerated: ${tsPath}`);
