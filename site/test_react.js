const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const MIME={'.html':'text/html','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
// serve site/, but rewrite cdnjs + gsi scripts to local vendored copies (sandbox can't reach them)
function serveFile(res, f, type){ res.writeHead(200,{'content-type':type}); res.end(fs.readFileSync(f)); }
const srv = http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]); if(!p.startsWith('/isee')){res.writeHead(404);return res.end();}
  p=p.slice(5)||'/'; if(p==='/')p='/index.html';
  if(p.startsWith('/_vendor/')){const f=path.join(__dirname,p); if(fs.existsSync(f))return serveFile(res,f,'text/javascript'); res.writeHead(404);return res.end();}
  const f=path.join(__dirname,p);
  if(!fs.existsSync(f)){res.writeHead(404);return res.end();}
  if(p==='/index.html'){
    let html=fs.readFileSync(f,'utf8')
      .replace('https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js','/isee/_vendor/react.production.min.js')
      .replace('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js','/isee/_vendor/react-dom.production.min.js')
      .replace('https://cdnjs.cloudflare.com/ajax/libs/htm/3.1.1/htm.js','/isee/_vendor/htm.js')
      .replace('<script src="https://accounts.google.com/gsi/client" async></script>','');
    res.writeHead(200,{'content-type':'text/html'}); return res.end(html);
  }
  serveFile(res,f,MIME[path.extname(f)]||'text/plain');
});
(async()=>{
  await new Promise(r=>srv.listen(8130,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:844}}); const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERR '+e.message)); pg.on('console',m=>{if(m.type()==='error'&&!/gsi|accounts\.google|favicon/.test(m.text()))errs.push('CONSOLE '+m.text());});
  await pg.goto('http://localhost:8130/isee/',{waitUntil:'networkidle'});
  await pg.waitForSelector('.subj',{timeout:8000});
  console.log('home subjects:', (await pg.$$eval('.subj .nm',n=>n.map(x=>x.textContent))).join(', '));
  console.log('global nav present:', await pg.$('nav.tabs')!==null, '| tabs:', (await pg.$$eval('nav.tabs .lbl',n=>n.map(x=>x.textContent))).join('/'));
  console.log('review badge:', await pg.$eval('nav.tabs .badge',e=>e.textContent).catch(()=>'(none)'));
  console.log('subject progress:', (await pg.$$eval('.subj .sub.tnum',n=>n.map(x=>x.textContent))).join(' | '));
  // KEY FIX: enter a review directly, confirm global nav is still present, then EXIT via Home tab
  await pg.evaluate(()=>location.hash='#/review/ma'); await pg.waitForSelector('.opt,.empty');
  const navInReview = await pg.$('nav.tabs')!==null;
  const barInReview = await pg.$('.bar')!==null;
  console.log('in a review — global nav visible:', navInReview, '| answer bar visible:', barInReview);
  await pg.click('.tabwrap:nth-child(1) .tab');           // Home tab
  await pg.waitForSelector('.subj',{timeout:5000});
  console.log('exited review via Home tab:', await pg.$('.subj')!==null ? 'YES' : 'NO');
  // run a set fully; no leak before submit; 25% on all-A
  await pg.evaluate(()=>location.hash='#/run/rc/W2/0'); await pg.waitForSelector('.opt');
  console.log('runner passage present (RC):', await pg.$('.passage')!==null);
  let n=0, leak=false;
  for(;;){ if((await pg.$$('.opt.good,.opt.bad')).length) leak=true;
    await pg.click('.opt:first-child'); n++;
    const t=await pg.$eval('.bar .btn:last-child',e=>e.textContent);
    await pg.click('.bar .btn:last-child');
    if(/Finish/.test(t)) break; await pg.waitForSelector('.opt'); if(n>20)break; }
  await pg.waitForSelector('.score');
  console.log('ran set:',n,'q; leaked:',leak?'FAIL':'no','; score', await pg.$eval('.score .big',e=>e.textContent),(await pg.$eval('.score .of',e=>e.textContent)).trim());
  // drive button renders (offline in sandbox -> label present, no crash)
  console.log('drive button label:', await pg.$eval('.chipbtn',e=>e.textContent.trim()).catch(()=>'(none)'));
  // reload persists
  await pg.evaluate(()=>location.hash='#/'); await pg.reload({waitUntil:'networkidle'}); await pg.waitForSelector('.subj');
  console.log('after reload subject progress:', (await pg.$$eval('.subj .sub.tnum',n=>n.map(x=>x.textContent))).join(' | '));
  await pg.screenshot({path:'react-home.png'});
  await pg.evaluate(()=>location.hash='#/review/ma'); await pg.waitForSelector('.opt,.empty'); await pg.screenshot({path:'react-review.png'});
  console.log(errs.length?'ERRORS:\n  '+errs.slice(0,6).join('\n  '):'no page/console errors');
  await b.close(); srv.close();
})();
