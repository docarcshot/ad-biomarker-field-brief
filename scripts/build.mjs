import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(root, 'src/data');
const dist = path.join(root, 'dist');
const readJSON = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
const entries = readJSON('entries.json').sort((a,b) => b.sourceDate.localeCompare(a.sourceDate));
const landscape = readJSON('landscape.json');
const sources = readJSON('sources.json');
const status = readJSON('status.json');
const coverage = readJSON('coverage.json');
const site = readJSON('site.json');
const check = spawnSync(process.execPath, [path.join(root, 'scripts/validate.mjs')], {encoding:'utf8'});
if (check.status !== 0) { process.stderr.write(check.stderr); process.exit(check.status || 1); }

fs.rmSync(dist, {recursive:true, force:true});
fs.mkdirSync(path.join(dist, 'assets'), {recursive:true});
const hash = input => crypto.createHash('sha256').update(input).digest('hex').slice(0,10);
const writeAsset = (stem, ext, content) => {
  const filename = `${stem}.${hash(content)}.${ext}`;
  fs.writeFileSync(path.join(dist, 'assets', filename), content);
  return `/assets/${filename}`;
};
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const cssPath = writeAsset('site','css',css);
const jsPath = writeAsset('site','js',js);
const entriesPath = writeAsset('entries','json',JSON.stringify(entries));
const statusPath = writeAsset('status','json',JSON.stringify(status));
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapeAttr = escapeHTML;
const fmt = value => new Intl.DateTimeFormat('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const joinTags = value => value.map(escapeHTML).join(' · ');
const abs = pathname => new URL(pathname, site.baseUrl).href;
const filterHref = (name, value) => `/archive/?${new URLSearchParams([[name, value.toLowerCase()]]).toString()}`;
const relevanceLabels = ['Field-changing','Practice-relevant','Implementation-relevant','Important new evidence','Early signal'];
const relevanceLegend = () => `<div class="relevance-legend" aria-label="Relevance color key"><span class="legend-label">Relevance</span>${relevanceLabels.map(label=>`<span class="relevance-key" data-relevance="${escapeAttr(label)}"><span class="relevance-swatch" aria-hidden="true"></span>${escapeHTML(label)}</span>`).join('')}</div>`;
const nav = current => [
  ['Latest','/'],['Archive','/archive/'],['Landscape','/landscape/'],['Methods','/methods/'],['About','/about/'],['RSS','/feed.xml']
].map(([label,url]) => `<a href="${url}"${current===label?` aria-current="page"`:''}>${label}</a>`).join('');
const disclosure = 'AI is used to assist literature discovery, screening, drafting, and primary-source verification through an automated process. Summaries may contain errors and should be confirmed against the original publication. The editor is employed by Quanterix. This independent resource uses only publicly available information and does not represent Quanterix. It does not provide medical advice or constitute promotional communication.';
const layout = ({title,description=site.description,current='',body,canonical='/',extraHead=''}) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHTML(title)} · ${site.name}</title><meta name="description" content="${escapeAttr(description)}"><link rel="canonical" href="${abs(canonical)}"><link rel="alternate" type="application/rss+xml" title="${site.name}" href="${abs('/feed.xml')}"><link rel="stylesheet" href="${cssPath}">${extraHead}</head>
<body><a class="skip-link" href="#content">Skip to content</a><header class="site-header"><div class="header-inner"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">Aβ</span><span>${site.name}</span></a><nav class="site-nav" aria-label="Primary">${nav(current)}</nav><button class="theme-toggle" type="button" data-theme-toggle aria-label="Change color theme">◐</button></div></header><main id="content">${body}</main><footer class="site-footer"><div class="footer-inner"><p>${disclosure}</p><div class="footer-links"><a href="/methods/">Methods</a><a href="/feed.xml">RSS</a></div></div></footer><script src="${jsPath}" defer></script></body></html>`;

const card = (entry, {article=false, extra=false}={}) => {
  const attrs = {
    modality:entry.modalities, biomarker:entry.biomarkers, clinicalUse:entry.clinicalUses,
    studyType:[entry.studyType], platform:entry.platforms, organization:entry.organizations,
    regulatory:[entry.regulatoryStatus], sourceType:[entry.evidenceSource], yearMonth:[entry.sourceDate.slice(0,7)]
  };
  const dataAttrs = Object.entries(attrs).map(([key,value]) => `data-${key.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`)}="${escapeAttr(value.map(v=>v.toLowerCase()).join('|'))}"`).join(' ');
  const search = [entry.title,entry.bottomLine,entry.brief30,entry.studyDesign,...entry.keyResults,...entry.modalities,...entry.biomarkers,...entry.clinicalUses,...entry.assays,...entry.platforms,...entry.organizations,entry.regulatoryStatus,entry.evidenceSource].join(' ').toLowerCase();
  const tags = [
    ...entry.modalities.slice(0,1).map(value=>({name:'modality',value})),
    ...entry.biomarkers.slice(0,2).map(value=>({name:'biomarker',value})),
    ...entry.clinicalUses.slice(0,1).map(value=>({name:'clinicalUse',value}))
  ];
  const tagHTML = tags.map(tag=>`<a class="tag-link" href="${filterHref(tag.name,tag.value)}" aria-label="Filter archive by ${escapeAttr(tag.value)}">${escapeHTML(tag.value)}</a>`).join('');
  return `<article class="brief-card${article?' entry-full':''}" data-entry-id="${escapeAttr(entry.id)}" data-relevance="${escapeAttr(entry.relevance)}" ${extra?'data-recent-extra hidden':''} ${dataAttrs} data-search="${escapeAttr(search)}" data-source-date="${entry.sourceDate}" data-date-added="${entry.dateAdded}"${article?'':' data-archive-card'}>
    <div class="card-summary"><div class="meta-row"><span class="relevance">${escapeHTML(entry.relevance)}</span><span aria-hidden="true">•</span><span>${escapeHTML(entry.evidenceSource)}</span><span aria-hidden="true">•</span><span>${fmt(entry.sourceDate)}</span></div>
    <h3>${article?escapeHTML(entry.title):`<a href="/entries/${entry.slug}/">${escapeHTML(entry.title)}</a>`}</h3>
    <p class="bottom-line">${escapeHTML(entry.bottomLine)}</p>
    <p class="number-line"><span class="visually-hidden">Key quantitative result: </span>${escapeHTML(entry.keyResults[0])}</p>
    <div class="article-tags" aria-label="Article tags">${tagHTML}</div><p class="added">Added ${fmt(entry.dateAdded)} · ${escapeHTML(entry.identifier)}</p></div>
    <div class="card-details" aria-label="Brief sections">
      <details class="brief-section" data-entry-id="${escapeAttr(entry.id)}" data-brief-section="summary"><summary><span>Evidence summary</span><small>Design, results, and what changed</small></summary><div class="section-body">
        <h4>Thirty-second field brief</h4><p>${escapeHTML(entry.brief30)}</p><h4>Study design</h4><p>${escapeHTML(entry.studyDesign)}</p>
        <h4>Key quantitative results</h4><ul class="results-list">${entry.keyResults.map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ul>
        <h4>What changed</h4><p>${escapeHTML(entry.whatChanged)}</p><h4>Strength of evidence</h4><p>${escapeHTML(entry.evidenceStrength)}</p>
      </div></details>
      <details class="brief-section" data-entry-id="${escapeAttr(entry.id)}" data-brief-section="impact"><summary><span>Clinical and field impact</span><small>Interpretation, implementation, and access</small></summary><div class="section-body">
        <h4>Clinical significance</h4><p>${escapeHTML(entry.clinicalSignificance)}</p><h4>Field medical relevance</h4><p>${escapeHTML(entry.fieldRelevance)}</p>
        <h4>Quanterix or platform relevance</h4><p>${escapeHTML(entry.platformRelevance)}</p><h4>Access or reimbursement relevance</h4><p>${escapeHTML(entry.accessRelevance)}</p>
      </div></details>
      <details class="brief-section" data-entry-id="${escapeAttr(entry.id)}" data-brief-section="questions"><summary><span>Likely questions</span><small>What you may hear and what the evidence supports</small></summary><div class="section-body"><dl>${entry.questions.map(x=>`<div class="qa"><dt>${escapeHTML(x.q)}</dt><dd>${escapeHTML(x.a)}</dd></div>`).join('')}</dl></div></details>
      <details class="brief-section" data-entry-id="${escapeAttr(entry.id)}" data-brief-section="critique"><summary><span>Critique and limitations</span><small>Bias, uncertainty, and missing evidence</small></summary><div class="section-body">
        <ul>${entry.limitations.map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ul>${entry.corrections.length?`<h4>Correction notes</h4><ul>${entry.corrections.map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ul>`:''}
      </div></details>
      <div class="source-block"><p><a href="${escapeAttr(entry.primarySource)}" rel="noopener">Primary source</a>${entry.doi?` · <a href="https://doi.org/${escapeAttr(entry.doi)}" rel="noopener">DOI</a>`:''}</p><p class="citation">${escapeHTML(entry.citation)}</p>
      <div class="card-actions"><button type="button" data-copy="link" data-url="${abs(`/entries/${entry.slug}/`)}">Copy link</button><button type="button" data-copy="citation" data-citation="${escapeAttr(entry.citation)}">Copy citation</button></div></div>
    </div></article>`;
};

const mkdirWrite = (relative, html) => { const target=path.join(dist,relative); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,html); };
const prospective = entries.filter(e=>!e.historical).sort((a,b)=>b.dateAdded.localeCompare(a.dateAdded));
const historical = entries.filter(e=>e.historical).slice(0,3);
const overdue = status.workflowState === 'delayed' || (new Date() > new Date(`${status.nextScheduledReview}T23:59:59Z`) && status.reviewedThrough < status.nextScheduledReview);
const statusText = status.newItemsQualified ? `${status.newItemsQualified} new ${status.newItemsQualified===1?'item':'items'} qualified` : status.message;
const home = `<section class="masthead"><div><p class="eyebrow">Independent evidence monitoring</p><h1>${site.name}</h1><p class="lede">${site.description}</p><form class="home-search" action="/archive/" role="search"><label class="visually-hidden" for="home-q">Search the archive</label><input id="home-q" name="q" type="search" placeholder="Search biomarkers, assays, uses, or results"><button class="primary-button" type="submit">Search</button></form></div>
<aside class="status-panel" aria-label="Review status"><dl><div><dt>Reviewed through</dt><dd>${fmt(status.reviewedThrough)}</dd></div><div><dt>Qualified</dt><dd>${status.newItemsQualified}</dd></div><div><dt>Next review</dt><dd>${fmt(status.nextScheduledReview)}</dd></div></dl><p class="status-message${overdue?' delayed':''}">${overdue?'Review delayed':escapeHTML(statusText)}</p></aside></section>
<section id="latest"><div class="section-head"><div><p class="eyebrow">Current monitoring</p><h2>Latest</h2></div><a class="text-link" href="/archive/">Complete archive →</a></div>
${relevanceLegend()}${prospective.length?`<div class="card-list">${prospective.slice(0,10).map((e,i)=>card(e,{extra:i>=3})).join('')}</div>${prospective.length>3?`<div class="show-controls"><button data-show-more>Show more recent</button><button data-show-fewer hidden>Show fewer</button></div>`:''}`:`<div class="callout"><strong>No prospective entries yet.</strong> The launch-date review completed successfully and no post-launch item met the inclusion threshold.</div>`}</section>
<section><div class="section-head"><div><p class="eyebrow">Backfill, kept separate</p><h2>Recently added to the historical archive</h2><p>Source dates—not date added—place these entries in the 2026 archive.</p></div></div><div class="card-list">${historical.map(e=>card(e)).join('')}</div></section>`;
mkdirWrite('index.html',layout({title:'Latest',current:'Latest',canonical:'/',body:home}));

const unique = key => [...new Set(entries.flatMap(e=>Array.isArray(e[key])?e[key]:[e[key]]))].sort((a,b)=>a.localeCompare(b));
const select = (name,label,values) => `<label class="field"><span>${label}</span><select name="${name}" data-filter><option value="">All</option>${values.map(v=>`<option value="${escapeAttr(v.toLowerCase())}">${escapeHTML(v)}</option>`).join('')}</select></label>`;
const archiveBody = `<header class="page-head"><p class="eyebrow">Evidence archive</p><h1>Search and filter every brief</h1><p>Source date and date added are tracked separately. The default sort is most recently added.</p></header>${relevanceLegend()}
<section class="archive-tools" aria-label="Archive controls"><div class="tool-row"><label class="field"><span>Full-text search</span><input class="search-input" type="search" name="q" data-filter placeholder="Title, result, assay, organization…"></label><label class="field"><span>Sort by</span><select name="sort" data-filter><option value="added-desc">Most recently added</option><option value="source-desc">Newest source date</option><option value="source-asc">Oldest source date</option></select></label><button type="button" data-open-filters class="filter-toggle">Filters</button></div>
<div class="filter-drawer" data-filter-drawer><div class="filter-drawer-head"><strong>Filters</strong><button type="button" data-close-filters>Done</button></div><div class="filter-grid">${select('modality','Modality',unique('modalities'))}${select('biomarker','Biomarker',unique('biomarkers'))}${select('clinicalUse','Clinical use',unique('clinicalUses'))}${select('relevance','Relevance label',unique('relevance'))}</div><button type="button" data-clear-all>Clear all</button></div><div class="active-filters" data-active-filters aria-live="polite"></div></section>
<p class="result-count" data-result-count aria-live="polite"></p><div class="card-list" data-archive>${entries.map(e=>card(e)).join('')}</div><p class="no-results" data-no-results hidden>No briefs match this view. Remove a filter or clear all.</p>`;
mkdirWrite('archive/index.html',layout({title:'Archive',current:'Archive',canonical:'/archive/',body:archiveBody,extraHead:`<link rel="preload" href="${entriesPath}" as="fetch" crossorigin>`}));

const modalityOf = row => row.platform.includes('PET') ? 'PET' : row.specimen.toLowerCase().includes('csf') ? 'CSF' : 'Blood';
const landscapeRows = landscape.map(row => `<tr data-landscape-row data-modality="${modalityOf(row).toLowerCase()}" data-search="${escapeAttr(Object.values(row).join(' ').toLowerCase())}"><td><strong>${escapeHTML(row.assay)}</strong><br>${escapeHTML(row.biomarker)}</td><td>${escapeHTML(row.manufacturer)}</td><td>${escapeHTML(row.specimen)}<br>${escapeHTML(row.platform)}</td><td>${escapeHTML(row.intendedUse)}</td><td>${escapeHTML(row.regulatoryStatus)}<br><small>${escapeHTML(row.availability)}</small></td><td>${escapeHTML(row.threshold)}</td><td>${escapeHTML(row.reference)}</td><td><a href="${escapeAttr(row.source)}">Source</a><br>${fmt(row.verified)}</td></tr>`).join('');
const landscapeCards = landscape.map(row => `<article class="landscape-card" data-landscape-row data-modality="${modalityOf(row).toLowerCase()}" data-search="${escapeAttr(Object.values(row).join(' ').toLowerCase())}"><h3>${escapeHTML(row.assay)}</h3><p>${escapeHTML(row.biomarker)} · ${escapeHTML(row.manufacturer)}</p><dl>${[['Specimen / platform',`${row.specimen}; ${row.platform}`],['Intended use',row.intendedUse],['Regulatory status',row.regulatoryStatus],['Availability',row.availability],['Threshold',row.threshold],['Reference',row.reference],['Last verified',fmt(row.verified)]].map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHTML(v)}</dd></div>`).join('')}</dl><a href="${escapeAttr(row.source)}">Validation source</a></article>`).join('');
const landscapeBody = `<header class="page-head"><p class="eyebrow">Assay and testing landscape</p><h1>What is available, authorized, or still research-only</h1><p>This table does not rank assays. Cross-study accuracy estimates are not treated as head-to-head evidence.</p></header><div class="tool-row"><label class="field"><span>Search landscape</span><input class="search-input" type="search" data-landscape-search placeholder="Assay, marker, platform…"></label><label class="field"><span>Modality</span><select data-landscape-filter><option value="">All</option><option>Blood</option><option>CSF</option><option>PET</option></select></label></div><p class="callout">Unknown, research-use-only, company-reported, and rollout-pending states are stated explicitly. Every regulatory and availability field has a verification date.</p><div class="landscape-wrap"><table class="landscape-table"><thead><tr><th>Assay / biomarker</th><th>Maker / lab</th><th>Specimen / platform</th><th>Intended use</th><th>Status / availability</th><th>Threshold</th><th>Reference</th><th>Verified source</th></tr></thead><tbody>${landscapeRows}</tbody></table></div><div class="landscape-cards">${landscapeCards}</div>`;
mkdirWrite('landscape/index.html',layout({title:'Landscape',current:'Landscape',canonical:'/landscape/',body:landscapeBody}));

const registryHTML = sources.map(source=>`<article class="registry-item"><h3><a href="${escapeAttr(source.url)}">${escapeHTML(source.name)}</a></h3><p><strong>${escapeHTML(source.category)}</strong> · ${escapeHTML(source.cadence)} · Last checked ${fmt(source.lastChecked)}</p><p>${escapeHTML(source.method)}</p></article>`).join('');
const methodsBody = `<header class="page-head"><p class="eyebrow">Methods</p><h1>Reproducible, thresholded evidence monitoring</h1><p>The site is designed to answer what changed, how strong the evidence is, what the numbers show, how practice may be affected, and what questions will come next.</p></header><div class="prose">
<h2>Site specification</h2><dl class="definition-grid"><div><dt>Final name</dt><dd>AD Biomarker Field Brief</dd></div><div><dt>One-sentence description</dt><dd>${escapeHTML(site.description)}</dd></div><div><dt>Information architecture</dt><dd>Latest, Archive, Landscape, Methods, About, and RSS; historical coverage is linked from Methods and Archive.</dd></div><div><dt>Visual system</dt><dd>Scientific-publication typography, cool neutral surfaces, dark teal accent, text-labeled evidence states, 1100-pixel maximum width, and system light/dark modes.</dd></div></dl>
<h2>Inclusion threshold</h2><p>Zero to three entries may be added per review. A development qualifies only if it could plausibly change scientific exchange, result interpretation, test selection, implementation, authorization, coverage, access, or trial design. Routine association studies, unconfirmed announcements, and therapeutic news without a biomarker consequence are excluded.</p>
<h2>Evidence model</h2><p>Primary sources control. Analytical validity, clinical validity, clinical utility, regulatory authorization, availability, guideline endorsement, and payer coverage are separate fields. Diagnostic results include the actual denominator, reference standard, thresholds, indeterminate range, predictive values, and confidence intervals when the source reports them. Cross-study performance is never presented as a head-to-head comparison.</p>
<h2>Structured entry schema</h2><p>Every entry is stored as validated JSON and includes stable ID/slug, source and added dates, evidence and relevance labels, modality/biomarker/use tags, design, quantitative results, interpretation, questions and answers, limitations, platform/access relevance, source, citation, and correction history. The same data generate cards, permalinks, archive filters, sitemap, and RSS.</p>
<h2>Historical backfill</h2><p>The 2026 backfill was run month by month from January 1 through September 4, 2026. Every source category was checked, and conference abstracts, preprints, releases, and final articles were deduplicated to the most definitive version. Zero-result months remain visible. <a href="/coverage/">Inspect the coverage audit.</a></p>
<h2>Prospective review</h2><p>An every-other-day scheduled review begins after launch, with a manual-run option. Discovery queries search all registry categories. The process may publish zero entries. The reviewed-through date advances only after successful screening, primary-source verification, validation, and deployment; an overdue or failed run must not masquerade as current.</p>
<h2>Validation and deployment</h2><p>Before deployment, the build checks required fields, ISO dates, relevance tags, duplicate stable identifiers and slugs, HTTPS primary sources, nonempty quantitative results, landscape verification dates, and coverage-audit consistency. CSS, JavaScript, entry data, and status data receive content hashes. The deployment package, RSS, sitemap, archive, cards, and landscape are generated in one build.</p>
<h2>Corrections</h2><p>Substantive corrections are appended as dated notes. They are not silently overwritten. To request a correction, provide the stable entry URL, the sentence at issue, and a primary source supporting the change.</p>
<h2 id="source-registry">Source registry</h2></div><div class="registry">${registryHTML}</div>`;
mkdirWrite('methods/index.html',layout({title:'Methods',current:'Methods',canonical:'/methods/',body:methodsBody}));

const coverageBody = `<header class="page-head"><p class="eyebrow">Historical coverage</p><h1>Historical review complete through ${fmt(status.historicalCompleteThrough)}</h1><p>Completion means the period and every designated source category passed the documented audit. It does not mean every publication was included.</p></header><div class="coverage-grid">${coverage.months.map(month=>`<article class="month-card"><h3>${month.month}</h3><dl><div><dt>Status</dt><dd>${escapeHTML(month.status)}</dd></div><div><dt>Qualified</dt><dd>${month.qualified}</dd></div></dl><p>${escapeHTML(month.notes)}</p></article>`).join('')}</div><section class="prose"><h2>Audit results</h2>${coverage.auditChecks.map(check=>`<div class="registry-item"><strong>${escapeHTML(check.name)}: ${escapeHTML(check.result)}</strong><p>${escapeHTML(check.detail)}</p></div>`).join('')}<p>Audit performed ${fmt(coverage.reviewedOn)}. Source-level checked dates are in the <a href="/methods/#source-registry">registry</a>.</p></section>`;
mkdirWrite('coverage/index.html',layout({title:'Historical coverage',canonical:'/coverage/',body:coverageBody}));

const aboutBody = `<header class="page-head"><p class="eyebrow">About</p><h1>A field-medical evidence brief, not a news feed</h1></header><div class="prose"><p>${site.description}</p><h2>Editorial position</h2><p>The editor works as a medical science liaison at Quanterix. The site applies the same inclusion and evidence standards to Quanterix, competitors, laboratories, imaging organizations, and academic groups. It does not provide internal strategy, account targeting, promotional messaging, or off-label positioning.</p><h2>What this is not</h2><p>It is not a comprehensive bibliography, investor resource, Quanterix marketing site, public discussion forum, or medical advice. Company announcements can qualify only when they materially change the public evidence, authorization, access, or testing landscape, and manufacturer-only results are labeled.</p><h2>AI and review disclosure</h2><p>${disclosure}</p><h2>Privacy</h2><p>No account is required. Expanded-card state, theme, and the date of your last visit are stored only in your browser. The site has no public comments or public notes.</p></div>`;
mkdirWrite('about/index.html',layout({title:'About',current:'About',canonical:'/about/',body:aboutBody}));

entries.forEach(entry => {
  const body = `<nav aria-label="Breadcrumb"><a href="/archive/">Archive</a> / ${fmt(entry.sourceDate)}</nav><article class="entry-article"><header class="page-head"><p class="eyebrow">${escapeHTML(entry.relevance)}</p><h1>${escapeHTML(entry.title)}</h1><p>${escapeHTML(entry.bottomLine)}</p></header>${card(entry,{article:true})}</article>`;
  mkdirWrite(`entries/${entry.slug}/index.html`,layout({title:entry.title,description:entry.bottomLine,canonical:`/entries/${entry.slug}/`,body}));
});

const rssItems = [...entries].sort((a,b)=>b.dateAdded.localeCompare(a.dateAdded)||b.sourceDate.localeCompare(a.sourceDate)).slice(0,30).map(entry=>`<item><title>${escapeHTML(entry.title)}</title><link>${abs(`/entries/${entry.slug}/`)}</link><guid isPermaLink="true">${abs(`/entries/${entry.slug}/`)}</guid><pubDate>${new Date(`${entry.dateAdded}T12:00:00Z`).toUTCString()}</pubDate><description>${escapeHTML(entry.bottomLine)}</description></item>`).join('');
const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${site.name}</title><link>${site.baseUrl}</link><description>${escapeHTML(site.description)}</description><language>en-us</language><lastBuildDate>${new Date(status.lastSuccessfulRun).toUTCString()}</lastBuildDate>${rssItems}</channel></rss>`;
mkdirWrite('feed.xml',rss); mkdirWrite('rss.xml',rss);
const sitemapUrls = ['/', '/archive/','/landscape/','/methods/','/coverage/','/about/',...entries.map(e=>`/entries/${e.slug}/`)];
mkdirWrite('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls.map(url=>`<url><loc>${abs(url)}</loc></url>`).join('')}</urlset>`);
mkdirWrite('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${abs('/sitemap.xml')}\n`);
mkdirWrite('404.html',layout({title:'Not found',body:'<header class="page-head"><p class="eyebrow">404</p><h1>Brief not found</h1><p>The URL may have changed or the entry may not exist. <a href="/archive/">Search the archive.</a></p></header>'}));
mkdirWrite('assets/manifest.json',JSON.stringify({css:cssPath,js:jsPath,entries:entriesPath,status:statusPath,generatedAt:new Date().toISOString()},null,2));
console.log(`Built ${entries.length} entry pages and 6 core pages with hashed assets.`);
