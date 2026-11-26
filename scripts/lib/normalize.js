/** Lowercase, strip accents, unify quotes and whitespace. Used for grouping keys. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’′`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export const itemKey = (owner, item) => `${norm(owner)}|${norm(item)}`;

/** Spotify's placeholder for local files and unavailable items. */
export const isUnknownTrack = (artist, track) =>
  (!artist || artist === 'Unknown Artist') && (!track || track === 'Unknown Track');

/**
 * Collapse a raw Spotify platform string into a family name.
 * e.g. "Android OS 14 API 34 (Fakeco, FK-1)" -> "Android"
 */
export function platformFamily(raw) {
  if (!raw) return undefined;
  const s = String(raw).toLowerCase();
  if (/web_player|web player|webplayer/.test(s)) return 'Web';
  if (/android/.test(s)) return 'Android';
  if (/\bios\b|iphone|ipad/.test(s)) return 'iOS';
  if (/windows/.test(s)) return 'Windows';
  if (/os x|macos|mac os|osx/.test(s)) return 'macOS';
  if (/linux/.test(s)) return 'Linux';
  if (/cast|sonos|speaker|alexa|echo|google_home|home_thing/.test(s)) return 'Speaker';
  if (/playstation|xbox|ps4|ps5/.test(s)) return 'Console';
  if (/\btv\b|tizen|webos|roku|fire_tv|firetv/.test(s)) return 'TV';
  if (/\bcar\b|carplay|android_auto/.test(s)) return 'Car';
  return 'Other';
}
