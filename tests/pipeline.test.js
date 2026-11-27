// End-to-end aggregation tests on the synthetic fixtures in fixtures/ (both export formats).
// Expected values are worked out by hand from the fixture rows; see comments.
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRaw } from '../scripts/lib/load.js';
import { preparePlays, buildOutputs } from '../scripts/lib/pipeline.js';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
let out;
let s2024;
let s2025;
let s2026;
let all;

beforeAll(() => {
  const raw = loadRaw(fixtures);
  // Fixture years are short; turn off the 6-month visibility rule to test the stats themselves.
  out = buildOutputs(preparePlays(raw), raw, { now: new Date('2026-01-01T00:00:00Z'), minYearSpanDays: 0 });
  ({ 2024: s2024, 2025: s2025, 2026: s2026, all } = out.stats);
});

describe('loading and dedup', () => {
  it('finds both formats and reports what it did', () => {
    const formats = out.index.report.files.map((f) => f.format).sort();
    expect(formats).toEqual(['account-music', 'account-podcast', 'extended']);
    expect(out.index.report.overlapDuplicates).toBe(2); // Test Pattern 15:00 + Mock Beat 15:10 on 2025-12-01
    expect(out.index.report.exactDuplicates).toBe(0);
    expect(out.index.report.droppedRows).toBe(1); // extended row with no metadata
    expect(out.index.hasExtended).toBe(true);
    expect(out.index.hasEnrichment).toBe(false);
  });

  it('buckets years by local time (2026-01-01 04:30Z belongs to 2025)', () => {
    expect(out.index.scopes.map((s) => s.id)).toEqual(['2024', '2025', '2026', 'all']);
    expect(s2025.coverage.last).toBe('2025-12-31');
  });
});

describe('year visibility (6-month rule)', () => {
  it('hides short years but keeps their plays in all time, lookup and first-played dates', () => {
    const raw = loadRaw(fixtures);
    const o = buildOutputs(preparePlays(raw), raw, { minYearSpanDays: 183 });
    // fixture spans: 2024 = 48 days, 2025 = 31, 2026 = 44
    expect(o.index.scopes.map((s) => s.id)).toEqual(['all']);
    expect(o.index.hiddenYears.map((h) => [h.year, h.spanDays])).toEqual([
      [2024, 48],
      [2025, 31],
      [2026, 44],
    ]);
    expect(o.index.canCompare).toBe(false);
    expect(Object.keys(o.stats)).toEqual(['all']);
    expect(o.stats.all.totals.streams).toBe(17);
    expect(o.lookup.tracks.find((t) => t.n === 'Segfault Serenade').f).toBe('2024-08-01');
  });

  it('a year exactly at the threshold is shown; YoY needs two shown years', () => {
    const raw = loadRaw(fixtures);
    const o = buildOutputs(preparePlays(raw), raw, { minYearSpanDays: 44 });
    expect(o.index.scopes.map((s) => s.id)).toEqual(['2024', '2026', 'all']);
    expect(o.index.canCompare).toBe(true);
    const one = buildOutputs(preparePlays(raw), raw, { minYearSpanDays: 45 });
    expect(one.index.scopes.map((s) => s.id)).toEqual(['2024', 'all']);
    expect(one.index.canCompare).toBe(false);
  });
});

describe('2025 (account + overlapping extended)', () => {
  it('totals', () => {
    // 3x180000 + 150500 (extended copy) + 10000 + 240000 + 3x150000 + 2x240000 + 3000 + 60000 + 200000
    expect(s2025.totals.minutes).toBe(35.6);
    expect(s2025.totals.streams).toBe(12);
    expect(s2025.totals.plays).toBe(14);
    expect(s2025.totals.skips).toBe(2);
    expect(s2025.totals.uniqueTracks).toBe(4);
    expect(s2025.totals.uniqueArtists).toBe(3);
    expect(s2025.totals.uniqueAlbums).toBe(3);
    expect(s2025.totals.albumCoveragePct).toBe(100);
    expect(s2025.totals.unknownMinutes).toBe(1);
    expect(s2025.skipSource).toBe('mixed');
  });

  it('coverage marks a partial year', () => {
    expect(s2025.coverage).toMatchObject({ first: '2025-12-01', last: '2025-12-31', partial: true, startsLate: true, endsEarly: false, pctCovered: 8.5 });
  });

  it('top artists differ by minutes vs plays and exclude Unknown Artist', () => {
    expect(s2025.top.artists.byMinutes.map((a) => a.name)).toEqual(['The Placeholders', 'Null Pointer', 'DJ Fixture']);
    expect(s2025.top.artists.byPlays.map((a) => a.name)).toEqual(['The Placeholders', 'DJ Fixture', 'Null Pointer']);
    expect(s2025.top.artists.byMinutes[0].minutes).toBe(12.3);
  });

  it('top tracks and albums (albums filled from library, playlists and extended rows)', () => {
    expect(s2025.top.tracks.byPlays.map((t) => [t.name, t.plays])).toEqual([
      ['Mock Beat', 4],
      ['Segfault Serenade', 3],
      ['Test Pattern', 3],
      ['Lorem Song', 1],
    ]);
    expect(s2025.top.tracks.byMinutes[0].name).toBe('Segfault Serenade');
    expect(s2025.top.albums.byMinutes.map((a) => a.name)).toEqual(['Fixture Album', 'Core Dump', 'Beat Album']);
    expect(s2025.top.tracks.byPlays.find((t) => t.name === 'Segfault Serenade').uri).toBe('spotify:track:fakeSegfault0000000001');
  });

  it('top artist deep dive', () => {
    expect(s2025.topArtist).toMatchObject({
      name: 'The Placeholders',
      plays: 4,
      pctOfListening: 34.7,
      uniqueTracks: 2,
      firstPlayEver: { date: '2025-12-01', track: 'Test Pattern' }, // 2024 play was a 5s skip, not a stream
      peakMonth: { month: '2025-12' },
    });
    expect(s2025.topArtist.topTracks.map((t) => t.name)).toEqual(['Test Pattern', 'Lorem Song']);
    expect(s2025.topArtist.monthly).toHaveLength(12);
  });

  it('habits: busiest day, streak, sessions', () => {
    expect(s2025.habits.busiestDay).toMatchObject({ date: '2025-12-01', minutes: 15.7, streams: 5 });
    expect(s2025.habits.busiestDay.topTracks[0].name).toBe('Test Pattern');
    // Dec 1-4 music + Dec 5 podcast
    expect(s2025.habits.longestStreak).toEqual({ days: 5, start: '2025-12-01', end: '2025-12-05' });
    // two podcast episodes 20 minutes apart: 22:30Z -> 23:40Z
    expect(s2025.habits.longestSession).toMatchObject({ date: '2025-12-05', minutes: 70, plays: 2, topArtistOrShow: 'The Fake Podcast' });
    expect(s2025.habits.sessionCount).toBe(9);
    expect(s2025.habits.byMonth).toHaveLength(12);
    expect(s2025.habits.byMonth[11]).toMatchObject({ month: '2025-12', musicMinutes: 35.6, podcastMinutes: 50, streams: 12 });
    expect(s2025.habits.calendar['2025-12-05']).toEqual([0, 50]);
    expect(s2025.habits.heatmap).toHaveLength(7);
    expect(s2025.habits.heatmap[0]).toHaveLength(24);
  });

  it('quirks', () => {
    const q = s2025.quirks;
    expect(q.onRepeat.map((r) => [r.name, r.run])).toEqual([
      ['Test Pattern', 3],
      ['Segfault Serenade', 2],
    ]);
    expect(q.obsessions.map((o) => [o.name, o.plays, o.date])).toEqual([
      ['Test Pattern', 3, '2025-12-01'],
      ['Segfault Serenade', 2, '2025-12-10'],
    ]);
    expect(q.mostSkipped).toEqual([{ name: 'Segfault Serenade', artist: 'Null Pointer', uri: 'spotify:track:fakeSegfault0000000001', skips: 2, plays: 5, skipRatePct: 40 }]);
    expect(q.latestNight).toMatchObject({ date: '2025-12-10', time: '04:05', name: 'Segfault Serenade' });
    expect(q.earliestMorning).toMatchObject({ date: '2025-12-01', time: '09:57', name: 'Test Pattern' });
    // Null Pointer was first streamed in 2024, so it is not a 2025 discovery
    expect(q.discoveries.limitedHistory).toBe(false);
    expect(q.discoveries.artists.map((a) => a.name)).toEqual(['The Placeholders', 'DJ Fixture']);
    expect(q.soundtrack[11].track.name).toBe('Mock Beat');
    expect(q.soundtrack[0].track).toBe(null);
  });

  it('podcasts', () => {
    expect(s2025.podcasts).toMatchObject({ minutes: 50, streams: 2, uniqueShows: 1, uniqueEpisodes: 2 });
    expect(s2025.podcasts.binges).toEqual([{ date: '2025-12-05', show: 'The Fake Podcast', episodes: 2, minutes: 50 }]);
    expect(s2025.podcasts.peakHour).toBe(18);
  });

  it('bonus: searches collapse as-you-type fragments; playlists by creation year', () => {
    expect(s2025.bonus.searches.count).toBe(3);
    expect(s2025.bonus.searches.topQueries[0]).toEqual({ query: 'fake song', count: 2 });
    expect(s2025.bonus.playlists).toMatchObject({ created: 1, tracksAdded: 2 });
    expect(s2026.bonus.searches.count).toBe(1);
  });

  it('extended stats exist for the overlapping extended rows only', () => {
    expect(s2025.extended.plays).toBe(2);
    expect(s2026.extended).toBe(null);
  });
});

describe('2024 (extended only)', () => {
  it('totals and coverage', () => {
    expect(s2024.totals).toMatchObject({ minutes: 10.8, streams: 3, plays: 4, podcastMinutes: 10 });
    expect(s2024.coverage).toMatchObject({ first: '2024-06-15', last: '2024-08-01', pctCovered: 13.1, partial: true });
    expect(s2024.skipSource).toBe('reported');
  });

  it('extended-only stats', () => {
    const e = s2024.extended;
    expect(e.shufflePct).toBe(50);
    expect(e.offlinePct).toBe(20);
    expect(e.incognitoCount).toBe(1);
    expect(e.platforms.map((p) => p.name)).toEqual(['Android', 'Windows', 'iOS']);
    expect(e.platforms.find((p) => p.name === 'iOS').skipRatePct).toBe(100);
    expect(e.countries.map((c) => c.name)).toEqual(['US', 'CA']);
    expect(e.reasonStart).toEqual([
      { name: 'clickrow', count: 2, pct: 50 },
      { name: 'trackdone', count: 2, pct: 50 },
    ]);
    expect(e.platformsByMonth.rows.map((r) => r.month)).toEqual(['2024-06', '2024-07', '2024-08']);
  });

  it('first play in data', () => {
    expect(s2024.habits.firstPlay).toMatchObject({ date: '2024-06-15', name: 'Retro Fake', artist: 'Mock Turtle' });
  });
});

describe('all time', () => {
  it('sums the years', () => {
    const years = [s2024, s2025, s2026];
    expect(all.totals.streams).toBe(years.reduce((a, s) => a + s.totals.streams, 0));
    expect(all.totals.minutes).toBeCloseTo(years.reduce((a, s) => a + s.totals.minutes, 0), 0);
    expect(all.coverage).toMatchObject({ first: '2024-06-15', last: '2026-02-14', partial: false });
    expect(all.top.artists.byMinutes[0].name).toBe('Null Pointer');
    expect(all.quirks.discoveries).toBe(null);
    expect(all.habits.byMonth[0].month).toBe('2024-06');
    expect(all.habits.byMonth.at(-1).month).toBe('2026-02');
  });

  it('2026 is a partial year with a zero-length play counted as a row but not a stream', () => {
    expect(s2026.totals).toMatchObject({ streams: 2, plays: 3, minutes: 7.3 }); // 200000 + 0 + 240000 ms
    expect(s2026.coverage).toMatchObject({ first: '2026-01-02', last: '2026-02-14', partial: true });
  });
});

describe('global bonus + lookup', () => {
  it('library, playlists, inferences, marquee', () => {
    const b = out.index.bonus;
    expect(b.library).toMatchObject({ tracks: 1, albums: 1, artists: 1, shows: 1 });
    expect(b.playlists).toMatchObject({ count: 2, totalItems: 3 });
    expect(b.playlists.mostAddedTracks[0]).toMatchObject({ name: 'Mock Beat', playlists: 2 });
    expect(b.inferences).toMatchObject({ count: 5, readable: 3 });
    expect(b.inferences.labels).toContain('Imaginary Yacht Owners');
    expect(b.marquee.segments).toEqual({ 'Light listeners': 2, 'Previously Active Listeners': 1 });
  });

  it('lookup has full per-track history', () => {
    const t = out.lookup.tracks.find((x) => x.n === 'Segfault Serenade');
    expect(t).toMatchObject({ a: 'Null Pointer', p: 5, f: '2024-08-01', l: '2026-02-14', u: 'spotify:track:fakeSegfault0000000001' });
    expect(t.mo['2025-12'][0]).toBe(3);
    expect(out.lookup.artists.some((a) => a.n === 'Unknown Artist')).toBe(false);
    expect(out.lookup.shows.map((s) => s.n).sort()).toEqual(['Synthetic Talk', 'The Fake Podcast']);
  });
});
