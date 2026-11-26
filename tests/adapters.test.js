import { describe, it, expect } from 'vitest';
import { detectFormat, fromAccountMusic, fromAccountPodcast, fromExtended, adaptRows } from '../scripts/lib/adapters.js';
import { platformFamily } from '../scripts/lib/normalize.js';
import { dedupPlays } from '../scripts/lib/dedup.js';
import { cleanInference } from '../scripts/lib/bonus.js';

const ext = (o) => ({
  ts: '2025-12-01T15:00:20Z',
  ms_played: 180000,
  master_metadata_track_name: 'Test Pattern',
  master_metadata_album_artist_name: 'The Placeholders',
  master_metadata_album_album_name: 'Fixture Album',
  spotify_track_uri: 'spotify:track:fakeTestPattern0000001',
  episode_name: null,
  episode_show_name: null,
  reason_start: 'clickrow',
  reason_end: 'trackdone',
  shuffle: false,
  skipped: false,
  offline: false,
  incognito_mode: false,
  platform: 'Android OS 14',
  conn_country: 'US',
  ...o,
});

describe('detectFormat', () => {
  it('recognizes all three formats from content', () => {
    expect(detectFormat([{ endTime: 'x', artistName: 'a', trackName: 't', msPlayed: 1 }])).toBe('account-music');
    expect(detectFormat([{ endTime: 'x', podcastName: 'p', episodeName: 'e', msPlayed: 1 }])).toBe('account-podcast');
    expect(detectFormat([{ ts: 'x', ms_played: 1 }])).toBe('extended');
    expect(detectFormat([{ foo: 1 }])).toBe(null);
    expect(detectFormat({ not: 'an array' })).toBe(null);
  });
});

describe('adapters', () => {
  it('maps account music rows and infers skips from < 30s', () => {
    const p = fromAccountMusic({ endTime: '2025-12-01 15:00', artistName: 'DJ Fixture', trackName: 'Mock Beat', msPlayed: 10000 });
    expect(p).toMatchObject({ kind: 'track', artist: 'DJ Fixture', track: 'Mock Beat', skipped: true, source: 'account', date: '2025-12-01', hour: 10 });
    expect(p.trackKey).toBe('dj fixture|mock beat');
    expect(fromAccountMusic({ endTime: '2025-12-01 15:00', artistName: 'A', trackName: 'B', msPlayed: 30000 }).skipped).toBe(false);
  });

  it('flags Unknown Artist placeholders', () => {
    expect(fromAccountMusic({ endTime: '2025-12-01 15:00', artistName: 'Unknown Artist', trackName: 'Unknown Track', msPlayed: 1 }).unknown).toBe(true);
    expect(fromAccountMusic({ endTime: '2025-12-01 15:00', artistName: 'Laura Fake', trackName: 'Hello Unknown', msPlayed: 1 }).unknown).toBeUndefined();
  });

  it('maps account podcast rows', () => {
    const p = fromAccountPodcast({ endTime: '2025-12-05 23:00', podcastName: 'The Fake Podcast', episodeName: 'Ep 1', msPlayed: 1800000 });
    expect(p).toMatchObject({ kind: 'episode', show: 'The Fake Podcast', episode: 'Ep 1', artistKey: 'the fake podcast' });
  });

  it('maps extended rows with the real skip/shuffle/platform fields', () => {
    const p = fromExtended(ext({ skipped: null, reason_end: 'fwdbtn', shuffle: true }));
    expect(p).toMatchObject({ kind: 'track', album: 'Fixture Album', trackUri: 'spotify:track:fakeTestPattern0000001', skipped: true, shuffle: true, platform: 'Android', country: 'US', source: 'extended' });
    expect(fromExtended(ext({})).skipped).toBe(false);
  });

  it('maps extended episodes and drops rows with no metadata', () => {
    const e = fromExtended(ext({ master_metadata_track_name: null, episode_name: 'Ep 0', episode_show_name: 'The Fake Podcast', spotify_episode_uri: 'spotify:episode:x' }));
    expect(e).toMatchObject({ kind: 'episode', show: 'The Fake Podcast', episodeUri: 'spotify:episode:x' });
    expect(fromExtended(ext({ master_metadata_track_name: null }))).toBe(null);
    expect(adaptRows([ext({}), ext({ master_metadata_track_name: null })])).toMatchObject({ format: 'extended', dropped: 1 });
  });

  it('collapses platform strings into families', () => {
    expect(platformFamily('Android OS 9 API 28 (samsung, SM-G950U)')).toBe('Android');
    expect(platformFamily('iOS 14.4 (iPhone12,1)')).toBe('iOS');
    expect(platformFamily('Windows 10 (10.0.19041; x64)')).toBe('Windows');
    expect(platformFamily('web_player windows 10;chrome 87')).toBe('Web');
    expect(platformFamily('OS X 10.15.7 [x86 4]')).toBe('macOS');
    expect(platformFamily(undefined)).toBeUndefined();
  });
});

describe('dedupPlays', () => {
  const acc = (endTime, msPlayed = 180000) => fromAccountMusic({ endTime, artistName: 'The Placeholders', trackName: 'Test Pattern', msPlayed });

  it('drops account rows covered by an extended row and keeps the extended one', () => {
    const r = dedupPlays([acc('2025-12-01 15:00'), fromExtended(ext({}))]);
    expect(r.overlapDuplicates).toBe(1);
    expect(r.plays).toHaveLength(1);
    expect(r.plays[0].source).toBe('extended');
  });

  it('keeps account rows that are not near any extended row', () => {
    const r = dedupPlays([acc('2025-12-01 15:04'), fromExtended(ext({}))]);
    expect(r.overlapDuplicates).toBe(0);
    expect(r.plays).toHaveLength(2);
  });

  it('does not dedup different tracks at the same time', () => {
    const other = fromAccountMusic({ endTime: '2025-12-01 15:00', artistName: 'DJ Fixture', trackName: 'Mock Beat', msPlayed: 1000 });
    expect(dedupPlays([other, fromExtended(ext({}))]).plays).toHaveLength(2);
  });

  it('removes exact repeats from overlapping copies of the same export', () => {
    const r = dedupPlays([acc('2025-12-01 15:00'), acc('2025-12-01 15:00'), acc('2025-12-01 15:03')]);
    expect(r.exactDuplicates).toBe(1);
    expect(r.plays).toHaveLength(2);
  });

  it('returns plays sorted by time', () => {
    const r = dedupPlays([acc('2025-12-02 15:00'), acc('2025-12-01 15:00')]);
    expect(r.plays.map((p) => p.date)).toEqual(['2025-12-01', '2025-12-02']);
  });
});

describe('cleanInference', () => {
  it('produces readable labels and drops opaque ids', () => {
    expect(cleanInference('1P_Custom_Fake_Cereal_Enthusiasts')).toBe('Fake Cereal Enthusiasts');
    expect(cleanInference('3P_Custom_Imaginary Yacht Owners_US')).toBe('Imaginary Yacht Owners');
    expect(cleanInference('3P_Custom_Purina Competitive Segment_09Sep2019_US [Do Not Use in 2021]')).toBe('Purina Competitive Segment');
    expect(cleanInference('Interest | Music | Funk | Funk(1P)')).toBe('Funk');
    expect(cleanInference('1P_Custom_ArtistAffinity_abc123')).toBe(null);
    expect(cleanInference('targeting:00000000-0000-0000-0000-000000000000')).toBe(null);
  });
});
