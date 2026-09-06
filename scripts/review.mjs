import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key,...rest]=arg.replace(/^--/,'').split('='); return [key,rest.join('=') || true]; }));
if (!args['reviewed-through']) {
  console.error('Usage: npm run review -- --reviewed-through=YYYY-MM-DD --qualified=0 [--next=YYYY-MM-DD] [--failure="message"]');
  process.exit(2);
}
const dateRx = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRx.test(args['reviewed-through'])) throw new Error('reviewed-through must be YYYY-MM-DD');
const statusPath = path.join(root,'src/data/status.json');
const status = JSON.parse(fs.readFileSync(statusPath,'utf8'));
const appendReview = record => {
  status.reviewLog = [...(status.reviewLog || []), record].slice(-30);
};
if (args.failure) {
  const failedAt = new Date().toISOString();
  status.workflowState = 'delayed';
  status.failure = {date:failedAt,message:String(args.failure)};
  appendReview({reviewedThrough:status.reviewedThrough,completedAt:failedAt,outcome:'delayed',qualified:0,note:String(args.failure)});
  fs.writeFileSync(statusPath,`${JSON.stringify(status,null,2)}\n`);
  console.error(`Review failed without advancing reviewed-through: ${args.failure}`);
  process.exitCode = 1;
} else {
  const qualified = Number(args.qualified ?? 0);
  if (!Number.isInteger(qualified) || qualified < 0 || qualified > 3) throw new Error('qualified must be an integer from 0 to 3');
  const reviewed = new Date(`${args['reviewed-through']}T12:00:00Z`);
  const next = args.next || new Date(reviewed.getTime()+2*86400000).toISOString().slice(0,10);
  const completedAt = new Date().toISOString();
  const message = qualified?`${qualified} new ${qualified===1?'item':'items'} qualified`:'No new items met the inclusion threshold';
  Object.assign(status,{reviewedThrough:args['reviewed-through'],newItemsQualified:qualified,nextScheduledReview:next,lastSuccessfulRun:completedAt,workflowState:'on-schedule',message,failure:null});
  appendReview({reviewedThrough:args['reviewed-through'],completedAt,outcome:'success',qualified,note:message});
  fs.writeFileSync(statusPath,`${JSON.stringify(status,null,2)}\n`);
  console.log(`Review recorded through ${status.reviewedThrough}; ${qualified} qualified; next ${next}.`);
}
