// Runs once before the tests: build the site, serve it, stop the server afterwards.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default async function globalSetup() {
  let dir = process.env.SITE_DIR;
  if (!dir) {
    dir = path.join(root, 'tests/.site');
    const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
    run('node', ['scripts/images.mjs']);                                   // cover derivatives + _data/media.json (quick when up to date)
    run('bundle', ['exec', 'jekyll', 'build', '--destination', dir]);
  }
  if (!existsSync(path.join(dir, 'index.html'))) throw new Error(`no built site in ${dir}`);
  const server = await serve({ dir, port: Number(process.env.TEST_PORT) });
  return () => server.close();
}
