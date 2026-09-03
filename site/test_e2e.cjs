/* End-to-end check of the built site, served under a GitHub Pages-style subpath (/isee/).
 * Run:  npm run build && node test_e2e.cjs
 * The sandbox cannot reach Google Fonts or accounts.google.com; those requests are
 * aborted so the page behaves as it would offline. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, 'dist');
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith('/isee')) { res.writeHead(404); return res.end(); }
  p = p.slice(5) || '/'; if (p === '/') p = '/index.html';
  const f = path.join(DIST, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
const exe = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
let failures = 0;
function check(name, ok, extra) { console.log((ok ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) failures++; }

(async () => {
  await new Promise((r) => srv.listen(8140, r));
  const b = await chromium.launch({ executablePath: exe });
  for (const [label, viewport] of [['desktop', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
    console.log('\n== ' + label + ' ==');
    const ctx = await b.newContext({ viewport });
    await ctx.route(/fonts\.googleapis|fonts\.gstatic|accounts\.google/, (r) => r.abort());
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error' && !/gsi|accounts\.google|fonts\.g|favicon|net::ERR_FAILED/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
    // A result saved by the very first site version (numeric `at`) must not break rendering.
    await pg.addInitScript(() => { if (!localStorage.getItem('isee.v1')) localStorage.setItem('isee.v1', JSON.stringify({ results: { 'rc:W5:0': { n: 12, right: 3, at: 1788395637217, wrong: [] } } })); });
    await pg.goto('http://localhost:8140/isee/', { waitUntil: 'networkidle' });

    // Dashboard renders from the migrated Week-1 seed (plus the one legacy set above)
    await pg.waitForSelector('[data-slot=card]', { timeout: 10000 });
    const cards = await pg.$$eval('[data-slot=card-description]', (n) => n.map((x) => x.textContent.trim()));
    check('dashboard stat cards', cards.includes('Sets completed') && cards.includes('Accuracy') && cards.includes('To review'));
    const body = await pg.textContent('body');
    check('seed applied + legacy set (11 of 82 sets)', /11\s*of\s*82/.test(body), body.match(/\d+\s*of\s*82/)?.[0]);
    check('legacy numeric timestamp renders as a date', /Sep 2/.test(body));
    check('review count 19 on dashboard', /19/.test(body));
    check('recent-sets table present', (await pg.$$('[data-slot=table-row]')).length > 1);
    check('accuracy chart drawn', (await pg.$$('.recharts-bar-rectangle')).length > 0, (await pg.$$('.recharts-bar-rectangle')).length + ' bars');

    // Global navigation: sidebar (drawer on phone) is reachable from every screen
    const isPhone = label === 'phone';
    if (isPhone) {
      check('sidebar hidden on phone until opened', (await pg.$('[data-slot=sidebar][data-mobile=true]')) === null);
      await pg.click('[data-slot=sidebar-trigger]');
      await pg.waitForSelector('[data-slot=sidebar][data-mobile=true]');
      check('sidebar drawer opens on phone', true);
      await pg.click('[data-slot=sidebar-menu-button]:has-text("Review")');
      await pg.waitForSelector('[data-slot=sidebar][data-mobile=true]', { state: 'detached' });
      check('drawer closes after navigation', true);
    } else {
      check('sidebar visible on desktop', (await pg.$('[data-slot=sidebar-container]')) !== null);
      await pg.click('[data-slot=sidebar-menu-button]:has-text("Review")');
    }
    await pg.waitForFunction(() => location.hash === '#/review');
    check('review page lists subjects', /to try again/.test(await pg.textContent('body')));

    // Enter a review; header breadcrumb + sidebar trigger must still be there; exit via breadcrumb
    await pg.click('button:has-text("Start review")');
    await pg.waitForSelector('[data-testid=choice]');
    check('review runner shows choices', (await pg.$$('[data-testid=choice]')).length === 4);
    check('header still present inside a review', (await pg.$('[data-slot=sidebar-trigger]')) !== null);
    const crumbs = await pg.$$eval('[data-slot=breadcrumb-item]', (n) => n.map((x) => x.textContent.trim()).filter(Boolean));
    check('breadcrumb trail inside review', crumbs[0] === 'Dashboard' && crumbs.includes('Review'), crumbs.join(' > '));
    await pg.click(isPhone ? '[data-testid=crumb-home]' : '[data-slot=breadcrumb-link]:has-text("Dashboard")');
    await pg.waitForFunction(() => location.hash === '#/' || location.hash === '');
    await pg.waitForSelector('text=Sets completed');
    check('exited review via breadcrumb', /Sets completed/.test(await pg.textContent('body')));

    // Run a full set: no answer leak before submit; all-A yields a plausible score; result persists
    await pg.evaluate(() => { location.hash = '#/run/rc/W2/0'; });
    await pg.waitForSelector('[data-testid=choice]');
    check('RC passage box present', (await pg.$('[data-slot=scroll-area]')) !== null);
    const expected = +(await pg.textContent('body')).match(/1 \/ (\d+)/)[1];
    let n = 0, leak = false;
    for (;;) {
      if (/Correct:/.test(await pg.textContent('body'))) leak = true;
      await pg.click('[data-testid=choice] >> nth=0'); n++;
      const t = await pg.textContent('[data-testid=next]');
      await pg.click('[data-testid=next]');
      if (/Finish/.test(t)) break;
      if (n > 20) break;
      await pg.waitForSelector('[data-testid=choice]');
    }
    await pg.waitForSelector('[data-testid=score]');
    const score = (await pg.textContent('[data-testid=score]')).replace(/\s+/g, ' ');
    check('set of ' + n + ' finished, no leak', n === expected && !leak, score.slice(0, 60));
    await pg.click('button:has-text("Back to sets")');
    await pg.waitForFunction(() => location.hash === '#/s/rc/W2');
    await pg.waitForSelector('text=Set 1');
    check('result badge on sets list', new RegExp('\\d+/' + expected).test(await pg.textContent('body')));

    // Keyboard shortcuts on a fresh set
    await pg.evaluate(() => { location.hash = '#/run/vr/W3/0'; });
    await pg.waitForSelector('[data-testid=choice]');
    await pg.keyboard.press('b');
    const picked = await pg.$eval('[data-testid=choice] >> nth=1', (e) => e.getAttribute('data-state'));
    check('keyboard B selects choice B', picked === 'checked');
    await pg.keyboard.press('Enter');
    await pg.waitForFunction(() => /2 \/ \d+/.test(document.body.textContent));
    check('Enter advances to question 2', true);

    // Theme toggle flips the .dark class and persists across reload
    const wasDark = await pg.evaluate(() => document.documentElement.classList.contains('dark'));
    await pg.click('button[aria-label="Toggle theme"]');
    const nowDark = await pg.evaluate(() => document.documentElement.classList.contains('dark'));
    check('theme toggle flips', wasDark !== nowDark);
    await pg.evaluate(() => { location.hash = '#/'; });
    await pg.reload({ waitUntil: 'networkidle' });
    await pg.waitForSelector('text=Sets completed');
    check('theme persists after reload', (await pg.evaluate(() => document.documentElement.classList.contains('dark'))) === nowDark);
    check('progress persists after reload', /12\s*of\s*82/.test(await pg.textContent('body')));
    await pg.click('button[aria-label="Toggle theme"]');   // back to light for the screenshot

    // Drive chip: offline here, so the click must not crash; status becomes "unavailable"
    if (!isPhone) {
      await pg.evaluate(() => { location.hash = '#/'; });
      await pg.click('button:has-text("Save to Drive")');
      await pg.waitForTimeout(300);
      check('Drive button degrades gracefully offline', !errs.length, await pg.$eval('[data-slot=sidebar-menu-button][data-size=lg]', (e) => e.textContent.trim()).catch(() => ''));
    }

    await pg.evaluate(() => { location.hash = '#/'; });
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: `shot-${label}-home.png`, fullPage: label === 'phone' });
    await pg.evaluate(() => { location.hash = '#/run/rc/W3/0'; });
    await pg.waitForSelector('[data-testid=choice]'); await pg.waitForTimeout(200);
    await pg.screenshot({ path: `shot-${label}-runner.png` });
    check('no page/console errors', !errs.length, errs.slice(0, 4).join(' | '));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
