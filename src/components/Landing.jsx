import { useState } from 'react';
import { motion } from 'framer-motion';
import { navigate } from '../lib/route.js';
import { coverageNote, int, scopeLabel } from '../lib/format.js';
import { useSettings } from '../lib/settings.js';

export default function Landing({ index }) {
  const years = index.scopes.filter((s) => s.id !== 'all');
  const defaultScope = years.length ? years.reduce((a, b) => (b.minutes > a.minutes ? b : a)).id : 'all';
  const [scope, setScope] = useState(defaultScope);
  const [settings, update] = useSettings();
  const sel = index.scopes.find((s) => s.id === scope);

  return (
    <main className="relative min-h-full overflow-hidden">
      {/* backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-40 -top-40 h-[42rem] w-[42rem] rounded-full bg-[#ff3d77] opacity-50 blur-[120px]"
          animate={{ x: [0, 80, 0], y: [0, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-48 right-[-10rem] h-[46rem] w-[46rem] rounded-full bg-[#5b2bff] opacity-50 blur-[130px]"
          animate={{ x: [0, -60, 0], y: [0, -50, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="grain absolute inset-0 opacity-[.12] mix-blend-overlay" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
        <header>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">Your listening, unwrapped</p>
          <h1 className="mt-3 font-display text-7xl font-extrabold leading-[0.88] tracking-[-0.04em] sm:text-9xl">
            Jack's
            <br />
            <span className="bg-gradient-to-r from-[#ffd23f] via-[#ff3d77] to-[#a66bff] bg-clip-text text-transparent">Wrapped</span>
          </h1>
        </header>

        <section aria-labelledby="pick">
          <h2 id="pick" className="mb-3 text-sm font-semibold text-white/70">
            Pick a year
          </h2>
          <div role="radiogroup" aria-labelledby="pick" className="flex flex-wrap gap-2">
            {index.scopes.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={scope === s.id}
                onClick={() => setScope(s.id)}
                className={`rounded-full px-5 py-2.5 text-lg font-bold transition ${
                  scope === s.id ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {scopeLabel(s.id)}
              </button>
            ))}
          </div>
          {sel && (
            <p className="mt-4 text-white/80">
              <span className="font-semibold text-white">{int(sel.minutes)} minutes</span> · {int(sel.streams)} streams
              {sel.topArtist ? (
                <>
                  {' '}
                  · #1 <span className="font-semibold text-white">{sel.topArtist}</span>
                </>
              ) : null}
              <br />
              <span className={sel.coverage?.partial ? 'text-[#ffd23f]' : 'text-white/60'}>{coverageNote(sel.coverage, sel.id)}</span>
            </p>
          )}
          {index.hiddenYears?.length > 0 && (
            <p className="mt-2 text-sm text-white/50">
              {index.hiddenYears.map((h) => `${h.year} (${h.spanDays} days)`).join(', ')} {index.hiddenYears.length === 1 ? 'is' : 'are'} hidden until there's at least 6
              months of data, but still counted in All time.
            </p>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('story', scope)}
            className="rounded-full bg-white px-8 py-4 text-lg font-black text-black shadow-[0_10px_40px_-10px_rgba(255,61,119,.8)] transition hover:scale-[1.03] active:scale-95"
          >
            ▶ Play my Wrapped
          </button>
          <button
            onClick={() => navigate('explore', scope)}
            className="rounded-full border-2 border-white/70 px-8 py-4 text-lg font-black text-white transition hover:bg-white/10"
          >
            Explore
          </button>
        </div>

        <details className="text-sm text-white/60">
          <summary className="cursor-pointer select-none font-semibold text-white/70">Settings & data</summary>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-3">
              Seconds per slide
              <select
                value={settings.slideSeconds}
                onChange={(e) => update({ slideSeconds: Number(e.target.value) })}
                className="rounded-md bg-white/10 px-2 py-1 text-white"
              >
                {[4, 6, 8, 10, 0].map((n) => (
                  <option key={n} value={n} className="bg-neutral-900">
                    {n ? `${n}s` : 'Manual'}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Built {new Date(index.generatedAt).toLocaleString()} · {index.hasExtended ? 'extended history' : 'account data only'} ·{' '}
              {index.hasEnrichment ? 'Spotify art on' : 'generated art (no API data)'}
            </p>
            <p>Times shown in {index.timeZone.replace('_', ' ')}.</p>
          </div>
        </details>
      </div>
    </main>
  );
}
