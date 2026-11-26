#!/usr/bin/env node
// Preprocess: data/raw -> src/generated/*.json
//   npm run build:data                 (enrich via Spotify API if keys exist)
//   npm run build:data:offline         (skip enrichment)
//   node scripts/build-data.js --raw fixtures   (build from synthetic fixtures)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRaw } from './lib/load.js';
import { preparePlays, buildOutputs } from './lib/pipeline.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const rawDir = path.resolve(root, opt('--raw', 'data/raw'));
const outDir = path.resolve(root, opt('--out', 'src/generated'));

const t0 = Date.now();
console.log(`Reading ${path.relative(root, rawDir) || '.'}`);
const raw = loadRaw(rawDir);
for (const e of raw.errors) console.warn(`  ! ${e}`);
if (!raw.streaming.length) {
  console.error(`No streaming history files found under ${rawDir}.\nPut your Spotify export in data/raw/ (see README).`);
  process.exit(1);
}

const prepared = preparePlays(raw);
const { report } = prepared;
for (const f of report.files) {
  console.log(`  ${f.format ? f.format.padEnd(16) : 'unrecognized'.padEnd(16)} ${String(f.plays).padStart(7)} plays  ${f.file}${f.dropped ? `  (${f.dropped} rows skipped)` : ''}`);
}
console.log(
  `  ${prepared.plays.length} plays after dedup (${report.exactDuplicates} exact repeats, ${report.overlapDuplicates} account/extended overlaps removed); ` +
    `${report.albumsFilledLocally} albums filled from library/playlists`,
);

// Enrichment is added in a later milestone; until then the app uses generated art.
const meta = undefined;

const { index, stats, lookup } = buildOutputs(prepared, raw, { meta });

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/^(stats-.*|index|lookup)\.json$/.test(f)) fs.rmSync(path.join(outDir, f));
const write = (name, data) => {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, JSON.stringify(data));
  return `${name} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`;
};
const written = [write('index.json', index), write('lookup.json', lookup)];
for (const [id, s] of Object.entries(stats)) written.push(write(`stats-${id}.json`, s));

console.log(`\nScopes:`);
for (const s of index.scopes) {
  const c = s.coverage;
  const note = c?.partial ? `partial: ${c.first} → ${c.last}, ${c.pctCovered}% of year` : `${c.first} → ${c.last}`;
  console.log(`  ${String(s.id).padEnd(5)} ${String(Math.round(s.minutes)).padStart(7)} min  ${String(s.streams).padStart(6)} streams  top: ${s.topArtist ?? '-'}  (${note})`);
}
console.log(`\nWrote ${path.relative(root, outDir)}/: ${written.join(', ')}`);
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
