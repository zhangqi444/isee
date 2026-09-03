const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const MIME={'.html':'text/html','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const srv = http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]); if(!p.startsWith('/isee')){res.writeHead(404);return res.end();}
  p=p.slice(5)||'/'; if(p==='/')p='/index.html';
  const f=path.join(__dirname,p); if(!fs.existsSync(f)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':MIME[path.extname(f)]||'text/plain'}); res.end(fs.readFileSync(f));
});
(async()=>{
  await new Promise(r=>srv.listen(8124,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:844}}); const pg=await ctx.newPage();
  await pg.goto('http://localhost:8124/isee/',{waitUntil:'networkidle'});
  await pg.waitForSelector('.subj',{timeout:10000});
  // home should now show completed sets + a review count reflecting migrated misses
  const prog=await pg.$$eval('.subj .sub.tnum',n=>n.map(x=>x.textContent));
  const review=await pg.$eval('[data-nav="review"] .pill', e=>e.textContent).catch(()=>'(none)');
  console.log('after seed — subject progress:', prog.join(' | '));
  console.log('review queue badge:', review);
  // per-subject: open QR, confirm sets show as done with scores
  await pg.click('[data-sub="qr"]'); await pg.waitForSelector('[data-week]');
  const wk1=await pg.$eval('.rowbtn:nth-child(1) .pill', e=>e.textContent).catch(()=>'?');
  console.log('QR W1 pill:', wk1);
  // idempotency: reload, progress must not double
  await pg.reload({waitUntil:'networkidle'}); await pg.waitForSelector('.subj');
  const prog2=await pg.$$eval('.subj .sub.tnum',n=>n.map(x=>x.textContent));
  console.log('after reload  — subject progress:', prog2.join(' | '), '(must equal above)');
  // no-clobber: simulate her doing a fresh set on-site, then re-seed shouldn't erase it
  const seedApplied = await pg.evaluate(()=>{ try{return JSON.parse(localStorage.getItem('isee.v1')).seedApplied}catch(e){return null} });
  console.log('seedApplied marker:', seedApplied);
  await pg.screenshot({path:'seed-home.png'});
  await b.close(); srv.close();
})();
