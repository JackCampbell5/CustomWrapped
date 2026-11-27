import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRaw } from '../scripts/lib/load.js';
import { preparePlays, buildOutputs } from '../scripts/lib/pipeline.js';
import { compareYears, rankChanges } from '../scripts/lib/compare.js';

const e = (key, minutes = 1) => ({ key, name: key.toUpperCase(), minutes, plays: 1 });

describe('rankChanges', () => {
  it('marks up, down, same, new and dropped', () => {
    const before = [e('a'), e('b'), e('c'), e('d')];
    const after = [e('b'), e('a'), e('c'), e('x')];
    const r = rankChanges(before, after);
    expect(r.rows.map((x) => [x.key, x.status, x.change])).toEqual([
      ['b', 'up', 1],
      ['a', 'down', -1],
      ['c', 'same', 0],
      ['x', 'new', null],
    ]);
    expect(r.dropped).toEqual([{ key: 'd', name: 'D', artist: undefined, prevRank: 4 }]);
  });
});

describe('compareYears on fixtures (2024 -> 2025)', () => {
  let c;
  beforeAll(() => {
    const raw = loadRaw(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures'));
    const { stats } = buildOutputs(preparePlays(raw), raw, { minYearSpanDays: 0 });
    c = compareYears(stats['2024'], stats['2025']);
  });

  it('computes minute deltas and per-day rates for partial years', () => {
    expect(c.years).toEqual(['2024', '2025']);
    expect(c.partial).toBe(true);
    expect(c.minutes).toMatchObject({ before: 10.8, after: 35.6, delta: 24.8 });
    // 10.8 min over 48 days vs 35.6 over 31 days
    expect(c.minutesPerDay.before).toBe(0.2);
    expect(c.minutesPerDay.after).toBe(1.1);
  });

  it('ranks artists: Null Pointer held, Placeholders climbed, DJ Fixture new, Mock Turtle dropped', () => {
    const np = c.artists.rows.find((x) => x.name === 'Null Pointer');
    expect(np).toMatchObject({ prevRank: 2, rank: 2, status: 'same' });
    // 2024: one 5-second play put them at #3
    expect(c.artists.rows.find((x) => x.name === 'The Placeholders')).toMatchObject({ prevRank: 3, rank: 1, status: 'up', change: 2 });
    expect(c.artists.rows.find((x) => x.name === 'DJ Fixture').status).toBe('new');
    expect(c.artists.dropped.map((x) => x.name)).toEqual(['Mock Turtle']);
    expect(c.stayedTop10.map((x) => x.name)).toEqual(['The Placeholders', 'Null Pointer']);
  });

  it('reports habit shifts', () => {
    expect(typeof c.habits.centerHourShift).toBe('number');
    expect(c.habits.persona).toHaveLength(2);
  });
});
