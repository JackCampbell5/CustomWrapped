// Spotify enrichment: resolve only the items the UI shows, cache everything, and
// build art/metadata from the cache (so re-runs and offline runs make zero calls).
import { itemKey, norm } from './normalize.js';
import { STREAM_MS } from './config.js';
import { ForbiddenError, QuotaError, trimTrack, trimArtist, trimShow, trimAlbum } from './spotify/api.js';
import { bestTrackMatch, bestNameMatch, similarity } from './spotify/match.js';

export const ENRICH_LIMITS = { tracks: 100, artists: 100, albums: 50, shows: 20 };

// ---------------------------------------------------------------- targets
function topKeys(plays, keyOf, n) {
  const ms = new Map();
  for (const p of plays) {
    const k = keyOf(p);
    if (k) ms.set(k, (ms.get(k) ?? 0) + p.msPlayed);
  }
  return [...ms.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

const albumKeyOf = (p) => (p.album ? itemKey(p.artist, p.album) : null);

/** Walk stats JSON and collect track keys referenced anywhere (quirks, deep dives...). */
function referencedTrackKeys(node, out = new Set()) {
  if (Array.isArray(node)) for (const x of node) referencedTrackKeys(x, out);
  else if (node && typeof node === 'object') {
    if (typeof node.artist === 'string') {
      if (typeof node.name === 'string') out.add(itemKey(node.artist, node.name));
      if (typeof node.track === 'string') out.add(itemKey(node.artist, node.track));
    }
    for (const v of Object.values(node)) if (v && typeof v === 'object') referencedTrackKeys(v, out);
  }
  return out;
}

/**
 * @param {import('./adapters.js').Play[]} plays
 * @param {Record<string, any>} stats  first-pass stats per scope
 */
export function collectTargets(plays, stats) {
  const info = { tracks: new Map(), artists: new Map(), albums: new Map(), shows: new Map() };
  for (const p of plays) {
    if (p.kind === 'track' && !p.unknown) {
      const t = info.tracks.get(p.trackKey);
      if (!t) info.tracks.set(p.trackKey, { name: p.track, artist: p.artist, uri: p.trackUri, album: p.album });
      else {
        t.uri ??= p.trackUri;
        t.album ??= p.album;
      }
      if (!info.artists.has(p.artistKey)) info.artists.set(p.artistKey, { name: p.artist });
      const ak = albumKeyOf(p);
      if (ak && !info.albums.has(ak)) info.albums.set(ak, { name: p.album, artist: p.artist });
    } else if (p.kind === 'episode' && !info.shows.has(p.artistKey)) info.shows.set(p.artistKey, { name: p.show });
  }

  const scopes = new Map();
  for (const p of plays) {
    for (const id of [String(p.year), 'all']) {
      if (!scopes.has(id)) scopes.set(id, []);
      scopes.get(id).push(p);
    }
  }
  const want = { tracks: new Set(), artists: new Set(), albums: new Set(), shows: new Set() };
  for (const ps of scopes.values()) {
    const music = ps.filter((p) => p.kind === 'track' && !p.unknown);
    const eps = ps.filter((p) => p.kind === 'episode');
    for (const k of topKeys(music, (p) => p.trackKey, ENRICH_LIMITS.tracks)) want.tracks.add(k);
    for (const k of topKeys(music, (p) => p.artistKey, ENRICH_LIMITS.artists)) want.artists.add(k);
    for (const k of topKeys(music, albumKeyOf, ENRICH_LIMITS.albums)) want.albums.add(k);
    for (const k of topKeys(eps, (p) => p.artistKey, ENRICH_LIMITS.shows)) want.shows.add(k);
  }
  for (const s of Object.values(stats ?? {})) for (const k of referencedTrackKeys(s)) if (info.tracks.has(k)) want.tracks.add(k);

  const pick = (kind) => new Map([...want[kind]].filter((k) => info[kind].has(k)).map((k) => [k, info[kind].get(k)]));
  return { tracks: pick('tracks'), artists: pick('artists'), albums: pick('albums'), shows: pick('shows') };
}

// ---------------------------------------------------------------- resolve
const idOf = (uri, type) => (typeof uri === 'string' && uri.startsWith(`spotify:${type}:`) ? uri.split(':')[2] : null);
const q = (s) => String(s ?? '').replace(/["]/g, '').trim();

/**
 * Resolve targets against the API (when `api` is given) and the cache.
 * @param {ReturnType<typeof collectTargets>} targets
 * @param {{ api?: any, cache: ReturnType<import('./spotify/cache.js').openCache>, log?: (s: string) => void, onForbidden?: () => Promise<boolean> }} opts
 *   onForbidden: called on the first 403; return true to retry (e.g. after switching to PKCE).
 */
export async function resolveTargets(targets, { api, cache, log = () => {}, onForbidden }) {
  let online = Boolean(api);
  let switched = false;
  const stats = { calls: 0, stoppedReason: null };

  async function call(fn) {
    if (!online) return undefined;
    try {
      stats.calls++;
      return await fn();
    } catch (e) {
      if (e instanceof ForbiddenError && !switched && onForbidden) {
        switched = true;
        if (await onForbidden()) return call(fn);
      }
      online = false;
      stats.stoppedReason = e instanceof QuotaError ? `quota: ${e.message}` : e instanceof ForbiddenError ? 'API returned 403 (access denied)' : e.message;
      log(`  ! Stopping API calls: ${stats.stoppedReason}. Using what is cached so far.`);
      return undefined;
    }
  }

  const getCached = async (path, fetcher, trim) => {
    if (cache.has('get', path)) return cache.data.get[path];
    const raw = await call(fetcher);
    if (raw === undefined) return undefined; // offline / stopped: don't cache
    const v = trim(raw);
    cache.set('get', path, v);
    return v;
  };
  const searchCached = async (query, type, pickItems, trim) => {
    const key = `${type}|${query}`;
    if (cache.has('search', key)) return cache.data.search[key];
    const raw = await call(() => api.search(query, type));
    if (raw === undefined) return undefined;
    const v = (pickItems(raw) ?? []).map(trim).filter(Boolean);
    cache.set('search', key, v);
    return v;
  };
  const progress = (kind, i, n) => {
    if (online && (i % 25 === 0 || i === n) && n) log(`  ${kind} ${i}/${n}`);
  };

  // tracks
  let i = 0;
  for (const [key, t] of targets.tracks) {
    progress('tracks', ++i, targets.tracks.size);
    if (cache.resolvedHas('tracks', key)) continue;
    let id = idOf(t.uri, 'track');
    if (id) {
      const got = await getCached(`/tracks/${id}`, () => api.track(id), trimTrack);
      if (got === undefined) continue;
      if (got === null) id = null;
    }
    if (!id) {
      let results = await searchCached(`track:"${q(t.name)}" artist:"${q(t.artist)}"`, 'track', (r) => r?.tracks?.items, trimTrack);
      if (results === undefined) continue;
      let hit = bestTrackMatch(results, { track: t.name, artist: t.artist });
      if (!hit) {
        results = await searchCached(`${q(t.name)} ${q(t.artist)}`, 'track', (r) => r?.tracks?.items, trimTrack);
        if (results === undefined) continue;
        hit = bestTrackMatch(results, { track: t.name, artist: t.artist });
      }
      if (hit?.id) {
        id = hit.id;
        if (!cache.has('get', `/tracks/${id}`)) cache.set('get', `/tracks/${id}`, hit);
      }
    }
    cache.resolve('tracks', key, id ?? null);
  }

  // artist ids seen on resolved tracks (free; no extra calls)
  const artistIdsByName = new Map();
  for (const key of targets.tracks.keys()) {
    const tr = cache.data.get[`/tracks/${cache.data.resolved.tracks[key]}`];
    for (const a of tr?.artists ?? []) if (a.id && a.name && !artistIdsByName.has(norm(a.name))) artistIdsByName.set(norm(a.name), a.id);
  }

  i = 0;
  for (const [key, a] of targets.artists) {
    progress('artists', ++i, targets.artists.size);
    if (!cache.resolvedHas('artists', key)) {
      let id = artistIdsByName.get(key) ?? null;
      if (!id) {
        const results = await searchCached(`artist:"${q(a.name)}"`, 'artist', (r) => r?.artists?.items, trimArtist);
        if (results === undefined) continue;
        const hit = bestNameMatch(results, a.name, { min: 0.85 });
        if (hit?.id) {
          id = hit.id;
          if (!cache.has('get', `/artists/${id}`)) cache.set('get', `/artists/${id}`, hit);
        }
      }
      cache.resolve('artists', key, id);
    }
    const id = cache.data.resolved.artists[key];
    if (id) await getCached(`/artists/${id}`, () => api.artist(id), trimArtist);
  }

  // albums: reuse album objects from resolved tracks first
  const albumFromTracks = new Map();
  for (const [key, t] of targets.tracks) {
    const tr = cache.data.get[`/tracks/${cache.data.resolved.tracks[key]}`];
    if (tr?.album?.id && t.album && similarity(t.album, tr.album.name ?? '') >= 0.8) albumFromTracks.set(itemKey(t.artist, t.album), tr.album);
  }
  i = 0;
  for (const [key, al] of targets.albums) {
    progress('albums', ++i, targets.albums.size);
    if (cache.resolvedHas('albums', key)) continue;
    let album = albumFromTracks.get(key) ?? null;
    if (!album) {
      const results = await searchCached(`album:"${q(al.name)}" artist:"${q(al.artist)}"`, 'album', (r) => r?.albums?.items, trimAlbum);
      if (results === undefined) continue;
      album = bestNameMatch(results, al.name, { owner: al.artist, ownerOf: (r) => (r.artists ?? []).map((x) => x.name ?? '') });
    }
    if (album?.id && !cache.has('get', `/albums/${album.id}`)) cache.set('get', `/albums/${album.id}`, album);
    cache.resolve('albums', key, album?.id ?? null);
  }

  i = 0;
  for (const [key, s] of targets.shows) {
    progress('shows', ++i, targets.shows.size);
    if (cache.resolvedHas('shows', key)) continue;
    const results = await searchCached(q(s.name), 'show', (r) => r?.shows?.items, trimShow);
    if (results === undefined) continue;
    const hit = bestNameMatch(results, s.name, { min: 0.8 });
    if (hit?.id && !cache.has('get', `/shows/${hit.id}`)) cache.set('get', `/shows/${hit.id}`, hit);
    cache.resolve('shows', key, hit?.id ?? null);
  }

  cache.save();
  return stats;
}

// ---------------------------------------------------------------- meta (from cache only)
function pickImages(images) {
  if (!images?.length) return {};
  const big = images.find((i) => (i.w ?? 640) <= 640) ?? images[0];
  const small = [...images].reverse().find((i) => (i.w ?? 0) >= 160) ?? images[images.length - 1];
  return { img: big.url, imgSm: small.url };
}
const yearOf = (d) => (typeof d === 'string' && /^\d{4}/.test(d) ? +d.slice(0, 4) : null);
const compact = (o) => {
  for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
  return o;
};

/** Build the art/metadata document for the UI from whatever the cache holds. */
export function buildMeta(targets, cache) {
  const { get, resolved } = cache.data;
  const meta = { tracks: {}, artists: {}, albums: {}, shows: {} };
  for (const key of targets.tracks.keys()) {
    const id = resolved.tracks[key];
    const t = id && get[`/tracks/${id}`];
    if (!t) continue;
    meta.tracks[key] = compact({
      uri: `spotify:track:${id}`,
      ...pickImages(t.album?.images),
      durationMs: t.durationMs,
      explicit: t.explicit,
      releaseYear: yearOf(t.album?.releaseDate),
      album: t.album?.name,
    });
  }
  for (const key of targets.artists.keys()) {
    const id = resolved.artists[key];
    const a = id && get[`/artists/${id}`];
    if (!a) continue;
    meta.artists[key] = compact({ uri: `spotify:artist:${id}`, ...pickImages(a.images), genres: a.genres?.length ? a.genres : null });
  }
  for (const key of targets.albums.keys()) {
    const id = resolved.albums[key];
    const al = id && get[`/albums/${id}`];
    if (!al) continue;
    meta.albums[key] = compact({ uri: `spotify:album:${id}`, ...pickImages(al.images), releaseYear: yearOf(al.releaseDate) });
  }
  for (const key of targets.shows.keys()) {
    const id = resolved.shows[key];
    const s = id && get[`/shows/${id}`];
    if (!s) continue;
    meta.shows[key] = compact({ uri: `spotify:show:${id}`, ...pickImages(s.images), publisher: s.publisher });
  }
  const counts = Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, Object.keys(v).length]));
  return Object.values(counts).some(Boolean) ? { ...meta, counts } : null;
}

// ---------------------------------------------------------------- enriched stats
const toMin = (ms) => Math.round(ms / 6000) / 10;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

/** Genre / decade / explicit / track-length stats; each piece is null when the API didn't provide it. */
export function computeEnriched(plays, meta) {
  if (!meta) return null;
  const music = plays.filter((p) => p.kind === 'track' && !p.unknown);
  const total = music.reduce((a, p) => a + p.msPlayed, 0);
  if (!total) return null;

  // genres (split each play's minutes across its artist's genres)
  const genreMs = new Map();
  const genreMonth = new Map();
  let withGenre = 0;
  for (const p of music) {
    const g = meta.artists[p.artistKey]?.genres;
    if (!g?.length) continue;
    withGenre += p.msPlayed;
    const share = p.msPlayed / g.length;
    const m = p.date.slice(0, 7);
    if (!genreMonth.has(m)) genreMonth.set(m, new Map());
    for (const name of g) {
      genreMs.set(name, (genreMs.get(name) ?? 0) + share);
      genreMonth.get(m).set(name, (genreMonth.get(m).get(name) ?? 0) + share);
    }
  }
  let genres = null;
  if (genreMs.size) {
    const top = [...genreMs.entries()].sort((a, b) => b[1] - a[1]);
    const names = top.slice(0, 6).map(([n]) => n);
    genres = {
      top: top.slice(0, 10).map(([name, ms]) => ({ name, minutes: toMin(ms), pct: pct(ms, withGenre) })),
      coveragePct: pct(withGenre, total),
      byMonth: {
        genres: names,
        rows: [...genreMonth.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, gm]) => {
            const monthTotal = [...gm.values()].reduce((a, b) => a + b, 0);
            return { month, ...Object.fromEntries(names.map((n) => [n, pct(gm.get(n) ?? 0, monthTotal)])) };
          }),
      },
    };
  }

  // release years / decades (track metadata first, album metadata as fallback)
  const yearOfPlay = (p) => meta.tracks[p.trackKey]?.releaseYear ?? (p.album ? meta.albums[itemKey(p.artist, p.album)]?.releaseYear : null) ?? null;
  const decadeMs = new Map();
  let withYear = 0;
  let yearSum = 0;
  const oldestByTrack = new Map();
  for (const p of music) {
    const y = yearOfPlay(p);
    if (!y) continue;
    withYear += p.msPlayed;
    yearSum += y * p.msPlayed;
    const d = `${Math.floor(y / 10) * 10}s`;
    decadeMs.set(d, (decadeMs.get(d) ?? 0) + p.msPlayed);
    if (p.msPlayed >= STREAM_MS) {
      const e = oldestByTrack.get(p.trackKey) ?? { name: p.track, artist: p.artist, year: y, plays: 0 };
      e.plays++;
      oldestByTrack.set(p.trackKey, e);
    }
  }
  const candidates = [...oldestByTrack.entries()].filter(([, e]) => e.plays >= 3);
  const decades = decadeMs.size
    ? {
        list: [...decadeMs.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([decade, ms]) => ({ decade, minutes: toMin(ms), pct: pct(ms, withYear) })),
        avgReleaseYear: Math.round(yearSum / withYear),
        coveragePct: pct(withYear, total),
        oldest: candidates.sort((a, b) => a[1].year - b[1].year)[0]?.[1] ?? null,
        newest: candidates.sort((a, b) => b[1].year - a[1].year)[0]?.[1] ?? null,
      }
    : null;

  // explicit + average track length (over streams of enriched tracks)
  let explicitKnown = 0;
  let explicitMs = 0;
  let durSum = 0;
  let durN = 0;
  for (const p of music) {
    const t = meta.tracks[p.trackKey];
    if (!t) continue;
    if (typeof t.explicit === 'boolean') {
      explicitKnown += p.msPlayed;
      if (t.explicit) explicitMs += p.msPlayed;
    }
    if (t.durationMs && p.msPlayed >= STREAM_MS) {
      durSum += t.durationMs;
      durN++;
    }
  }

  return {
    genres,
    topGenre: genres?.top[0]?.name ?? null,
    decades,
    explicit: explicitKnown ? { pct: pct(explicitMs, explicitKnown), coveragePct: pct(explicitKnown, total) } : null,
    avgTrackLengthMin: durN ? Math.round((durSum / durN / 60_000) * 100) / 100 : null,
  };
}
