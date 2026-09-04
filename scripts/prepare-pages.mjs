import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'dist');
const output = path.join(root, 'pages-dist');
const mount = '/ad-biomarker-field-brief';

if (!fs.existsSync(path.join(source, 'index.html'))) {
  throw new Error('Run the site build before preparing the GitHub Pages artifact.');
}

fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(source, output, { recursive: true });

const files = [];
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(item => {
  const target = path.join(directory, item.name);
  if (item.isDirectory()) walk(target);
  else files.push(target);
});
walk(output);

for (const file of files.filter(file => file.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8')
    .replace(/(href|src|action)="\/(?!\/)/g, `$1="${mount}/`);
  fs.writeFileSync(file, html);
}

const manifestPath = path.join(output, 'assets', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const key of ['css', 'js', 'entries', 'status']) manifest[key] = `${mount}${manifest[key]}`;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const errors = [];
for (const file of files.filter(file => file.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src|action)="(\/(?!\/)[^"]*)"/g)) {
    if (!match[1].startsWith(`${mount}/`)) errors.push(`${path.relative(output, file)} has unmounted path ${match[1]}`);
  }
}
if (errors.length) throw new Error(errors.join('\n'));

console.log(`Prepared GitHub Pages artifact at ${mount}/ with ${files.length} files.`);
