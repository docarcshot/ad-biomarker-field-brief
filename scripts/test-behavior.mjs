import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import '../src/view-state.js';
import {relatedBriefs,assayId} from './views.mjs';

const root=path.resolve(import.meta.dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'src/data',name),'utf8'));
const {visit,selection,delayed}=globalThis.ADBFViewState;

// A page transition must not acknowledge the rest of a new batch.
const first=visit(['old'],null,null);
assert.deepEqual(first.newIds,[]);
const returnVisit=visit(['old','new'],first.known,null);
assert.deepEqual(returnVisit.newIds,['new']);
const archive=visit(['old','new'],returnVisit.known,returnVisit.baseline);
assert.deepEqual(archive.newIds,['new']);
// IDs, rather than dates, detect an additional item published later the same day.
assert.deepEqual(visit(['old','new','same-day'],archive.known,archive.baseline).newIds,['new','same-day']);
assert.deepEqual(visit(['old','new'],archive.known,null).newIds,[]);
assert.deepEqual(visit(['old'],{corrupt:true},'corrupt').newIds,[]);

const status={reviewedThrough:'2026-09-06',nextScheduledReview:'2026-09-08',workflowState:'on-schedule'};
assert.equal(delayed(status,'2026-09-08'),false);
assert.equal(delayed(status,'2026-09-09'),true);
assert.equal(delayed({...status,workflowState:'delayed'},'2026-09-06'),true);
assert.deepEqual(selection(['b','a','b','missing','c','d'],['a','b','c','d'],3),['b','a','c']);
assert.deepEqual(selection({bad:true},['a']),[]);

const entries=read('entries.json');
const landscape=read('landscape.json');
const meeting=fs.readFileSync(path.join(root,'dist/meeting/index.html'),'utf8');
assert.equal((meeting.match(/class="packet-brief"/g)||[]).length,entries.length);
for(const entry of entries) {
  assert.ok(meeting.includes(`data-packet-id="${entry.id}" hidden`));
  assert.ok(meeting.includes(entry.primarySource.replace(/&/g,'&amp;')));
}
const comparison=fs.readFileSync(path.join(root,'dist/landscape/index.html'),'utf8');
for(const row of landscape) {
  assert.ok(comparison.includes(`data-compare-id="${assayId(row)}" hidden`));
  for(const link of relatedBriefs(row,entries)) assert.ok(comparison.includes(`/entries/${link.entry.slug}/`));
}
assert.ok(comparison.includes('No payer-specific determination recorded.'));
assert.ok(comparison.includes('No verified payment or patient-cost estimate recorded.'));
assert.ok(comparison.includes('Population and design'));
assert.ok(!relatedBriefs(landscape.find(row=>row.id==='elecsys-ptau181'),entries).length,'A shared biomarker must not silently link a different assay.');
assert.deepEqual(selection(entries.slice(0,3).map(entry=>entry.id),entries.map(entry=>entry.id)),entries.slice(0,3).map(entry=>entry.id));

// Execute the real application with disabled storage; core status code must still run.
const warning={hidden:true};
const message={dataset:{normalMessage:'No new items met the inclusion threshold'},classList:{toggle(){}},textContent:''};
const document={documentElement:{dataset:{},removeAttribute(){}},
  querySelector(selector){return selector==='#adbf-view-state'?{textContent:JSON.stringify({ids:entries.map(entry=>entry.id),status:{...status,workflowState:'delayed'}})}:null;},
  querySelectorAll(selector){return selector==='[data-review-warning]'?[warning]:selector==='[data-review-message]'?[message]:[];},addEventListener(){}};
const window={setInterval(){},addEventListener(){}};
for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw new Error('Storage unavailable');}});
const context=vm.createContext({window,document,URL,URLSearchParams,Intl,Date,location:{search:'',pathname:'/',hash:'',href:'https://example.test/'}});
vm.runInContext(fs.readFileSync(path.join(root,'src/view-state.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/app.js'),'utf8'),context);
assert.equal(warning.hidden,false);
assert.equal(message.textContent,'Review delayed');

// A missed review must fail the watchdog without changing the review date, while
// still permitting a new build with a visible delayed warning.
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'adbf-status-test-'));
try {
  for(const folder of ['scripts','src'])fs.cpSync(path.join(root,folder),path.join(temporary,folder),{recursive:true});
  const stale={...read('status.json'),reviewedThrough:'2000-01-01',nextScheduledReview:'2000-01-03'};
  const filename=path.join(temporary,'src/data/status.json');
  const before=JSON.stringify(stale);
  fs.writeFileSync(filename,before);
  const watchdog=spawnSync(process.execPath,['scripts/check-freshness.mjs'],{cwd:temporary,encoding:'utf8'});
  assert.equal(watchdog.status,1);
  assert.equal(fs.readFileSync(filename,'utf8'),before);
  const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:temporary,encoding:'utf8'});
  assert.equal(build.status,0,build.stderr);
  assert.ok(fs.readFileSync(path.join(temporary,'dist/index.html'),'utf8').includes('data-review-warning role="status">Review delayed'));
  assert.equal(fs.readFileSync(filename,'utf8'),before);
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
const workflow=fs.readFileSync(path.join(root,'.github/workflows/review.yml'),'utf8');
assert.match(workflow,/id: freshness[\s\S]*?continue-on-error: true/);
assert.ok(workflow.indexOf('Report overdue review after publishing its warning')>workflow.indexOf('uses: actions/deploy-pages'));
console.log('Passed visit continuity, same-day additions, delayed status, blocked storage, packet selections, assay relationships, and overdue-build regression checks.');
