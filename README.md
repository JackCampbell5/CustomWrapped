# Jack's Wrapped

A local, private, custom year-in-review built from a Spotify data export. Vite + React (JavaScript), Tailwind, Framer Motion and Recharts.

- **Story mode:** full-screen animated slides (about 30, depending on your data) ending in a summary card.
- **Explore mode:** a dashboard with charts, sortable top-50 lists, search for any artist, song or podcast, podcast mode, and a year-over-year comparison.
- Works with the **Account data** export (last ~12 months) today, and the **Extended streaming history** (lifetime) when it arrives. No code changes needed.

## Privacy first

Your listening data and API keys never leave your machine and are never committed:

- Personal data goes in `data/raw/` (gitignored). Generated stats (`src/generated/`, `public/data/`), the API cache and the login token (`data/cache/`) are gitignored too.
- Secrets go in `.env` (gitignored). Only `.env.example` is committed.
- Tests and demos use small synthetic fixtures in `fixtures/` (fake artists like "The Placeholders").
- A production build (`dist/`) contains your stats, so it's gitignored. Don't publish it.

### Pre-commit safety hook

`.githooks/pre-commit` blocks any commit that stages `data/raw/`, `data/cache/`, `src/generated/`, `public/data/`, `.env` files (except `.env.example`), `StreamingHistory*`, `Streaming_History*`, `*.zip`, or content that looks like a Spotify client secret or token. Enable it once per clone:

```sh
git config core.hooksPath .githooks
```

On macOS/Linux you may also need `chmod +x .githooks/pre-commit`.

## Setup

Requires Node 20.12+.

```sh
npm install
cp .env.example .env          # optional: add Spotify keys (see below)
```

### 1. Add your data

Request your data at <https://www.spotify.com/account/privacy/> and unzip it into `data/raw/`. Subfolders are fine:

```
data/raw/
  Spotify Account Data/
    StreamingHistory_music_0.json …
    StreamingHistory_podcast_0.json
    YourLibrary.json, Playlist1.json, SearchQueries.json, Inferences.json, Marquee.json …
```

The pipeline only opens streaming-history files plus `YourLibrary`, `Playlist*`, `SearchQueries`, `Inferences` and `Marquee`. Identity, payment and message files are never read.

### 2. (Optional) Spotify API keys for album art and metadata

Without keys everything still works, using generated gradient art.

1. Go to <https://developer.spotify.com/dashboard> → **Create app**. A Spotify Premium account is required for Development Mode apps.
2. Redirect URI: `http://127.0.0.1:8888/callback`
3. APIs: tick **Web API**.
4. Open the app's **Settings** and copy the **Client ID** and **Client Secret** into `.env`:
   ```
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   ```

The script tries Client Credentials first. If Spotify answers 403, it falls back to a one-time browser login (Authorization Code + PKCE) and caches the refresh token in `data/cache/`.

It enriches only what the UI shows: top 100 tracks and artists, top 50 albums, top 20 shows per year, and every track a slide mentions. It uses single-item endpoints and limit-10 searches, waits on 429s, and caches every response in `data/cache/spotify.json`, so **re-runs make zero API calls**. As of 2026, new apps usually get no artist genres, so genre slides hide themselves.

### 3. Build the stats and run

```sh
npm run build:data      # data/raw -> src/generated/*.json (+ enrichment if keys exist)
npm run dev             # open the printed URL
```

## Adding the Extended streaming history later

When Spotify emails the lifetime export, unzip it anywhere under `data/raw/` (e.g. `data/raw/Spotify Extended Streaming History/Streaming_History_Audio_*.json`) and re-run `npm run build:data`.

- Overlapping rows from both exports are deduplicated, keeping the extended rows (same item, end times within ~90s).
- New years appear in the year picker, and the "All time" scope expands.
- Extended-only stats switch on: shuffle %, real skips, devices, countries, offline %, private sessions, how songs started.
- Year-over-year compare gets real multi-year comparisons.

## Commands

| Command | What it does |
|---|---|
| `npm run build:data` | Build stats from `data/raw/`, enriching via the API if keys are in `.env` |
| `npm run build:data:offline` | Same, but no API calls (still uses the cache) |
| `node scripts/build-data.js --raw fixtures` | Build a demo from the fake fixtures (overwrites `src/generated/`) |
| `npm run dev` | Start the app |
| `npm test` | Run the Vitest suites (fixtures only, no network) |
| `npm run build` | Production build into `dist/` (contains your stats: keep it private) |

## How it works

```
data/raw/*.json ─► adapters (account | extended) ─► one Play shape, America/New_York local time
   ─► dedup ─► album/URI fill from library + playlists ─► per-year + all-time aggregation
   ─► Spotify enrichment (cache-first) ─► src/generated/{index,stats-<year>,stats-all,lookup,art}.json
   ─► React app reads the JSON (no heavy work in the browser)
```

- A **stream** is a play of 30 seconds or more. Total minutes count all playback.
- Account-data skips are inferred (plays under 30s). Extended data uses Spotify's real `skipped` / `reason_end`.
- A year only gets its own Wrapped if its data spans at least 6 months (183 days, first to last listening day; `MIN_YEAR_SPAN_DAYS` in `scripts/lib/config.js`). Shorter years are hidden but still count toward All time, search history and first-played dates.
- Year-over-year appears only once two or more years pass that rule (e.g. after adding the extended history).
- Shown years that are still partial are labeled (e.g. "Data runs through Nov 23"), and year-over-year shows minutes per covered day.
- "Top X% of listeners" is a playful, made-up number and is labeled that way in the app.

Story controls: tap the right side or press →/Space for next, tap the left side or press ← for back, hold to pause, **P** pause/resume, **Esc** close. Slide length is set under *Settings & data* on the start page. `?slide=N` (e.g. `/?slide=5#/story/2026`) opens a specific slide, paused.

Respects `prefers-reduced-motion`.
