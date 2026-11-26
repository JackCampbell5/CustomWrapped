import fs from 'node:fs';
import path from 'node:path';

/** Streaming-history candidates by filename; format is then confirmed from content. */
const STREAMING_NAME = /history|endsong/i;

/** Bonus files we read. Anything else in data/raw (Identity, Payments, messages...) is never opened. */
const BONUS = {
  library: /^YourLibrary\.json$/i,
  playlist: /^Playlist\d*\.json$/i,
  searches: /^SearchQueries\.json$/i,
  inferences: /^Inferences\.json$/i,
  marquee: /^Marquee\.json$/i,
};

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.isFile() ? [p] : [];
  });
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
}

/**
 * Find and read everything the pipeline needs under `rawDir`.
 * @returns {{ streaming: {file: string, rows: any[]}[], library?: any, playlists: any[], searches?: any[], inferences?: any, marquee?: any[], errors: string[] }}
 */
export function loadRaw(rawDir) {
  const out = { streaming: [], playlistFiles: [], errors: [] };
  const files = walk(rawDir).filter((f) => f.toLowerCase().endsWith('.json'));
  for (const file of files) {
    const base = path.basename(file);
    const rel = path.relative(rawDir, file);
    try {
      if (STREAMING_NAME.test(base)) {
        const rows = readJson(file);
        if (Array.isArray(rows)) out.streaming.push({ file: rel, rows });
      } else if (BONUS.library.test(base)) out.library = readJson(file);
      else if (BONUS.playlist.test(base)) out.playlistFiles.push(readJson(file));
      else if (BONUS.searches.test(base)) out.searches = readJson(file);
      else if (BONUS.inferences.test(base)) out.inferences = readJson(file);
      else if (BONUS.marquee.test(base)) out.marquee = readJson(file);
    } catch (e) {
      out.errors.push(`${rel}: ${e.message}`);
    }
  }
  out.streaming.sort((a, b) => a.file.localeCompare(b.file));
  return out;
}
