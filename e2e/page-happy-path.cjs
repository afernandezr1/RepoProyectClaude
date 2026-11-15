/**
 * Happy-path check of the single-page build (dist-page/preview.html) under
 * conditions like a published Claude page:
 *  - served from a nested path, not "/"
 *  - strict CSP: inline scripts only, no eval, no network requests
 *  - window.confirm always false; files saved only through claude.use("downloads")
 * Then reloads to prove data persisted in IndexedDB.
 *
 *   npm run build:page && npm run e2e:page     (needs `playwright` + Chromium)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const page = fs.readFileSync(path.join(__dirname, '..', 'dist-page', 'preview.html'));
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  "connect-src 'none'",
  'worker-src blob:',
].join('; ');

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/artifact/demo')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP });
    res.end(page);
  } else {
    res.writeHead(404);
    res.end();
  }
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const BASE = `http://localhost:${server.address().port}/artifact/demo`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  await ctx.addInitScript(() => {
    window.confirm = () => false;
    window.__saved = [];
    window.claude = {
      use: async (name) =>
        name === 'downloads'
          ? { save: async ({ filename, data }) => (window.__saved.push({ filename, data }), { status: 'saved' }) }
          : null,
    };
  });
  const p = await ctx.newPage();
  const problems = [];
  p.on('pageerror', (e) => problems.push('PAGEERROR: ' + e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') problems.push('console: ' + m.text());
  });
  const tid = (id) => p.locator(`[data-testid="${id}"]`);
  const nav = async (label) => p.getByRole('tab', { name: label }).first().click();
  const step = async (name, fn) => {
    try {
      await fn();
      console.log('OK  ', name);
    } catch (e) {
      console.log('FAIL', name, e.message.split('\n')[0]);
      await p.screenshot({ path: `${OUT}/page-fail-${name.replace(/\W+/g, '_')}.png` });
      throw e;
    }
  };

  try {
    await p.goto(BASE, { waitUntil: 'load' });
    await step('welcome + disclaimer', async () => {
      await tid('accept-disclaimer').click();
      await p.getByText('Empezar un entrenamiento').waitFor();
    });
    await step('start template + set + rest timer', async () => {
      await tid('start-tpl-full-a').click();
      await p.locator('[data-testid^="weight-"]').first().fill('20');
      await p.locator('[data-testid^="done-"]').first().click();
      await p.getByText(/^Descanso \d+:\d\d$/).waitFor();
    });
    await step('finish with in-app confirm', async () => {
      await tid('finish-workout').click();
      await tid('confirm-ok').click();
      await p.getByText('Entrenamiento guardado. ¡Bien hecho!').waitFor();
    });
    await step('history + patterns via tabs', async () => {
      await p.goBack().catch(() => undefined);
      await nav('Historial');
      await p.getByText(/1 series/).first().waitFor();
      await nav('Patrones');
      await p.getByText('Esta semana: 1 sesión').first().waitFor();
    });
    await step('add sleep log', async () => {
      await nav('Registros');
      await tid('add-log').click();
      await tid('log-kind-sleep').click();
      await tid('log-value').fill('7.5');
      await tid('save-log').click();
      await p.getByText('7,5 h').first().waitFor();
    });
    await step('data persists after reopening the page', async () => {
      await p.waitForTimeout(800); // debounce for the IndexedDB save
      await p.goto(BASE, { waitUntil: 'load' }); // the host reopens the page from its own address
      await p.getByText('Empezar un entrenamiento').waitFor(); // disclaimer remembered
      await nav('Historial');
      await p.getByText(/1 series/).first().waitFor();
    });
    await step('export via Claude save prompt', async () => {
      await nav('Ajustes');
      await p.getByText('Exportar, restaurar o borrar datos').click();
      await tid('export-json').click();
      await p.getByText(/Descargado steady-log-backup-/).waitFor();
      const saved = await p.evaluate(() => window.__saved);
      const j = JSON.parse(saved[0].data);
      if (j.workouts.length !== 1 || j.logs.length !== 1) throw new Error('unexpected export contents');
    });
    await step('delete everything with in-app confirms', async () => {
      await tid('delete-all').click();
      await tid('confirm-ok').click();
      await tid('confirm-ok').click();
      await tid('accept-disclaimer').waitFor();
    });
    await p.screenshot({ path: `${OUT}/page-final.png` });
  } catch {
    process.exitCode = 1;
  } finally {
    console.log(problems.length ? problems.join('\n') : 'no page errors or CSP violations');
    if (problems.length) process.exitCode = 1;
    await browser.close();
    server.close();
  }
})();
