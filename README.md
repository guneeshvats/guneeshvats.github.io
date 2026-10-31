# guneeshvats.github.io

Personal site of **Guneesh Vats**, Machine Learning Engineer & Applied AI Researcher.
Live at **https://guneeshvats.github.io**

Hand-written HTML, CSS and JavaScript. No framework, no build step, no dependencies.

## What's where

```
index.html                 all page content (edit text here)
404.html                   "token not in vocabulary" error page
assets/css/style.css       all styling; colours and fonts are CSS variables at the top
assets/js/latent.js        hero animation: the latent-space / k-NN query canvas
assets/js/viz.js           REDACT redaction demo, ITSM agent trace, change-point detector
assets/js/main.js          nav, scroll effects, token streaming, ⌘K palette, loss HUD
assets/img/                photo, favicon, social preview image (og-image.jpg)
assets/docs/               résumé PDFs
.github/workflows/         auto-deploy to GitHub Pages
```

## Run it locally

```bash
cd "Portfolio Website"
python3 -m http.server 8000
# open http://localhost:8000
```

## Update the site

Every push to `main` deploys automatically in about a minute
(watch it under the repo's **Actions** tab).

**Small change** (a typo, a new bullet, a new résumé):

```bash
git pull
# edit files, check locally
git add -A
git commit -m "Update experience bullets"
git push
```

**Bigger change** (new section, redesign): use a branch so `main` stays live and clean.

```bash
git switch -c update/new-section
# edit, commit as often as you like
git push -u origin update/new-section
gh pr create --fill          # review the diff on GitHub
gh pr merge --squash         # merging to main triggers the deploy
git switch main && git pull
```

**Redeploy without changes:** Actions → *Deploy to GitHub Pages* → *Run workflow*,
or `gh workflow run deploy.yml`.

## Common edits

| Change | Where |
| --- | --- |
| Replace a résumé | overwrite the PDF in `assets/docs/` (keep the file name) |
| New job / bullet | `index.html`, the `<article class="xp">` blocks in **Experience** |
| New paper | `index.html`, add an `<li class="pub">` in **Publications**; `data-tags` = `nlp`, `signal` or `speech` |
| New project card | `index.html`, copy an `<a class="proj">` block in **Projects** |
| Photo | replace `assets/img/guneesh-vats.jpg` (4:5 portrait); nudge the face box via `.bbox` in `style.css` |
| Hero phrases | `PHRASES` in `assets/js/main.js` |
| Hero clusters & labels | `CLUSTERS` in `assets/js/latent.js` |
| Colours / fonts | token blocks at the top of `assets/css/style.css`: the first block is the dark theme, `[data-theme="light"]` is the light theme |
