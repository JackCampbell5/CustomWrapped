// Year-over-year comparison of two stats documents. Pure and light (top-50 lists only),
// so the browser can run it for any pair of years.

const rankMap = (list) => new Map(list.map((x, i) => [x.key, i + 1]));
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Rank movement from `before` to `after` for one top list.
 * change > 0 means it moved up. status: up | down | same | new.
 */
export function rankChanges(beforeList, afterList, { show = 15, droppedFrom = 10 } = {}) {
  const before = rankMap(beforeList);
  const after = rankMap(afterList);
  const rows = afterList.slice(0, show).map((x, i) => {
    const rank = i + 1;
    const prev = before.get(x.key) ?? null;
    const change = prev == null ? null : prev - rank;
    return {
      key: x.key,
      name: x.name,
      artist: x.artist,
      rank,
      prevRank: prev,
      change,
      status: prev == null ? 'new' : change > 0 ? 'up' : change < 0 ? 'down' : 'same',
      minutes: x.minutes,
      plays: x.plays,
    };
  });
  const dropped = beforeList
    .slice(0, droppedFrom)
    .map((x, i) => ({ key: x.key, name: x.name, artist: x.artist, prevRank: i + 1 }))
    .filter((x) => !after.has(x.key));
  return { rows, dropped };
}

const perDay = (s) => (s.coverage?.spanDays ? s.totals.minutes / s.coverage.spanDays : null);

/** @param {any} a earlier stats doc  @param {any} b later stats doc */
export function compareYears(a, b) {
  const delta = (x, y) => (x == null || y == null ? null : round1(y - x));
  const pctChange = (x, y) => (x ? round1(((y - x) / x) * 100) : null);

  const topTen = (s) => new Set(s.top.artists.byMinutes.slice(0, 10).map((x) => x.key));
  const tenA = topTen(a);
  const stayedTop10 = b.top.artists.byMinutes.slice(0, 10).filter((x) => tenA.has(x.key)).map((x) => ({ key: x.key, name: x.name }));

  const pa = perDay(a);
  const pb = perDay(b);
  const hA = a.habits;
  const hB = b.habits;

  return {
    years: [a.scope, b.scope],
    partial: Boolean(a.coverage?.partial || b.coverage?.partial),
    coverage: [a.coverage, b.coverage],
    minutes: { before: a.totals.minutes, after: b.totals.minutes, delta: delta(a.totals.minutes, b.totals.minutes), pct: pctChange(a.totals.minutes, b.totals.minutes) },
    minutesPerDay: { before: pa && round1(pa), after: pb && round1(pb), pct: pa && pb ? pctChange(pa, pb) : null },
    streams: { before: a.totals.streams, after: b.totals.streams, delta: delta(a.totals.streams, b.totals.streams) },
    uniqueArtists: { before: a.totals.uniqueArtists, after: b.totals.uniqueArtists, delta: delta(a.totals.uniqueArtists, b.totals.uniqueArtists) },
    uniqueTracks: { before: a.totals.uniqueTracks, after: b.totals.uniqueTracks, delta: delta(a.totals.uniqueTracks, b.totals.uniqueTracks) },
    podcastMinutes: { before: a.totals.podcastMinutes, after: b.totals.podcastMinutes, delta: delta(a.totals.podcastMinutes, b.totals.podcastMinutes) },
    artists: rankChanges(a.top.artists.byMinutes, b.top.artists.byMinutes),
    tracks: rankChanges(a.top.tracks.byPlays, b.top.tracks.byPlays),
    stayedTop10,
    habits: {
      // positive = later in the day
      centerHourShift: delta(hA.persona?.centerHour, hB.persona?.centerHour),
      persona: [hA.persona?.peak ?? null, hB.persona?.peak ?? null],
      nightShareShift: delta(hA.persona?.shares?.night, hB.persona?.shares?.night),
      skipRateShift: delta(a.totals.skipRatePct, b.totals.skipRatePct),
      avgSessionShift: delta(hA.avgSessionMinutes, hB.avgSessionMinutes),
      weekendShift: delta(hA.weekdayVsWeekend?.weekendAvgMinutes, hB.weekdayVsWeekend?.weekendAvgMinutes),
    },
    topArtist: [a.topArtist?.name ?? null, b.topArtist?.name ?? null],
  };
}
