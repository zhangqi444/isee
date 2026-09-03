/* Smoke-test ../artifact.html the way the Artifact viewer serves it: wrapped in a bare skeleton, no network. */
const { chromium } = require('playwright'); const fs = require('fs'); const http = require('http');
const art = fs.readFileSync(__dirname + '/../artifact.html', 'utf8');
const page = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:14px system-ui}</style></head><body>' + art + '</body></html>';
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(page); });
const exe = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
(async () => {
  await new Promise((r) => srv.listen(8141, r));
  const b = await chromium.launch({ executablePath: exe }); const ctx = await b.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx.route(/fonts\.g/, (r) => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:8141/', { waitUntil: 'networkidle' });
  await pg.waitForSelector('text=Sets completed', { timeout: 10000 });
  const body = await pg.textContent('body');
  console.log('dashboard from inlined bundle:', /10\s*of\s*82/.test(body) ? 'ok' : 'FAIL');
  console.log('no Drive button in artifact:', (await pg.$('button:has-text("Save to Drive")')) === null ? 'ok' : 'FAIL');
  console.log('external requests:', JSON.stringify(await pg.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => !/fonts\.g/.test(n)))));
  await pg.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await pg.waitForTimeout(100);
  console.log('host data-theme=dark applied:', (await pg.evaluate(() => document.documentElement.classList.contains('dark'))) ? 'ok' : 'FAIL');
  await pg.screenshot({ path: 'shot-artifact-dark.png' });
  await pg.evaluate(() => { location.hash = '#/review/ma'; }); await pg.waitForSelector('[data-testid=choice]');
  console.log('review runs in artifact:', 'ok');
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
  await b.close(); srv.close();
})();
