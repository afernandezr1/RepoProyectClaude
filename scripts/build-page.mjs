#!/usr/bin/env node
/**
 * Build the browser version as ONE self-contained HTML page, suitable for
 * publishing as a Claude page (artifact):   npm run build:page
 *
 *  1. `expo export --platform web` with EXPO_PUBLIC_TARGET=artifact
 *     (single bundle, sql.js storage, in-app dialogs, Claude save prompt)
 *  2. inline the JS bundle and the sql.js asm.js engine (no WebAssembly,
 *     no worker, no network requests at runtime)
 *  3. replace image asset URLs with data: URIs
 *
 * Output: dist-page/steady-log.html (page content without <html>/<head>/<body>,
 * which the publishing host adds) and dist-page/preview.html (a complete
 * document for opening locally).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exportDir = join(root, 'dist-artifact');
const outDir = join(root, 'dist-page');

rmSync(exportDir, { recursive: true, force: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const r = spawnSync(npx, ['expo', 'export', '--platform', 'web', '--output-dir', exportDir], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_TARGET: 'artifact', EXPO_PUBLIC_HEALTH_ENABLED: 'false', CI: '1' },
});
if (r.status !== 0) process.exit(r.status ?? 1);

const html = readFileSync(join(exportDir, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
if (scripts.length !== 1) {
  console.error(`Expected exactly one bundle, found ${scripts.length}: ${scripts.join(', ')}`);
  process.exit(1);
}
let bundle = readFileSync(join(exportDir, scripts[0].replace(/^\//, '')), 'utf8');

// Images referenced by absolute path -> data URIs.
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
let inlined = 0;
bundle = bundle.replace(/"(\/assets\/[^"]+\.(png|jpg|gif|svg|ttf))"/g, (whole, p) => {
  const file = join(exportDir, p.replace(/^\//, ''));
  if (!existsSync(file)) return whole;
  inlined++;
  return JSON.stringify(`data:${MIME[extname(file)]};base64,${readFileSync(file).toString('base64')}`);
});

const sqlEngine = readFileSync(join(root, 'node_modules', 'sql.js', 'dist', 'sql-asm.js'), 'utf8');

// Make inline <script> content safe inside HTML.
const safe = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const content = `<title>Steady Log</title>
<style>
/* Calm training log: the app paints its own screens; these tokens only set the page ground. */
:root { --bg: #F6F5F2; --fg: #1F2328 }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #141617; --fg: #ECEDEE; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #141617; --fg: #ECEDEE; color-scheme: dark }
html, body { height: 100% }
body { background: var(--bg); color: var(--fg); overflow: hidden }
#root { display: flex; height: 100%; flex: 1 }
</style>
<div id="root"></div>
<script>
/* The router keeps its screens in location.pathname; start every visit at the Today screen. */
try { if (location.pathname !== '/') history.replaceState(null, '', '/'); } catch (e) {}
</script>
<script>${safe(sqlEngine)}</script>
<script>${safe(bundle)}</script>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'steady-log.html'), content);
writeFileSync(
  join(outDir, 'preview.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${content}</body></html>`,
);
const mb = (Buffer.byteLength(content) / 1024 / 1024).toFixed(2);
console.log(`\nWrote dist-page/steady-log.html (${mb} MB, ${inlined} images inlined).`);
if (readdirSync(outDir).length === 0) process.exit(1);
