import fs from 'node:fs';
import path from 'node:path';

/**
 * Permanent response cache in data/cache/spotify.json (gitignored).
 *   get[path]        trimmed GET responses (null = 404 / not available)
 *   search[query]    trimmed search results
 *   resolved[kind][key]  export item -> Spotify id (null = searched, no good match)
 */
export function openCache(file) {
  let data = { v: 1, get: {}, search: {}, resolved: { tracks: {}, artists: {}, albums: {}, shows: {} } };
  if (fs.existsSync(file)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (loaded?.v === 1) data = { ...data, ...loaded, resolved: { ...data.resolved, ...loaded.resolved } };
    } catch {
      fs.copyFileSync(file, `${file}.corrupt-${Date.now()}`);
    }
  }
  let dirty = 0;
  const save = () => {
    if (!dirty) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
    dirty = 0;
  };
  return {
    data,
    has: (bucket, k) => Object.prototype.hasOwnProperty.call(data[bucket], k),
    resolvedHas: (kind, k) => Object.prototype.hasOwnProperty.call(data.resolved[kind], k),
    set(bucket, k, v) {
      data[bucket][k] = v;
      if (++dirty >= 25) save();
    },
    resolve(kind, k, id) {
      data.resolved[kind][k] = id;
      if (++dirty >= 25) save();
    },
    save,
  };
}
