# Sheila ISEE — practice site

A static site that shadows the Google Sheets question banks. No build step, no
server code, no dependencies. Drop it on GitHub Pages and it works offline after
the first visit.

## Files

    index.html            the whole app — markup, styles and logic in one file
    content/bundle.json   834 questions + 16 reading passages, generated
    sw.js                 service worker, caches the shell and the bank
    manifest.webmanifest  installable as a home-screen app
    _page.html            shared source for both build targets
    build.py              writes index.html and ../artifact.html from _page.html
    test.js               end-to-end browser test

## Publishing on GitHub Pages

Settings → Pages → deploy from branch, folder `/site`. Nothing else to configure.
Everything resolves relatively, so a project subpath (`user.github.io/isee/`) is fine.

## Regenerating the question bank

`content/bundle.json` is generated from `content/question-banks/*.json`, which are
themselves the repo shadow of the Sheets workbooks. After the banks change:

    python3 site/build.py      # rebuilds index.html and artifact.html

## What it does

Questions are grouped by subject and week, then split into sets of twelve — one
sitting. Answers stay hidden until a set is submitted, mirroring the submit-latch
behaviour of the workbooks. On submit it shows every question with the correct
answer and its explanation. Missed questions collect into a review queue and leave
that queue once answered correctly.

Progress lives in `localStorage`, so it is per-browser and never leaves the device.
The Sheets remain the record of truth for scored attempts; this is practice.

## A note on the answer keys

Keys ship in `bundle.json` in the clear. That is deliberate and matches the
approved design: preventing source inspection is an explicit non-goal, and
answer-key concealment here is a UX convention, not a security boundary.

## Testing

    npm install playwright
    node site/test.js

Checks that the bank loads, passages render, **no answer leaks before submit**,
scoring and explanations are right, progress survives a reload, and both colour
themes resolve. Answering "A" to everything should score near 25% — that is the
de-patterning check.
