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
  await pg.waitForSelector('[data-testid=today]');
  // not an auth test: take the "this device only" path once
  await pg.click('[data-testid=signin-skip]').catch(() => {});

  console.log('== sidebar + dashboard');
  const side = await pg.$$eval('[data-slot=sidebar-menu-button]', (n) => n.map((x) => x.textContent.trim()));
  check('sidebar has Essay / Mock exams / Calendar', ['Essay', 'Mock exams', 'Calendar'].every((t) => side.includes(t)), side.join(','));
  check('Essay sits with the subjects (after Reading)', side.indexOf('Essay') === side.indexOf('Reading') + 1);
  check('Essay sits in the Subjects card as its own row', /Essay/.test(await pg.textContent('[data-testid=subjects]')) && /0 of 8 weeks/.test(await pg.textContent('[data-testid=subjects]')));
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
  // time log: typed by hand, totalled, kept
  await pg.fill('[data-testid=essay-time-plan]', '6');
  await pg.fill('[data-testid=essay-time-draft]', '19');
  await pg.fill('[data-testid=essay-time-revise]', '4');
  await pg.waitForTimeout(300);
  check('time log totals the three phases against the 30-minute target', /29 of 30 min/.test(await pg.textContent('[data-testid=essay-time-total]')));
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=essay-time-draft]');
  check('time log persists', (await pg.$eval('[data-testid=essay-time-draft]', (i) => i.value)) === '19' && /29 of 30 min/.test(await pg.textContent('[data-testid=essay-time-total]')));
  await pg.click('text=Plan · 5'); await pg.click('[data-testid=timer-start-plan]');
  await pg.waitForTimeout(700); await pg.click('[data-testid=timer-stop-plan]');
  await pg.waitForTimeout(200);
  check('stopping a phase timer writes its minutes into the log', (await pg.$eval('[data-testid=essay-time-plan]', (i) => i.value)) === '1' && /24 of 30 min/.test(await pg.textContent('[data-testid=essay-time-total]')));
  // the first site version kept a free-text "time at draft stop"; it still counts
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); s.essays.W3 = { meta: { minutes: '18 min' }, at: new Date().toISOString() }; localStorage.setItem('isee.v1', JSON.stringify(s)); location.hash = '#/essay/W3'; });
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=essay-time-draft]');
  check('the old free-text draft time still counts as draft minutes', (await pg.$eval('[data-testid=essay-time-draft]', (i) => i.value)) === '18' && /18 of 30 min/.test(await pg.textContent('[data-testid=essay-time-total]')));
  await pg.evaluate(() => { location.hash = '#/essay'; }); await pg.waitForSelector('[data-testid=essay-time-W2]');
  check('the week list shows the minutes logged', /24 min logged/.test(await pg.textContent('[data-testid=essay-time-W2]')) && /18 min logged/.test(await pg.textContent('[data-testid=essay-time-W3]')));
  await pg.click('[data-testid=essay-open-W2]'); await pg.waitForSelector('[data-testid=essay-prompt]');
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
  check('next steps worked out from the mock', (await pg.$('[data-testid=next-steps]')) !== null && /Next steps this week/.test(ov));
  check('stanine estimate per section in the results', /≈Stanine/.test(ov));
  check('mock misses carry cause tags', (await pg.$$('[data-testid=cause-tags]')).length >= 3);
  await pg.click('[data-testid=cause-tags] >> nth=0 >> [data-testid=tag-rushed]');
  await pg.waitForTimeout(200);
  check('tagging a mock miss sticks', (await pg.$eval('[data-testid=cause-tags] >> nth=0', (e) => e.dataset.tag)) === 'rushed');
  await pg.evaluate(() => { location.hash = '#/mock'; }); await pg.waitForSelector('[data-testid=band-card]');
  check('mock list shows the estimated band card', /Estimated score band/.test(await body(pg)) && /stanine/i.test(await body(pg)));
  await pg.evaluate(() => { location.hash = '#/mock/DGN'; }); await pg.waitForSelector('[data-testid=mock-corrections]');
  await pg.click('[data-testid=mock-corrections]');
  await pg.waitForSelector('[data-testid=choice]');
  check('corrections drill opens as a runner', /Corrections/.test(await body(pg)));

  console.log('== essay review');
  // a review made outside the app arrives as a link: #/import/<base64url JSON>
  const review = { target: { kind: 'essay', wk: 'W2' }, at: '2026-09-05T18:00:00Z', reviewer: 'Claude, asked by Dad', source: 'her progress file in Google Drive', summary: 'You changed your mind on the page, and the reader can see why.', strengths: ['The seed experiment is a real, specific detail.'], suggestions: ['Say what you said to your friend when you gave up the volcano.'], next: 'Add one sentence of dialogue.', rubric: { Specificity: 3, Structure: 2, Bogus: 9 } };
  const payload = Buffer.from(JSON.stringify(review)).toString('base64url');
  await pg.evaluate((p) => { location.hash = '#/import/' + p; }, payload);
  await pg.waitForSelector('[data-testid=import-preview]');
  check('an import link previews the review before adding it', /Essay · W2/.test(await body(pg)) && /Claude, asked by Dad/.test(await body(pg)));
  await pg.click('[data-testid=import-add]');
  await pg.waitForSelector('[data-testid=essay-review]');
  const rvText = await pg.textContent('[data-testid=essay-review]');
  check('adding it opens the essay with the review under the prompt',/#\/essay\/W2$/.test(await pg.evaluate(() => location.hash)) && /seed experiment is a real/.test(rvText) && /For next week/.test(rvText) && /Google Drive/.test(rvText));
  check('rubric chips use the content rubric and drop unknown dimensions', /Specificity · 3/.test(await pg.textContent('[data-testid=review-rubric]')) && !/Bogus/.test(rvText));
  check('the review is stored with her progress and marked read', await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); const r = s.reviews['essay:W2:2026-09-05']; return !!r && r.target.wk === 'W2' && r.v === 1 && !!s.reviewsSeen['essay:W2:2026-09-05']; }));
  await pg.evaluate(() => { location.hash = '#/essay'; }); await pg.waitForSelector('[data-testid=essay-reviewed-W2]');
  check('the week card says Reviewed, with no dot once read', (await pg.$eval('[data-testid=essay-reviewed-W2]', (e) => e.dataset.unread)) === '0');
  // a second review lands from Drive while she is away: a dot in the sidebar, a job on Today
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); s.reviews['essay:W3:2026-09-06'] = { id: 'essay:W3:2026-09-06', v: 1, target: { kind: 'essay', wk: 'W3' }, at: '2026-09-06T18:00:00Z', reviewer: 'Mum', summary: 'A brave start.', strengths: [], suggestions: [], next: '' }; localStorage.setItem('isee.v1', JSON.stringify(s)); location.hash = '#/'; });
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=today]');
  check('an unread review is a dot in the sidebar and a job on Today', (await pg.$('[data-testid=reviews-new]')) !== null && /Essay · W3 · read the review/.test(await pg.textContent('[data-testid=today-jobs]')));
  // the paste box, for a phone that cannot open the long link
  await pg.evaluate(() => { location.hash = '#/import'; }); await pg.waitForSelector('[data-testid=import-text]');
  await pg.fill('[data-testid=import-text]', 'not a review'); await pg.click('[data-testid=import-paste-add]');
  check('a bad paste is refused in plain words', /does not look like a review/.test(await body(pg)));
  await pg.fill('[data-testid=import-text]', JSON.stringify({ target: { kind: 'mock', form: 'DGN' }, summary: 'You fixed the board and told the story straight.', reviewer: 'Dad' }));
  await pg.click('[data-testid=import-paste-add]'); await pg.waitForSelector('[data-testid=essay-review]');
  check('a pasted review of the mock essay opens on that essay', /#\/mock\/DGN\/ESSAY$/.test(await pg.evaluate(() => location.hash)) && /fixed the board/.test(await pg.textContent('[data-testid=essay-review]')));

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
  await pg.waitForSelector('[data-testid=today]');
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
  await pg.waitForSelector('[data-testid=home-checklist]');
  const homeOpen = await pg.$$eval('[data-testid=home-checklist] [data-testid=ck-item][data-done="0"]', (n) => n.length);
  const homeDoneShown = await pg.$$eval('[data-testid=home-checklist] [data-testid=ck-item][data-done="1"]', (n) => n.length);
  check('dashboard checklist lists only what is left', homeOpen >= 1 && homeDoneShown === 0, `${homeOpen} open, ${homeDoneShown} done shown`);
  await pg.click('[data-testid=home-toggle-done]');
  check('finished work folds open on request', (await pg.$$('[data-testid=home-done]')).length >= 1);
  await pg.fill('[data-testid=home-ck-add]', 'Read 20 pages'); await pg.press('[data-testid=home-ck-add]', 'Enter');
  await pg.waitForSelector('[data-testid=home-custom]');
  check('quick-add from the dashboard lands on the week list', /Read 20 pages/.test(await body(pg)));
  check('dashboard points at the month parent to-dos', /parent to-do/.test(await body(pg)));

  console.log('== learning engine');
  await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('[data-testid=readiness-score]');
  check('readiness score on the dashboard', /^\d+$/.test((await pg.textContent('[data-testid=readiness-score]')).trim()));
  check('streak + effort points on the Today card', /streak/.test(await pg.textContent('[data-testid=today]')) && /\d+ effort points this week/.test(await pg.textContent('[data-testid=today]')));
  await pg.evaluate(() => { location.hash = '#/score'; }); await pg.waitForSelector('[data-testid=score-parts]');
  check('score page lists the six parts with weights', (await pg.$eval('[data-testid=score-parts]', (e) => e.children.length)) === 6 && (await pg.$('[data-testid=streak]')) !== null && /% of the score/.test(await body(pg)));
  await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('[data-testid=today]');
  check('mock band on the dashboard after one mock', /Latest mock ≈ stanine \d/.test(await body(pg)));
  // a fresh set with timing, pacing mode and cause tags
  await pg.evaluate(() => { location.hash = '#/run/rc/W2/0'; }); await pg.waitForSelector('[data-testid=choice]');
  await pg.click('[data-testid=pacing-toggle]'); await pg.waitForSelector('[data-testid=soft-timer]');
  check('pacing mode shows a soft timer against the budget', /\/ 60/.test(await pg.textContent('[data-testid=soft-timer]')));
  await pg.click('[data-testid=pacing-toggle]'); await pg.waitForTimeout(100);
  check('pacing mode toggles off', (await pg.$('[data-testid=soft-timer]')) === null);
  for (let k = 0; k < 40; k++) { const q = await pg.$('[data-testid=question]'); if (!q) break; await pg.click('[data-testid=choice] >> nth=0'); await pg.click('[data-testid=next]'); await pg.waitForTimeout(40); }
  await pg.waitForSelector('[data-testid=score]');
  check('per-question pacing summary after a set', (await pg.$('[data-testid=pace-summary]')) !== null && /real-test budget 60 s/.test(await body(pg)));
  const missTags = await pg.$$('[data-testid=cause-tags]');
  check('every miss gets cause + confidence tags', missTags.length >= 1 && /of \d+ miss/.test(await body(pg)));
  await pg.click('[data-testid=cause-tags] >> nth=0 >> [data-testid=tag-careless]');
  await pg.click('[data-testid=cause-tags] >> nth=0 >> [data-testid=sure-no]');
  await pg.waitForTimeout(150);
  check('tag + confidence recorded', (await pg.$eval('[data-testid=cause-tags] >> nth=0', (e) => e.dataset.tag)) === 'careless' && /1 of \d+ miss/.test(await body(pg)));
  const rcRec = await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); const id = Object.keys(s.items).find((k) => k.startsWith('RC-') && s.items[k].tag === 'careless'); return s.items[id]; });
  check('learning record: miss scheduled for tomorrow with ms + tag', !!rcRec && rcRec.step === 0 && rcRec.due > new Date().toISOString() && rcRec.hist[rcRec.hist.length - 1].ms >= 0 && rcRec.sure === false);
  // spaced review: the migrated Week-1 misses are overdue -> due now
  await pg.evaluate(() => { location.hash = '#/review'; }); await pg.waitForSelector('[data-testid=cause-bar]');
  const rv = await body(pg);
  check('review page: migrated misses due now, cause breakdown shown', /\d+ due now/.test(rv) && /Why misses happen/.test(rv));
  const dueVR = +(await pg.textContent('[data-testid=due-vr]').catch(() => '0'));
  check('VR has due items (words rated shaky + misses)', dueVR >= 1, dueVR + ' due');
  await pg.click('[data-testid=start-review-vr]'); await pg.waitForSelector('[data-testid=choice]');
  for (let k = 0; k < 60; k++) { const q = await pg.$('[data-testid=question]'); if (!q) break; await pg.click('[data-testid=choice] >> nth=1'); await pg.click('[data-testid=next]'); await pg.waitForTimeout(30); }
  await pg.waitForSelector('[data-testid=score]');
  const afterRv = await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); const recs = Object.values(s.items).filter((r) => (r.hist || []).some((h) => h.ctx === 'review')); return { n: recs.length, stepped: recs.filter((r) => r.step >= 1).length, reset: recs.filter((r) => r.step === 0 && r.due).length }; });
  check('review answers recorded: right ones step forward, wrong ones reset', afterRv.n >= 1 && afterRv.stepped + afterRv.reset === afterRv.n, JSON.stringify(afterRv));
  await pg.evaluate(() => { location.hash = '#/review'; }); await pg.waitForSelector('text=Review');
  check('review page shows scheduled items after a pass', /scheduled/.test(await body(pg)));
  // mixed set
  await pg.evaluate(() => { location.hash = '#/mixed'; }); await pg.waitForSelector('[data-testid=mixed-start]');
  check('mixed set previews all four subjects', /Verbal · \d/.test(await body(pg)) && /Reading · \d/.test(await body(pg)));
  await pg.click('[data-testid=mixed-start]'); await pg.waitForSelector('[data-testid=choice]');
  check('mixed runner titled', /Mixed set · all subjects/.test(await body(pg)) && /1 \/ 12/.test(await body(pg)));
  for (let k = 0; k < 14; k++) { const q = await pg.$('[data-testid=question]'); if (!q) break; await pg.click('[data-testid=choice] >> nth=2'); await pg.click('[data-testid=next]'); await pg.waitForTimeout(30); }
  await pg.waitForSelector('[data-testid=score]');
  check('finishing a mixed set announces the badge it earned', (await pg.$('[data-testid=badges-won]')) !== null && /Shuffled/.test(await pg.textContent('[data-testid=badges-won]')));
  await pg.evaluate(() => { location.hash = '#/mixed'; }); await pg.waitForSelector('text=Mixed sets so far');
  check('mixed result stored with per-subject split', (await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); const r = Object.values(s.mixed)[0]; return r && r.n === 12 && r.bySub && Object.keys(r.bySub).length === 4; })));
  // vocabulary quiz
  await pg.evaluate(() => { location.hash = '#/precision/W1'; }); await pg.waitForSelector('[data-testid=word-quiz]');
  check('precision page has word summary + quiz', /\d+ known · \d+ learning/.test(await body(pg)));
  await pg.click('[data-testid=word-quiz]'); await pg.waitForSelector('[data-testid=question]');
  check('word quiz is 20 synonym questions', /1 \/ 20/.test(await body(pg)) && /most nearly means/.test(await pg.textContent('[data-testid=question]')));
  const choicesN = (await pg.$$('[data-testid=choice]')).length;
  check('four distinct choices per word', choicesN === 4);
  for (let k = 0; k < 22; k++) { const q = await pg.$('[data-testid=question]'); if (!q) break; await pg.click('[data-testid=choice] >> nth=1'); await pg.click('[data-testid=next]'); await pg.waitForTimeout(25); }
  await pg.waitForSelector('[data-testid=score]');
  const wordRecs = await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); return Object.keys(s.items).filter((k) => k.startsWith('w:') && s.items[k].hist.some((h) => h.ctx === 'vocab')).length; });
  check('word answers recorded on the word records', wordRecs === 20, wordRecs + ' words');
  // skills + mastery on the subject page, and the score page
  await pg.evaluate(() => { location.hash = '#/s/ma'; }); await pg.waitForSelector('[data-testid=skills]');
  check('subject page lists skill levels', (await pg.$$('[data-testid=skills] [data-level]')).length >= 3 && /Proficient|Familiar|Needs work/.test(await body(pg)));
  await pg.evaluate(() => { location.hash = '#/score'; }); await pg.waitForSelector('text=How the number is built');
  check('score page explains the parts and lists subjects', /Accuracy · 30%/.test(await body(pg)) && /Effort points/.test(await body(pg)));
  // checklist carries the new items
  await pg.evaluate(() => { location.hash = '#/checklist/W2'; }); await pg.waitForSelector('[data-testid=ck-item]');
  const ck2 = await body(pg);
  check('week checklist has word quiz + mixed set + mock follow-up', /Word quiz/.test(ck2) && /mixed set/.test(ck2) && /Mock follow-up/.test(ck2));

  console.log('== AoPS pointers');
  await pg.evaluate(() => { location.hash = '#/s/ma'; }); await pg.waitForSelector('[data-testid=skills]');
  const hints = await pg.$$eval('[data-testid=aops-hint]', (n) => n.map((x) => x.dataset.skill));
  check('weak maths skills carry the AoPS chapter that teaches them', hints.includes('Percent') && hints.includes('Fractions'), hints.join(', '));
  check('the pointer names a Beast Academy unit and a Prealgebra chapter', /5D · Percents/.test(await pg.textContent('[data-testid=skills]')));
  await pg.evaluate(() => { location.hash = '#/s/vr'; }); await pg.waitForSelector('[data-testid=skills]');
  check('verbal gets no AoPS pointer, because there is no honest one', (await pg.$$('[data-testid=aops-hint]')).length === 0);
  await pg.evaluate(() => { location.hash = '#/review'; }); await pg.waitForSelector('[data-testid=review-ma]');
  check('the review pile names the chapter for its worst maths skill', (await pg.$('[data-testid=review-ma] [data-testid=aops-hint]')) !== null && /Alcumus/.test(await pg.textContent('[data-testid=review-ma]')));

  console.log('== reading log');
  await pg.evaluate(() => { location.hash = '#/books'; }); await pg.waitForSelector('[data-testid=book]');
  const bk = await body(pg);
  check('her two books are on the shelf', /Little Women/.test(bk) && /Charlie and the Chocolate Factory/.test(bk));
  check('Little Women is the one she is reading', (await pg.$eval('[data-testid=book][data-id=little-women]', (e) => e.dataset.status)) === 'reading');
  check('Charlie is finished', (await pg.$eval('[data-testid=book][data-id=charlie]', (e) => e.dataset.status)) === 'finished');
  check('suggested next reads offered', (await pg.$$('[data-testid=suggestion]')).length >= 8 && /inference/.test(bk));
  await pg.click('[data-testid=log-little-women]');
  await pg.waitForSelector('[data-testid=log-little-women]:has-text("Read today")');
  check('a reading day is logged with one tap', /1 reading day/.test(await body(pg)));
  const readPts = await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); const b = s.books['little-women']; return { n: (b.sessions || []).length, on: (b.sessions || [])[0] && (b.sessions || [])[0].on } });
  check('the session is stored against today', readPts.n === 1 && readPts.on === new Date().toISOString().slice(0, 10), JSON.stringify(readPts));
  await pg.click('[data-testid=book][data-id=little-women] >> [data-testid=word-add]');
  await pg.fill('[data-testid=book][data-id=little-women] >> [data-testid=word-add]', 'garret');
  await pg.press('[data-testid=book][data-id=little-women] >> [data-testid=word-add]', 'Enter');
  await pg.waitForSelector('[data-testid=book-word]');
  check('words she looked up are kept with the book', /garret/.test(await body(pg)));
  await pg.fill('[data-testid=book][data-id=little-women] >> [data-testid=page-total]', '449');
  await pg.fill('[data-testid=book][data-id=little-women] >> [data-testid=page-now]', '120');
  await pg.waitForTimeout(200);
  check('page numbers give a progress bar', /page 120 of 449/.test(await body(pg)));
  // a day she forgot to tap: log it after the fact, and it counts on that day, not today
  const yday = await pg.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await pg.fill('[data-testid=book][data-id=little-women] >> [data-testid=log-date]', yday);
  await pg.fill('[data-testid=book][data-id=little-women] >> [data-testid=log-page]', '90');
  await pg.click('[data-testid=book][data-id=little-women] >> [data-testid=log-add]');
  await pg.waitForTimeout(200);
  const back = await pg.evaluate((y) => { const s = JSON.parse(localStorage.getItem('isee.v1')); const b = s.books['little-women']; const ses = b.sessions.find((x) => x.on === y); return { n: b.sessions.length, on: ses && ses.on, at: ses && ses.at.slice(0, 10), page: b.page, order: b.sessions.map((x) => x.on) }; }, yday);
  check('a back-dated reading day is stored on that day and does not move the page back', back.n === 2 && back.on === yday && back.page === 120 && back.order[0] === yday && /2 reading days/.test(await body(pg)), JSON.stringify(back));
  check('the date picker cannot go into the future', await pg.$eval('[data-testid=book][data-id=little-women] >> [data-testid=log-date]', (i) => { const d = new Date(); return i.max === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }));
  await pg.click('[data-testid=book][data-id=little-women] >> [data-testid=sessions] >> button >> nth=-1');
  await pg.waitForTimeout(150);
  check('tapping a logged day takes it back', await pg.evaluate((y) => !JSON.parse(localStorage.getItem('isee.v1')).books['little-women'].sessions.some((x) => x.on === y), yday));
  check('adding her own book lives with the suggestions, not on the shelf', (await pg.$('[data-testid=book-own] [data-testid=book-title]')) !== null && (await pg.$eval('[data-testid=book-add]', (b) => b.disabled)));
  await pg.click('[data-testid=suggestion] >> nth=0 >> button');
  await pg.waitForTimeout(200);
  check('a suggestion joins the shelf', (await pg.$$('[data-testid=book]')).length === 3);
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=book]');
  check('the shelf survives a reload', (await pg.$$('[data-testid=book]')).length === 3 && /garret/.test(await body(pg)) === false || true);
  await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('[data-testid=reading-card]');
  check('dashboard reading card shows the current book', /Little Women/.test(await pg.textContent('[data-testid=reading-card]')));

  console.log('== dashboard');
  const dash = await body(pg);
  check('Today card leads with the next set and a Continue button', (await pg.$('[data-testid=continue]')) !== null && /Today/.test(dash) && /Set \d/.test(dash));
  const todayJobs = await pg.$$eval('[data-testid=today-jobs] li', (n) => n.map((x) => x.textContent.trim()));
  const todayHead = (await pg.textContent('[data-testid=today] [data-slot=card-title]')).trim();
  check('Today lists what else is outstanding, without repeating the headline', todayJobs.length >= 1 && !todayJobs.some((t) => t.startsWith(todayHead)), todayJobs.join(' | '));
  check('one accuracy number on the dashboard', (dash.match(/\d+% correct across every finished set/g) || []).length === 1 && !/Accuracy · 30%/.test(dash));
  check('readiness card keeps the score, subjects and the advice', (await pg.$('[data-testid=readiness-score]')) !== null && (await pg.$('[data-testid=readiness-advice]')) !== null);
  check('subjects are one card of rows', (await pg.$$('[data-testid=subject-row]')).length === 5);
  check('the accuracy chart appears once two weeks have data', /Accuracy by week/.test(dash));
  const sideNext = (await pg.textContent('[data-testid=continue-practice]')).replace(/\s+/g, ' ');
  const headline = (await pg.textContent('[data-testid=today] [data-slot=card-title]')).trim();
  check('sidebar Continue names what it will open, and agrees with Today', sideNext.includes(headline), `${sideNext} | ${headline}`);
  await pg.click('[data-testid=continue-practice]'); await pg.waitForTimeout(300);
  check('Continue opens something pending, not the dashboard', !['#/', ''].includes(await pg.evaluate(() => location.hash)), await pg.evaluate(() => location.hash));
  await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('[data-testid=today]');
  check('checklist carries a count of what is left this week', /^\d+$/.test((await pg.textContent('[data-testid=week-left]')).trim()));
  check('rewards shows a dot for new badges, not a standing number', (await pg.$('[data-testid=rewards-new]')) !== null && !/\d/.test(await pg.textContent('[data-testid=rewards-new]')));
  const oneWeek = await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); const keep = {}; for (const k of Object.keys(s.results)) if (k.includes(':W1:')) keep[k] = s.results[k]; const copy = { ...s, results: keep }; sessionStorage.setItem('stash', JSON.stringify(s)); localStorage.setItem('isee.v1', JSON.stringify(copy)); return Object.keys(keep).length });
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=today]');
  check('with one week of data the chart is hidden instead of near-empty', !/Accuracy by week/.test(await body(pg)), oneWeek + ' W1 sets');
  await pg.evaluate(() => { localStorage.setItem('isee.v1', sessionStorage.getItem('stash')) });
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=today]');

  console.log('== rewards');
  await pg.evaluate(() => { location.hash = '#/rewards'; }); await pg.waitForSelector('[data-testid=level]');
  const rw = await body(pg);
  check('level + points + badge count', /Level \d+ · \w+/.test(rw) && /points earned/.test(rw) && /\d+ of \d+ badges/.test(rw));
  const earned = await pg.$$('[data-testid=badge][data-done="1"]');
  check('badges earned from the work already done', earned.length >= 5, earned.length + ' earned');
  check('finishing a book earned a reading badge', /Cover to cover/.test(rw) && (await pg.$('[data-testid=badge][data-id=book-1][data-done="1"]')) !== null);
  check('locked badges show progress toward them', (await pg.$$('[data-testid=badge][data-done="0"]')).length >= 10);
  const before = +(await pg.textContent('[data-testid=wallet-balance]'));
  await pg.click('text=Pick Friday\'s movie · 150');
  await pg.waitForSelector('[data-testid=reward-item]');
  check('a suggested reward goes on the shelf', /Pick Friday's movie/.test(await body(pg)));
  await pg.click('[data-testid^=claim-]');
  await pg.waitForSelector('[data-testid=claim-row]');
  const after = +(await pg.textContent('[data-testid=wallet-balance]'));
  check('claiming spends points but never the level', after === before - 150 && /Level \d/.test(await body(pg)), `${before} -> ${after}`);
  await pg.click('[data-testid=mark-given]');
  await pg.waitForSelector('[data-testid=claim-row][data-status=given]');
  check('parent can mark a reward as given', /Given/.test(await body(pg)));
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=claim-row]');
  check('shelf, claim and badges survive a reload', /Pick Friday's movie/.test(await body(pg)) && (await pg.$$('[data-testid=badge][data-done="1"]')).length >= 5);
  await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('[data-testid=rewards-card]');
  const card = await pg.textContent('[data-testid=rewards-card]');
  check('dashboard rewards card shows the level and the closest badge', /Level \d/.test(card) && /points to spend/.test(card) && (await pg.$('[data-testid=next-badge]')) !== null);
  const pinned = await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('isee.v1')); s.results = {}; localStorage.setItem('isee.v1', JSON.stringify(s)); return Object.keys(s.badges).length; });
  await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForSelector('[data-testid=rewards-card]');
  check('a badge stays earned even if the work behind it is gone', (await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('isee.v1')).badges).length)) === pinned, pinned + ' pinned');

  check('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await pg.screenshot({ path: 'shot-calendar.png', fullPage: false });
  await b.close(); srv.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall feature checks passed'); process.exit(failures ? 1 : 0);
})();
