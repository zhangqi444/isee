// Brand-new browser context: no cookies, no cache, no logged-in anything.
// Verifies the PUBLIC site the way a stranger (or Sheila) would first load it.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const MIME={'.html':'text/html','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith('/isee')) { res.writeHead(404); return res.end(); }
  p = p.slice(5) || '/'; if (p === '/') p = '/index.html';
  const f = path.join(__dirname, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'content-type': MIME[path.extname(f)] || 'text/plain'});
  res.end(fs.readFileSync(f));
});
const URL = process.argv[2] || 'http://localhost:8123/isee/';

(async () => {
  await new Promise(r => srv.listen(8123, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: undefined });
  const pg = await ctx.newPage();
  const bad = [];
  pg.on('pageerror', e => bad.push('pageerror: ' + e.message));
  pg.on('response', r => { if (r.status() >= 400) bad.push(`HTTP ${r.status()} ${r.url()}`); });

  const t0 = Date.now();
  const resp = await pg.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
  console.log('HTTP', resp.status(), '·', URL, '·', Date.now() - t0, 'ms');

  await pg.waitForSelector('.subj', { timeout: 15000 });
  console.log('subjects:', (await pg.$$eval('.subj .nm', n => n.map(x => x.textContent))).join(', '));
  console.log('this week:', await pg.$eval('.nowrow strong', e => e.textContent));

  const cts = await pg.evaluate(async () => {
    const j = await (await fetch('content/bundle.json')).json();
    return { items: Object.values(j.subjects).reduce((a, b) => a + b.length, 0),
             passages: Object.keys(j.passages).length, version: j.version };
  });
  console.log('bundle:', cts.items, 'items,', cts.passages, 'passages, v' + cts.version);

  // no horizontal scroll on a phone
  console.log('mobile h-scroll:', await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) ? 'FAIL' : 'none');

  // full run through a Reading set, choosing A every time
  await pg.click('[data-sub="rc"]'); await pg.waitForSelector('[data-week]');
  await pg.click('.rowbtn:nth-child(5)'); await pg.waitForSelector('[data-run]');
  await pg.click('[data-run]'); await pg.waitForSelector('.opt');
  console.log('passage rendered:', await pg.$('.passage') !== null);
  let n = 0, leak = false;
  for (;;) {
    if ((await pg.$$('.opt.good, .opt.bad')).length) leak = true;
    await pg.click('.opt[data-pick="0"]'); n++;
    const last = (await pg.$eval('[data-step="1"]', b => b.textContent)).includes('Finish');
    await pg.click('[data-step="1"]');
    if (last) break;
    await pg.waitForSelector('.opt');
    if (n > 30) break;
  }
  await pg.waitForSelector('.score');
  console.log(`answered ${n}; leaked before submit: ${leak ? 'FAIL' : 'no'};`,
              'score', await pg.$eval('.score .big', e => e.textContent),
              '·', (await pg.$eval('.score .of', e => e.textContent)).trim());
  console.log('explanations shown:', await pg.$$eval('.rev .why', e => e.length));

  // offline: reload with the network cut, service worker should serve it
  await ctx.setOffline(true);
  try {
    await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pg.waitForSelector('.subj', { timeout: 10000 });
    console.log('offline reload: works (service worker serving)');
  } catch (e) { console.log('offline reload: FAILED —', e.message.split('\n')[0]); }
  await ctx.setOffline(false);

  await pg.screenshot({ path: 'live-mobile.png' });
  const real = bad.filter(x => !/favicon|fonts\.g/.test(x));
  console.log(real.length ? 'ERRORS:\n  ' + real.join('\n  ') : 'no page errors, no 4xx/5xx');
  await b.close(); srv.close();
})();
