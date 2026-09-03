#!/usr/bin/env python3
"""Build both targets from the single React page source.

  site/index.html   full HTML document; fetches content/bundle.json; Drive OAuth on   (GitHub Pages)
  artifact.html     body-only, bundle inlined, no Drive/OAuth (offline-only)           (Artifact tool)
"""
import json, os, subprocess
subprocess.run(['python3', 'site/make_bundle.py'], check=True)
page = open('site/_page.html').read()
oauth = json.load(open('site/oauth.json'))

split = '<div id="root"></div>'
head_part, body_part = page.split(split, 1)
body_part = split + body_part

# ---- 1. GitHub Pages document ----
drive_cfg = ('<script>window.__ENABLE_DRIVE__=true;window.__OAUTH_CLIENT_ID__='
             + json.dumps(oauth['client_id']) + ';</script>\n'
             '<script src="https://accounts.google.com/gsi/client" async></script>\n')
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
       '<meta name="description" content="ISEE Lower Level practice — every question from the study workbooks, offline-capable.">\n'
       '<link rel="manifest" href="manifest.webmanifest">\n'
       '<meta name="theme-color" content="#0F7A6B">\n'
       + head_part + drive_cfg + '</head>\n<body>\n'
       + body_part.replace('<!--DATA-->', '')
       + '\n<script>if("serviceWorker" in navigator)addEventListener("load",function(){navigator.serviceWorker.register("sw.js")});</script>\n'
       '</body>\n</html>\n')
open('site/index.html', 'w').write(doc)

# ---- 2. Artifact (offline-only; the Artifact tool adds the doctype/head/body) ----
data = open('site/content/bundle.json').read()
art = (head_part + body_part).replace('<!--DATA-->', '<script>window.__ISEE__=' + data + ';</script>')
open('artifact.html', 'w').write(art)

print('site/index.html ', os.path.getsize('site/index.html'), 'bytes  (Drive OAuth ON)')
print('artifact.html   ', os.path.getsize('artifact.html'), 'bytes  (offline-only)')
