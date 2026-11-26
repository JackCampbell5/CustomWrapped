import { STREAM_MS } from './config.js';
import { localParts, parseAccountTime, parseIsoUtc } from './time.js';
import { norm, itemKey, isUnknownTrack, platformFamily } from './normalize.js';

/**
 * One normalized listening event. Timestamps are END times (both exports record when playback stopped).
 * @typedef {Object} Play
 * @property {string} ts           End time, ISO with America/New_York offset
 * @property {number} tsUtc        End time, epoch ms
 * @property {string} date         Local "YYYY-MM-DD"
 * @property {number} year
 * @property {number} month        1-12
 * @property {number} dow          0 = Sunday
 * @property {number} hour         0-23 local
 * @property {number} minute
 * @property {number} msPlayed
 * @property {'track'|'episode'} kind
 * @property {string} [track]
 * @property {string} [artist]
 * @property {string} [album]
 * @property {string} [show]
 * @property {string} [episode]
 * @property {string} [trackUri]
 * @property {string} [episodeUri]
 * @property {string} trackKey     Normalized "artist|track" or "show|episode"
 * @property {string} artistKey    Normalized artist or show
 * @property {boolean} [unknown]   Spotify's "Unknown Artist / Unknown Track" placeholder
 * @property {boolean} [skipped]   extended: reported; account: inferred (< 30s)
 * @property {boolean} [shuffle]
 * @property {boolean} [offline]
 * @property {boolean} [incognito]
 * @property {string} [reasonStart]
 * @property {string} [reasonEnd]
 * @property {string} [platform]   Family, e.g. "Android"
 * @property {string} [country]
 * @property {'account'|'extended'} source
 */

/** Identify a streaming-history file from its rows. */
export function detectFormat(rows) {
  if (!Array.isArray(rows)) return null;
  const r = rows.find((x) => x && typeof x === 'object');
  if (!r) return null;
  if ('ts' in r && 'ms_played' in r) return 'extended';
  if ('endTime' in r && 'msPlayed' in r) {
    if ('podcastName' in r || 'episodeName' in r) return 'account-podcast';
    if ('artistName' in r || 'trackName' in r) return 'account-music';
  }
  return null;
}

function withTime(tsUtc, fields) {
  const lp = localParts(tsUtc);
  return {
    ts: lp.iso,
    tsUtc,
    date: lp.date,
    year: lp.year,
    month: lp.month,
    dow: lp.dow,
    hour: lp.hour,
    minute: lp.minute,
    ...fields,
  };
}

const clean = (o) => {
  for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === null) delete o[k];
  return o;
};

/** @returns {Play|null} */
export function fromAccountMusic(r) {
  const tsUtc = parseAccountTime(r?.endTime);
  if (!Number.isFinite(tsUtc)) return null;
  const ms = Math.max(0, Number(r.msPlayed) || 0);
  const artist = r.artistName ?? undefined;
  const track = r.trackName ?? undefined;
  return clean(
    withTime(tsUtc, {
      msPlayed: ms,
      kind: 'track',
      track,
      artist,
      trackKey: itemKey(artist, track),
      artistKey: norm(artist),
      unknown: isUnknownTrack(artist, track) || undefined,
      skipped: ms < STREAM_MS,
      source: 'account',
    }),
  );
}

/** @returns {Play|null} */
export function fromAccountPodcast(r) {
  const tsUtc = parseAccountTime(r?.endTime);
  if (!Number.isFinite(tsUtc)) return null;
  const ms = Math.max(0, Number(r.msPlayed) || 0);
  const show = r.podcastName ?? undefined;
  const episode = r.episodeName ?? undefined;
  if (!show && !episode) return null;
  return clean(
    withTime(tsUtc, {
      msPlayed: ms,
      kind: 'episode',
      show,
      episode,
      trackKey: itemKey(show, episode),
      artistKey: norm(show),
      skipped: ms < STREAM_MS,
      source: 'account',
    }),
  );
}

/** @returns {Play|null} Rows with no track or episode metadata (e.g. audiobooks) return null. */
export function fromExtended(r) {
  const tsUtc = parseIsoUtc(r?.ts);
  if (!Number.isFinite(tsUtc)) return null;
  const ms = Math.max(0, Number(r.ms_played) || 0);
  const common = {
    msPlayed: ms,
    skipped: r.skipped === true || r.reason_end === 'fwdbtn',
    shuffle: typeof r.shuffle === 'boolean' ? r.shuffle : undefined,
    offline: typeof r.offline === 'boolean' ? r.offline : undefined,
    incognito: typeof r.incognito_mode === 'boolean' ? r.incognito_mode : undefined,
    reasonStart: r.reason_start ?? undefined,
    reasonEnd: r.reason_end ?? undefined,
    platform: platformFamily(r.platform),
    country: r.conn_country ?? undefined,
    source: 'extended',
  };
  if (r.master_metadata_track_name) {
    const artist = r.master_metadata_album_artist_name ?? undefined;
    const track = r.master_metadata_track_name;
    return clean(
      withTime(tsUtc, {
        kind: 'track',
        track,
        artist,
        album: r.master_metadata_album_album_name ?? undefined,
        trackUri: r.spotify_track_uri ?? undefined,
        trackKey: itemKey(artist, track),
        artistKey: norm(artist),
        ...common,
      }),
    );
  }
  if (r.episode_name || r.episode_show_name) {
    const show = r.episode_show_name ?? undefined;
    const episode = r.episode_name ?? undefined;
    return clean(
      withTime(tsUtc, {
        kind: 'episode',
        show,
        episode,
        episodeUri: r.spotify_episode_uri ?? undefined,
        trackKey: itemKey(show, episode),
        artistKey: norm(show),
        ...common,
      }),
    );
  }
  return null;
}

const ADAPTERS = {
  'account-music': fromAccountMusic,
  'account-podcast': fromAccountPodcast,
  extended: fromExtended,
};

/** Convert one file's rows into Plays. Returns { format, plays, dropped }. */
export function adaptRows(rows) {
  const format = detectFormat(rows);
  if (!format) return { format: null, plays: [], dropped: Array.isArray(rows) ? rows.length : 0 };
  const fn = ADAPTERS[format];
  const plays = [];
  let dropped = 0;
  for (const r of rows) {
    const p = fn(r);
    if (p) plays.push(p);
    else dropped++;
  }
  return { format, plays, dropped };
}
