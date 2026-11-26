// Story deck. buildSlides() returns only slides whose data exists, each with its own palette.
import { Art } from '../components/Art.jsx';
import * as f from '../lib/format.js';
import { Big, CountUp, fitSize, Footnote, Kicker, M, Pill, RankList, Stagger, Sub, Title } from './primitives.jsx';
import { Heatmap, MonthBars, ShareBars } from './charts.jsx';
import { PALETTES } from './palettes.js';

export const PERSONAS = {
  morning: { name: 'The Early Riser', blurb: 'Your soundtrack starts before most people find their coffee.' },
  afternoon: { name: 'The Afternoon Cruiser', blurb: 'Peak listening hits when the day is in full swing.' },
  evening: { name: 'The Golden-Hour Romantic', blurb: 'Sunset is when the volume goes up.' },
  night: { name: 'The Night Owl', blurb: 'The best songs come out after dark. You know this.' },
};
const BUCKET_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };

/** Stable pseudo-random pick so the same year shows the same "random" items. */
function seeded(list, n, seed) {
  const out = [...list];
  let x = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}

/**
 * @param {any} s      stats-<scope>.json
 * @param {any} index  index.json
 * @param {{ onReplay: () => void, onExplore: () => void }} actions
 */
export function buildSlides(s, index, actions) {
  const slides = [];
  const add = (id, label, C, when = true) => when && slides.push({ id, label, C });
  const isAll = s.scope === 'all';
  const yr = isAll ? 'all time' : s.year;
  const inYr = isAll ? 'of all time' : `in ${s.year}`;
  const t = s.totals;
  const topA = s.top.artists.byMinutes;
  const topT = s.top.tracks.byPlays;
  const ta = s.topArtist;
  const h = s.habits;
  const q = s.quirks;
  const e = s.enriched;
  const pod = s.podcasts;

  // 1. Intro
  add('intro', `Jack's Wrapped ${yr}`, () => (
    <Stagger className="flex h-full flex-col justify-between">
      <M>
        <Kicker>Jack's Wrapped</Kicker>
      </M>
      <div>
        <M v="pop">
          <Big size={isAll ? '27cqw' : '36cqw'}>{isAll ? <>All<br />time</> : s.year}</Big>
        </M>
        <M>
          <Sub className="mt-[5cqw] max-w-[80%]">Your {isAll ? 'whole listening history' : 'year'} in sound. Tap to skip ahead, hold to pause.</Sub>
        </M>
      </div>
      <M>
        <Pill>{f.coverageNote(s.coverage, s.scope)}</Pill>
      </M>
    </Stagger>
  ));

  // 2. Minutes
  add('minutes', 'Minutes listened', () => (
    <Stagger className="flex h-full flex-col justify-center gap-[5cqw]">
      <M>
        <Kicker>{isAll ? 'All told, you listened for' : `In ${s.year} you listened for`}</Kicker>
      </M>
      <M v="pop">
        <Big size={fitSize(f.int(t.minutes), 30)}>
          <CountUp value={Math.round(t.minutes)} />
        </Big>
      </M>
      <M>
        <Title size="12cqw">minutes</Title>
      </M>
      <M>
        <Sub>
          That's {f.one(t.days)} days of music, across {f.int(t.streams)} streams
          {t.podcastMinutes > 60 ? `, plus ${f.int(t.podcastMinutes / 60)} hours of podcasts` : ''}.
        </Sub>
      </M>
    </Stagger>
  ));

  // 3. Fun percentile (made up)
  add('fun', 'Playful listener ranking', () => (
    <Stagger className="flex h-full flex-col justify-center gap-[4cqw]">
      <M>
        <Kicker>By our very scientific estimate</Kicker>
      </M>
      <M v="pop">
        <Big size="28cqw">Top {s.funPercentile}%*</Big>
      </M>
      <M>
        <Title size="9cqw">of listeners on the planet</Title>
      </M>
      <M className="mt-[8cqw]">
        <Footnote>*Not real Spotify data. We just did some math on your minutes and felt generous.</Footnote>
      </M>
    </Stagger>
  ));

  // 4. Variety
  add('variety', 'How many different songs and artists', () => (
    <Stagger className="flex h-full flex-col justify-center gap-[7cqw]">
      <M>
        <Kicker>You kept it interesting</Kicker>
      </M>
      {[
        [t.uniqueTracks, 'different songs'],
        [t.uniqueArtists, 'different artists'],
        [t.uniqueAlbums, 'different albums'],
      ]
        .filter(([n]) => n)
        .map(([n, label]) => (
          <M key={label}>
            <Big size="19cqw">
              <CountUp value={n} />
            </Big>
            <Sub className="mt-[1cqw] text-[6cqw]">{label}</Sub>
          </M>
        ))}
    </Stagger>
  ));

  // 5. #1 artist
  add(
    'top-artist',
    `Top artist: ${ta?.name}`,
    () => (
      <Stagger className="flex h-full flex-col justify-between">
        <M>
          <Kicker>Your #1 artist {inYr}</Kicker>
        </M>
        <M v="pop" className="self-center">
          <Art kind="artists" item={ta} round className="aspect-square w-[64cqw] shadow-[0_6cqw_14cqw_-4cqw_rgba(0,0,0,.55)]" />
        </M>
        <div>
          <M>
            <Title size={fitSize(ta.name, 15, 8)}>{ta.name}</Title>
          </M>
          <M>
            <Sub className="mt-[2cqw]">
              <CountUp value={Math.round(ta.minutes)} /> minutes · {ta.pctOfListening}% of everything you played
            </Sub>
          </M>
        </div>
      </Stagger>
    ),
    Boolean(ta),
  );

  // 6. Deep dive
  add(
    'artist-story',
    `${ta?.name} deep dive`,
    () => (
      <Stagger className="flex h-full flex-col gap-[5cqw]">
        <M>
          <Kicker>A {ta.name} love story</Kicker>
        </M>
        {ta.firstPlayEver && (
          <M>
            <p className="text-[4cqw] font-bold opacity-75">It started on</p>
            <Title size="8.5cqw">{f.dateMed(ta.firstPlayEver.date)}</Title>
            <Sub>with “{ta.firstPlayEver.track}”</Sub>
          </M>
        )}
        {ta.peakMonth && (
          <M>
            <p className="text-[4cqw] font-bold opacity-75">You couldn't get enough in</p>
            <Title size="8.5cqw">{f.monthName(ta.peakMonth.month)}</Title>
            <Sub>{f.int(ta.peakMonth.minutes)} minutes that month alone</Sub>
          </M>
        )}
        <M>
          <p className="mb-[2cqw] text-[4cqw] font-bold opacity-75">
            Your top songs out of {f.int(ta.uniqueTracks)} you played
          </p>
        </M>
        <RankList items={ta.topTracks.slice(0, 3)} kind="tracks" value={(x) => `${f.int(x.plays)} plays`} />
      </Stagger>
    ),
    Boolean(ta?.topTracks?.length),
  );

  // 7. Top artists
  add(
    'top-artists',
    'Top 5 artists',
    () => (
      <Stagger className="flex h-full flex-col gap-[5cqw]">
        <M>
          <Kicker>Your top artists</Kicker>
          <Title size="11cqw" className="mt-[2cqw]">
            The {Math.min(5, topA.length) === 5 ? 'Fab Five' : 'headliners'}
          </Title>
        </M>
        <RankList items={topA.slice(0, 5)} kind="artists" round value={(x) => `${f.compact(x.minutes)} min`} />
      </Stagger>
    ),
    topA.length >= 2,
  );

  // 8. #1 song
  const song = topT[0];
  add(
    'top-song',
    `Top song: ${song?.name}`,
    () => (
      <Stagger className="flex h-full flex-col justify-between">
        <M>
          <Kicker>Your song of {isAll ? 'all time' : 'the year'}</Kicker>
        </M>
        <M v="pop" className="self-center">
          <Art kind="tracks" item={song} className="aspect-square w-[68cqw] rounded-[2cqw] shadow-[0_6cqw_14cqw_-4cqw_rgba(0,0,0,.55)]" />
        </M>
        <div>
          <M>
            <Title size={fitSize(song.name, 14, 7.5)}>{song.name}</Title>
            <Sub className="mt-[1cqw]">{song.artist}</Sub>
          </M>
          <M>
            <Sub className="mt-[3cqw] text-[5.5cqw] font-black">
              <CountUp value={song.plays} /> plays · {f.int(song.minutes)} minutes
            </Sub>
          </M>
        </div>
      </Stagger>
    ),
    Boolean(song),
  );

  // 9. Top songs
  add(
    'top-songs',
    'Top 5 songs',
    () => (
      <Stagger className="flex h-full flex-col gap-[5cqw]">
        <M>
          <Kicker>Your top songs</Kicker>
          <Title size="11cqw" className="mt-[2cqw]">
            On repeat, all {isAll ? 'the time' : 'year'}
          </Title>
        </M>
        <RankList items={topT.slice(0, 5)} kind="tracks" sub={(x) => x.artist} value={(x) => `${f.int(x.plays)}×`} />
      </Stagger>
    ),
    topT.length >= 2,
  );

  // 10. Albums
  const albums = s.top.albums?.byMinutes ?? [];
  add(
    'albums',
    'Top albums',
    () => (
      <Stagger className="flex h-full flex-col gap-[5cqw]">
        <M>
          <Kicker>Albums on heavy rotation</Kicker>
        </M>
        <div className="grid grid-cols-2 gap-[3cqw]">
          {albums.slice(0, 4).map((a, i) => (
            <M key={a.key} v="pop" className="relative">
              <Art kind="albums" item={a} className="aspect-square w-full rounded-[2cqw] shadow-xl" />
              <span className="absolute left-[2cqw] top-[2cqw] grid h-[9cqw] w-[9cqw] place-items-center rounded-full bg-black/70 text-[4.6cqw] font-black text-white">
                {i + 1}
              </span>
            </M>
          ))}
        </div>
        <M>
          <Title size={fitSize(albums[0]?.name, 9, 6)}>{albums[0]?.name}</Title>
          <Sub>
            {albums[0]?.artist} · {f.int(albums[0]?.minutes)} minutes
          </Sub>
        </M>
      </Stagger>
    ),
    albums.length >= 4,
  );

  // 11. Months
  const months = isAll ? h.byMonth : h.byMonth.filter((r) => r.musicMinutes > 0 || (r.month >= s.coverage.first.slice(0, 7) && r.month <= s.coverage.last.slice(0, 7)));
  const peakM = months.reduce((a, r) => (r.musicMinutes > (a?.musicMinutes ?? -1) ? r : a), null);
  add(
    'months',
    'Listening by month',
    ({ palette }) => (
      <Stagger className="flex h-full flex-col justify-between">
        <div>
          <M>
            <Kicker>Month by month</Kicker>
          </M>
          <M>
            <Title size="11cqw" className="mt-[2cqw]">
              {isAll ? f.monthYear(peakM.month) : f.monthName(peakM.month)} was your peak
            </Title>
          </M>
          <M>
            <Sub className="mt-[2cqw]">{f.int(peakM.musicMinutes)} minutes in one month.</Sub>
          </M>
        </div>
        <M v="fade">
          <MonthBars rows={months} ink={palette.ink} />
        </M>
      </Stagger>
    ),
    months.length >= 2 && peakM?.musicMinutes > 0,
  );

  // 12. Soundtrack timeline
  const st = q.soundtrack.filter((m) => m.track).slice(-12);
  add(
    'soundtrack',
    'Soundtrack of the year',
    () => (
      <Stagger className="flex h-full flex-col gap-[3.4cqw]">
        <M>
          <Kicker>The soundtrack of your {isAll ? 'last 12 months' : 'year'}</Kicker>
        </M>
        <ol className="flex flex-col gap-[2.2cqw]">
          {st.map((m) => (
            <M key={m.month} v="slide">
              <li className="flex items-center gap-[2.6cqw]">
                <span className="w-[10cqw] shrink-0 text-[3.6cqw] font-black uppercase opacity-80">{f.monthName(m.month, 'short')}</span>
                <Art kind="tracks" item={m.track} small className="h-[8.5cqw] w-[8.5cqw] shrink-0 rounded-[1cqw]" />
                <p className="min-w-0 flex-1 truncate text-[3.8cqw] font-extrabold">
                  {m.track.name} <span className="font-semibold opacity-70">· {m.track.artist}</span>
                </p>
              </li>
            </M>
          ))}
        </ol>
      </Stagger>
    ),
    st.length >= 3,
  );

  // 13. Clock heatmap
  let peakCell = { d: 0, h: 0, v: -1 };
  h.heatmap.forEach((row, d) => row.forEach((v, hr) => v > peakCell.v && (peakCell = { d, h: hr, v })));
  add(
    'clock',
    'When you listen',
    ({ palette }) => (
      <Stagger className="flex h-full flex-col justify-between">
        <div>
          <M>
            <Kicker>When you press play</Kicker>
          </M>
          <M>
            <Title size="10.5cqw" className="mt-[2cqw]">
              {f.DAYS[peakCell.d]}s around {f.hourLabel(peakCell.h)}
            </Title>
          </M>
          <M>
            <Sub className="mt-[2cqw]">is your prime time. Each square is an hour of the week; brighter means more listening.</Sub>
          </M>
        </div>
        <M v="fade">
          <Heatmap grid={h.heatmap} ink={palette.ink} />
        </M>
      </Stagger>
    ),
    peakCell.v > 0,
  );

  // 14. Persona
  const persona = PERSONAS[h.persona?.peak];
  add(
    'persona',
    `Persona: ${persona?.name}`,
    ({ palette }) => (
      <Stagger className="flex h-full flex-col justify-center gap-[5cqw]">
        <M>
          <Kicker>Your listening persona</Kicker>
        </M>
        <M v="pop">
          <Title size="14cqw">{persona.name}</Title>
        </M>
        <M>
          <Sub>{persona.blurb}</Sub>
        </M>
        <M>
          <ShareBars
            ink={palette.ink}
            items={Object.entries(h.persona.shares).map(([k, pct]) => ({ label: BUCKET_LABEL[k], pct, highlight: k === h.persona.peak }))}
          />
        </M>
        {h.weekdayVsWeekend && (
          <M>
            <Footnote>
              {f.int(h.weekdayVsWeekend.weekdayAvgMinutes)} min on an average weekday vs {f.int(h.weekdayVsWeekend.weekendAvgMinutes)} on a weekend day.
            </Footnote>
          </M>
        )}
      </Stagger>
    ),
    Boolean(persona),
  );

  // 15. Busiest day
  const bd = h.busiestDay;
  add(
    'busiest-day',
    'Biggest listening day',
    () => (
      <Stagger className="flex h-full flex-col gap-[4.5cqw]">
        <M>
          <Kicker>Your biggest day</Kicker>
        </M>
        <M>
          <Title size="10cqw">{f.dateLong(bd.date)}</Title>
          {isAll && <Sub>{bd.date.slice(0, 4)}</Sub>}
        </M>
        <M v="pop">
          <Big size="22cqw">
            <CountUp value={Math.round(bd.minutes)} />
          </Big>
          <Sub>minutes in a single day. That's {f.one(bd.minutes / 60)} hours.</Sub>
        </M>
        <M>
          <p className="text-[4cqw] font-bold opacity-75">What was playing</p>
        </M>
        <RankList items={bd.topTracks.slice(0, 3)} kind="tracks" sub={(x) => x.artist} value={(x) => `${x.plays}×`} />
      </Stagger>
    ),
    Boolean(bd),
  );

  // 16. Streak + sessions
  const ls = h.longestSession;
  add(
    'streak',
    'Streak and sessions',
    () => (
      <Stagger className="flex h-full flex-col justify-center gap-[6cqw]">
        <M>
          <Kicker>Commitment issues? Never heard of them</Kicker>
        </M>
        <M v="pop">
          <Big size="30cqw">
            <CountUp value={h.longestStreak.days} />
          </Big>
          <Title size="9cqw">day listening streak</Title>
          <Sub className="mt-[1.5cqw]">
            {f.dateShortYear(h.longestStreak.start)} → {f.dateShortYear(h.longestStreak.end)}
          </Sub>
        </M>
        {ls && (
          <M>
            <p className="text-[4cqw] font-bold opacity-75">Longest session</p>
            <Title size="8.5cqw">{f.duration(ls.minutes)} straight</Title>
            <Sub>
              on {f.dateMed(ls.date)}
              {ls.topArtistOrShow ? `, mostly ${ls.topArtistOrShow}` : ''}.
            </Sub>
          </M>
        )}
        {h.avgSessionMinutes && (
          <M>
            <Footnote>Your average session runs {f.int(h.avgSessionMinutes)} minutes.</Footnote>
          </M>
        )}
      </Stagger>
    ),
    Boolean(h.longestStreak?.days > 1),
  );

  // 17. Obsession
  const ob = q.obsessions[0];
  add(
    'obsession',
    'Most plays in one day',
    () => (
      <Stagger className="flex h-full flex-col justify-between">
        <M>
          <Kicker>Certified obsession</Kicker>
        </M>
        <div className="flex items-end gap-[4cqw]">
          <M v="pop">
            <Big size="34cqw">{ob.plays}×</Big>
          </M>
          <M>
            <Sub className="pb-[3cqw]">
              in one day
              <br />({f.dateShortYear(ob.date)})
            </Sub>
          </M>
        </div>
        <M className="flex items-center gap-[4cqw]">
          <Art kind="tracks" item={ob} className="h-[30cqw] w-[30cqw] shrink-0 rounded-[2cqw] shadow-xl" />
          <div className="min-w-0">
            <Title size={fitSize(ob.name, 9, 6)}>{ob.name}</Title>
            <Sub>{ob.artist}</Sub>
          </div>
        </M>
        {q.obsessions.length > 1 && (
          <M>
            <Footnote>
              Runners-up: {q.obsessions.slice(1, 3).map((o) => `${o.name} (${o.plays}× on ${f.dateShort(o.date)})`).join(', ')}
            </Footnote>
          </M>
        )}
      </Stagger>
    ),
    Boolean(ob && ob.plays >= 3),
  );

  // 18. On repeat (back-to-back)
  const rep = q.onRepeat[0];
  add(
    'on-repeat',
    'Back-to-back repeats',
    () => (
      <Stagger className="flex h-full flex-col justify-center gap-[5cqw]">
        <M>
          <Kicker>Back to back to back</Kicker>
        </M>
        <M v="pop">
          <Big size="40cqw">{rep.run}×</Big>
        </M>
        <M>
          <Title size="9cqw">in a row. No skips.</Title>
        </M>
        <M className="flex items-center gap-[4cqw]">
          <Art kind="tracks" item={rep} small className="h-[18cqw] w-[18cqw] shrink-0 rounded-[1.6cqw]" />
          <div className="min-w-0">
            <p className="truncate text-[5.5cqw] font-black">{rep.name}</p>
            <Sub>
              {rep.artist} · {f.dateShortYear(rep.date)}
            </Sub>
          </div>
        </M>
      </Stagger>
    ),
    Boolean(rep && rep.run >= 3),
  );

  // 19. Most skipped
  const sk = q.mostSkipped[0];
  add(
    'skipped',
    'Most skipped song',
    () => (
      <Stagger className="flex h-full flex-col justify-center gap-[5cqw]">
        <M>
          <Kicker>We need to talk about…</Kicker>
        </M>
        <M v="pop">
          <Art kind="tracks" item={sk} className="aspect-square w-[46cqw] rotate-[-4deg] rounded-[2cqw] shadow-2xl grayscale-[35%]" />
        </M>
        <M>
          <Title size={fitSize(sk.name, 11, 7)}>{sk.name}</Title>
          <Sub>{sk.artist}</Sub>
        </M>
        <M>
          <Sub className="text-[5.4cqw] font-black">
            You skipped it {f.int(sk.skips)} times. That's {sk.skipRatePct}% of the times it came on.
          </Sub>
        </M>
        {s.skipSource === 'inferred' && (
          <M>
            <Footnote>Skips = plays under 30 seconds.</Footnote>
          </M>
        )}
      </Stagger>
    ),
    Boolean(sk && sk.skips >= 5),
  );

  // 20. Night & morning
  const late = q.latestNight;
  const early = q.earliestMorning;
  const Moment = ({ label, m }) => (
    <M className="rounded-[4cqw] bg-black/15 p-[5cqw] backdrop-blur-sm">
      <p className="text-[3.6cqw] font-extrabold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <Big size="15cqw" className="mt-[1.5cqw]">
        {f.clock(m.time)}
      </Big>
      <p className="mt-[2cqw] truncate text-[4.4cqw] font-extrabold">{m.name}</p>
      <p className="truncate text-[3.6cqw] font-semibold opacity-75">
        {m.artist ?? m.show} · {f.dateShortYear(m.date)}
      </p>
    </M>
  );
  add(
    'night-morning',
    'Latest night and earliest morning',
    () => (
      <Stagger className="flex h-full flex-col justify-center gap-[5cqw]">
        <M>
          <Kicker>Burning the candle at both ends</Kicker>
        </M>
        {late && <Moment label="Latest night" m={late} />}
        {early && <Moment label="Earliest start" m={early} />}
      </Stagger>
    ),
    Boolean(late || early),
  );

  // 21. Discoveries
  const disc = q.discoveries;
  add(
    'discoveries',
    'New discoveries',
    () => (
      <Stagger className="flex h-full flex-col gap-[4.5cqw]">
        <M>
          <Kicker>Fresh finds</Kicker>
        </M>
        <M v="pop">
          <Big size="30cqw">{disc.count}</Big>
          <Sub>artists in your top 50 that you'd never played before {s.year}.</Sub>
        </M>
        <RankList items={disc.artists.slice(0, 4)} kind="artists" round value={(x) => `#${x.rank}`} sub={(x) => `first played ${f.dateShort(x.firstPlayed)}`} />
        {disc.limitedHistory && (
          <M>
            <Footnote>Your data starts {f.dateShortYear(disc.historyStarts)}, so “new” means new since then.</Footnote>
          </M>
        )}
      </Stagger>
    ),
    Boolean(disc?.count),
  );

  // 22. Loyalty + longest loved
  const loyal = q.loyalArtists;
  const loved = q.longestLoved[0];
  add(
    'loyal',
    'Loyal artists and longest-loved song',
    () => (
      <Stagger className="flex h-full flex-col gap-[5cqw]">
        <M>
          <Kicker>Ride or die</Kicker>
          <Title size="9.5cqw" className="mt-[2cqw]">
            In your monthly top 5, again and again
          </Title>
        </M>
        <RankList items={loyal.slice(0, 4)} kind="artists" round value={(x) => `${x.months}/${x.monthsWithData} mo`} />
        {loved && (
          <M className="mt-auto">
            <p className="text-[4cqw] font-bold opacity-75">Longest-loved song</p>
            <p className="text-[6cqw] font-black leading-tight">{loved.name}</p>
            <Sub>
              {loved.artist}: first played {f.dateShortYear(loved.first)}, still playing {f.dateShortYear(loved.last)}. {f.int(loved.spanDays)} days of devotion.
            </Sub>
          </M>
        )}
      </Stagger>
    ),
    loyal.length >= 2,
  );

  // 23. One-hit artists
  const oneHit = q.oneHitArtists;
  add(
    'one-hit',
    'One-song artists',
    () => (
      <Stagger className="flex h-full flex-col gap-[5cqw]">
        <M>
          <Kicker>One song. Zero notes.</Kicker>
          <Title size="9.5cqw" className="mt-[2cqw]">
            Artists you love for exactly one song
          </Title>
        </M>
        <RankList items={oneHit.slice(0, 5).map((x) => ({ name: x.track, artist: x.artist, uri: x.uri, plays: x.plays }))} kind="tracks" sub={(x) => x.artist} value={(x) => `${x.plays}×`} />
      </Stagger>
    ),
    oneHit.length >= 3,
  );

  // 24. Binged then abandoned
  const ba = q.bingedAbandoned[0];
  add(
    'binged',
    'Binged then abandoned',
    () => (
      <Stagger className="flex h-full flex-col justify-center gap-[5cqw]">
        <M>
          <Kicker>Binged, then ghosted</Kicker>
        </M>
        <M v="pop" className="flex items-center gap-[4cqw]">
          <Art kind="tracks" item={ba} className="h-[34cqw] w-[34cqw] shrink-0 rounded-[2cqw] shadow-xl" />
          <Big size="20cqw">{ba.peakPlays}×</Big>
        </M>
        <M>
          <Title size={fitSize(ba.name, 10, 6.5)}>{ba.name}</Title>
          <Sub>{ba.artist}</Sub>
        </M>
        <M>
          <Sub className="font-black">
            {ba.peakPlays} plays in the two weeks from {f.dateShort(ba.peakStart)}. Then silence. Last heard {f.dateShortYear(ba.lastPlayed)}.
          </Sub>
        </M>
        {q.bingedAbandoned.length > 1 && (
          <M>
            <Footnote>Also ghosted: {q.bingedAbandoned.slice(1, 4).map((x) => x.name).join(', ')}</Footnote>
          </M>
        )}
      </Stagger>
    ),
    Boolean(ba),
  );

  // 25. Genres (only when the API provided them)
  add(
    'genres',
    'Top genres',
    ({ palette }) => (
      <Stagger className="flex h-full flex-col justify-center gap-[5cqw]">
        <M>
          <Kicker>Your sound</Kicker>
        </M>
        <M v="pop">
          <Title size={fitSize(e.genres.top[0].name, 14, 8)}>{e.genres.top[0].name}</Title>
        </M>
        <M>
          <ShareBars ink={palette.ink} items={e.genres.top.slice(0, 6).map((g, i) => ({ label: g.name, pct: g.pct, highlight: i === 0 }))} />
        </M>
        <M>
          <Footnote>Based on artist genres from Spotify ({e.genres.coveragePct}% of your listening).</Footnote>
        </M>
      </Stagger>
    ),
    Boolean(e?.genres?.top?.length >= 3),
  );

  // 26. Decades / explicit / length
  const dec = e?.decades;
  const topDec = dec?.list.reduce((a, d) => (d.pct > a.pct ? d : a), dec.list[0]);
  add(
    'decades',
    'Release decades',
    ({ palette }) => (
      <Stagger className="flex h-full flex-col justify-center gap-[5cqw]">
        <M>
          <Kicker>Time machine</Kicker>
        </M>
        <M v="pop">
          <Big size="26cqw">{topDec.decade}</Big>
          <Sub>is where your top songs live. Average release year: {dec.avgReleaseYear}.</Sub>
        </M>
        <M>
          <ShareBars ink={palette.ink} items={dec.list.map((d) => ({ label: d.decade, pct: d.pct, highlight: d === topDec }))} />
        </M>
        {dec.oldest && (
          <M>
            <Sub>
              Oldest favorite: “{dec.oldest.name}” by {dec.oldest.artist} ({dec.oldest.year}).
            </Sub>
          </M>
        )}
        <M>
          <Footnote>
            {e.explicit ? `${e.explicit.pct}% explicit. ` : ''}
            {e.avgTrackLengthMin ? `Average song: ${Math.floor(e.avgTrackLengthMin)}:${String(Math.round((e.avgTrackLengthMin % 1) * 60)).padStart(2, '0')}. ` : ''}
            Based on your top songs ({dec.coveragePct}% of listening).
          </Footnote>
        </M>
      </Stagger>
    ),
    Boolean(dec?.list?.length >= 2),
  );

  // 27. Podcasts
  const topShow = pod?.topShows?.[0];
  add(
    'podcasts',
    'Podcasts',
    () => (
      <Stagger className="flex h-full flex-col gap-[4.5cqw]">
        <M>
          <Kicker>Podcast brain</Kicker>
        </M>
        <M v="pop">
          <Big size="26cqw">
            <CountUp value={Math.round(pod.hours)} />
          </Big>
          <Sub>hours of people talking in your ears.</Sub>
        </M>
        <M className="flex items-center gap-[4cqw]">
          <Art kind="shows" item={topShow} className="h-[28cqw] w-[28cqw] shrink-0 rounded-[2cqw] shadow-xl" />
          <div className="min-w-0">
            <p className="text-[3.6cqw] font-bold opacity-75">Top show</p>
            <Title size={fitSize(topShow.name, 8.5, 5.5)}>{topShow.name}</Title>
            <Sub>{f.int(topShow.minutes / 60)} hours</Sub>
          </div>
        </M>
        <RankList items={pod.topShows.slice(1, 4)} kind="shows" start={2} value={(x) => `${f.int(x.minutes / 60)} h`} />
        <M>
          <Footnote>
            Podcast o'clock: {f.hourLabel(pod.peakHour)}.
            {pod.binges[0] ? ` Biggest binge: ${pod.binges[0].episodes} episodes of ${pod.binges[0].show} on ${f.dateShort(pod.binges[0].date)}.` : ''}
          </Footnote>
        </M>
      </Stagger>
    ),
    Boolean(topShow && pod.hours >= 1),
  );

  // 28. Extended-only habits
  const ex = s.extended;
  add(
    'how-you-listen',
    'How you listen',
    () => (
      <Stagger className="flex h-full flex-col justify-center gap-[5cqw]">
        <M>
          <Kicker>How you listen</Kicker>
        </M>
        {[
          ex.shufflePct != null && [`${ex.shufflePct}%`, 'of songs on shuffle'],
          ex.platforms[0] && [ex.platforms[0].name, `your main device (${f.int(ex.platforms[0].minutes / 60)} hours)`],
          ex.countries.length > 1 && [ex.countries.length, `countries you listened from`],
          ex.offlinePct ? [`${ex.offlinePct}%`, 'listened offline'] : null,
          ex.incognitoCount ? [ex.incognitoCount, 'private-session plays (we saw nothing)'] : null,
        ]
          .filter(Boolean)
          .slice(0, 4)
          .map(([big, label]) => (
            <M key={label}>
              <Big size="16cqw">{big}</Big>
              <Sub>{label}</Sub>
            </M>
          ))}
      </Stagger>
    ),
    Boolean(ex && ex.plays > 50),
  );

  // 29. Ad inferences (global, funny)
  const inf = index.bonus?.inferences;
  add(
    'inferences',
    'What advertisers think',
    () => {
      const picks = seeded(inf.labels.filter((l) => l.length <= 34), 8, Number(s.year) || 7);
      return (
        <Stagger className="flex h-full flex-col gap-[5cqw]">
          <M>
            <Kicker>Meanwhile, the advertisers</Kicker>
            <Title size="10cqw" className="mt-[2cqw]">
              Spotify's ad files say you're…
            </Title>
          </M>
          <div className="flex flex-wrap gap-[2.4cqw]">
            {picks.map((l, i) => (
              <M key={l} v="pop">
                <span className={`inline-block rounded-full px-[3.6cqw] py-[1.8cqw] text-[3.8cqw] font-extrabold ${i % 3 === 0 ? 'bg-black/80 text-white' : 'border-[0.5cqw] border-current'}`}>{l}</span>
              </M>
            ))}
          </div>
          <M className="mt-auto">
            <Footnote>
              Picked at random from {f.int(inf.count)} ad segments in your data export. We didn't make these up. Spotify did.
            </Footnote>
          </M>
        </Stagger>
      );
    },
    Boolean(inf?.labels?.length >= 5),
  );

  // 30. Searches / library / playlists
  const sr = s.bonus?.searches;
  const pl = s.bonus?.playlists;
  const lib = index.bonus?.library;
  add(
    'library',
    'Searches, playlists, library',
    () => (
      <Stagger className="flex h-full flex-col justify-center gap-[5.5cqw]">
        <M>
          <Kicker>Behind the scenes</Kicker>
        </M>
        {sr?.count > 0 && (
          <M>
            <Big size="16cqw">{f.int(sr.count)}</Big>
            <Sub>searches{sr.topQueries[0] ? `. Most typed: “${sr.topQueries[0].query}” (${sr.topQueries[0].count}×)` : ''}</Sub>
          </M>
        )}
        {pl?.created > 0 && (
          <M>
            <Big size="16cqw">{pl.created}</Big>
            <Sub>
              playlists created, with {f.int(pl.tracksAdded)} songs added{isAll ? '' : ` in ${s.year}`}
            </Sub>
          </M>
        )}
        {lib?.tracks > 0 && (
          <M>
            <Big size="16cqw">{f.int(lib.tracks)}</Big>
            <Sub>
              liked songs in your library{lib.bannedTracks ? `, and ${lib.bannedTracks} you've banished forever` : ''}
            </Sub>
          </M>
        )}
      </Stagger>
    ),
    Boolean(sr?.count || pl?.created || lib?.tracks),
  );

  // 31. Summary card
  add('summary', 'Summary', () => <Summary s={s} actions={actions} persona={persona} />);

  return slides.map((x, i) => ({ ...x, palette: PALETTES[i % PALETTES.length] }));
}

function Summary({ s, actions, persona }) {
  const a = s.top.artists.byMinutes.slice(0, 5);
  const tr = s.top.tracks.byPlays.slice(0, 5);
  const third = s.enriched?.topGenre ? ['Top genre', s.enriched.topGenre] : persona ? ['Persona', persona.name.replace(/^The /, '')] : ['Streams', f.int(s.totals.streams)];
  const stop = (fn) => (ev) => {
    ev.stopPropagation();
    fn();
  };
  return (
    <Stagger className="flex h-full flex-col gap-[4cqw]">
      <M className="flex items-center gap-[4cqw]">
        {a[0] && <Art kind="artists" item={a[0]} round className="h-[24cqw] w-[24cqw] shrink-0 shadow-xl" />}
        <div>
          <Kicker>Jack's Wrapped</Kicker>
          <Big size="15cqw">{s.scope === 'all' ? 'All time' : s.year}</Big>
        </div>
      </M>
      <div className="grid grid-cols-2 gap-[4cqw]">
        {[
          ['Top artists', a, 'artists'],
          ['Top songs', tr, 'tracks'],
        ].map(([label, list, kind]) => (
          <M key={label}>
            <p className="mb-[2cqw] text-[3.4cqw] font-extrabold uppercase tracking-[0.15em] opacity-80">{label}</p>
            <ol className="flex flex-col gap-[1.8cqw]">
              {list.map((x, i) => (
                <li key={x.key} className="flex items-center gap-[2cqw]">
                  <span className="w-[3.4cqw] text-[3.4cqw] font-black opacity-80">{i + 1}</span>
                  <Art kind={kind} item={x} small round={kind === 'artists'} className="h-[8cqw] w-[8cqw] shrink-0 rounded-[1cqw]" />
                  <span className="min-w-0 truncate text-[3.5cqw] font-extrabold">{x.name}</span>
                </li>
              ))}
            </ol>
          </M>
        ))}
      </div>
      <M className="grid grid-cols-2 gap-[4cqw] rounded-[4cqw] bg-black/15 p-[4.5cqw]">
        <div>
          <p className="text-[3.2cqw] font-extrabold uppercase tracking-[0.15em] opacity-80">Minutes</p>
          <p className="text-[8cqw] font-black leading-none">{f.int(s.totals.minutes)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[3.2cqw] font-extrabold uppercase tracking-[0.15em] opacity-80">{third[0]}</p>
          <p className="text-[5.2cqw] font-black leading-[1.05] text-balance">{third[1]}</p>
        </div>
      </M>
      <M className="mt-auto flex gap-[3cqw]">
        <button onPointerUp={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onClick={stop(actions.onReplay)} className="flex-1 rounded-full bg-black/80 py-[3.4cqw] text-[4cqw] font-black text-white">
          ↺ Replay
        </button>
        <button onPointerUp={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onClick={stop(actions.onExplore)} className="flex-1 rounded-full border-[0.6cqw] border-current py-[3.4cqw] text-[4cqw] font-black">
          Explore →
        </button>
      </M>
    </Stagger>
  );
}
