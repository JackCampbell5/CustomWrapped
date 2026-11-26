import { navigate } from '../lib/route.js';

// Placeholder until the Explore milestone.
export default function Explore({ scopeId }) {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <button onClick={() => navigate('home')} className="text-white/70 underline">
        ← Back
      </button>
      <h1 className="mt-6 text-4xl font-black">Explore {scopeId}</h1>
      <p className="mt-2 text-white/70">Coming next.</p>
    </main>
  );
}
