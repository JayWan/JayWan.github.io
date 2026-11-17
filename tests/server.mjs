// A small static file server that behaves like GitHub Pages where it matters to the tests:
//   - directories serve their index.html, unknown paths serve /404.html with status 404
//   - Range requests work (the audio player seeks)
//   - JavaScript modules, AVIF, MP3 and WOFF2 get the right Content-Type
//
// Used by the Playwright tests (tests/global-setup.mjs) and handy on its own:
//
//   node tests/server.mjs --dir _site --port 4201
//   node tests/server.mjs --dir _site --port 4201 --theme classic
//
// --theme <id> answers every page request that has no ?theme= with a redirect to the same
// page with ?theme=<id>, so a tool that cannot add query strings (a crawler, a visual diff)
// sees the whole site in one theme.

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

const isFile = async (p) => { try { return (await stat(p)).isFile() ? p : null; } catch { return null; } };

// What is sent when a file is missing and the site has no /404.html. Worded like the error page
// of `python3 -m http.server`, so a tool that compares this server with a Python-served copy of
// the site compares the sites and not the servers.
const NOT_FOUND = `<!DOCTYPE HTML>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <title>Error response</title>
    </head>
    <body>
        <h1>Error response</h1>
        <p>Error code: 404</p>
        <p>Message: File not found.</p>
        <p>Error code explanation: 404 - Nothing matches the given URI.</p>
    </body>
</html>
`;

export async function serve({ dir, port = 0, host = '127.0.0.1', theme = null, log = false }) {
  const root = path.resolve(dir);

  async function resolve(pathname) {
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return null; }
    const file = path.join(root, rel);
    if (!file.startsWith(root)) return null;                          // no escaping the root
    if (rel.endsWith('/')) return isFile(path.join(file, 'index.html'));
    return (await isFile(file)) || (await isFile(path.join(file, 'index.html')));
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let status = 200;
    let file = await resolve(url.pathname);
    if (!file) { status = 404; file = await isFile(path.join(root, '404.html')); }
    if (log) console.log(status, req.method, req.url);
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(NOT_FOUND); return; }

    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    if (theme && type.startsWith('text/html') && !url.searchParams.has('theme') && req.headers['sec-fetch-dest'] !== 'empty') {
      url.searchParams.set('theme', theme);
      res.writeHead(302, { Location: url.pathname + url.search }); res.end(); return;
    }

    const { size } = await stat(file);
    const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
    const range = status === 200 && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    let start = 0, end = size - 1;
    if (range && (range[1] || range[2])) {
      if (range[1]) { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])); }
      else start = Math.max(0, size - Number(range[2]));
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  });

  await new Promise((ok, fail) => server.once('error', fail).listen(port, host, ok));
  return { server, port: server.address().port, url: `http://${host}:${server.address().port}`, close: () => new Promise((ok) => server.close(ok)) };
}

// run directly: node tests/server.mjs --dir _site --port 4201 [--theme classic] [--log]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : fallback; };
  const s = await serve({ dir: arg('dir', '_site'), port: Number(arg('port', 4201)), theme: arg('theme', null), log: process.argv.includes('--log') });
  console.log(`serving ${path.resolve(arg('dir', '_site'))} at ${s.url}${arg('theme') ? ` (every page as ?theme=${arg('theme')})` : ''}`);
}
