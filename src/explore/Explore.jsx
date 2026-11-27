import { useState } from 'react';
import { Art } from '../components/Art.jsx';
import { useJson } from '../data/load.js';
import * as f from '../lib/format.js';
import { navigate } from '../lib/route.js';
import { PERSONAS } from '../story/slides.jsx';
import { CalendarHeatmap, HBarList, HourHeatmap, MonthlyChart, SeqLegend } from './charts.jsx';
import Compare from './Compare.jsx';
import Search from './Search.jsx';
import { PODCAST } from './theme.js';
import TopTable from './TopTable.jsx';
import { Card, Empty, Section, Segmented, StatTile, TipLayer } from './ui.jsx';

export default function Explore({ index, scopeId }) {
  const { data: s } = useJson(`stats-${scopeId}`);
  const [mode, setMode] = useState('music');
  const [picked, setPicked] = useState(null);

  const pick = (x, kind) => {
    if (kind === 'albums') return;
    setPicked({ kind, key: x.key, name: x.name, t: Date.now() });
    document.getElementById('lookup')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <TipLayer>
      <div className="min-h-full bg-[#0b0b0b] font-sans text-[#efefef]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0b0b]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <button onClick={() => navigate('home')} className="rounded-full px-2 py-1 text-[#9c9c9c] hover:text-[#efefef]" aria-label="Back to start">
              ←
            </button>
            <h1 className="mr-auto font-display text-xl font-extrabold tracking-tight">Jack's Wrapped · Explore</h1>
            <Segmented label="Year" options={index.scopes.map((x) => [x.id, f.scopeLabel(x.id)])} value={scopeId} onChange={(id) => navigate('explore', id)} />
            <Segmented
              label="Content"
              options={[
                ['music', 'Music'],
                ['podcasts', 'Podcasts'],
              ]}
              value={mode}
              onChange={setMode}
            />
            <button onClick={() => navigate('story', scopeId)} className="rounded-full bg-[#efefef] px-4 py-1.5 text-sm font-bold text-black hover:bg-white">
              ▶ Story
            </button>
          </div>
        </header>

        {!s ? (
          <p className="p-10 text-center text-[#9c9c9c]">Loading…</p>
        ) : (
          <main className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-8 sm:px-6">
            <p className={`-mb-8 text-sm ${s.coverage?.partial ? 'text-[#d28e05]' : 'text-[#9c9c9c]'}`}>
              {f.coverageNote(s.coverage, s.scope)} · times in {index.timeZone.replace('_', ' ')}
            </p>
            {mode === 'music' ? <MusicView s={s} index={index} onPick={pick} /> : <PodcastView s={s} onPick={pick} />}

            <Section id="lookup" title="Look anything up" subtitle="Your personal history with any artist, song or podcast.">
              <Search picked={picked} />
            </Section>

            {index.canCompare && (
              <Section id="compare" title="Year vs. year" subtitle="Rank changes, minutes and habit shifts between any two years.">
                <Compare index={index} />
              </Section>
            )}

            <Bonus s={s} index={index} />
            <footer className="pb-10 text-xs text-[#9c9c9c]">
              Built {new Date(index.generatedAt).toLocaleString()} from your Spotify export. Nothing here leaves your computer.
            </footer>
          </main>
        )}
      </div>
    </TipLayer>
  );
}

function years(s) {
  if (s.year) return [s.year];
  const ys = new Set(Object.keys(s.habits.calendar).map((d) => +d.slice(0, 4)));
  return [...ys].sort();
}

function MusicView({ s, index, onPick }) {
  const t = s.totals;
  const h = s.habits;
  const q = s.quirks;
  const e = s.enriched;
  return (
    <>
      <Section id="overview" title="Overview">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Minutes" value={f.int(t.minutes)} note={`${f.one(t.days)} days`} />
          <StatTile label="Streams" value={f.compact(t.streams)} note="plays of 30s or more" />
          <StatTile label="Artists" value={f.int(t.uniqueArtists)} />
          <StatTile label="Songs" value={f.int(t.uniqueTracks)} />
          <StatTile label="Active days" value={f.int(h.activeDays)} note={`${f.int(h.avgMinutesPerActiveDay)} min per day`} />
          <StatTile label="Skip rate" value={`${t.skipRatePct}%`} note={s.skipSource === 'inferred' ? 'plays under 30s' : 'reported skips'} />
        </div>
        {s.topArtist && (
          <Card className="mt-3">
            <div className="flex flex-wrap items-center gap-5">
              <Art kind="artists" item={s.topArtist} round className="h-24 w-24 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#9c9c9c]">#1 artist</p>
                <p className="text-3xl font-bold">{s.topArtist.name}</p>
                <p className="text-sm text-[#9c9c9c]">
                  {f.int(s.topArtist.minutes)} min · {s.topArtist.pctOfListening}% of listening · {f.int(s.topArtist.uniqueTracks)} songs · peak{' '}
                  {s.topArtist.peakMonth ? f.monthYear(s.topArtist.peakMonth.month) : '-'}
                  {s.topArtist.firstPlayEver ? ` · first played ${f.dateMed(s.topArtist.firstPlayEver.date)}` : ''}
                </p>
              </div>
              <p className="max-w-xs text-sm text-[#9c9c9c]">
                Playful estimate: top {s.funPercentile}% of listeners overall, top {s.topArtist.funPercentile}% of {s.topArtist.name} fans. <em>Made-up math, not Spotify data.</em>
              </p>
            </div>
          </Card>
        )}
      </Section>

      <Section id="time" title="Listening over time" subtitle="Minutes per month, music and podcasts.">
        <Card>
          <MonthlyChart rows={h.byMonth} mode="both" />
        </Card>
        <div className="mt-3 flex flex-col gap-3">
          {years(s).map((y) => (
            <Card key={y} title={`Every day of ${y}`} subtitle="Music minutes per day">
              <CalendarHeatmap year={y} calendar={h.calendar} mode="music" />
              <SeqLegend />
            </Card>
          ))}
        </div>
      </Section>

      <Section id="habits" title="Habits">
        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <Card title="When you listen" subtitle="Music minutes by day and hour">
            <HourHeatmap grid={h.heatmap} />
          </Card>
          <Card title={PERSONAS[h.persona.peak]?.name ?? 'Persona'} subtitle={`Center of your listening day: ${f.clock(`${String(Math.floor(h.persona.centerHour % 24)).padStart(2, '0')}:${String(Math.round((h.persona.centerHour % 1) * 60) % 60).padStart(2, '0')}`)}`}>
            <HBarList
              items={Object.entries(h.persona.shares).map(([k, v]) => ({ label: k[0].toUpperCase() + k.slice(1), value: v }))}
              format={(v) => `${v}%`}
            />
            {h.weekdayVsWeekend && (
              <p className="mt-4 text-sm text-[#9c9c9c]">
                {f.int(h.weekdayVsWeekend.weekdayAvgMinutes)} min per weekday vs {f.int(h.weekdayVsWeekend.weekendAvgMinutes)} per weekend day.
              </p>
            )}
          </Card>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {h.busiestDay && <StatTile label="Busiest day" value={`${f.int(h.busiestDay.minutes)} min`} note={f.dateMed(h.busiestDay.date)} />}
          {h.longestStreak && <StatTile label="Longest streak" value={`${h.longestStreak.days} days`} note={`${f.dateShort(h.longestStreak.start)} – ${f.dateShortYear(h.longestStreak.end)}`} />}
          {h.longestSession && <StatTile label="Longest session" value={f.duration(h.longestSession.minutes)} note={`${f.dateMed(h.longestSession.date)}${h.longestSession.topArtistOrShow ? ` · ${h.longestSession.topArtistOrShow}` : ''}`} />}
          {h.avgSessionMinutes && <StatTile label="Average session" value={`${f.int(h.avgSessionMinutes)} min`} note={`${f.int(h.sessionCount)} sessions`} />}
        </div>
      </Section>

      <Section id="top" title="Top lists" subtitle="Top 50. Click a row to see its history.">
        <TopTable top={s.top} mode="music" onPick={onPick} />
      </Section>

      <Section id="quirks" title="Deep cuts & quirks">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <QuirkList title="Most skipped" items={q.mostSkipped} value={(x) => `${x.skips} skips · ${x.skipRatePct}%`} />
          <QuirkList title="Obsessions" subtitle="Most plays in a single day" items={q.obsessions} value={(x) => `${x.plays}× · ${f.dateShortYear(x.date)}`} />
          <QuirkList title="On repeat" subtitle="Same song back to back" items={q.onRepeat} value={(x) => `${x.run} in a row`} />
          <QuirkList title="Binged, then abandoned" items={q.bingedAbandoned} value={(x) => `${x.peakPlays} in 2 wks · last ${f.dateShort(x.lastPlayed)}`} />
          <QuirkList title="Longest-loved" subtitle="Biggest gap between first and last play" items={q.longestLoved} value={(x) => `${f.int(x.spanDays)} days`} />
          <QuirkList title="One-song artists" items={q.oneHitArtists.map((x) => ({ name: x.track, artist: x.artist, uri: x.uri, plays: x.plays }))} value={(x) => `${x.plays} plays`} />
          <QuirkList title="Loyal artists" subtitle="Months in your monthly top 5" items={q.loyalArtists} kind="artists" value={(x) => `${x.months} of ${x.monthsWithData}`} />
          {q.discoveries && (
            <QuirkList
              title="New discoveries"
              subtitle={q.discoveries.limitedHistory ? `Top-50 artists first played this year (data starts ${f.dateShortYear(q.discoveries.historyStarts)})` : 'Top-50 artists first played this year'}
              items={q.discoveries.artists}
              kind="artists"
              value={(x) => `#${x.rank}`}
            />
          )}
          <Card title="Night & morning">
            {[
              ['Latest night', q.latestNight],
              ['Earliest start', q.earliestMorning],
            ]
              .filter(([, m]) => m)
              .map(([label, m]) => (
                <div key={label} className="mb-3">
                  <p className="text-sm text-[#9c9c9c]">{label}</p>
                  <p className="text-2xl font-semibold">{f.clock(m.time)}</p>
                  <p className="truncate text-sm">
                    {m.name} <span className="text-[#9c9c9c]">· {m.artist ?? m.show} · {f.dateShortYear(m.date)}</span>
                  </p>
                </div>
              ))}
          </Card>
        </div>
        <Card title="Soundtrack of the year" subtitle="Each month's most-played song" className="mt-3">
          <ol className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {q.soundtrack
              .filter((m) => m.track)
              .map((m) => (
                <li key={m.month} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm text-[#9c9c9c]">{f.monthYear(m.month)}</span>
                  <Art kind="tracks" item={m.track} small className="h-9 w-9 shrink-0 rounded" />
                  <span className="min-w-0 text-sm">
                    <span className="block truncate">{m.track.name}</span>
                    <span className="block truncate text-xs text-[#9c9c9c]">{m.track.artist}</span>
                  </span>
                </li>
              ))}
          </ol>
        </Card>
      </Section>

      <Section id="sound" title="Your sound" subtitle={e ? 'From Spotify metadata for your top songs and artists.' : undefined}>
        {!e ? (
          <Empty>Add Spotify API keys and re-run npm run build:data to unlock release years, explicit share and track lengths.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {e.decades && (
              <Card title="Release decades" subtitle={`Average release year ${e.decades.avgReleaseYear} · covers ${e.decades.coveragePct}% of listening`}>
                <HBarList items={e.decades.list.map((d) => ({ label: d.decade, value: d.pct }))} format={(v) => `${v}%`} />
                {e.decades.oldest && <p className="mt-3 text-sm text-[#9c9c9c]">Oldest favorite: {e.decades.oldest.name} ({e.decades.oldest.year})</p>}
              </Card>
            )}
            <div className="grid gap-3">
              {e.explicit && <StatTile label="Explicit" value={`${e.explicit.pct}%`} note={`of listening with known ratings (${e.explicit.coveragePct}% coverage)`} />}
              {e.avgTrackLengthMin && <StatTile label="Average song length" value={`${Math.floor(e.avgTrackLengthMin)}:${String(Math.round((e.avgTrackLengthMin % 1) * 60)).padStart(2, '0')}`} />}
            </div>
            <Card title="Genres">
              {e.genres ? (
                <HBarList items={e.genres.top.map((g) => ({ label: g.name, value: g.pct }))} format={(v) => `${v}%`} />
              ) : (
                <p className="text-sm text-[#9c9c9c]">Spotify didn't return genres for your artists (common for new developer apps since the 2026 API changes).</p>
              )}
            </Card>
          </div>
        )}
      </Section>

      <Extended s={s} index={index} />
    </>
  );
}

function QuirkList({ title, subtitle, items, value, kind = 'tracks' }) {
  return (
    <Card title={title} subtitle={subtitle}>
      {!items?.length ? (
        <p className="text-sm text-[#9c9c9c]">Nothing yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.slice(0, 5).map((x, i) => (
            <li key={`${x.name}-${i}`} className="flex items-center gap-3">
              <Art kind={kind} item={x} small round={kind === 'artists'} className="h-9 w-9 shrink-0 rounded" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate">{x.name}</span>
                {x.artist && <span className="block truncate text-xs text-[#9c9c9c]">{x.artist}</span>}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-[#9c9c9c]">{value(x)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Extended({ s, index }) {
  const ex = s.extended;
  return (
    <Section id="extended" title="How you listen" subtitle="Devices, shuffle, skips and more from the extended streaming history.">
      {!ex ? (
        <Empty>
          {index.hasExtended
            ? 'No extended-history rows in this period.'
            : 'Request your Extended streaming history from Spotify, drop the files in data/raw/ and re-run npm run build:data to unlock shuffle, devices, countries and more.'}
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {ex.shufflePct != null && <StatTile label="On shuffle" value={`${ex.shufflePct}%`} />}
          <StatTile label="Skip rate" value={`${ex.skipRatePct}%`} note="reported skips" />
          {ex.offlinePct != null && <StatTile label="Offline" value={`${ex.offlinePct}%`} />}
          <StatTile label="Private session plays" value={f.int(ex.incognitoCount)} />
          <Card title="Devices" subtitle="Minutes and skip rate by platform" className="md:col-span-2">
            <HBarList items={ex.platforms.slice(0, 8).map((p) => ({ label: `${p.name} (${p.skipRatePct}% skips)`, value: p.minutes }))} format={(v) => `${f.int(v)} min`} />
          </Card>
          <Card title="Countries">
            <HBarList items={ex.countries.slice(0, 8).map((c) => ({ label: c.name, value: c.minutes }))} format={(v) => `${f.int(v)} min`} />
          </Card>
          <Card title="How songs started">
            <HBarList items={ex.reasonStart.slice(0, 6).map((r) => ({ label: r.name, value: r.pct }))} format={(v) => `${v}%`} />
          </Card>
        </div>
      )}
    </Section>
  );
}

function PodcastView({ s, onPick }) {
  const p = s.podcasts;
  if (!p) return <Empty>No podcast listening in this period.</Empty>;
  return (
    <>
      <Section id="overview" title="Podcasts">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Hours" value={f.int(p.hours)} />
          <StatTile label="Episodes played" value={f.int(p.streams)} note="30s or more" />
          <StatTile label="Shows" value={f.int(p.uniqueShows)} />
          <StatTile label="Unique episodes" value={f.int(p.uniqueEpisodes)} />
        </div>
      </Section>
      <Section id="time" title="Podcasts vs. music" subtitle="Minutes per month">
        <Card>
          <MonthlyChart rows={s.habits.byMonth} mode="both" />
        </Card>
        {years(s).map((y) => (
          <Card key={y} title={`Every day of ${y}`} subtitle="Podcast minutes per day" className="mt-3">
            <CalendarHeatmap year={y} calendar={s.habits.calendar} mode="podcasts" />
            <SeqLegend />
          </Card>
        ))}
      </Section>
      <Section id="top" title="Top shows">
        <TopTable top={s.top} shows={p.topShows} mode="podcasts" onPick={onPick} />
      </Section>
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Top episodes">
          <ol className="flex flex-col gap-2">
            {p.topEpisodes.slice(0, 10).map((x, i) => (
              <li key={x.key} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-right text-[#9c9c9c] tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{x.name}</span>
                  <span className="block truncate text-xs text-[#9c9c9c]">{x.show}</span>
                </span>
                <span className="tabular-nums text-[#9c9c9c]">{f.int(x.minutes)} min</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Podcast time of day" subtitle={`Peak hour: ${f.hourLabel(p.peakHour)}`}>
          <HBarList
            color={PODCAST}
            items={p.byHour.map((v, h) => ({ label: f.hourLabel(h), value: v })).filter((x, h) => h % 2 === 0 || x.value > 0).slice(0, 24)}
            format={(v) => `${f.int(v)} min`}
          />
        </Card>
        <Card title="Binge days" subtitle="Most episodes of one show in a day">
          {p.binges.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {p.binges.map((b) => (
                <li key={`${b.date}-${b.show}`} className="flex justify-between gap-3">
                  <span className="truncate">
                    {b.show} <span className="text-[#9c9c9c]">· {f.dateShortYear(b.date)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[#9c9c9c]">
                    {b.episodes} eps · {f.int(b.minutes)} min
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#9c9c9c]">No binges yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function Bonus({ s, index }) {
  const b = index.bonus ?? {};
  const sr = s.bonus?.searches;
  const pl = s.bonus?.playlists;
  return (
    <Section id="bonus" title="From your data export">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {b.library && <StatTile label="Liked songs" value={f.int(b.library.tracks)} note={`${f.int(b.library.albums)} saved albums · ${f.int(b.library.shows)} shows`} />}
        {pl && <StatTile label="Playlists created" value={f.int(pl.created)} note={`${f.int(pl.tracksAdded)} songs added`} />}
        {b.playlists && <StatTile label="Playlists in your account" value={f.int(b.playlists.count)} note={`${f.int(b.playlists.totalItems)} songs total`} />}
        {sr && <StatTile label="Searches" value={f.int(sr.count)} />}
        {sr?.topQueries?.length > 0 && (
          <Card title="Top searches" className="md:col-span-2">
            <HBarList items={sr.topQueries.map((x) => ({ label: `“${x.query}”`, value: x.count }))} format={(v) => `${v}×`} />
          </Card>
        )}
        {b.playlists?.mostAddedTracks?.length > 0 && (
          <Card title="On the most playlists" className="md:col-span-2">
            <HBarList items={b.playlists.mostAddedTracks.slice(0, 8).map((x) => ({ label: x.name, value: x.playlists }))} format={(v) => `${v} playlists`} />
          </Card>
        )}
        {b.inferences && (
          <Card title="What advertisers think you're into" subtitle={`${f.int(b.inferences.readable)} readable of ${f.int(b.inferences.count)} ad segments in your export`} className="md:col-span-2 lg:col-span-4">
            <InferenceChips labels={b.inferences.labels} />
          </Card>
        )}
      </div>
    </Section>
  );
}

function InferenceChips({ labels }) {
  const [all, setAll] = useState(false);
  const shown = all ? labels : labels.slice(0, 40);
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {shown.map((l) => (
          <li key={l} className="rounded-full border border-white/10 px-3 py-1 text-sm text-[#efefef]">
            {l}
          </li>
        ))}
      </ul>
      {labels.length > 40 && (
        <button onClick={() => setAll((x) => !x)} className="mt-3 text-sm text-[#338ced] hover:underline">
          {all ? 'Show fewer' : `Show all ${labels.length}`}
        </button>
      )}
    </>
  );
}
