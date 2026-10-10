// Build: copy public/ -> dist/ (or $OUT), bundle src/app.js, stamp VERSION + APP_NAME (from src/config.js).
import { build } from 'esbuild';
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const OUT = process.env.OUT || 'dist';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const cfg = readFileSync('src/config.js', 'utf8');
const get = (k) => cfg.match(new RegExp(`${k} = '([^']+)'`))[1];
const VERSION = `${pkg.version}+${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT);
cpSync('public', OUT, { recursive: true });
await build({ entryPoints: ['src/app.js'], bundle: true, format: 'esm', minify: true, target: ['safari15', 'chrome100'], outfile: `${OUT}/app.js` });
for (const f of ['sw.js', 'app.js', 'index.html', 'manifest.webmanifest']) {
  const p = `${OUT}/${f}`;
  writeFileSync(p, readFileSync(p, 'utf8').replaceAll('__VERSION__', VERSION).replaceAll('__APP_NAME__', get('APP_NAME')).replaceAll('__SHORT_NAME__', get('SHORT_NAME')));
}
if (!readFileSync(`${OUT}/sw.js`, 'utf8').includes(VERSION)) throw new Error('version stamp failed');
writeFileSync(`${OUT}/.nojekyll`, '');
writeFileSync(`${OUT}/version.txt`, VERSION + '\n');
console.log('built', VERSION);
