// Minimal, quota-friendly Spotify Web API client (2026 Development Mode rules):
// single-item endpoints only, search limit <= 10, throttled, honors Retry-After.
const API = 'https://api.spotify.com/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class ForbiddenError extends Error {}
export class QuotaError extends Error {}

/**
 * @param {{ auth: ReturnType<import('./auth.js').createAuth>, minIntervalMs?: number, log?: (s: string) => void }} opts
 */
export function createApi({ auth, minIntervalMs = 250, log = () => {} }) {
  let last = 0;
  let calls = 0;

  async function request(pathAndQuery, attempt = 0) {
    const wait = last + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    calls++;
    const token = await auth.token();
    let res;
    try {
      res = await fetch(`${API}${pathAndQuery}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      if (attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        return request(pathAndQuery, attempt + 1);
      }
      throw e;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt;
      if (retryAfter > 300 || attempt >= 6) throw new QuotaError(`rate limited (Retry-After ${retryAfter}s)`);
      log(`  rate limited; waiting ${retryAfter}s`);
      await sleep(retryAfter * 1000 + 250);
      return request(pathAndQuery, attempt + 1);
    }
    if (res.status === 401 && attempt < 1) {
      auth.invalidate();
      return request(pathAndQuery, attempt + 1);
    }
    if (res.status === 403) throw new ForbiddenError(`403 on ${pathAndQuery.split('?')[0]}`);
    if (res.status === 404 || res.status === 400) return null;
    if (res.status >= 500 && attempt < 3) {
      await sleep(1000 * 2 ** attempt);
      return request(pathAndQuery, attempt + 1);
    }
    if (!res.ok) throw new Error(`Spotify ${res.status} on ${pathAndQuery.split('?')[0]}`);
    return res.json();
  }

  return {
    get calls() {
      return calls;
    },
    track: (id) => request(`/tracks/${encodeURIComponent(id)}`),
    artist: (id) => request(`/artists/${encodeURIComponent(id)}`),
    album: (id) => request(`/albums/${encodeURIComponent(id)}`),
    show: (id) => request(`/shows/${encodeURIComponent(id)}?market=US`),
    search: (q, type) => request(`/search?${new URLSearchParams({ q, type, limit: '10', market: 'US' })}`),
  };
}

// ---- trimming: keep only fields the app uses; every field may be missing (2026 API changes)
const imgs = (arr) =>
  Array.isArray(arr) && arr.length
    ? [...arr].filter((i) => i?.url).sort((a, b) => (b.width ?? 0) - (a.width ?? 0)).map((i) => ({ url: i.url, w: i.width ?? null }))
    : null;

export const trimAlbum = (a) =>
  a ? { id: a.id ?? null, name: a.name ?? null, releaseDate: a.release_date ?? null, images: imgs(a.images), artists: (a.artists ?? []).map((x) => ({ id: x?.id ?? null, name: x?.name ?? null })) } : null;

export const trimTrack = (t) =>
  t
    ? {
        id: t.id ?? null,
        name: t.name ?? null,
        durationMs: typeof t.duration_ms === 'number' ? t.duration_ms : null,
        explicit: typeof t.explicit === 'boolean' ? t.explicit : null,
        artists: (t.artists ?? []).map((x) => ({ id: x?.id ?? null, name: x?.name ?? null })),
        album: trimAlbum(t.album),
      }
    : null;

export const trimArtist = (a) => (a ? { id: a.id ?? null, name: a.name ?? null, genres: Array.isArray(a.genres) ? a.genres : null, images: imgs(a.images) } : null);

export const trimShow = (s) => (s ? { id: s.id ?? null, name: s.name ?? null, publisher: s.publisher ?? null, images: imgs(s.images) } : null);
