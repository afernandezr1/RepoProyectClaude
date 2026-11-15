#!/usr/bin/env node
/**
 * One-command local first run:  npm run first-run
 *
 *  1. checks the Node version
 *  2. creates .env from .env.example if it doesn't exist (never overwrites)
 *  3. installs dependencies if node_modules is missing
 *  4. starts the Expo dev server (scan the QR code with Expo Go, or press
 *     i / a / w for iOS simulator, Android emulator, or web)
 *
 * Extra arguments are passed to `expo start`, e.g. `npm run first-run -- --tunnel`.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  console.error(`Node ${process.versions.node} found; Node 20 or newer is required.`);
  process.exit(1);
}

const env = join(root, '.env');
if (!existsSync(env)) {
  copyFileSync(join(root, '.env.example'), env);
  console.log('Created .env from .env.example (health integrations off).');
}

if (!existsSync(join(root, 'node_modules', 'expo'))) {
  console.log('Installing dependencies…');
  const cmd = existsSync(join(root, 'package-lock.json')) ? 'ci' : 'install';
  const r = spawnSync(npm, [cmd, '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const r = spawnSync(npx, ['expo', 'start', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 0);
