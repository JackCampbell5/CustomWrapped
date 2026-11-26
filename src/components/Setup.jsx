export default function Setup() {
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 p-8">
      <h1 className="text-5xl font-black tracking-tight">Jack's Wrapped</h1>
      <p className="text-lg text-white/80">No stats yet. Generate them from your Spotify export:</p>
      <ol className="list-decimal space-y-3 pl-6 text-white/80">
        <li>
          Put your Spotify export in <code className="rounded bg-white/10 px-1.5 py-0.5">data/raw/</code>
        </li>
        <li>
          Run <code className="rounded bg-white/10 px-1.5 py-0.5">npm run build:data</code>
        </li>
        <li>Reload this page.</li>
      </ol>
      <p className="text-sm text-white/50">
        Want to try it first? <code className="rounded bg-white/10 px-1.5 py-0.5">node scripts/build-data.js --raw fixtures</code> builds a demo from
        fake data.
      </p>
    </main>
  );
}
