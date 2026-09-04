import fs from 'node:fs';
const status = JSON.parse(fs.readFileSync(new URL('../src/data/status.json',import.meta.url),'utf8'));
const today = new Date().toISOString().slice(0,10);
if (today > status.nextScheduledReview) {
  console.error(`Review overdue: reviewed through ${status.reviewedThrough}; next scheduled ${status.nextScheduledReview}.`);
  process.exit(1);
}
console.log(`Review current through ${status.reviewedThrough}; next scheduled ${status.nextScheduledReview}.`);
