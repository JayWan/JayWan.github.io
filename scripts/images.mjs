#!/usr/bin/env node
// Media derivatives — the only thing Node is used for in the build.
//
// What it makes (all of it is generated, none of it is committed):
//
//   assets/images/thumbnail/<name>          350px sidebar thumbnails (committed ones are left alone)
//   assets/m/hero/<stem>-<ext>-<width>.avif  cover images at 480 / 800 / 1200 / 1600 px wide,
//   assets/m/hero/<stem>-<ext>-<width>.jpg   AVIF for browsers that take it, JPEG for the rest
//   _data/media.json                         what the templates and themes need to know:
//       hero.<file>  : { w, h, color, lqip, base, widths }
//       tracks.<file>: { duration, title, artist, bytes }
//
// A full-size cover is 0.1 – 11 MB; the home page used to load all 31 of them (45 MB).
// The 480px AVIFs of all covers together weigh about 0.4 MB.
//
//   node scripts/images.mjs            make whatever is missing or out of date
//   node scripts/images.mjs --force    regenerate everything
//
// "Out of date" is decided by content, not by file dates: assets/m/.manifest.json remembers a
// hash of the cover each set of derivatives was made from. That is what lets GitHub Actions keep
// assets/m in a cache between runs (a fresh checkout gives every file today's date, so dates
// would say "everything changed" and all ~240 files would be encoded again, which takes minutes).
// Covers the manifest has never seen fall back to the old rule: derivative newer than its source.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, stat, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HERO = path.join(root, 'assets/images/hero');
const THUMB = path.join(root, 'assets/images/thumbnail');
const OUT = path.join(root, 'assets/m/hero');
const BGM = path.join(root, 'assets/bgm');
const DATA = path.join(root, '_data/media.json');
const MANIFEST = path.join(root, 'assets/m/.manifest.json');   // a dotfile: Jekyll does not publish it
const WIDTHS = [480, 800, 1200, 1600];
const force = process.argv.includes('--force');

const mtime = async (p) => { try { return (await stat(p)).mtimeMs; } catch { return 0; } };
const isImage = (name) => /\.(jpe?g|png)$/i.test(name);

let sharpLib;
const sharp = async (...args) => (sharpLib ??= (await import('sharp')).default)(...args);

// ---------------------------------------------------------------- covers

async function covers() {
  await mkdir(OUT, { recursive: true });
  await mkdir(THUMB, { recursive: true });
  const names = (await readdir(HERO)).filter(isImage).sort();
  const thumbs = new Set(await readdir(THUMB));
  const seen = await readFile(MANIFEST, 'utf8').then(JSON.parse).catch(() => ({}));
  const manifest = {};
  const hero = {};
  let made = 0;

  for (const name of names) {
    const src = path.join(HERO, name);
    const srcTime = await mtime(src);
    // the cover's bytes plus the widths asked for: change either and its derivatives are redone
    const signature = createHash('sha1').update(await readFile(src)).update(WIDTHS.join(',')).digest('hex');
    const sameSource = name in seen ? seen[name] === signature : null;   // null: this cover was never recorded
    const slug = name.replace(/\.(\w+)$/, '-$1').toLowerCase();       // 24.jpg -> 24-jpg (24.png also exists)
    const meta = await (await sharp(src)).metadata();
    const [w, h] = (meta.orientation ?? 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
    const widths = [...new Set(WIDTHS.map((x) => Math.min(x, w)))];

    // thumbnails for the classic sidebar: only the missing ones, committed files are never rewritten
    if (!thumbs.has(name) || force) {
      await (await sharp(src)).rotate().resize({ width: 350, withoutEnlargement: true })
        .toFormat(/\.png$/i.test(name) ? 'png' : 'jpeg').toFile(path.join(THUMB, name));
      made++;
    }

    for (const width of widths) {
      for (const ext of ['avif', 'jpg']) {
        const out = path.join(OUT, `${slug}-${width}.${ext}`);
        const outTime = await mtime(out);
        if (!force && outTime && (sameSource ?? outTime > srcTime)) continue;
        const img = (await sharp(src)).rotate().flatten({ background: '#ffffff' }).resize({ width, withoutEnlargement: true });
        if (ext === 'avif') await img.avif({ quality: 52, effort: 4 }).toFile(out);
        else await img.jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(out);
        made++;
      }
    }

    // average colour (a calm placeholder) and a 16px blur-up preview
    const flat = (await sharp(src)).rotate().flatten({ background: '#ffffff' });
    const px = await flat.clone().resize(1, 1, { fit: 'fill' }).raw().toBuffer();
    const color = '#' + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    const tiny = await flat.clone().resize({ width: 16 }).webp({ quality: 35 }).toBuffer();
    hero[name] = {
      w, h, color,
      lqip: 'data:image/webp;base64,' + tiny.toString('base64'),
      base: `/assets/m/hero/${slug}`,
      widths,
    };
    manifest[name] = signature;
  }
  const json = JSON.stringify(manifest, null, 1) + '\n';
  if ((await readFile(MANIFEST, 'utf8').catch(() => '')) !== json) await writeFile(MANIFEST, json);
  return { hero, made, count: names.length };
}

// ---------------------------------------------------------------- songs

// Duration and tags straight from the MP3 bytes (no dependency): ID3v2 text frames for
// title/artist; length from the Xing/Info frame count, or from size / bitrate for plain CBR files.
const BITRATES = { 3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function id3Text(buf) {
  const enc = buf[0];
  let body = buf.subarray(1);
  let text;
  if (enc === 1 || enc === 2) {
    const be = enc === 2 || (body[0] === 0xfe && body[1] === 0xff);
    if (body[0] === 0xff || body[0] === 0xfe) body = body.subarray(2);
    if (be) body = Buffer.from(body).swap16();
    text = body.toString('utf16le');
  } else if (enc === 3) text = body.toString('utf8');
  else text = body.toString('latin1');
  return text.replace(/\0+$/, '').trim();
}

async function track(file) {
  const { size } = await stat(file);
  const fh = await open(file, 'r');
  try {
    const head = Buffer.alloc(Math.min(size, 512 * 1024));
    await fh.read(head, 0, head.length, 0);
    let pos = 0;
    const tags = {};
    if (head.toString('latin1', 0, 3) === 'ID3') {
      const ver = head[3];
      const tagSize = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
      let p = 10;
      while (p + 10 < Math.min(10 + tagSize, head.length)) {
        const id = head.toString('latin1', p, p + 4);
        if (!/^[A-Z0-9]{4}$/.test(id)) break;
        const len = ver === 4
          ? ((head[p + 4] & 0x7f) << 21) | ((head[p + 5] & 0x7f) << 14) | ((head[p + 6] & 0x7f) << 7) | (head[p + 7] & 0x7f)
          : head.readUInt32BE(p + 4);
        if (len <= 0) break;
        if ((id === 'TIT2' || id === 'TPE1') && p + 10 + len <= head.length) tags[id] = id3Text(head.subarray(p + 10, p + 10 + len));
        p += 10 + len;
      }
      pos = 10 + tagSize;
    }
    // first MPEG frame header after the tag
    let frame = Buffer.alloc(4096);
    let duration = null;
    for (let tries = 0; tries < 64 && pos < size - 4; tries++) {
      const { bytesRead } = await fh.read(frame, 0, frame.length, pos);
      let found = -1;
      for (let i = 0; i < bytesRead - 4; i++) {
        if (frame[i] === 0xff && (frame[i + 1] & 0xe0) === 0xe0) {
          const version = (frame[i + 1] >> 3) & 3, layer = (frame[i + 1] >> 1) & 3;
          const br = (frame[i + 2] >> 4) & 15, sr = (frame[i + 2] >> 2) & 3;
          if (version !== 1 && layer === 1 && br > 0 && br < 15 && sr < 3) { found = i; break; }
        }
      }
      if (found < 0) { pos += bytesRead - 4; continue; }
      const b = frame.subarray(found);
      const version = (b[1] >> 3) & 3;                      // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
      const bitrate = (version === 3 ? BITRATES[3] : BITRATES[2])[(b[2] >> 4) & 15] * 1000;
      const rate = RATES[version][(b[2] >> 2) & 3];
      const mono = ((b[3] >> 6) & 3) === 3;
      const samples = version === 3 ? 1152 : 576;
      const side = version === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17);
      const tag = b.toString('latin1', 4 + side, 8 + side);
      if ((tag === 'Xing' || tag === 'Info') && (b.readUInt32BE(8 + side) & 1)) {
        duration = (b.readUInt32BE(12 + side) * samples) / rate;
      } else {
        duration = ((size - pos - found) * 8) / bitrate;
      }
      break;
    }
    return { duration: duration ? Math.round(duration * 10) / 10 : null, title: tags.TIT2 || null, artist: tags.TPE1 || null, bytes: size };
  } finally {
    await fh.close();
  }
}

async function tracks() {
  const out = {};
  for (const name of (await readdir(BGM)).filter((n) => /\.mp3$/i.test(n)).sort()) {
    out[name] = await track(path.join(BGM, name));
  }
  return out;
}

// ---------------------------------------------------------------- main

const t0 = Date.now();
const { hero, made, count } = await covers();
const songs = await tracks();
await mkdir(path.dirname(DATA), { recursive: true });
const json = JSON.stringify({ hero, tracks: songs }, null, 1) + '\n';
if ((await readFile(DATA, 'utf8').catch(() => '')) !== json) await writeFile(DATA, json);
console.log(`images: ${count} covers, ${Object.keys(songs).length} songs, ${made} file(s) written in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
