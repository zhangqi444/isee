/* Essay, precision review, mock exams and calendar — against dist/ under /isee/. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, 'dist');
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (!p.startsWith('/isee')) { res.writeHead(404); return res.end(); }
  p = p.slice(5) || '/'; if (p === '/') p = '/index.html';
  const f = path.join(DIST, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
const exe = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
let failures = 0; const check = (n, ok, x) => { console.log((ok ? '  ok   ' : '  FAIL ') + n + (x ? '  ' + x : '')); if (!ok) failures++; };
const body = async (pg) => (await pg.textContent('body')).replace(/\s+/g, ' ');

(async () => {
  await new Promise((r) => srv.listen(8143, r));
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/fonts\.g|accounts\.google/, (r) => r.abort());
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  pg.on('dialog', (d) => d.accept());
  await pg.goto('http://localhost:8143/isee/', { waitUntil: 'networkidle' });
  await pg.waitForSelector('text=Sets completed');

  console.log('== sidebar + dashboard');
  const side = await pg.$$eval('[data-slot=sidebar-menu-button]', (n) => n.map((x) => x.textContent.trim()));
  check('sidebar has Essay / Mock exams / Calendar', ['Essay', 'Mock exams', 'Calendar'].every((t) => side.includes(t)), side.join(','));
  check('Essay sits with the subjects (after Reading)', side.indexOf('Essay') === side.indexOf('Reading') + 1);
  check('dashboard has an Essay card', /Essay.*weeks written/.test(await body(pg)));
  check('dashboard Coming up lists a mock', /Coming up.*Split diagnostic/.test(await body(pg)));

  console.log('== precision review');
  await pg.evaluate(() => { location.hash = '#/s/vr/W1'; });
  await pg.waitForSelector('[data-testid=precision-row]');
  check('VR week card shows Session 1 row', /Session 1 · Precision review/.test(await body(pg)));
  await pg.click('[data-testid=precision-row]');
  await pg.waitForSelector('[data-testid=pword]');
  const cards = await pg.$$('[data-testid=pword]');
  check('20 word cards', cards.length === 20);
  const filled = await pg.$$eval('[data-testid=pword] textarea', (n) => n.filter((t) => t.value.trim()).length);
  check('her 19 Week-1 responses migrated', filled === 19, filled + ' filled');
  check('W1 shows as submitted (from the sheet)', /Submitted/.test(await body(pg)));
  const first = await pg.$eval('[data-testid=pword] textarea', (t) => t.value);
  check('first response is hers', /benign/.test(first), first.slice(0, 40));
  await pg.click('[data-testid=pword] >> nth=0 >> [data-testid=reveal]');
  await pg.waitForSelector('[data-testid=meaning]');
  check('Check meaning reveals the Vocabulary Master entry', /harmless/.test(await pg.textContent('[data-testid=meaning]')));
  // W2: write one answer, rate it, persists after reload
  await pg.evaluate(() => { location.hash = '#/precision/W2'; });
  await pg.waitForSelector('[data-testid=pword]');
  check('W2 is a cluster week', /imply \/ infer/.test(await body(pg)));
  await pg.fill('[data-testid=pword] >> nth=0 >> textarea', 'imply is the speaker hinting; infer is the listener figuring it out');
  await pg.click('[data-testid=pword] >> nth=0 >> [data-testid=conf-3]');
  await pg.waitForTimeout(700);
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=pword]');
  check('precision response + confidence persist', (await pg.$eval('[data-testid=pword] >> nth=0 >> textarea', (t) => t.value)).includes('speaker hinting') && /1\/20 written/.test(await body(pg)));
  check('submit disabled until every word is answered', await pg.$eval('[data-testid=submit-precision]', (b) => b.disabled));

  console.log('== essay');
  await pg.evaluate(() => { location.hash = '#/essay'; });
  await pg.waitForSelector('[data-testid=essay-open-W1]');
  check('8 essay weeks listed with prompts', (await pg.$$('[data-testid^=essay-open-]')).length === 8 && /small responsibility/.test(await body(pg)));
  await pg.click('[data-testid=essay-open-W2]');
  await pg.waitForSelector('[data-testid=essay-prompt]');
  check('W2 prompt shown', /changed your mind/.test(await pg.textContent('[data-testid=essay-prompt]')));
  await pg.fill('#W2-plan-focus', 'I will show that listening changed my mind about the science fair.');
  await pg.click('text=Draft · 20');
  await pg.fill('#W2-draft-opening', 'Last spring I was sure my volcano would win. Then my friend showed me her seed experiment and I started to listen.');
  await pg.fill('#W2-draft-middle', 'She had measured every plant for three weeks. I had only mixed baking soda and vinegar once. I realized that a real experiment needs careful data, so I changed my project.');
  await pg.fill('#W2-draft-ending', 'Now I understand that changing my mind is not losing; it is learning.');
  await pg.waitForTimeout(700);
  check('word count updates', /\d{2,} words/.test(await body(pg)));
  await pg.click('text=Revise · 5');
  await pg.waitForSelector('[data-testid=essay-complete]');
  await pg.click('[data-testid=essay-complete]');
  await pg.waitForSelector('text=Complete');
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=essay-prompt]');
  const completeBadge = /Complete/.test(await pg.textContent('[data-slot=card-action]'));
  await pg.click('text=Plan · 5'); await pg.waitForSelector('#W2-plan-focus');
  check('essay draft + completion persist', completeBadge && (await pg.$eval('#W2-plan-focus', (t) => t.value)).includes('listening'));
  await pg.click('text=Guide');
  check('guide shows the eight lessons', /Read the prompt precisely/.test(await body(pg)) && /Revise, then edit/.test(await body(pg)));

  console.log('== mock exam');
  await pg.evaluate(() => { location.hash = '#/mock'; });
  await pg.waitForSelector('[data-testid=mock-open-DGN]');
  check('four forms listed', (await pg.$$('[data-testid^=mock-open-]')).length === 4);
  await pg.click('[data-testid=mock-open-DGN]');
  await pg.waitForSelector('[data-testid=mock-next]');
  check('split diagnostic shows Part A / Part B', /Part A/.test(await body(pg)) && /Part B/.test(await body(pg)));
  await pg.click('[data-testid=mock-next]');                       // VR
  await pg.waitForSelector('[data-testid=mock-start]');
  check('essay/answers not visible before start', !/most nearly means/.test(await body(pg)));
  await pg.click('[data-testid=mock-start]');
  await pg.waitForSelector('[data-testid=mock-timer]');
  const t0 = await pg.textContent('[data-testid=mock-timer]');
  check('VR timer starts near 20:00', /19:5\d|20:00/.test(t0), t0.trim());
  for (let k = 0; k < 5; k++) { await pg.click('[data-testid=choice] >> nth=1'); await pg.click('[data-testid=mock-next-q]'); }
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=mock-timer]');
  check('section resumes after reload, timer still running', /19:[0-5]\d/.test(await pg.textContent('[data-testid=mock-timer]')) && /5\/34 answered/.test(await body(pg)));
  // jump to the last question via palette and submit (dialog auto-accepted)
  await pg.click('text=All questions');
  await pg.click('button:has-text("34")');
  await pg.click('[data-testid=choice] >> nth=1');
  await pg.click('[data-testid=mock-submit]');
  await pg.waitForSelector('[data-testid=mock-score]');
  const sc = await pg.textContent('[data-testid=mock-score]');
  check('section submitted with raw score', /\d+\s*\/\s*34/.test(sc.replace(/\s+/g, ' ')), sc.replace(/\s+/g, ' ').slice(0, 80));
  check('misses stay hidden until the form is done', /unlocks when the whole form/.test(sc));
  // finish the rest quickly through the store, then the essay
  await pg.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('isee.v1'));
    for (const id of ['QR', 'RC', 'MA']) s.mocks.DGN.sections[id] = { started: Date.now() - 60000, endsAt: Date.now() + 60000, picks: { 0: 'A' }, submittedAt: new Date().toISOString(), right: 1, n: id === 'QR' ? 38 : id === 'RC' ? 25 : 30, timeUsed: 60000 };
    localStorage.setItem('isee.v1', JSON.stringify(s)); location.hash = '#/mock/DGN/ESSAY';
  });
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=mock-essay-start]');
  check('mock essay prompt hidden before start', !/others had overlooked/.test(await body(pg)));
  await pg.click('[data-testid=mock-essay-start]');
  await pg.waitForSelector('[data-testid=mock-essay-prompt]');
  check('mock essay prompt revealed after start', /others had overlooked/.test(await pg.textContent('[data-testid=mock-essay-prompt]')));
  await pg.fill('[data-testid=mock-essay-text]', 'Last summer I noticed a loose board on the dock that everyone stepped over. I told the lifeguard and we fixed it together.');
  await pg.click('[data-testid=mock-essay-submit]');
  await pg.waitForSelector('text=See results');
  await pg.click('text=See results');
  await pg.waitForSelector('[data-testid=mock-corrections]');
  const ov = await body(pg);
  check('results table + missed questions once the whole form is done', /Results/.test(ov) && /Missed questions · \d+/.test(ov) && /raw correct/.test(ov));
  await pg.click('[data-testid=mock-corrections]');
  await pg.waitForSelector('[data-testid=choice]');
  check('corrections drill opens as a runner', /Corrections/.test(await body(pg)));

  console.log('== calendar');
  await pg.evaluate(() => { location.hash = '#/calendar'; });
  await pg.waitForSelector('[data-testid=test-date]');
  const cal = await body(pg);
  check('ISEE seasons, school sittings and deadlines present', /Fall testing season/.test(cal) && /Bush School/.test(cal) && /Application deadline/.test(cal));
  check('plan weeks and mocks on the timeline', /W1 · plan week/.test(cal) && /Mock 1/.test(cal));
  check('today marker placed', (await pg.$('[data-testid=today-marker]')) !== null);
  check('known sittings offered as one-tap picks', (await pg.$$('[data-testid^=pick-]')).length >= 2);
  await pg.click('[data-testid=pick-bush-isee]');
  check('pick fills the date + format', (await pg.$eval('[data-testid=test-date]', (i) => i.value)) === '2026-10-24');
  await pg.fill('[data-testid=test-date]', '2026-12-05');
  await pg.selectOption('#testFormat', { index: 3 });
  await pg.click('[data-testid=test-save]');
  await pg.waitForSelector('text=days to go');
  check('test day saved with countdown', /\d+ days to go/.test(await body(pg)));
  await pg.evaluate(() => { location.hash = '#/'; });
  await pg.waitForSelector('text=Sets completed');
  check('dashboard shows days until the ISEE', /days until Sheila's ISEE/.test(await body(pg)));

  console.log('== checklist');
  await pg.evaluate(() => { location.hash = '#/checklist'; });
  await pg.waitForSelector('[data-testid=ck-item]');
  const wkText = await body(pg);
  check('week checklist lists VR precision, sets, essay, review', /Precision review/.test(wkText) && /Set 1/.test(wkText) && /Weekly essay/.test(wkText) && /review pile/i.test(wkText));
  const autoDone = await pg.$$eval('[data-testid=ck-item][data-done="1"]', (n) => n.length);
  check('finished work already ticked', autoDone >= 1, autoDone + ' ticked');
  await pg.fill('[data-testid=ck-add]', 'Tutor session Thursday'); await pg.press('[data-testid=ck-add]', 'Enter');
  await pg.waitForSelector('[data-testid=ck-custom]');
  await pg.click('[data-testid=ck-custom] >> button >> nth=0');
  await pg.waitForTimeout(300);
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=ck-custom]');
  check('custom item persists, ticked', /Tutor session Thursday/.test(await body(pg)) && (await pg.$eval('[data-testid=ck-custom] span', (e) => e.className.includes('line-through'))));
  await pg.click('text=This month');
  await pg.waitForSelector('text=Parent to-dos');
  check('month checklist has parent to-dos + plan weeks', /Parent to-dos/.test(await body(pg)) && /Plan weeks/.test(await body(pg)));
  await pg.click('[data-testid=ck-item][data-done="0"] >> nth=-1 >> button >> nth=0').catch(() => {});
  await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('text=plan tasks done');
  check('dashboard tile shows this week checklist progress', /\d+ of \d+ plan tasks done/.test(await body(pg)));

  check('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await pg.screenshot({ path: 'shot-calendar.png', fullPage: false });
  await b.close(); srv.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall feature checks passed'); process.exit(failures ? 1 : 0);
})();
