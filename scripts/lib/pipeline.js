import { APP_NAME, MIN_YEAR_SPAN_DAYS, TIME_ZONE } from './config.js';
import { adaptRows } from './adapters.js';
import { dedupPlays } from './dedup.js';
import { computeStats, buildGlobals, buildLookup, coverageFor } from './aggregate.js';
import { flattenPlaylists, buildLocalCatalog, applyCatalog, scopedBonus, globalBonus } from './bonus.js';
import { computeEnriched } from './enrich.js';

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
 * @param {{ now?: Date, minYearSpanDays?: number }} [opts]
 *   minYearSpanDays: years whose data spans fewer days are hidden (no stats file, not in the picker).
 *   Their plays still count toward "all", search history and first-played dates.
 */
export function buildOutputs({ plays, playlists, report }, raw, opts = {}) {
  const minSpan = opts.minYearSpanDays ?? MIN_YEAR_SPAN_DAYS;
  const globals = buildGlobals(plays);
  const allYears = [...new Set(plays.map((p) => p.year))].sort((a, b) => a - b);
  const bonusInputs = { searches: raw.searches, playlists };

  const stats = {};
  const years = [];
  const hiddenYears = [];
  for (const year of allYears) {
    const scope = { id: String(year), year };
    const scoped = plays.filter((p) => p.year === year);
    const cov = coverageFor(scope, scoped);
    if (cov.spanDays < minSpan) {
      hiddenYears.push({ year, spanDays: cov.spanDays, first: cov.first, last: cov.last });
      continue;
    }
    years.push(year);
    stats[scope.id] = { ...computeStats(scoped, { scope, globals }), bonus: scopedBonus(scope, bonusInputs), enriched: null };
  }
  if (plays.length) {
    const scope = { id: 'all' };
    stats.all = { ...computeStats(plays, { scope, globals }), bonus: scopedBonus(scope, bonusInputs), enriched: null };
  }

  const index = {
    name: APP_NAME,
    timeZone: TIME_ZONE,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    hasExtended: plays.some((p) => p.source === 'extended'),
    hasEnrichment: false,
    scopes: [
      ...years.map((y) => summarize(stats[String(y)])),
      ...(stats.all ? [summarize(stats.all)] : []),
    ],
    hiddenYears,
    minYearSpanDays: minSpan,
    // Year-over-year needs at least two years that pass the span rule.
    canCompare: years.length >= 2,
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

/** Add enrichment-derived sections (genres, decades, explicit...) to already-built outputs. */
export function attachEnrichment(outputs, plays, meta) {
  if (!meta) return outputs;
  for (const [id, s] of Object.entries(outputs.stats)) {
    const scoped = id === 'all' ? plays : plays.filter((p) => String(p.year) === id);
    s.enriched = computeEnriched(scoped, meta);
  }
  outputs.index.hasEnrichment = true;
  outputs.index.enrichmentCounts = meta.counts;
  for (const sc of outputs.index.scopes) sc.topGenre = outputs.stats[sc.id]?.enriched?.topGenre ?? null;
  return outputs;
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
