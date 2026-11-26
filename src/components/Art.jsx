import { createContext, useContext, useState } from 'react';
import { itemKey, norm } from '../../scripts/lib/normalize.js';
import { useJson } from '../data/load.js';

const ArtContext = createContext(null);

export function ArtProvider({ children }) {
  const { data } = useJson('art');
  return <ArtContext.Provider value={data && data.tracks ? data : null}>{children}</ArtContext.Provider>;
}

export const useArtMeta = () => useContext(ArtContext);

/** Resolve the art.json key for an item. kind: tracks | artists | albums | shows */
export function artKey(kind, { k, name, artist }) {
  if (k) return k;
  if (kind === 'tracks' || kind === 'albums') return itemKey(artist, name);
  return norm(name);
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic gradient art used when there is no Spotify image (or no API keys). */
export function GradientArt({ seed, label, className = '', round = false }) {
  const h = hash(seed || label || '?');
  const h1 = h % 360;
  const h2 = (h1 + 50 + ((h >> 9) % 140)) % 360;
  const angle = (h >> 3) % 360;
  const initials = String(label ?? '?')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div
      role="img"
      aria-label={label ? `Generated cover for ${label}` : 'Generated cover'}
      className={`relative grid place-items-center overflow-hidden @container ${round ? 'rounded-full' : ''} ${className}`}
      style={{
        background: `radial-gradient(circle at 28% 22%, hsl(${h1} 95% 72% / .95), transparent 55%), radial-gradient(circle at 80% 85%, hsl(${h2} 90% 60% / .9), transparent 60%), linear-gradient(${angle}deg, hsl(${h1} 80% 48%), hsl(${h2} 85% 38%))`,
      }}
    >
      <span aria-hidden="true" className="text-[34cqw] font-black leading-none tracking-tighter text-white/90 mix-blend-overlay">
        {initials || '♪'}
      </span>
    </div>
  );
}

/**
 * Album / artist / show art with graceful fallback.
 * @param {{ kind: 'tracks'|'artists'|'albums'|'shows', item: {k?: string, key?: string, name: string, artist?: string}, small?: boolean, round?: boolean, className?: string }} props
 */
export function Art({ kind, item, small = false, round = false, className = '' }) {
  const meta = useArtMeta();
  const [failed, setFailed] = useState(false);
  const key = artKey(kind, { k: item?.key ?? item?.k, name: item?.name, artist: item?.artist });
  const m = meta?.[kind]?.[key];
  const src = m ? (small ? m.imgSm ?? m.img : m.img ?? m.imgSm) : null;
  const label = item?.name ?? '';
  const alt =
    kind === 'artists' ? `Photo of ${label}` : kind === 'shows' ? `Cover art for the podcast ${label}` : `Cover art for ${label}${item?.artist ? ` by ${item.artist}` : ''}`;
  if (!src || failed) return <GradientArt seed={key} label={label} round={round} className={className} />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${round ? 'rounded-full' : ''} ${className}`}
    />
  );
}
