// Central knobs for the data pipeline.
export const APP_NAME = "Jack's Wrapped";

/** Every time-of-day and day-boundary stat uses this zone. */
export const TIME_ZONE = 'America/New_York';

/** Spotify's own rule: a play counts as a stream at >= 30 seconds. */
export const STREAM_MS = 30_000;

/** Two plays belong to the same session if the gap between them is under this. */
export const SESSION_GAP_MS = 30 * 60_000;

/**
 * Account-export end times are truncated to the minute, extended ones are exact.
 * An account row is a duplicate of an extended row for the same item whose end
 * time is within this window of the account row's minute midpoint.
 */
export const DEDUP_WINDOW_MS = 90_000;

/** Length of the precomputed top lists. */
export const TOP_N = 50;

/** Minimum total listening (music + podcasts) for a day to count toward a streak. */
export const STREAK_MIN_MS = 60_000;
