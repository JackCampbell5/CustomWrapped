#!/usr/bin/env node
// Preprocess: data/raw -> src/generated/*.json
//   npm run build:data                 (enrich via Spotify API if keys are in .env)
//   npm run build:data:offline         (no API calls; still uses data/cache/spotify.json)
//   node scripts/build-data.js --raw fixtures   (build from synthetic fixtures)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRaw } from './lib/load.js';
import { preparePlays, buildOutputs, attachEnrichment } from './lib/pipeline.js';
import { collectTargets, resolveTargets, buildMeta } from './lib/enrich.js';
import { openCache } from './lib/spotify/cache.js';
import { createAuth } from './lib/spotify/auth.js';
import { createApi } from './lib/spotify/api.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const rawDir = path.resolve(root, opt('--raw', 'data/raw'));
const outDir = path.resolve(root, opt('--out', 'src/generated'));
const cacheDir = path.resolve(root, 'data/cache');
const noEnrich = args.includes('--no-enrich');
const log = (s) => console.log(s);

async function main() {
  const t0 = Date.now();
  log(`Reading ${path.relative(root, rawDir) || '.'}`);
  const raw = loadRaw(rawDir);
  for (const e of raw.errors) console.warn(`  ! ${e}`);
  if (!raw.streaming.length) {
    console.error(`No streaming history files found under ${rawDir}.\nPut your Spotify export in data/raw/ (see README).`);
    process.exit(1);
  }

  const prepared = preparePlays(raw);
  const { report } = prepared;
  for (const f of report.files) {
    log(`  ${(f.format ?? 'unrecognized').padEnd(16)} ${String(f.plays).padStart(7)} plays  ${f.file}${f.dropped ? `  (${f.dropped} rows skipped)` : ''}`);
  }
  log(
    `  ${prepared.plays.length} plays after dedup (${report.exactDuplicates} exact repeats, ${report.overlapDuplicates} account/extended overlaps removed); ` +
      `${report.albumsFilledLocally} albums filled from library/playlists`,
  );

  const outputs = buildOutputs(prepared, raw);

  // ---- enrichment (cache-first; API only for what's missing)
  log('\nSpotify enrichment');
  const cache = openCache(path.join(cacheDir, 'spotify.json'));
  const targets = collectTargets(prepared.plays, outputs.stats);
  log(`  targets: ${targets.tracks.size} tracks, ${targets.artists.size} artists, ${targets.albums.size} albums, ${targets.shows.size} shows`);

  let api = null;
  let auth = null;
  if (!noEnrich) {
    try {
      process.loadEnvFile(path.join(root, '.env'));
    } catch {
      /* no .env: handled below */
    }
    const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
    if (clientId && clientSecret) {
      auth = createAuth({ clientId, clientSecret, cacheDir, log });
      api = createApi({ auth, log });
    } else {
      log('  ⚠ No SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env: skipping API calls.');
      log('    The app still works and uses generated gradient art. See README to add keys.');
    }
  } else log('  --no-enrich: using cached results only.');

  const onForbidden = async () => {
    if (!auth || auth.mode !== 'client') return false;
    log('  Client Credentials got 403; falling back to Authorization Code + PKCE.');
    try {
      await auth.switchToUser();
      return true;
    } catch (e) {
      log(`  ! PKCE login failed: ${e.message}`);
      return false;
    }
  };

  const process_ = await resolveTargets(targets, { api, cache, log, onForbidden });
  if (api) log(`  ${process_.calls} API calls this run${process_.stoppedReason ? ` (stopped early: ${process_.stoppedReason})` : ''}`);
  const meta = buildMeta(targets, cache);
  if (meta) {
    attachEnrichment(outputs, prepared.plays, meta);
    log(`  metadata for ${meta.counts.tracks} tracks, ${meta.counts.artists} artists, ${meta.counts.albums} albums, ${meta.counts.shows} shows`);
  } else log('  no cached metadata yet; the app will use generated art.');

  // ---- write
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^(stats-.*|index|lookup|art)\.json$/.test(f)) fs.rmSync(path.join(outDir, f));
  const write = (name, data) => {
    const file = path.join(outDir, name);
    fs.writeFileSync(file, JSON.stringify(data));
    return `${name} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`;
  };
  const written = [write('index.json', outputs.index), write('lookup.json', outputs.lookup), write('art.json', meta ?? {})];
  for (const [id, s] of Object.entries(outputs.stats)) written.push(write(`stats-${id}.json`, s));

  log(`\nScopes:`);
  for (const s of outputs.index.scopes) {
    const c = s.coverage;
    const note = c?.partial ? `partial: ${c.first} → ${c.last}, ${c.pctCovered}% of year` : `${c.first} → ${c.last}`;
    log(`  ${String(s.id).padEnd(5)} ${String(Math.round(s.minutes)).padStart(7)} min  ${String(s.streams).padStart(6)} streams  top: ${s.topArtist ?? '-'}  (${note})`);
  }
  for (const hy of outputs.index.hiddenYears) {
    log(`  ${String(hy.year).padEnd(5)} hidden: only ${hy.spanDays} days of data (${hy.first} → ${hy.last}); needs ${outputs.index.minYearSpanDays}. Still counted in "all".`);
  }
  log(`  year-over-year: ${outputs.index.canCompare ? 'on' : 'off (needs two years with 6+ months of data)'}`);
  log(`\nWrote ${path.relative(root, outDir)}/: ${written.join(', ')}`);
  log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(`\nbuild:data failed: ${e.message}`);
  process.exit(1);
});
