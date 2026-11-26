import { STREAM_MS, SESSION_GAP_MS, STREAK_MIN_MS, TOP_N } from './config.js';
import { localParts, addDays, daysBetween, daysInYear, dowOfDate, monthsBetween, clockOf } from './time.js';
import { norm } from './normalize.js';

// ---------------------------------------------------------------- helpers
export const toMin = (ms) => Math.round(ms / 6000) / 10;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const isStream = (p) => p.msPlayed >= STREAM_MS;
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const monthOf = (p) => p.date.slice(0, 7);

/**
 * Group plays by key. `describe(p)` returns display fields; missing fields are
 * filled from later plays (e.g. a URI only some rows carry).
 */
function tally(plays, keyOf, describe) {
  const m = new Map();
  for (const p of plays) {
    const k = keyOf(p);
    if (!k) continue;
    let e = m.get(k);
    const d = describe(p);
    if (!e) {
      e = { key: k, ...d, ms: 0, plays: 0, rows: 0, first: p.date, last: p.date };
      m.set(k, e);
    } else {
      for (const f in d) if (e[f] == null && d[f] != null) e[f] = d[f];
    }
    e.ms += p.msPlayed;
    e.rows++;
    if (isStream(p)) e.plays++;
    e.last = p.date;
  }
  return m;
}

const sorters = {
  minutes: (a, b) => b.ms - a.ms || b.plays - a.plays,
  plays: (a, b) => b.plays - a.plays || b.ms - a.ms,
};

const publicEntry = ({ ms, rows, ...e }) => {
  for (const k of Object.keys(e)) if (e[k] == null) delete e[k];
  return { ...e, minutes: toMin(ms) };
};

function ranked(map, by, n = TOP_N) {
  return [...map.values()]
    .filter((e) => e.ms > 0)
    .sort(sorters[by])
    .slice(0, n)
    .map(publicEntry);
}

const both = (map, n) => ({ byMinutes: ranked(map, 'minutes', n), byPlays: ranked(map, 'plays', n) });

const describeTrack = (p) => ({ name: p.track, artist: p.artist, album: p.album, uri: p.trackUri });
const describeArtist = (p) => ({ name: p.artist });
const albumKeyOf = (p) => (p.album ? `${norm(p.artist)}|${norm(p.album)}` : null);
const describeAlbum = (p) => ({ name: p.album, artist: p.artist });

// ---------------------------------------------------------------- coverage
export function coverageFor(scope, plays) {
  if (!plays.length) return null;
  const first = plays[0].date;
  const last = plays[plays.length - 1].date;
  const daysWithData = new Set(plays.map((p) => p.date)).size;
  const span = daysBetween(first, last) + 1;
  if (scope.year == null) {
    return { first, last, daysWithData, spanDays: span, periodDays: span, pctCovered: 100, partial: false };
  }
  const y = scope.year;
  const periodDays = daysInYear(y);
  const startGap = daysBetween(`${y}-01-01`, first);
  const endGap = daysBetween(last, `${y}-12-31`);
  return {
    first,
    last,
    daysWithData,
    spanDays: span,
    periodDays,
    pctCovered: pct(span, periodDays),
    partial: startGap > 6 || endGap > 6,
    startsLate: startGap > 6,
    endsEarly: endGap > 6,
  };
}

// ---------------------------------------------------------------- sessions
function sessionsOf(plays) {
  const sessions = [];
  let cur = null;
  for (const p of plays) {
    if (p.msPlayed <= 0) continue;
    const start = p.tsUtc - p.msPlayed;
    const end = p.tsUtc;
    if (cur && start - cur.end < SESSION_GAP_MS) {
      cur.end = Math.max(cur.end, end);
      cur.ms += p.msPlayed;
      cur.n++;
      cur.items.push(p);
    } else {
      cur = { start: Math.min(start, end), end, ms: p.msPlayed, n: 1, items: [p] };
      sessions.push(cur);
    }
  }
  return sessions;
}

function topLabelOf(items) {
  const t = new Map();
  for (const p of items) {
    const label = p.kind === 'track' ? p.artist : p.show;
    if (!label || p.unknown) continue;
    t.set(label, (t.get(label) ?? 0) + p.msPlayed);
  }
  return [...t.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// ---------------------------------------------------------------- persona
const BUCKETS = [
  ['morning', (h) => h >= 5 && h < 12],
  ['afternoon', (h) => h >= 12 && h < 17],
  ['evening', (h) => h >= 17 && h < 21],
  ['night', (h) => h >= 21 || h < 5],
];

/**
 * Weighted mean "listening hour", measured on a day that starts at 5am so that
 * 1am counts as late night, not early morning. Returned in 0-24 (may exceed 24 = after midnight).
 */
function centerHour(plays) {
  let w = 0;
  let s = 0;
  for (const p of plays) {
    const h = (p.hour + p.minute / 60 - 5 + 24) % 24;
    s += h * p.msPlayed;
    w += p.msPlayed;
  }
  return w ? Math.round((s / w + 5) * 10) / 10 : null;
}

// ---------------------------------------------------------------- main
/**
 * @param {import('./adapters.js').Play[]} plays   plays in scope, sorted by tsUtc
 * @param {{ scope: {id: string, year?: number}, globals: ReturnType<typeof buildGlobals>, meta?: any }} ctx
 */
export function computeStats(plays, ctx) {
  const { scope, globals } = ctx;
  const music = plays.filter((p) => p.kind === 'track');
  const known = music.filter((p) => !p.unknown);
  const knownStreams = known.filter(isStream);
  const episodes = plays.filter((p) => p.kind === 'episode');
  const coverage = coverageFor(scope, plays);

  const msMusic = sum(music, (p) => p.msPlayed);
  const msPodcast = sum(episodes, (p) => p.msPlayed);

  // ---- top lists
  const trackMap = tally(known, (p) => p.trackKey, describeTrack);
  const artistMap = tally(known, (p) => p.artistKey, describeArtist);
  const albumMap = tally(known, albumKeyOf, describeAlbum);
  const msWithAlbum = sum(known, (p) => (p.album ? p.msPlayed : 0));

  const totals = {
    minutes: toMin(msMusic),
    hours: Math.round(msMusic / 360_000) / 10,
    days: Math.round(msMusic / 8_640_000) / 10,
    streams: music.filter(isStream).length,
    plays: music.length,
    uniqueTracks: new Set(knownStreams.map((p) => p.trackKey)).size,
    uniqueArtists: new Set(knownStreams.map((p) => p.artistKey)).size,
    uniqueAlbums: albumMap.size ? new Set(knownStreams.map(albumKeyOf).filter(Boolean)).size : null,
    albumCoveragePct: pct(msWithAlbum, sum(known, (p) => p.msPlayed)),
    skips: music.filter((p) => p.skipped).length,
    skipRatePct: pct(music.filter((p) => p.skipped).length, music.length),
    avgPlayLengthMin: knownStreams.length ? toMin(sum(knownStreams, (p) => p.msPlayed) / knownStreams.length) : null,
    unknownMinutes: toMin(sum(music, (p) => (p.unknown ? p.msPlayed : 0))),
    podcastMinutes: toMin(msPodcast),
    allMinutes: toMin(msMusic + msPodcast),
  };

  const top = {
    artists: both(artistMap),
    tracks: both(trackMap),
    albums: albumMap.size ? both(albumMap) : null,
  };

  // ---- monthly series
  const months = coverage
    ? scope.year != null
      ? monthsBetween(`${scope.year}-01`, `${scope.year}-12`)
      : monthsBetween(coverage.first, coverage.last)
    : [];
  const monthIdx = new Map(months.map((m, i) => [m, i]));
  const byMonth = months.map((month) => ({ month, musicMinutes: 0, podcastMinutes: 0, streams: 0 }));
  for (const p of plays) {
    const row = byMonth[monthIdx.get(monthOf(p))];
    if (!row) continue;
    if (p.kind === 'track') {
      row.musicMinutes += p.msPlayed;
      if (isStream(p)) row.streams++;
    } else row.podcastMinutes += p.msPlayed;
  }
  for (const r of byMonth) {
    r.musicMinutes = toMin(r.musicMinutes);
    r.podcastMinutes = toMin(r.podcastMinutes);
  }

  // ---- top artist deep dive
  const topArtistEntry = [...artistMap.values()].sort(sorters.minutes)[0];
  let topArtist = null;
  if (topArtistEntry) {
    const theirs = known.filter((p) => p.artistKey === topArtistEntry.key);
    const theirTracks = tally(theirs, (p) => p.trackKey, describeTrack);
    const perMonth = new Map();
    for (const p of theirs) perMonth.set(monthOf(p), (perMonth.get(monthOf(p)) ?? 0) + p.msPlayed);
    const peak = [...perMonth.entries()].sort((a, b) => b[1] - a[1])[0];
    const firstEver = globals.artistFirst.get(topArtistEntry.key);
    topArtist = {
      name: topArtistEntry.name,
      key: topArtistEntry.key,
      minutes: toMin(topArtistEntry.ms),
      plays: topArtistEntry.plays,
      pctOfListening: pct(topArtistEntry.ms, msMusic),
      uniqueTracks: theirTracks.size,
      firstPlayInScope: { date: theirs[0].date, track: theirs[0].track },
      firstPlayEver: firstEver ?? null,
      topTracks: ranked(theirTracks, 'plays', 5),
      peakMonth: peak ? { month: peak[0], minutes: toMin(peak[1]) } : null,
      monthly: months.map((m) => ({ month: m, minutes: toMin(perMonth.get(m) ?? 0) })),
      funPercentile: funPercentile(topArtistEntry.ms / 60_000, 1500),
    };
  }

  // ---- daily
  const daily = new Map();
  for (const p of plays) {
    let d = daily.get(p.date);
    if (!d) daily.set(p.date, (d = { music: 0, podcast: 0, streams: 0 }));
    if (p.kind === 'track') {
      d.music += p.msPlayed;
      if (isStream(p)) d.streams++;
    } else d.podcast += p.msPlayed;
  }
  const calendar = {};
  for (const [date, d] of [...daily.entries()].sort()) calendar[date] = [toMin(d.music), toMin(d.podcast)];

  // busiest day (music)
  let busiestDay = null;
  const busiest = [...daily.entries()].sort((a, b) => b[1].music - a[1].music)[0];
  if (busiest && busiest[1].music > 0) {
    const that = known.filter((p) => p.date === busiest[0]);
    busiestDay = {
      date: busiest[0],
      minutes: toMin(busiest[1].music),
      streams: busiest[1].streams,
      topTracks: ranked(tally(that, (p) => p.trackKey, describeTrack), 'plays', 5),
      topArtists: ranked(tally(that, (p) => p.artistKey, describeArtist), 'minutes', 3),
    };
  }

  // streak
  const activeDays = [...daily.entries()]
    .filter(([, d]) => d.music + d.podcast >= STREAK_MIN_MS)
    .map(([date]) => date)
    .sort();
  let longestStreak = null;
  {
    let runStart = null;
    let prev = null;
    let best = { days: 0 };
    for (const d of activeDays) {
      if (prev && daysBetween(prev, d) === 1) {
        // continue
      } else runStart = d;
      const len = daysBetween(runStart, d) + 1;
      if (len > best.days) best = { days: len, start: runStart, end: d };
      prev = d;
    }
    if (best.days) longestStreak = best;
  }

  // sessions (music + podcasts)
  const sessions = sessionsOf(plays).filter((s) => s.ms >= 60_000);
  let longestSession = null;
  if (sessions.length) {
    const s = sessions.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
    const startLocal = localParts(s.start);
    longestSession = {
      date: startLocal.date,
      start: startLocal.iso,
      end: localParts(s.end).iso,
      minutes: toMin(s.end - s.start),
      listenedMinutes: toMin(s.ms),
      plays: s.n,
      topArtistOrShow: topLabelOf(s.items),
    };
  }
  const avgSessionMinutes = sessions.length ? toMin(sum(sessions, (s) => s.end - s.start) / sessions.length) : null;

  // heatmap dow x hour (music minutes), plus hour profile for podcasts
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const p of music) heatmap[p.dow][p.hour] += p.msPlayed;
  for (const row of heatmap) for (let h = 0; h < 24; h++) row[h] = toMin(row[h]);

  // persona
  const bucketMs = Object.fromEntries(BUCKETS.map(([k]) => [k, 0]));
  for (const p of plays) for (const [k, test] of BUCKETS) if (test(p.hour)) bucketMs[k] += p.msPlayed;
  const allMs = msMusic + msPodcast;
  const shares = Object.fromEntries(Object.entries(bucketMs).map(([k, v]) => [k, pct(v, allMs)]));
  const persona = {
    peak: Object.entries(bucketMs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    shares,
    centerHour: centerHour(plays),
  };

  // weekday vs weekend: average minutes per calendar day of each kind within the covered span
  let weekdayVsWeekend = null;
  if (coverage) {
    let wdDays = 0;
    let weDays = 0;
    for (let d = coverage.first; d <= coverage.last; d = addDays(d, 1)) {
      const w = dowOfDate(d);
      if (w === 0 || w === 6) weDays++;
      else wdDays++;
    }
    let wdMs = 0;
    let weMs = 0;
    for (const p of plays) (p.dow === 0 || p.dow === 6 ? (weMs += p.msPlayed) : (wdMs += p.msPlayed));
    weekdayVsWeekend = {
      weekdayAvgMinutes: wdDays ? toMin(wdMs / wdDays) : 0,
      weekendAvgMinutes: weDays ? toMin(weMs / weDays) : 0,
    };
  }

  const firstStream = knownStreams[0];
  const habits = {
    byMonth,
    heatmap,
    calendar,
    busiestDay,
    longestStreak,
    longestSession,
    avgSessionMinutes,
    sessionCount: sessions.length,
    persona,
    weekdayVsWeekend,
    activeDays: activeDays.length,
    avgMinutesPerActiveDay: activeDays.length ? toMin(allMs / activeDays.length) : 0,
    firstPlay: firstStream ? { date: firstStream.date, ts: firstStream.ts, ...describeTrack(firstStream) } : null,
  };

  const quirks = computeQuirks({ known, knownStreams, months, coverage, scope, globals, trackMap, artistMap, sessions });
  const podcasts = computePodcasts(episodes);
  const extended = computeExtended(plays);

  return {
    scope: scope.id,
    year: scope.year ?? null,
    coverage,
    sources: {
      account: plays.filter((p) => p.source === 'account').length,
      extended: plays.filter((p) => p.source === 'extended').length,
    },
    skipSource: skipSourceOf(music),
    totals,
    funPercentile: funPercentile(msMusic / 60_000, 20_000),
    top,
    topArtist,
    habits,
    quirks,
    podcasts,
    extended,
  };
}

function skipSourceOf(music) {
  const acc = music.some((p) => p.source === 'account');
  const ext = music.some((p) => p.source === 'extended');
  return acc && ext ? 'mixed' : ext ? 'reported' : acc ? 'inferred' : null;
}

/**
 * A playful, made-up "top X%" number. NOT real Spotify data; the UI labels it as such.
 * Decays exponentially with minutes; `scale` sets how fast.
 */
export function funPercentile(minutes, scale) {
  const v = 100 * Math.exp(-minutes / scale);
  return Math.min(99, Math.max(0.1, Math.round(v * 10) / 10));
}

// ---------------------------------------------------------------- quirks
function computeQuirks({ known, knownStreams, months, coverage, scope, globals, trackMap, artistMap, sessions }) {
  // most skipped
  const skipMap = new Map();
  for (const p of known) {
    let e = skipMap.get(p.trackKey);
    if (!e) skipMap.set(p.trackKey, (e = { ...describeTrack(p), skips: 0, rows: 0 }));
    e.rows++;
    if (p.skipped) e.skips++;
  }
  const mostSkipped = [...skipMap.values()]
    .filter((e) => e.skips >= 2)
    .sort((a, b) => b.skips - a.skips || b.skips / b.rows - a.skips / a.rows)
    .slice(0, 10)
    .map(({ rows, ...e }) => ({ name: e.name, artist: e.artist, uri: e.uri, skips: e.skips, plays: rows, skipRatePct: pct(e.skips, rows) }));

  // obsessions: most streams of one track in one day (each track listed once)
  const dayCount = new Map();
  for (const p of knownStreams) {
    const k = `${p.trackKey}\u0000${p.date}`;
    dayCount.set(k, (dayCount.get(k) ?? 0) + 1);
  }
  const bestDay = new Map();
  for (const [k, n] of dayCount) {
    const [tk, date] = k.split('\u0000');
    const cur = bestDay.get(tk);
    if (!cur || n > cur.plays) bestDay.set(tk, { plays: n, date });
  }
  const obsessions = [...bestDay.entries()]
    .filter(([, v]) => v.plays >= 2)
    .sort((a, b) => b[1].plays - a[1].plays)
    .slice(0, 10)
    .map(([tk, v]) => ({ ...publicEntry({ ...trackMap.get(tk) }), plays: v.plays, date: v.date }));

  // on repeat: same track back-to-back (consecutive streams within a session gap)
  const bestRun = new Map();
  {
    let prev = null;
    let run = 0;
    for (const p of knownStreams) {
      if (prev && prev.trackKey === p.trackKey && p.tsUtc - p.msPlayed - prev.tsUtc < SESSION_GAP_MS) run++;
      else run = 1;
      const cur = bestRun.get(p.trackKey);
      if (!cur || run > cur.run) bestRun.set(p.trackKey, { run, date: p.date });
      prev = p;
    }
  }
  const onRepeat = [...bestRun.entries()]
    .filter(([, v]) => v.run >= 2)
    .sort((a, b) => b[1].run - a[1].run)
    .slice(0, 10)
    .map(([tk, v]) => {
      const t = trackMap.get(tk);
      return { name: t.name, artist: t.artist, uri: t.uri, run: v.run, date: v.date };
    });

  // soundtrack: per month #1 track (by streams) and #1 artist (by minutes)
  const soundtrack = months.map((month) => {
    const inMonth = known.filter((p) => p.date.startsWith(month));
    if (!inMonth.length) return { month, track: null, artist: null };
    const t = ranked(tally(inMonth, (p) => p.trackKey, describeTrack), 'plays', 1)[0] ?? null;
    const a = ranked(tally(inMonth, (p) => p.artistKey, describeArtist), 'minutes', 1)[0] ?? null;
    return { month, track: t, artist: a };
  });

  // loyal artists: in a month's top 5 (by minutes) for >= 3 months
  const loyalCount = new Map();
  let monthsWithData = 0;
  for (const month of months) {
    const inMonth = known.filter((p) => p.date.startsWith(month));
    if (!inMonth.length) continue;
    monthsWithData++;
    for (const a of ranked(tally(inMonth, (p) => p.artistKey, describeArtist), 'minutes', 5)) {
      const e = loyalCount.get(a.key) ?? { name: a.name, key: a.key, months: 0 };
      e.months++;
      loyalCount.set(a.key, e);
    }
  }
  const loyalArtists = [...loyalCount.values()]
    .filter((e) => e.months >= Math.min(3, monthsWithData))
    .sort((a, b) => b.months - a.months || (artistMap.get(b.key)?.ms ?? 0) - (artistMap.get(a.key)?.ms ?? 0))
    .slice(0, 10)
    .map((e) => ({ ...e, monthsWithData }));

  // one-hit artists: >= 10 streams, all of them one song
  const artistTracks = new Map();
  for (const p of knownStreams) {
    if (!artistTracks.has(p.artistKey)) artistTracks.set(p.artistKey, new Map());
    const m = artistTracks.get(p.artistKey);
    m.set(p.trackKey, (m.get(p.trackKey) ?? 0) + 1);
  }
  const oneHitArtists = [...artistTracks.entries()]
    .filter(([, m]) => m.size === 1 && [...m.values()][0] >= 10)
    .map(([ak, m]) => {
      const [tk, n] = [...m.entries()][0];
      const t = trackMap.get(tk);
      return { artist: artistMap.get(ak).name, track: t.name, uri: t.uri, plays: n };
    })
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);

  // per-track stream dates (used by binge/abandon + longest-loved)
  const streamDates = new Map();
  for (const p of knownStreams) {
    if (!streamDates.has(p.trackKey)) streamDates.set(p.trackKey, []);
    streamDates.get(p.trackKey).push(p.date);
  }

  // binged then abandoned: >= 12 streams, >= 60% inside one 14-day window, silent for the last 45+ days of data
  const bingedAbandoned = [];
  if (coverage) {
    for (const [tk, dates] of streamDates) {
      if (dates.length < 12) continue;
      const last = dates[dates.length - 1];
      if (daysBetween(last, coverage.last) < 45) continue;
      let best = 0;
      let bestStart = dates[0];
      for (let i = 0, j = 0; j < dates.length; j++) {
        while (daysBetween(dates[i], dates[j]) >= 14) i++;
        if (j - i + 1 > best) {
          best = j - i + 1;
          bestStart = dates[i];
        }
      }
      if (best / dates.length >= 0.6) {
        const t = trackMap.get(tk);
        bingedAbandoned.push({ name: t.name, artist: t.artist, uri: t.uri, plays: dates.length, peakPlays: best, peakStart: bestStart, lastPlayed: last });
      }
    }
    bingedAbandoned.sort((a, b) => b.peakPlays - a.peakPlays);
    bingedAbandoned.splice(10);
  }

  // longest loved: largest first->last span (>= 5 streams)
  const longestLoved = [...streamDates.entries()]
    .filter(([, d]) => d.length >= 5)
    .map(([tk, d]) => {
      const t = trackMap.get(tk);
      return { name: t.name, artist: t.artist, uri: t.uri, plays: d.length, first: d[0], last: d[d.length - 1], spanDays: daysBetween(d[0], d[d.length - 1]) };
    })
    .sort((a, b) => b.spanDays - a.spanDays || b.plays - a.plays)
    .slice(0, 10);

  // Latest night = the latest a session ENDED between 20:00 and 04:59 (sessions that run past 5am,
  // e.g. sleep sounds, are ignored). Earliest morning = earliest session START between 05:00 and 11:59.
  let latest = null;
  let earliest = null;
  for (const s of sessions) {
    const named = s.items.filter((p) => !p.unknown);
    if (!named.length) continue;
    const e = localParts(s.end);
    const st = localParts(s.start);
    const endMod = e.hour * 60 + e.minute;
    const startMod = st.hour * 60 + st.minute;
    if ((e.hour >= 20 || e.hour < 5) && s.end - s.start < 12 * 3_600_000) {
      const late = (endMod - 20 * 60 + 1440) % 1440;
      if (!latest || late > latest.late) latest = { late, at: e, p: named[named.length - 1] };
    }
    if (st.hour >= 5 && st.hour < 12 && (!earliest || startMod < earliest.mod)) earliest = { mod: startMod, at: st, p: named[0] };
  }
  const moment = (x) => {
    if (!x) return null;
    const what = x.p.kind === 'track' ? describeTrack(x.p) : { name: x.p.episode, show: x.p.show, uri: x.p.episodeUri };
    return { date: x.at.date, time: clockOf(x.at.iso), ts: x.at.iso, kind: x.p.kind, ...what };
  };

  // new discoveries: top-50 artists whose first-ever play falls in this scope
  let discoveries = null;
  if (scope.year != null && globals.firstDate) {
    const scopeStart = `${scope.year}-01-01`;
    const list = ranked(artistMap, 'minutes', TOP_N)
      .map((a, i) => ({ ...a, rank: i + 1, firstPlayed: globals.artistFirst.get(a.key)?.date }))
      .filter((a) => a.firstPlayed && a.firstPlayed >= scopeStart);
    discoveries = {
      // If history starts less than ~60 days before this year, "first heard" is unreliable.
      limitedHistory: daysBetween(globals.firstDate, scopeStart) < 60,
      historyStarts: globals.firstDate,
      artists: list.slice(0, 15),
      count: list.length,
    };
  }

  return {
    mostSkipped,
    obsessions,
    onRepeat,
    soundtrack,
    loyalArtists,
    oneHitArtists,
    bingedAbandoned,
    longestLoved,
    latestNight: moment(latest),
    earliestMorning: moment(earliest),
    discoveries,
  };
}

// ---------------------------------------------------------------- podcasts
function computePodcasts(episodes) {
  if (!episodes.length) return null;
  const ms = sum(episodes, (p) => p.msPlayed);
  const showMap = tally(episodes, (p) => p.artistKey, (p) => ({ name: p.show, uri: undefined }));
  const epMap = tally(episodes, (p) => p.trackKey, (p) => ({ name: p.episode, show: p.show, uri: p.episodeUri }));

  const dayShow = new Map();
  for (const p of episodes) {
    const k = `${p.date}\u0000${p.artistKey}`;
    let e = dayShow.get(k);
    if (!e) dayShow.set(k, (e = { date: p.date, show: p.show, eps: new Set(), ms: 0 }));
    e.eps.add(p.trackKey);
    e.ms += p.msPlayed;
  }
  const binges = [...dayShow.values()]
    .filter((e) => e.eps.size >= 2)
    .sort((a, b) => b.eps.size - a.eps.size || b.ms - a.ms)
    .slice(0, 5)
    .map((e) => ({ date: e.date, show: e.show, episodes: e.eps.size, minutes: toMin(e.ms) }));

  const byHour = Array(24).fill(0);
  for (const p of episodes) byHour[p.hour] += p.msPlayed;
  const peakHour = byHour.indexOf(Math.max(...byHour));

  return {
    minutes: toMin(ms),
    hours: Math.round(ms / 360_000) / 10,
    streams: episodes.filter(isStream).length,
    uniqueShows: showMap.size,
    uniqueEpisodes: epMap.size,
    topShows: ranked(showMap, 'minutes', 20),
    topEpisodes: ranked(epMap, 'minutes', 20),
    binges,
    byHour: byHour.map(toMin),
    peakHour,
  };
}

// ---------------------------------------------------------------- extended-only
function computeExtended(plays) {
  const ext = plays.filter((p) => p.source === 'extended');
  if (!ext.length) return null;
  const music = ext.filter((p) => p.kind === 'track');
  const share = (arr, f) => {
    const defined = arr.filter((p) => p[f] !== undefined);
    return defined.length ? pct(defined.filter((p) => p[f]).length, defined.length) : null;
  };
  const countBy = (arr, f) => {
    const m = new Map();
    for (const p of arr) if (p[f]) m.set(p[f], (m.get(p[f]) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count, pct: pct(count, arr.length) }));
  };

  const platMap = new Map();
  for (const p of music) {
    if (!p.platform) continue;
    const e = platMap.get(p.platform) ?? { name: p.platform, plays: 0, skips: 0, ms: 0 };
    e.plays++;
    e.ms += p.msPlayed;
    if (p.skipped) e.skips++;
    platMap.set(p.platform, e);
  }
  const platforms = [...platMap.values()]
    .sort((a, b) => b.ms - a.ms)
    .map((e) => ({ name: e.name, plays: e.plays, minutes: toMin(e.ms), skipRatePct: pct(e.skips, e.plays) }));

  const topPlatforms = platforms.slice(0, 6).map((p) => p.name);
  const pm = new Map();
  for (const p of ext) {
    if (!p.platform) continue;
    const m = monthOf(p);
    if (!pm.has(m)) pm.set(m, { month: m });
    const row = pm.get(m);
    const name = topPlatforms.includes(p.platform) ? p.platform : 'Other';
    row[name] = (row[name] ?? 0) + p.msPlayed;
  }
  const platformsByMonth = {
    platforms: topPlatforms,
    rows: [...pm.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === 'month' ? v : toMin(v)]))),
  };

  const cMap = new Map();
  for (const p of ext) {
    if (!p.country) continue;
    const e = cMap.get(p.country) ?? { name: p.country, plays: 0, ms: 0 };
    e.plays++;
    e.ms += p.msPlayed;
    cMap.set(p.country, e);
  }

  return {
    plays: ext.length,
    shufflePct: share(music, 'shuffle'),
    offlinePct: share(ext, 'offline'),
    incognitoCount: ext.filter((p) => p.incognito).length,
    skipRatePct: pct(music.filter((p) => p.skipped).length, music.length),
    platforms,
    platformsByMonth,
    countries: [...cMap.values()].sort((a, b) => b.ms - a.ms).map((e) => ({ name: e.name, plays: e.plays, minutes: toMin(e.ms) })),
    reasonStart: countBy(music, 'reasonStart'),
    reasonEnd: countBy(music, 'reasonEnd'),
  };
}

// ---------------------------------------------------------------- globals
/** Facts that need the full history regardless of scope (first-ever plays). */
export function buildGlobals(allPlays) {
  const artistFirst = new Map();
  for (const p of allPlays) {
    if (p.kind !== 'track' || p.unknown || !isStream(p)) continue;
    if (!artistFirst.has(p.artistKey)) artistFirst.set(p.artistKey, { date: p.date, track: p.track });
  }
  return { artistFirst, firstDate: allPlays[0]?.date ?? null, lastDate: allPlays.at(-1)?.date ?? null };
}

// ---------------------------------------------------------------- lookup (Explore search)
/** Compact per-artist / per-track / per-show history for the Explore search box. */
export function buildLookup(allPlays) {
  const build = (plays, keyOf, describe) => {
    const m = new Map();
    for (const p of plays) {
      const k = keyOf(p);
      let e = m.get(k);
      if (!e) m.set(k, (e = { k, ...describe(p), p: 0, ms: 0, f: p.date, l: p.date, mo: {} }));
      for (const f in describe(p)) if (e[f] == null) e[f] = describe(p)[f];
      e.ms += p.msPlayed;
      e.l = p.date;
      const mo = monthOf(p);
      const cell = (e.mo[mo] ??= [0, 0]);
      cell[1] += p.msPlayed;
      if (isStream(p)) {
        e.p++;
        cell[0]++;
      }
    }
    return [...m.values()]
      .sort((a, b) => b.ms - a.ms)
      .map(({ ms, ...e }) => {
        for (const c of Object.values(e.mo)) c[1] = toMin(c[1]);
        for (const f of Object.keys(e)) if (e[f] == null) delete e[f];
        return { ...e, m: toMin(ms) };
      });
  };
  const known = allPlays.filter((p) => p.kind === 'track' && !p.unknown);
  const eps = allPlays.filter((p) => p.kind === 'episode');
  return {
    artists: build(known, (p) => p.artistKey, (p) => ({ n: p.artist })),
    tracks: build(known, (p) => p.trackKey, (p) => ({ n: p.track, a: p.artist, u: p.trackUri })),
    shows: build(eps, (p) => p.artistKey, (p) => ({ n: p.show })),
  };
}
