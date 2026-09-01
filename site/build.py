#!/usr/bin/env python3
"""Build both targets from the single page source.

  site/index.html   full document, fetches content/bundle.json  (GitHub Pages)
  artifact.html     body-only, data inlined                     (Artifact tool)
"""
import json, re, os, subprocess
subprocess.run(['python3', 'site/make_bundle.py'], check=True)
page = open('site/_page.html').read()

# --- 1. GitHub Pages: wrap in a real document, keep the fetch loader ---
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
       '<meta name="description" content="ISEE Lower Level practice — every question '
       'from the study workbooks, offline-capable.">\n'
       '<link rel="manifest" href="manifest.webmanifest">\n'
       '<meta name="theme-color" content="#0F7A6B">\n'
       + page.replace('<!--DATA-->', '') +
       '\n<script>if("serviceWorker" in navigator)'
       'addEventListener("load",function(){navigator.serviceWorker.register("sw.js")});</script>\n'
       '</body>\n</html>\n')
# the shared source has no <body>; open it right after the styles
doc = doc.replace('</style>\n\n<header>', '</style>\n</head>\n<body>\n<header>')
open('site/index.html', 'w').write(doc)

# --- 2. Artifact: inline the bundle, no document skeleton ---
data = open('site/content/bundle.json').read()
art = page.replace('<!--DATA-->',
                   '<script>window.__ISEE__=' + data + ';</script>')
open('artifact.html', 'w').write(art)

print('site/index.html ', os.path.getsize('site/index.html'), 'bytes')
print('artifact.html   ', os.path.getsize('artifact.html'), 'bytes')
