// GitHub Pages project sites serve at /<repo>/, not /. Prove the site works there.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const MIME={'.html':'text/html','.json':'application/json','.js':'text/javascript','.webmanifest':'application/manifest+json'};
const BASE='/isee';                       // pretend repo name
const srv=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(!p.startsWith(BASE)){res.writeHead(404);return res.end('outside base');}
  p=p.slice(BASE.length)||'/';
  if(p==='/')p='/index.html';
  const f=path.join(__dirname,p);
  if(!fs.existsSync(f)){res.writeHead(404);return res.end('nf');}
  res.writeHead(200,{'content-type':MIME[path.extname(f)]||'text/plain'});
  res.end(fs.readFileSync(f));
});
(async()=>{
  await new Promise(r=>srv.listen(8100,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const errs=[]; const pg=await b.newPage({viewport:{width:430,height:900}});
  pg.on('pageerror',e=>errs.push('pageerror: '+e.message));
  pg.on('response',r=>{ if(r.status()>=400 && !r.url().includes('favicon')) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  await pg.goto('http://localhost:8100/isee/',{waitUntil:'networkidle'});
  await pg.waitForSelector('.subj',{timeout:6000});
  const subs=await pg.$$eval('.subj .nm',n=>n.map(x=>x.textContent));
  console.log('served at /isee/ — subjects loaded:', subs.length, '->', subs.join(', '));
  // drill into a set and answer it, to prove the bundle fetched from the subpath
  await pg.click('[data-sub="ma"]'); await pg.waitForSelector('[data-week]');
  await pg.click('.rowbtn:nth-child(1)'); await pg.waitForSelector('[data-run]');
  await pg.click('[data-run]'); await pg.waitForSelector('.opt');
  const q=await pg.$eval('.qtext',e=>e.textContent);
  console.log('first MA question renders:', JSON.stringify(q.slice(0,50)));
  // service worker + manifest resolve under the subpath
  const sw=await pg.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?r.scope:null;});
  const man=await pg.$eval('link[rel=manifest]',e=>e.href);
  console.log('service worker scope:', sw);
  console.log('manifest resolves to :', man);
  console.log(errs.length? 'ERRORS:\n  '+errs.join('\n  ') : 'no page errors, no 4xx/5xx');
  await b.close(); srv.close();
})();
