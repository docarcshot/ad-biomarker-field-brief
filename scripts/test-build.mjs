import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root,'dist');
const files = [];
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).forEach(item => item.isDirectory() ? walk(path.join(dir,item.name)) : files.push(path.join(dir,item.name)));
walk(dist);
const errors = [];
const htmlFiles = files.filter(file=>file.endsWith('.html'));
const toTarget = href => {
  const clean = href.split(/[?#]/)[0];
  if (!clean.startsWith('/')) return null;
  if (clean.endsWith('/')) return path.join(dist,clean,'index.html');
  return path.join(dist,clean);
};
for (const file of htmlFiles) {
  const html = fs.readFileSync(file,'utf8');
  for (const required of ['<main id="content">','class="skip-link"','rel="alternate" type="application/rss+xml"']) if (!html.includes(required)) errors.push(`${path.relative(dist,file)} missing ${required}`);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  const duplicates = ids.filter((id,i)=>ids.indexOf(id)!==i);
  if (duplicates.length) errors.push(`${path.relative(dist,file)} duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const href = match[1];
    if (href.startsWith('mailto:') || href.startsWith('#')) continue;
    const target = toTarget(href);
    if (target && !fs.existsSync(target)) errors.push(`${path.relative(dist,file)} broken internal link: ${href}`);
  }
}
const entries = JSON.parse(fs.readFileSync(path.join(root,'src/data/entries.json'),'utf8'));
if (htmlFiles.filter(file=>file.includes(`${path.sep}entries${path.sep}`)).length !== entries.length) errors.push('entry page count does not match data');
const feed = fs.readFileSync(path.join(dist,'feed.xml'),'utf8');
if (!feed.startsWith('<?xml') || !feed.includes('<rss version="2.0">')) errors.push('RSS is not well formed enough for discovery');
if ((feed.match(/<item>/g)||[]).length > 30) errors.push('RSS exceeds 30 entries');
const manifest = JSON.parse(fs.readFileSync(path.join(dist,'assets/manifest.json'),'utf8'));
for (const value of [manifest.css,manifest.js,manifest.entries,manifest.status]) if (!/\.[a-f0-9]{10}\./.test(value)) errors.push(`asset is not content hashed: ${value}`);
const archive = fs.readFileSync(path.join(dist,'archive/index.html'),'utf8');
for (const name of ['modality','biomarker','clinicalUse','relevance','sort']) if (!archive.includes(`name="${name}"`)) errors.push(`archive missing ${name} control`);
for (const name of ['studyType','platform','organization','regulatory','sourceType','yearMonth']) if (archive.includes(`name="${name}"`)) errors.push(`archive still contains removed ${name} control`);
if (!archive.includes('data-relevance="Early signal"')) errors.push('archive missing an Early signal relevance record');
if (!archive.includes('class="relevance-legend"')) errors.push('archive missing the relevance color key');
for (const section of ['summary','impact','questions','critique']) if (!archive.includes(`data-brief-section="${section}"`)) errors.push(`archive missing ${section} brief section`);
for (const label of ['Evidence summary','Clinical and field impact','Likely questions','Critique and limitations']) if (!archive.includes(label)) errors.push(`archive missing ${label} section`);
if (!archive.includes('class="article-tags"') || !archive.includes('/archive/?biomarker=')) errors.push('archive is missing searchable article tags');
if (archive.includes('Read full brief')) errors.push('archive still uses the single full-brief disclosure');
for (const [value,label] of [['added-desc','Most recently added'],['source-desc','Newest source date'],['source-asc','Oldest source date']]) {
  if (!archive.includes(`<option value="${value}">${label}</option>`)) errors.push(`archive sort is missing ${label}`);
}
if (archive.includes('<select name="sort" data-filter><option value="">All</option>')) errors.push('archive sort has an inaccurate All default');
if (!archive.includes('class="filter-drawer-actions"') || !archive.includes('class="filter-done"')) errors.push('archive filter header is not structured for desktop and mobile');
const css = fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
for (const feature of ['@media (max-width:620px)', '.filter-drawer', '.landscape-wrap { display:none; }', '.article-tags', '.brief-section', 'min-height:44px', 'prefers-reduced-motion', 'prefers-color-scheme', '@media print']) {
  if (!css.includes(feature)) errors.push(`responsive/accessibility CSS missing ${feature}`);
}
for (const relevance of ['Field-changing','Practice-relevant','Implementation-relevant','Important new evidence','Early signal']) if (!css.includes(`[data-relevance="${relevance}"]`)) errors.push(`relevance color missing for ${relevance}`);
const app = fs.readFileSync(path.join(root,'src/app.js'),'utf8');
if (!app.includes('data-entry-id][data-brief-section]') || !app.includes('detail.dataset.briefSection')) errors.push('independent brief-section state is not implemented');
const home = fs.readFileSync(path.join(dist,'index.html'),'utf8');
for (const link of ['FDA device databases','Medicare Coverage Database','CMS laboratory fee schedule','ClinicalTrials.gov','Blood-biomarker guideline','Amyloid and tau PET criteria']) if (!home.includes(link)) errors.push(`home missing quick reference: ${link}`);
if (!home.includes('class="latest-layout"') || !home.includes('class="quick-references"') || !home.includes('data-quick-references')) errors.push('home floating quick-reference panel is missing');
if (!css.includes('.quick-references { position:fixed') || !css.includes('@media (max-width:1640px)')) errors.push('floating quick-reference responsive layout is missing');
if (!home.includes('Reviewed through</dt><dd>September 4, 2026') || !home.includes('No new items met the inclusion threshold') || !home.includes('Next review</dt><dd>September 6, 2026')) errors.push('home review status is inaccurate');
const coverage = fs.readFileSync(path.join(dist,'coverage/index.html'),'utf8');
if (!coverage.includes('Historical review complete through September 4, 2026')) errors.push('historical coverage status missing');
if (!home.includes('automated process')) errors.push('automated review disclosure missing');
const landscapePage = fs.readFileSync(path.join(dist,'landscape/index.html'),'utf8');
if (!landscapePage.includes('<option>PET</option>') || !app.includes('row.dataset.modality.includes(modality)')) errors.push('landscape PET grouping is not implemented');
if (errors.length) { console.error(`Build tests failed:\n- ${errors.join('\n- ')}`); process.exit(1); }
console.log(`Passed structural, internal-link, RSS, asset-hash, archive-control, responsive/accessibility, status, disclosure, and ${entries.length}-permalink checks across ${htmlFiles.length} HTML files.`);
