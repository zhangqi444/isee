/* Drive session behaviour, with Google stubbed: sign-in once, survive a reload
 * without a new prompt, reconnect after expiry with prompt:'' (no consent). */
const { chromium } = require('playwright');
const { stubGoogle } = require('./test_google.cjs');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, 'dist');
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(DIST, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
const exe = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
let failures = 0; const check = (n, ok, x) => { console.log((ok ? '  ok   ' : '  FAIL ') + n + (x ? '  ' + x : '')); if (!ok) failures++; };
(async () => {
  await new Promise((r) => srv.listen(8142, r));
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
  await ctx.route(/fonts\.g|accounts\.google\.com\/gsi/, (r) => r.abort());
  const drive = await stubGoogle(ctx);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:8142/', { waitUntil: 'networkidle' });
  await pg.waitForSelector('[data-testid=signin-page]');
  check('a fresh visit is gated: the sign-in page, nothing else, no popup on load',
    (await pg.$('[data-testid=today]')) === null && (await pg.$('[data-slot=sidebar]')) === null
    && (await pg.evaluate(() => window.__gisCalls.length)) === 0);
  check('the gate says where the data goes', /your own Google Drive/.test(await pg.textContent('[data-testid=signin-page]')));

  await pg.click('[data-testid=signin-google]');
  try { await pg.waitForSelector('button:has-text("Saved to Drive")', { timeout: 8000 }); }
  catch (e) { console.log('DEBUG status button:', await pg.$eval('[data-slot=sidebar-footer]', (x) => x.textContent), '| calls:', JSON.stringify(drive.calls), '| gis:', JSON.stringify(await pg.evaluate(() => window.__gisCalls)), '| errs:', errs.join(' | ')); throw e; }
  check('first sign-in asks for consent once', JSON.stringify(await pg.evaluate(() => window.__gisCalls)) === '["consent"]');
  await pg.waitForSelector('[data-testid=today]', { timeout: 8000 });
  check('signing in opens the app', true);
  check('folder + progress.json created', drive.folder === 'folder1' && drive.file === 'file1' && /"results"/.test(drive.body));
  check('email shown in sidebar', /qi@example\.com/.test(await pg.textContent('[data-slot=sidebar-footer]')));

  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=today]');
  await pg.waitForSelector('button:has-text("Saved to Drive")', { timeout: 8000 });
  check('reload: still Saved to Drive with NO new Google prompt', (await pg.evaluate(() => window.__gisCalls.length)) === 1);
  check('a returning visit is not asked again', (await pg.$('[data-testid=signin-page]')) === null);

  // finish a set -> pushed to Drive
  await pg.evaluate(() => { location.hash = '#/run/ma/W2/0'; }); await pg.waitForSelector('[data-testid=choice]');
  for (let i = 0; i < 12; i++) { await pg.click('[data-testid=choice] >> nth=0'); await pg.click('[data-testid=next]'); if (i < 11) await pg.waitForSelector('[data-testid=choice]'); }
  await pg.waitForSelector('[data-testid=score]'); await pg.waitForTimeout(1600);
  check('finished set pushed to Drive', /"ma:W2:0"/.test(drive.body));
  check('learning records travel with it (schema 4, items, mixed)', /"schema":4/.test(drive.body) && /"items":\{"/.test(drive.body) && /"mixed"/.test(drive.body));

  // The hour expiry should be invisible: the next Drive call refreshes silently.
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); s.drive.exp = Date.now() - 1000; localStorage.setItem('isee.v1', JSON.stringify(s)); location.hash = '#/'; });
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=today]');
  await pg.waitForSelector('button:has-text("Saved to Drive")', { timeout: 8000 });
  check('an aged-out token refreshes itself with prompt:"" — no Reconnect button, no dialog',
    JSON.stringify(await pg.evaluate(() => window.__gisCalls)) === '["consent",""]'
    && (await pg.$('button:has-text("Reconnect Drive")')) === null
    && (await pg.$('[data-testid=signin-page]')) === null);

  // Only when the silent refresh cannot succeed is she asked — back at the gate.
  await pg.evaluate(() => {
    sessionStorage.setItem('gisFail', '1');
    const s = JSON.parse(localStorage.getItem('isee.v1')); s.drive.exp = Date.now() - 1000; localStorage.setItem('isee.v1', JSON.stringify(s));
  });
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForSelector('[data-testid=signin-page]', { timeout: 8000 });
  check('a refresh that needs a click sends her back to the gate, which knows she has been here',
    /Welcome back/.test(await pg.textContent('[data-testid=signin-page]')) && (await pg.$('[data-testid=today]')) === null);
  await pg.evaluate(() => sessionStorage.removeItem('gisFail'));
  await pg.click('[data-testid=signin-google]');
  await pg.waitForSelector('[data-testid=today]', { timeout: 8000 });
  check('signing in again returns her to the app with no consent screen',
    !(await pg.evaluate(() => window.__gisCalls)).slice(1).includes('consent'));
  check('and her work is still there', (await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('isee.v1')).results).length)) > 10);

  // A remote copy of the same attempt without per-item picks must not erase local picks (seed v3 upgrade case)
  drive.body = drive.body.replace(/"picks":\{[^}]*\}/g, '"picks":{}');
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); s.results['ma:W2:0'].picks = { X: 'A' }; localStorage.setItem('isee.v1', JSON.stringify(s)); });
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('button:has-text("Saved to Drive")', { timeout: 8000 });
  await pg.waitForTimeout(300);
  check('merge tie keeps local picks', (await pg.evaluate(() => JSON.parse(localStorage.getItem('isee.v1')).results['ma:W2:0'].picks.X)) === 'A');

  // Learning records: another device tagged a miss and reviewed it later -> the newer copy wins, histories are merged
  const missId = await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); return s.results['ma:W2:0'].wrong[0]; });
  {
    const remote = JSON.parse(drive.body.split('\r\n\r\n').pop().split('\r\n--')[0]);
    const r = remote.items[missId];
    const later = new Date(Date.now() + 60000).toISOString();
    remote.items[missId] = { ...r, tag: 'misread', sure: false, step: 1, at: later, hist: [...r.hist, { at: later, ok: true, ms: 4000, ctx: 'review' }] };
    drive.body = JSON.stringify(remote);
  }
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('button:has-text("Saved to Drive")', { timeout: 8000 });
  await pg.waitForTimeout(300);
  const merged = await pg.evaluate((id) => JSON.parse(localStorage.getItem('isee.v1')).items[id], missId);
  check('newer remote learning record wins tag + schedule, histories merged', merged.tag === 'misread' && merged.step === 1 && merged.hist.length === 2 && merged.hist[1].ctx === 'review', JSON.stringify(merged).slice(0, 160));

  // disconnect clears everything
  await pg.click('button:has-text("Saved to Drive")');
  await pg.waitForSelector('[data-testid=signin-page]', { timeout: 8000 });
  check('disconnect forgets the session and locks the door again',
    (await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); return !s.drive && !s.driveGranted && !s.driveOptIn })));
  check('no page errors', !errs.length, errs.join(' | '));
  await b.close(); srv.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall drive checks passed'); process.exit(failures ? 1 : 0);
})();
