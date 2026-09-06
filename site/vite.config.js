import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.dirname(new URL(import.meta.url).pathname)
const ARTIFACT = process.env.LEARNING_TARGET === 'artifact'
const oauth = JSON.parse(fs.readFileSync(path.join(ROOT, 'oauth.json'), 'utf8'))

/** Wires the question bank and the Drive/OAuth config into each build target.
 *  GitHub Pages: bundle.json fetched at runtime, Drive sync on, service worker on.
 *  Artifact:     bundle.json inlined, no Drive (the artifact origin is not an OAuth origin). */
function learningTarget() {
  return {
    name: 'learning-target',
    transformIndexHtml(html) {
      const tags = []
      if (ARTIFACT) {
        const data = fs.readFileSync(path.join(ROOT, 'content/bundle.json'), 'utf8')
        tags.push({ tag: 'script', children: 'window.__LEARNING__=' + data + ';', injectTo: 'body-prepend' })
      } else {
        tags.push({
          tag: 'script',
          children: 'window.__ENABLE_DRIVE__=true;window.__OAUTH_CLIENT_ID__=' + JSON.stringify(oauth.client_id) + ';',
          injectTo: 'head',
        })
        tags.push({ tag: 'script', attrs: { src: 'https://accounts.google.com/gsi/client', async: true }, injectTo: 'head' })
        tags.push({ tag: 'link', attrs: { rel: 'manifest', href: 'manifest.webmanifest' }, injectTo: 'head' })
        tags.push({
          tag: 'script',
          children: 'if("serviceWorker" in navigator)addEventListener("load",function(){navigator.serviceWorker.register("sw.js")});',
          injectTo: 'body',
        })
      }
      return tags
    },
    closeBundle() {
      if (ARTIFACT) return
      const out = path.join(ROOT, 'dist/content')
      fs.mkdirSync(out, { recursive: true })
      fs.copyFileSync(path.join(ROOT, 'content/bundle.json'), path.join(out, 'bundle.json'))
    },
  }
}

export default defineConfig({
  root: ROOT,
  base: './',
  publicDir: ARTIFACT ? false : 'public',
  resolve: { alias: { '@': path.join(ROOT, 'src') } },
  plugins: [react(), tailwindcss(), learningTarget(), ...(ARTIFACT ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
  build: {
    outDir: ARTIFACT ? 'dist-artifact' : 'dist',
    emptyOutDir: true,
    sourcemap: false,
    reportCompressedSize: true,
  },
})
