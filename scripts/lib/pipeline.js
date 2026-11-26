import { APP_NAME, TIME_ZONE } from './config.js';
import { adaptRows } from './adapters.js';
import { dedupPlays } from './dedup.js';
import { computeStats, buildGlobals, buildLookup } from './aggregate.js';
import { flattenPlaylists, buildLocalCatalog, applyCatalog, scopedBonus, globalBonus } from './bonus.js';

/** raw (from loadRaw) -> normalized, deduped, locally-enriched plays + a report. */
export function preparePlays(raw) {
  const report = { files: [], droppedRows: 0 };
  let plays = [];
  for (const { file, rows } of raw.streaming) {
    const { format, plays: ps, dropped } = adaptRows(rows);
    report.files.push({ file, format, rows: rows.length, plays: ps.length, dropped });
    report.droppedRows += dropped;
    plays = plays.concat(ps);
  }
  const d = dedupPlays(plays);
  report.exactDuplicates = d.exactDuplicates;
  report.overlapDuplicates = d.overlapDuplicates;

  const playlists = flattenPlaylists(raw.playlistFiles ?? []);
  const catalog = buildLocalCatalog({ library: raw.library, playlists, plays: d.plays });
  report.albumsFilledLocally = applyCatalog(d.plays, catalog);
  return { plays: d.plays, playlists, report };
}

/**
 * Build every output document.
 * @param {ReturnType<typeof preparePlays>} prepared
 * @param {object} raw  loadRaw() result (for bonus files)
 * @param {{ meta?: any, now?: Date }} [opts]
 */
export function buildOutputs({ plays, playlists, report }, raw, opts = {}) {
  const globals = buildGlobals(plays);
  const years = [...new Set(plays.map((p) => p.year))].sort((a, b) => a - b);
  const bonusInputs = { searches: raw.searches, playlists };

  const stats = {};
  for (const year of years) {
    const scope = { id: String(year), year };
    const scoped = plays.filter((p) => p.year === year);
    stats[scope.id] = { ...computeStats(scoped, { scope, globals, meta: opts.meta }), bonus: scopedBonus(scope, bonusInputs) };
  }
  if (plays.length) {
    const scope = { id: 'all' };
    stats.all = { ...computeStats(plays, { scope, globals, meta: opts.meta }), bonus: scopedBonus(scope, bonusInputs) };
  }

  const index = {
    name: APP_NAME,
    timeZone: TIME_ZONE,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    hasExtended: plays.some((p) => p.source === 'extended'),
    hasEnrichment: Boolean(opts.meta),
    scopes: [
      ...years.map((y) => summarize(stats[String(y)])),
      ...(stats.all ? [summarize(stats.all)] : []),
    ],
    report: {
      files: report.files.map(({ file, format, rows, plays: n, dropped }) => ({ file, format, rows, plays: n, dropped })),
      droppedRows: report.droppedRows,
      exactDuplicates: report.exactDuplicates,
      overlapDuplicates: report.overlapDuplicates,
      albumsFilledLocally: report.albumsFilledLocally,
    },
    bonus: globalBonus({ library: raw.library, playlists, inferences: raw.inferences, marquee: raw.marquee }),
  };

  return { index, stats, lookup: buildLookup(plays) };
}

function summarize(s) {
  return {
    id: s.scope,
    year: s.year,
    coverage: s.coverage,
    minutes: s.totals.minutes,
    streams: s.totals.streams,
    podcastMinutes: s.totals.podcastMinutes,
    topArtist: s.topArtist?.name ?? null,
    hasExtended: Boolean(s.extended),
  };
}
