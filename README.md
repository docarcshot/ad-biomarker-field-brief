# AD Biomarker Field Brief

A public, nonpromotional evidence-monitoring site for Alzheimer disease biomarkers. It is generated from validated JSON rather than hand-coded articles.

Production site: https://ad-biomarker-field-brief.arcshot.chatgpt.site/

GitHub Pages mirror: https://docarcshot.github.io/ad-biomarker-field-brief/

## Local commands

```bash
node scripts/validate.mjs
node scripts/build.mjs
node scripts/test-build.mjs
```

The deployable output is `dist/`. The build creates hashed CSS, JavaScript, entry-data, and review-status assets, plus permanent entry pages, archive, landscape, methods, coverage audit, sitemap, and RSS.

`node scripts/prepare-pages.mjs` creates the path-adjusted `pages-dist/` artifact used by GitHub Pages. It does not modify the production build in `dist/`.

## Record a review

Successful review with no qualifying entries:

```bash
node scripts/review.mjs --reviewed-through=2026-09-06 --qualified=0
node scripts/build.mjs
node scripts/test-build.mjs
```

For a successful review with entries, add zero to three fully sourced records to `src/data/entries.json`, then set `--qualified` to the number added. A failed review records a delayed state without advancing `reviewedThrough`:

```bash
node scripts/review.mjs --reviewed-through=2026-09-04 --qualified=0 --failure="FDA source fetch failed"
```

GitHub Actions exposes the same controls under **Actions → Validate, build, and publish → Run workflow**. Scheduled review work is performed every other day by the connected automation; the daily Actions schedule is a freshness watchdog and deploy validator, not an unsupervised claim that no evidence qualified.

## Editing or correcting an entry

Edit the matching object in `src/data/entries.json`. Preserve its `id` and `slug`. For a substantive correction, append a dated note to `corrections`; do not silently replace the claim. Run all three commands above before committing.

## Data model

The JSON Schema is `src/data/entry.schema.json`. Each entry separates source date from date added and distinguishes analytical validity, clinical validity, clinical utility, regulatory authorization, availability, guideline endorsement, and payer coverage.

## Publishing

GitHub Pages is published through `.github/workflows/review.yml`. ChatGPT Sites deployment is configured in `.openai/hosting.json`. Do not put secrets in the repository.
