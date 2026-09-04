import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'src/data', name), 'utf8'));
const entries = read('entries.json');
const landscape = read('landscape.json');
const sources = read('sources.json');
const status = read('status.json');
const coverage = read('coverage.json');
const errors = [];
const required = ['id','slug','title','bottomLine','dateAdded','sourceDate','evidenceSource','modalities','biomarkers','clinicalUses','studyType','assays','platforms','organizations','regulatoryStatus','relevance','brief30','studyDesign','keyResults','whatChanged','evidenceStrength','clinicalSignificance','fieldRelevance','questions','limitations','platformRelevance','accessRelevance','primarySource','identifier','citation','historical'];
const relevance = new Set(['Field-changing','Practice-relevant','Implementation-relevant','Important new evidence','Early signal']);
const dateRx = /^\d{4}-\d{2}-\d{2}$/;
const seen = new Set();
const seenSlug = new Set();

entries.forEach((entry, index) => {
  required.forEach(key => { if (!(key in entry) || entry[key] === '' || entry[key] == null && key !== 'doi') errors.push(`entries[${index}] missing ${key}`); });
  if (seen.has(entry.id)) errors.push(`duplicate id: ${entry.id}`); else seen.add(entry.id);
  if (seenSlug.has(entry.slug)) errors.push(`duplicate slug: ${entry.slug}`); else seenSlug.add(entry.slug);
  if (!/^[a-z0-9-]+$/.test(entry.slug)) errors.push(`invalid slug: ${entry.slug}`);
  if (!dateRx.test(entry.sourceDate) || Number.isNaN(Date.parse(entry.sourceDate))) errors.push(`invalid sourceDate: ${entry.slug}`);
  if (!dateRx.test(entry.dateAdded) || Number.isNaN(Date.parse(entry.dateAdded))) errors.push(`invalid dateAdded: ${entry.slug}`);
  if (!relevance.has(entry.relevance)) errors.push(`invalid relevance: ${entry.slug}`);
  if (!/^https:\/\//.test(entry.primarySource)) errors.push(`non-HTTPS primary source: ${entry.slug}`);
  ['modalities','biomarkers','clinicalUses','assays','platforms','organizations','keyResults','questions','limitations'].forEach(key => { if (!Array.isArray(entry[key]) || !entry[key].length) errors.push(`${entry.slug} requires nonempty ${key}`); });
  if (entry.questions?.some(item => !item.q || !item.a)) errors.push(`${entry.slug} has invalid Q&A`);
});

landscape.forEach((row, index) => ['biomarker','assay','manufacturer','specimen','platform','intendedUse','regulatoryStatus','availability','threshold','reference','source','verified','verification'].forEach(key => { if (!row[key]) errors.push(`landscape[${index}] missing ${key}`); }));
sources.forEach((source, index) => ['name','category','url','cadence','lastChecked','method'].forEach(key => { if (!source[key]) errors.push(`sources[${index}] missing ${key}`); }));
if (!dateRx.test(status.reviewedThrough) || !dateRx.test(status.nextScheduledReview)) errors.push('status dates invalid');
if (status.newItemsQualified < 0 || status.newItemsQualified > 3) errors.push('status newItemsQualified must be 0–3');
if (coverage.status === 'complete' && !coverage.auditChecks.every(check => check.result === 'pass')) errors.push('coverage cannot be complete with failed audit checks');

if (errors.length) {
  console.error(`Validation failed with ${errors.length} error(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Validated ${entries.length} entries, ${landscape.length} landscape rows, ${sources.length} source records, and historical coverage through ${coverage.periodEnd}.`);
