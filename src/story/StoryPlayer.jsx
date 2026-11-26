import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useJson } from '../data/load.js';
import { useSettings } from '../lib/settings.js';
import { scopeLabel } from '../lib/format.js';
import { buildSlides } from './slides.jsx';
import { Shell } from './primitives.jsx';

const HOLD_MS = 220;

export default function StoryPlayer({ index, scopeId, onExit, onExplore }) {
  const { data: stats } = useJson(`stats-${scopeId}`);
  const [settings] = useSettings();
  const durationMs = settings.slideSeconds * 1000;
  const reduce = useReducedMotion();

  // ?slide=N opens a specific slide, paused (handy for linking/reviewing one slide)
  const startAt = Number(new URLSearchParams(window.location.search).get('slide'));
  const [i, setI] = useState(Number.isInteger(startAt) && startAt > 0 ? startAt - 1 : 0);
  const [paused, setPaused] = useState(startAt > 0);
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [runKey, setRunKey] = useState(0); // restarts the current bar

  const actions = useMemo(
    () => ({
      onReplay: () => {
        setI(0);
        setRunKey((k) => k + 1);
      },
      onExplore,
    }),
    [onExplore],
  );
  const slides = useMemo(() => (stats ? buildSlides(stats, index, actions) : []), [stats, index, actions]);
  const n = slides.length;
  const last = i >= n - 1;

  const go = useCallback(
    (d) => {
      setI((cur) => Math.max(0, Math.min(n - 1, cur + d)));
      setRunKey((k) => k + 1);
    },
    [n],
  );

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('button, select, input')) {
        if (e.key !== 'Escape') return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'p' || e.key === 'k') setPaused((p) => !p);
      else if (e.key === 'Home') {
        setI(0);
        setRunKey((k) => k + 1);
      } else if (e.key === 'End') setI(n - 1);
      else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, n, onExit]);

  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  // tap = navigate, hold = pause
  const holdTimer = useRef(null);
  const didHold = useRef(false);
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    didHold.current = false;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      didHold.current = true;
      setHeld(true);
    }, HOLD_MS);
  };
  const onPointerUp = (e) => {
    clearTimeout(holdTimer.current);
    if (didHold.current) {
      setHeld(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    go((e.clientX - rect.left) / rect.width < 0.3 ? -1 : 1);
  };
  const cancelHold = () => {
    clearTimeout(holdTimer.current);
    if (didHold.current) setHeld(false);
  };

  if (!stats) return <div className="grid h-full place-items-center text-white/60">Loading…</div>;
  const slide = slides[i];
  const running = durationMs > 0 && !paused && !held && !hidden && !last;
  const C = slide.C;

  return (
    <div className="fixed inset-0 grid place-items-center bg-[#07070b] sm:p-4">
      {/* blurred backdrop echoing the slide colors */}
      <div aria-hidden="true" className="absolute inset-0 opacity-40 blur-3xl transition-[background] duration-700" style={{ background: `radial-gradient(circle at 30% 30%, ${slide.palette.stops[1]}, transparent 60%), radial-gradient(circle at 70% 70%, ${slide.palette.stops[2]}, transparent 60%)` }} />

      <section
        aria-roledescription="carousel"
        aria-label={`Jack's Wrapped ${scopeLabel(scopeId)} story`}
        className="story @container relative h-full w-full overflow-hidden bg-black sm:aspect-[9/16] sm:h-[min(94vh,960px)] sm:w-auto sm:rounded-[28px] sm:shadow-[0_30px_120px_-20px_rgba(0,0,0,.9)]"
      >
        {/* slides */}
        <div
          className="absolute inset-0 touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={`${slide.id}-${i}`}
              className="absolute inset-0"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: 'blur(8px)' }}
              transition={{ duration: reduce ? 0.2 : 0.45, ease: [0.22, 1, 0.36, 1] }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${slide.label}`}
            >
              <Shell palette={slide.palette}>
                <C palette={slide.palette} />
              </Shell>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* progress */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex gap-[3px] px-[3cqw] pt-[3cqw]" aria-hidden="true">
          {slides.map((sl, j) => (
            <div key={sl.id} className="relative h-[3px] flex-1 overflow-hidden rounded-full">
              <div className="absolute inset-0 opacity-30" style={{ background: slide.palette.ink }} />
              {j < i || (j === i && (durationMs === 0 || last)) ? (
                <div className="relative h-full w-full" style={{ background: slide.palette.ink }} />
              ) : j === i ? (
                <div
                  key={runKey}
                  className="progress-fill relative h-full w-full"
                  style={{ background: slide.palette.ink, animationDuration: `${durationMs}ms`, animationPlayState: running ? 'running' : 'paused' }}
                  onAnimationEnd={() => go(1)}
                />
              ) : null}
            </div>
          ))}
        </div>

        {/* controls */}
        <div className="absolute right-[3cqw] top-[6cqw] z-20 flex gap-[2cqw]">
          {durationMs > 0 && !last && (
            <button
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Play' : 'Pause'}
              className="grid h-[9cqw] max-h-11 w-[9cqw] max-w-11 place-items-center rounded-full bg-black/35 text-[4cqw] text-white backdrop-blur"
            >
              {paused ? '▶' : '❚❚'}
            </button>
          )}
          <button onClick={onExit} aria-label="Close story" className="grid h-[9cqw] max-h-11 w-[9cqw] max-w-11 place-items-center rounded-full bg-black/35 text-[4.6cqw] text-white backdrop-blur">
            ✕
          </button>
        </div>
        <div className="sr-only" aria-live="polite">
          Slide {i + 1} of {n}: {slide.label}. Use left and right arrow keys to move, P to pause, Escape to close.
        </div>
        {(held || paused) && !last && durationMs > 0 && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[3cqw] z-10 flex justify-center">
            <span className="rounded-full bg-black/45 px-[3cqw] py-[1cqw] text-[3cqw] font-bold text-white backdrop-blur">Paused</span>
          </div>
        )}
      </section>
    </div>
  );
}
