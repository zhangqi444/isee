const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const MIME = {'.html':'text/html','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(__dirname, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, {'content-type': MIME[path.extname(f)] || 'text/plain'});
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise(r => srv.listen(8099, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  const pg = await b.newPage({ viewport: { width: 430, height: 900 } });
  pg.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text()); });
  pg.on('pageerror', e => errs.push('pageerror: '+e.message));

  await pg.goto('http://localhost:8099/index.html', { waitUntil:'networkidle' });
  await pg.waitForSelector('.subj', { timeout: 5000 });

  const subjects = await pg.$$eval('.subj .nm', n => n.map(x => x.textContent));
  const thisWeek = await pg.$eval('.nowrow strong', n => n.textContent);
  console.log('home: subjects =', subjects.join(', '));
  console.log('home: current week =', thisWeek);

  // horizontal overflow check
  const ov = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log('horizontal scroll on mobile:', ov ? 'FAIL' : 'none');

  // drill: Reading (has passages) -> W5 -> Set 1
  await pg.click('[data-sub="rc"]');
  await pg.waitForSelector('.rowbtn');
  const weeks = await pg.$$eval('.rowbtn .t', n => n.map(x => x.textContent));
  console.log('rc weeks:', weeks.length, '->', weeks[0], '...', weeks[weeks.length-1]);
  await pg.click('.rowbtn:nth-child(5)');           // W5
  await pg.waitForSelector('[data-run]');
  await pg.click('[data-run]');
  await pg.waitForSelector('.opt');

  const hasPassage = await pg.$('.passage') !== null;
  console.log('rc runner shows passage:', hasPassage);

  // answer every question in the set, always choosing A, and confirm no key leaks
  let n = 0, leaked = false;
  for (;;) {
    const good = await pg.$$('.opt.good, .opt.bad');
    if (good.length) leaked = true;
    await pg.click('.opt[data-pick="0"]');
    n++;
    const label = await pg.$eval('[data-step="1"]', b => b.textContent);
    await pg.click('[data-step="1"]');
    if (label.indexOf('Finish') > -1) break;
    await pg.waitForSelector('.opt');
    if (n > 40) break;
  }
  console.log('answered', n, 'questions; answers leaked before submit:', leaked ? 'FAIL' : 'no');

  await pg.waitForSelector('.score');
  const score = await pg.$eval('.score .big', e => e.textContent);
  const of = await pg.$eval('.score .of', e => e.textContent.trim());
  const revs = await pg.$$eval('.rev', e => e.length);
  const whys = await pg.$$eval('.rev .why', e => e.length);
  console.log('results:', score, of, '| review rows:', revs, '| explanations shown:', whys);

  // persistence: reload and confirm the set is recorded
  await pg.goto('http://localhost:8099/index.html', { waitUntil:'networkidle' });
  await pg.waitForSelector('.subj');
  const prog = await pg.$$eval('.subj .sub.tnum', n => n.map(x => x.textContent));
  console.log('after reload, progress:', prog.join(' | '));
  const misses = await pg.$('[data-nav="review"]');
  console.log('review card present after misses:', !!misses);

  await pg.screenshot({ path: 'shot-light.png', fullPage: false });
  // runner + week list screenshots
  await pg.click('[data-sub="ma"]'); await pg.waitForSelector('.rowbtn');
  await pg.screenshot({ path: 'shot-weeks.png' });
  await pg.click('.rowbtn:nth-child(1)'); await pg.waitForSelector('[data-run]');
  await pg.click('[data-run]'); await pg.waitForSelector('.opt');
  await pg.click('.opt[data-pick="1"]');
  await pg.screenshot({ path: 'shot-runner.png' });
  await pg.emulateMedia({ colorScheme: 'dark' });
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForSelector('.subj');
  await pg.screenshot({ path: 'shot-dark.png', fullPage: false });

  // dark-theme contrast sanity: body bg must not be the light ground
  const bg = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const fg = await pg.evaluate(() => getComputedStyle(document.body).color);
  console.log('dark mode body bg', bg, 'fg', fg);

  console.log(errs.length ? 'ERRORS:\n  ' + errs.join('\n  ') : 'no console/page errors');
  await b.close(); srv.close();
})();
