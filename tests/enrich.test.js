import { describe, it, expect, beforeEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { similarity, bestTrackMatch, simplify } from '../scripts/lib/spotify/match.js';
import { openCache } from '../scripts/lib/spotify/cache.js';
import { ForbiddenError, QuotaError } from '../scripts/lib/spotify/api.js';
import { resolveTargets, buildMeta, computeEnriched } from '../scripts/lib/enrich.js';
import { fromAccountMusic } from '../scripts/lib/adapters.js';

// ---- fake Spotify objects (raw API shape)
const rawTrack = (id, name, artist, extra = {}) => ({
  id,
  name,
  duration_ms: 200000,
  explicit: false,
  artists: [{ id: `ar_${artist.replace(/\W/g, '')}`, name: artist }],
  album: { id: `al_${id}`, name: `${name} Album`, release_date: '1999-05-01', images: [{ url: `https://img.test/${id}-640`, width: 640 }, { url: `https://img.test/${id}-300`, width: 300 }] },
  ...extra,
});

function fakeApi(overrides = {}) {
  const calls = [];
  const api = {
    calls,
    track: async (id) => (calls.push(['track', id]), rawTrack(id, 'Test Pattern', 'The Placeholders')),
    artist: async (id) => {
      calls.push(['artist', id]);
      return id === 'ar_ThePlaceholders'
        ? { id, name: 'The Placeholders', genres: ['fake pop', 'test rock'], images: [{ url: 'https://img.test/a', width: 320 }] }
        : { id, name: 'DJ Fixture', genres: [], images: [] }; // 2026 API: genres often empty
    },
    search: async (q, type) => {
      calls.push(['search', type, q]);
      if (type === 'track')
        return { tracks: { items: [rawTrack('wrong1', 'Mock Beat', 'Someone Else'), rawTrack('mb1', 'Mock Beat (feat. Nobody)', 'DJ Fixture')] } };
      if (type === 'artist') return { artists: { items: [{ id: 'ar_DJFixture', name: 'DJ Fixture', genres: [], images: [] }] } };
      if (type === 'album') return { albums: { items: [] } };
      if (type === 'show') return { shows: { items: [{ id: 'sh1', name: 'The Fake Podcast', publisher: 'Nobody', images: [{ url: 'https://img.test/s', width: 300 }] }] } };
      return null;
    },
    ...overrides,
  };
  return api;
}

const targets = () => ({
  tracks: new Map([
    ['the placeholders|test pattern', { name: 'Test Pattern', artist: 'The Placeholders', uri: 'spotify:track:tp1', album: 'Test Pattern Album' }],
    ['dj fixture|mock beat', { name: 'Mock Beat', artist: 'DJ Fixture' }],
  ]),
  artists: new Map([
    ['the placeholders', { name: 'The Placeholders' }],
    ['dj fixture', { name: 'DJ Fixture' }],
  ]),
  albums: new Map([['the placeholders|test pattern album', { name: 'Test Pattern Album', artist: 'The Placeholders' }]]),
  shows: new Map([['the fake podcast', { name: 'The Fake Podcast' }]]),
});

let cacheFile;
beforeEach(() => {
  cacheFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jw-cache-')), 'spotify.json');
});

describe('fuzzy matching', () => {
  it('simplifies featured artists and remaster suffixes', () => {
    expect(simplify('Mock Beat (feat. Nobody)')).toBe('mock beat');
    expect(simplify('Test Pattern - Remastered 2011')).toBe('test pattern');
    expect(similarity('Beyoncé & Friends', 'beyonce and friends')).toBe(1);
  });

  it('picks the right artist among same-named tracks and rejects poor matches', () => {
    const items = [
      { id: 'a', name: 'Mock Beat', artists: [{ name: 'Someone Else' }] },
      { id: 'b', name: 'Mock Beat - Radio Edit', artists: [{ name: 'DJ Fixture' }] },
    ];
    expect(bestTrackMatch(items, { track: 'Mock Beat', artist: 'DJ Fixture' }).id).toBe('b');
    expect(bestTrackMatch(items, { track: 'Completely Different', artist: 'DJ Fixture' })).toBe(null);
  });
});

describe('resolveTargets', () => {
  it('uses URIs directly, searches otherwise, and caches everything', async () => {
    const cache = openCache(cacheFile);
    const api = fakeApi();
    await resolveTargets(targets(), { api, cache });
    expect(api.calls.filter((c) => c[0] === 'track').map((c) => c[1])).toEqual(['tp1']);
    expect(api.calls.some((c) => c[0] === 'search' && c[1] === 'track' && c[2].includes('Mock Beat'))).toBe(true);
    expect(cache.data.resolved.tracks['dj fixture|mock beat']).toBe('mb1');
    // DJ Fixture's artist id came free from the matched track; Placeholders too
    expect(api.calls.filter((c) => c[0] === 'search' && c[1] === 'artist')).toHaveLength(0);
    // album reused from the resolved track: no album search
    expect(api.calls.filter((c) => c[1] === 'album')).toHaveLength(0);
    expect(fs.existsSync(cacheFile)).toBe(true);
  });

  it('makes zero calls on a re-run with the same cache', async () => {
    await resolveTargets(targets(), { api: fakeApi(), cache: openCache(cacheFile) });
    const api2 = fakeApi();
    await resolveTargets(targets(), { api: api2, cache: openCache(cacheFile) });
    expect(api2.calls).toHaveLength(0);
  });

  it('works offline from the cache, and does not cache misses when offline', async () => {
    const cache = openCache(cacheFile);
    const r = await resolveTargets(targets(), { api: null, cache });
    expect(r.calls).toBe(0);
    expect(cache.resolvedHas('tracks', 'dj fixture|mock beat')).toBe(false);
    expect(buildMeta(targets(), cache)).toBe(null);
  });

  it('falls back via onForbidden on the first 403 and retries', async () => {
    let forbidden = true;
    let switched = 0;
    const api = fakeApi({
      track: async (id) => {
        if (forbidden) throw new ForbiddenError('403');
        return rawTrack(id, 'Test Pattern', 'The Placeholders');
      },
    });
    const cache = openCache(cacheFile);
    await resolveTargets(targets(), {
      api,
      cache,
      onForbidden: async () => {
        switched++;
        forbidden = false;
        return true;
      },
    });
    expect(switched).toBe(1);
    expect(cache.data.resolved.tracks['the placeholders|test pattern']).toBe('tp1');
  });

  it('stops cleanly on quota errors and keeps what it has', async () => {
    let n = 0;
    const api = fakeApi({
      search: async () => {
        throw new QuotaError('rate limited (Retry-After 86400s)');
      },
      track: async (id) => (n++, rawTrack(id, 'Test Pattern', 'The Placeholders')),
    });
    const logs = [];
    const cache = openCache(cacheFile);
    const r = await resolveTargets(targets(), { api, cache, log: (s) => logs.push(s) });
    expect(r.stoppedReason).toMatch(/quota/);
    expect(n).toBe(1);
    expect(logs.join('\n')).toMatch(/Stopping API calls/);
    const meta = buildMeta(targets(), cache);
    expect(meta.tracks['the placeholders|test pattern']).toBeTruthy();
    expect(meta.tracks['dj fixture|mock beat']).toBeUndefined();
  });
});

describe('buildMeta + computeEnriched', () => {
  it('builds art and derives genres, decades, explicit, track length', async () => {
    const cache = openCache(cacheFile);
    await resolveTargets(targets(), { api: fakeApi(), cache });
    const meta = buildMeta(targets(), cache);
    expect(meta.tracks['the placeholders|test pattern']).toMatchObject({ img: 'https://img.test/tp1-640', imgSm: 'https://img.test/tp1-300', releaseYear: 1999, durationMs: 200000 });
    expect(meta.artists['the placeholders'].genres).toEqual(['fake pop', 'test rock']);
    expect(meta.artists['dj fixture'].genres).toBeUndefined(); // empty genres -> treated as missing
    expect(meta.shows['the fake podcast'].img).toBe('https://img.test/s');
    expect(meta.counts).toEqual({ tracks: 2, artists: 2, albums: 1, shows: 1 });

    const plays = [
      fromAccountMusic({ endTime: '2025-12-01 15:00', artistName: 'The Placeholders', trackName: 'Test Pattern', msPlayed: 180000 }),
      fromAccountMusic({ endTime: '2025-12-01 16:00', artistName: 'DJ Fixture', trackName: 'Mock Beat', msPlayed: 120000 }),
    ];
    const e = computeEnriched(plays, meta);
    expect(e.genres.top.map((g) => g.name)).toEqual(['fake pop', 'test rock']);
    expect(e.genres.top[0].pct).toBe(50);
    expect(e.genres.coveragePct).toBe(60); // 180000 of 300000 ms has genre data
    expect(e.topGenre).toBe('fake pop');
    expect(e.decades.list).toEqual([{ decade: '1990s', minutes: 5, pct: 100 }]);
    expect(e.explicit.pct).toBe(0);
    expect(e.avgTrackLengthMin).toBeCloseTo(3.33, 2);
  });

  it('returns null without metadata', () => {
    expect(computeEnriched([], null)).toBe(null);
  });
});
