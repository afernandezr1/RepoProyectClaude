const { chromium } = require('playwright');
/**
 * Optional UI smoke test of the happy path in a real browser (web build).
 * Not part of `npm test`. Usage:
 *   npm run web            # in one terminal (serves http://localhost:8081)
 *   npm run e2e:web        # in another; needs `npm i -D playwright` + a Chromium
 * Screenshots on failure go to e2e/output/.
 */
const fs = require('fs');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:8081';
const SP = __dirname + '/output';
fs.mkdirSync(SP, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('dialog', d => { console.log('dialog:', d.message().split('\n')[0]); d.accept(); });
  const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); await p.screenshot({ path: `${SP}/fail-${name.replace(/\W+/g,'_')}.png` }); throw e; } };
  const tid = (id) => p.locator(`[data-testid="${id}"]`);
  await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 120000 });
  try {
    await step('welcome + disclaimer', async () => { await tid('accept-disclaimer').click(); await p.getByText('Start a workout').waitFor(); });
    await step('start template', async () => { await tid('start-tpl-full-a').click(); await p.getByText('Goblet Squat').first().waitFor(); });
    await step('complete a set + rest timer', async () => {
      const w = p.locator('[data-testid^="weight-"]').first();
      await w.fill('20');
      await p.locator('[data-testid^="done-"]').first().click();
      await p.getByText(/^Rest \d+:\d\d$/).waitFor();
    });
    await step('validation error on empty set', async () => {
      const reps = p.locator('[data-testid^="reps-"]').nth(1); await reps.fill('');
      await p.locator('[data-testid^="weight-"]').nth(1).fill('abc');
      await p.locator('[data-testid^="done-"]').nth(1).click();
      await p.getByText('Weight must be a number.').waitFor();
    });
    await step('finish -> success', async () => { await tid('finish-workout').click(); await p.getByText('Workout saved. Nice work showing up.').waitFor(); });
    await step('history list', async () => { await p.goto(BASE + '/history'); await p.getByText('Full Body A').first().waitFor(); await p.getByText(/1 sets/).waitFor(); });
    await step('patterns', async () => { await p.goto(BASE + '/trends'); await p.getByText('This week: 1 session').waitFor(); });
    await step('add sleep log', async () => {
      await p.goto(BASE + '/logs'); await tid('add-log').click();
      await tid('log-kind-sleep').click();
      await tid('log-value').fill('30'); await tid('save-log').click();
      await p.getByText('A single entry can be at most 24 hours.').waitFor();
      await tid('log-value').fill('7.5'); await tid('save-log').click();
      await p.getByText('7.5 h').waitFor();
    });
    await step('export json', async () => {
      await p.goto(BASE + '/data');
      const [dl] = await Promise.all([p.waitForEvent('download'), tid('export-json').click()]);
      const name = dl.suggestedFilename(); console.log('   downloaded', name);
      const path = `${SP}/${name}`; await dl.saveAs(path);
      const j = JSON.parse(fs.readFileSync(path, 'utf8'));
      if (j.format !== 'steady-log-backup' || j.workouts.length !== 1 || j.logs.length !== 1) throw new Error('bad export');
      await p.getByText(/Downloaded steady-log-backup-/).waitFor();
    });
    await step('delete everything', async () => {
      await tid('delete-all').click();
      await tid('accept-disclaimer').waitFor();
      await tid('accept-disclaimer').click();
      await p.getByText('Start a workout').waitFor();
      await p.goto(BASE + '/history'); await p.getByText('No workouts logged yet').waitFor();
    });
  } catch (e) {
    process.exitCode = 1;
  } finally {
    console.log(errs.length ? errs.join('\n') : 'no page errors');
    await b.close();
  }
})();
