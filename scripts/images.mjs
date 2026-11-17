#!/usr/bin/env node
// Image derivatives — the only thing Node is used for in this project.
//
// Today there is one derivative: a 350px-wide thumbnail for every hero image
//   assets/images/hero/<name>.{jpg,jpeg,png}  ->  assets/images/thumbnail/<name>.<same ext>
// (shown in the sidebar of every letter).
//
// Only MISSING thumbnails are generated, so running this is cheap, never rewrites
// files that are already committed, and gives the same result on every machine.
//
//   node scripts/images.mjs            create missing thumbnails
//   node scripts/images.mjs --force    regenerate all of them (e.g. after replacing a hero image)

import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets/images/hero');
const OUT = path.join(root, 'assets/images/thumbnail');
const WIDTH = 350;
const force = process.argv.includes('--force');

await mkdir(OUT, { recursive: true });
const existing = new Set(await readdir(OUT));
const todo = (await readdir(SRC))
  .filter((name) => /\.(jpe?g|png)$/i.test(name))
  .filter((name) => force || !existing.has(name))
  .sort();

if (todo.length === 0) {
  console.log('images: thumbnails are up to date');
} else {
  const { default: sharp } = await import('sharp'); // loaded only when there is work to do
  for (const name of todo) {
    const format = /\.png$/i.test(name) ? 'png' : 'jpeg';
    await sharp(path.join(SRC, name))
      .resize({ width: WIDTH, withoutEnlargement: true })
      .toFormat(format)
      .toFile(path.join(OUT, name));
    console.log(`images: thumbnail/${name}`);
  }
}
