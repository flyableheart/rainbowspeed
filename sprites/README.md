# Sprite Packer

Packs individual GIF assets into a single sprite sheet.

## Usage

```bash
cd sprites
bun install
bun pack.js
```

This generates two files in the current directory:

- `sprites.gif` — packed sprite sheet
- `sprites.ts` — atlas coordinates and metadata

Copy them to the project:

```bash
cp sprites.gif ../public/
cp sprites.ts ../src/
```
