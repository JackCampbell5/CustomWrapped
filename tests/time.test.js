import { describe, it, expect } from 'vitest';
import { localParts, parseAccountTime, parseIsoUtc, monthsBetween, addDays, daysBetween } from '../scripts/lib/time.js';

describe('time zone conversion (America/New_York)', () => {
  it('moves a just-after-midnight UTC play into the previous local day and year', () => {
    const p = localParts(Date.UTC(2026, 0, 1, 4, 30));
    expect(p.date).toBe('2025-12-31');
    expect(p.year).toBe(2025);
    expect(p.hour).toBe(23);
    expect(p.iso).toBe('2025-12-31T23:30:00-05:00');
  });

  it('handles the spring-forward DST jump', () => {
    expect(localParts(Date.UTC(2026, 2, 8, 6, 59)).iso).toBe('2026-03-08T01:59:00-05:00');
    expect(localParts(Date.UTC(2026, 2, 8, 7, 0)).iso).toBe('2026-03-08T03:00:00-04:00');
  });

  it('handles the fall-back DST repeat hour', () => {
    expect(localParts(Date.UTC(2026, 10, 1, 5, 30)).iso).toBe('2026-11-01T01:30:00-04:00');
    expect(localParts(Date.UTC(2026, 10, 1, 6, 30)).iso).toBe('2026-11-01T01:30:00-05:00');
  });

  it('reports day of week in local time', () => {
    // 2026-01-04 03:00Z is Saturday 2026-01-03 22:00 local
    expect(localParts(Date.UTC(2026, 0, 4, 3, 0)).dow).toBe(6);
  });
});

describe('parsers and date helpers', () => {
  it('parses account-export times as UTC', () => {
    expect(parseAccountTime('2025-11-22 19:01')).toBe(Date.UTC(2025, 10, 22, 19, 1));
    expect(Number.isNaN(parseAccountTime('garbage'))).toBe(true);
  });

  it("parses Spotify's ...Z[UTC] timestamps", () => {
    expect(parseIsoUtc('2026-08-29T01:35:32.467Z[UTC]')).toBe(Date.UTC(2026, 7, 29, 1, 35, 32, 467));
    expect(parseIsoUtc('2024-06-15T16:00:00Z')).toBe(Date.UTC(2024, 5, 15, 16));
  });

  it('does calendar math on date strings', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});
