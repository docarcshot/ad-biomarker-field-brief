# AD Biomarker Field Brief

A public, nonpromotional evidence-monitoring site for Alzheimer disease biomarkers, guidelines, and management. It is generated from validated JSON rather than hand-coded articles.

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

## Meeting preparation and comparison

Use **Add to meeting** on any brief, then open **Meeting prep** to remove items, copy a packet link, or print/save a PDF. Selections stay in the browser; a packet link carries public brief IDs and can be opened on another device. Packets use the current archive content.

The Landscape page compares two or three tests, keeps coverage and payment separate, and links to existing briefs with their population, results, limitations, and sources. Optional landscape `id` and `relatedBriefs` fields provide stable selection links and explicitly labeled evidence relationships. Exact assay-name matches also link automatically. Optional `coverage` and `reimbursement` records require `text`, an HTTPS `source`, and a `verified` date; absent fields display as unverified. No new research requirement is introduced by these optional fields.

New-item markers compare stable entry IDs against the start-of-visit snapshot, so navigation does not acknowledge an entire new batch and same-day additions are detected. The delayed-review warning also updates in the browser, independently of a successful rebuild. The scheduled watchdog permits publishing an overdue warning before reporting failure; it never advances the reviewed-through date.

## Scope and topic tags

The user expanded coverage on September 7, 2026 to general AD guidelines and management, independent of biomarker consequences. This includes diagnosis/staging, disease-modifying treatment and eligibility, dosing and safety, symptomatic/neuropsychiatric care, nonpharmacologic care, caregiver support, risk reduction, and material access changes. The every-other-day schedule, 0–3 prospective-item threshold, verification standards, publication gates and email conditions remain unchanged.

Every entry requires one or more `topics` from `Biomarkers`, `Guidelines`, and `Management`. The visible Topic filter matches any assigned topic; overlapping records appear in each relevant view. Tags link to bookmarkable archive URLs and topics are included in RSS and meeting packets. `Guidelines` includes formal guidelines and consensus guidance, with the evidence-source label making their status explicit. A treatment trial is not a guideline.

Use `resultType: "recommendations"` for guidance and `"regulatory"` for label details; otherwise quantitative results remain the default. Preserve design/population, findings, interpretation, Q&A, limitations and primary citations. Do not invent sample sizes or effect estimates for recommendations. Empty modality/biomarker/assay/platform arrays and null platform relevance are permitted when they do not apply to general management. Biomarker evidence still requires modality, biomarker and platform context. Additional HTTPS references use `supportingSources: [{label, url}]` and render in briefs and packets.

Nine verified historical records were added in a targeted 2026 backfill. The original completed monthly biomarker audit remains separate in `coverage.json`; general AD coverage is not labeled fully audited. This backfill does not advance the routine reviewed-through date or alter prospective counts. Unretrievable NICE drafts are recorded in verification notes without asserting a final recommendation. The connected task prompt is recorded in `AUTOMATION.md`.
