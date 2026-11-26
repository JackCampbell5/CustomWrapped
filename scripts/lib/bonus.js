import { itemKey } from './normalize.js';
import { localParts, parseIsoUtc } from './time.js';

const arr = (x) => (Array.isArray(x) ? x : []);

/** Flatten Playlist*.json files into one playlist list. */
export function flattenPlaylists(files) {
  return files.flatMap((f) => arr(f?.playlists));
}

/**
 * artist|track -> { album, trackUri } built from local files only (no API).
 * Sources, lowest to highest priority: playlists, library, extended plays.
 */
export function buildLocalCatalog({ library, playlists = [], plays = [] }) {
  const cat = new Map();
  const put = (artist, track, album, uri) => {
    if (!artist || !track) return;
    const k = itemKey(artist, track);
    const e = cat.get(k) ?? {};
    if (album) e.album = album;
    if (uri && String(uri).startsWith('spotify:track:')) e.trackUri = uri;
    cat.set(k, e);
  };
  for (const p of playlists) for (const it of arr(p?.items)) if (it?.track) put(it.track.artistName, it.track.trackName, it.track.albumName, it.track.trackUri);
  for (const p of playlists)
    for (const h of arr(p?.history))
      for (const op of arr(h?.operations)) for (const it of arr(op?.items)) if (it?.track) put(it.track.artistName, it.track.trackName, it.track.albumName, it.track.trackUri);
  for (const t of arr(library?.tracks)) put(t?.artist, t?.track, t?.album, t?.uri);
  for (const p of plays) if (p.source === 'extended' && p.kind === 'track') put(p.artist, p.track, p.album, p.trackUri);
  return cat;
}

/** Fill album / trackUri on plays that lack them. Returns how many plays were filled. */
export function applyCatalog(plays, catalog) {
  let filled = 0;
  for (const p of plays) {
    if (p.kind !== 'track' || p.unknown) continue;
    const e = catalog.get(p.trackKey);
    if (!e) continue;
    if (!p.album && e.album) {
      p.album = e.album;
      filled++;
    }
    if (!p.trackUri && e.trackUri) p.trackUri = e.trackUri;
  }
  return filled;
}

// ---------------------------------------------------------------- inferences
/** Turn ad-segment ids into readable labels; drop opaque ones. */
export function cleanInference(s) {
  if (typeof s !== 'string') return null;
  if (/^targeting:|ArtistAffinity|^[0-9a-f]{32}$/i.test(s)) return null;
  let t = s;
  if (/^Interest\s*\|/i.test(t)) t = t.split('|').map((x) => x.trim()).filter(Boolean).at(-1) ?? '';
  t = t
    .replace(/^\[T\]\s*-\s*/, '')
    .replace(/^(1P|2P|3P)_/, '')
    .replace(/^Custom(_| Audience_)/, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\(\s*\dP\s*\)/g, '')
    .replace(/_?\d{1,2}[-_ ]?[A-Za-z]{3,9}[-_ ]?\d{4}/g, '')
    .replace(/_(US|CA|MX|FR|UK|GB|DE|BR|AU|ES|IT|JP|IN)\b/g, '')
    .replace(/\d\|\d/g, ' ')
    .replace(/[_|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length < 4 || !/[a-z]/i.test(t)) return null;
  return t;
}

// ---------------------------------------------------------------- bonus stats
const inScope = (scope, local) => scope.year == null || local.year === scope.year;

/** Scope-dependent bonus stats (searches, playlist activity). */
export function scopedBonus(scope, { searches, playlists }) {
  const out = {};
  if (Array.isArray(searches)) {
    const counts = new Map();
    const platforms = new Map();
    let n = 0;
    const rows = searches
      .map((s) => ({ t: parseIsoUtc(s?.searchTime), q: String(s?.searchQuery ?? '').trim().toLowerCase(), platform: s?.platform }))
      .filter((s) => Number.isFinite(s.t) && inScope(scope, localParts(s.t)))
      .sort((a, b) => a.t - b.t);
    for (let i = 0; i < rows.length; i++) {
      const s = rows[i];
      // Spotify logs as-you-type fragments ("ve", "vers", "version history"): keep only the final query.
      const next = rows[i + 1];
      if (next && next.t - s.t < 120_000 && next.q.startsWith(s.q) && next.q !== s.q) continue;
      n++;
      const q = s.q;
      if (q.length >= 2) counts.set(q, (counts.get(q) ?? 0) + 1);
      const plat = s.platform || 'Unknown';
      platforms.set(plat, (platforms.get(plat) ?? 0) + 1);
    }
    out.searches = {
      count: n,
      topQueries: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([query, count]) => ({ query, count })),
      platforms: Object.fromEntries(platforms),
    };
  }
  if (playlists?.length) {
    let created = 0;
    let added = 0;
    const createdNames = [];
    for (const p of playlists) {
      const times = arr(p?.history).map((h) => parseIsoUtc(h?.timestamp)).filter(Number.isFinite).sort((a, b) => a - b);
      if (times.length && inScope(scope, localParts(times[0]))) {
        created++;
        if (p.name) createdNames.push(p.name);
      }
      for (const h of arr(p?.history)) {
        const t = parseIsoUtc(h?.timestamp);
        if (!Number.isFinite(t) || !inScope(scope, localParts(t))) continue;
        for (const op of arr(h?.operations)) if (op?.kind === 'add') added += arr(op.items).length;
      }
    }
    out.playlists = { created, tracksAdded: added, createdNames: createdNames.slice(0, 20) };
  }
  return out;
}

/** Snapshot bonus facts that don't depend on the year. */
export function globalBonus({ library, playlists, inferences, marquee }) {
  const out = {};
  if (library && typeof library === 'object') {
    out.library = {
      tracks: arr(library.tracks).length,
      albums: arr(library.albums).length,
      artists: arr(library.artists).length,
      shows: arr(library.shows).length,
      episodes: arr(library.episodes).length,
      bannedTracks: arr(library.bannedTracks).length,
    };
  }
  if (playlists?.length) {
    const counts = new Map();
    for (const p of playlists)
      for (const it of arr(p?.items)) {
        if (!it?.track?.trackName) continue;
        const k = itemKey(it.track.artistName, it.track.trackName);
        const e = counts.get(k) ?? { name: it.track.trackName, artist: it.track.artistName, uri: it.track.trackUri, playlists: 0 };
        e.playlists++;
        counts.set(k, e);
      }
    out.playlists = {
      count: playlists.length,
      totalItems: playlists.reduce((a, p) => a + arr(p?.items).length, 0),
      biggest: [...playlists].sort((a, b) => arr(b?.items).length - arr(a?.items).length).slice(0, 5).map((p) => ({ name: p.name, tracks: arr(p.items).length })),
      mostAddedTracks: [...counts.values()].filter((e) => e.playlists >= 2).sort((a, b) => b.playlists - a.playlists).slice(0, 10),
    };
  }
  const inf = arr(inferences?.inferences);
  if (inf.length) {
    const labels = [...new Set(inf.map(cleanInference).filter(Boolean))];
    out.inferences = { count: inf.length, readable: labels.length, labels };
  }
  if (Array.isArray(marquee)) {
    const seg = {};
    for (const m of marquee) if (m?.segment) seg[m.segment] = (seg[m.segment] ?? 0) + 1;
    out.marquee = { artists: marquee.length, segments: seg };
  }
  return out;
}
