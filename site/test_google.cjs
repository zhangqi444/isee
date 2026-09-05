/* Google stub shared by the browser suites: the site is gated behind Google
 * Sign-In, so every suite has to get through the door before it can test
 * anything. `sessionStorage.gisFail` makes the next token request fail, the
 * way a lapsed session or a blocked popup does. */
const FAKE_GIS = `
  window.__gisCalls = JSON.parse(sessionStorage.getItem('gisCalls') || '[]');
  window.google = { accounts: { oauth2: {
    initTokenClient: (cfg) => ({ requestAccessToken: (o) => {
      window.__gisCalls.push(o.prompt); sessionStorage.setItem('gisCalls', JSON.stringify(window.__gisCalls));
      if (sessionStorage.getItem('gisFail')) return setTimeout(() => cfg.error_callback({ type: 'popup_failed_to_open' }), 30);
      setTimeout(() => cfg.callback({ access_token: 'tok-' + Date.now(), expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.file openid email profile' }), 50);
    } }),
    hasGrantedAllScopes: (resp, s) => String(resp.scope || '').includes(s),
    revoke: () => {},
  } } };`;

/** Routes googleapis.com to an in-memory Drive. Returns its state. */
async function stubGoogle(ctx) {
  const drive = { folder: null, file: null, body: null, calls: [] };
  await ctx.route(/fonts\.g|accounts\.google\.com\/gsi/, (r) => r.abort());
  await ctx.route(/googleapis\.com/, (r) => {
    const u = r.request().url(), m = r.request().method();
    drive.calls.push(m + ' ' + u.replace(/\?.*/, ''));
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (/userinfo/.test(u)) return json({ email: 'qi@example.com', name: 'Qi Zhang' });
    if (/drive\/v3\/files\?/.test(u) && m === 'GET') {
      if (/google-apps\.folder/.test(decodeURIComponent(u))) return json({ files: drive.folder ? [{ id: drive.folder, name: 'Sheila ISEE Practice' }] : [] });
      return json({ files: drive.file ? [{ id: drive.file, name: 'progress.json' }] : [] });
    }
    if (/drive\/v3\/files$/.test(u) && m === 'POST') { drive.folder = 'folder1'; return json({ id: 'folder1' }); }
    if (/upload\/drive\/v3\/files\?/.test(u) && m === 'POST') { drive.file = 'file1'; drive.body = r.request().postData(); return json({ id: 'file1' }); }
    if (/upload\/drive\/v3\/files\/file1/.test(u) && m === 'PATCH') { drive.body = r.request().postData(); return json({ id: 'file1' }); }
    if (/drive\/v3\/files\/file1\?alt=media/.test(u)) return json(JSON.parse(drive.body.split('\r\n\r\n').pop().split('\r\n--')[0]));
    return r.fulfill({ status: 404, body: '{}' });
  });
  await ctx.addInitScript(FAKE_GIS);
  return drive;
}

/** Get through the gate: click the Google button and wait for the app shell. */
async function signIn(pg) {
  await pg.waitForSelector('[data-testid=signin-page]', { timeout: 15000 });
  await pg.click('[data-testid=signin-google]');
  await pg.waitForSelector('[data-testid=today]', { timeout: 15000 });
}

module.exports = { FAKE_GIS, stubGoogle, signIn };
