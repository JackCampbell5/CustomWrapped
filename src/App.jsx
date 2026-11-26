import { lazy, Suspense } from 'react';
import { hasGeneratedData, useJson } from './data/load.js';
import { navigate, useRoute } from './lib/route.js';
import { ArtProvider } from './components/Art.jsx';
import Landing from './components/Landing.jsx';
import Setup from './components/Setup.jsx';

const StoryPlayer = lazy(() => import('./story/StoryPlayer.jsx'));
const Explore = lazy(() => import('./explore/Explore.jsx'));

const Loading = () => (
  <div className="grid h-full place-items-center text-white/60" role="status">
    Loading…
  </div>
);

export default function App() {
  const route = useRoute();
  const { data: index, loading } = useJson(hasGeneratedData() ? 'index' : null);
  if (!hasGeneratedData()) return <Setup />;
  if (loading || !index) return <Loading />;

  const scopeIds = index.scopes.map((s) => s.id);
  const scope = scopeIds.includes(route.scope) ? route.scope : null;

  return (
    <ArtProvider>
      <Suspense fallback={<Loading />}>
        {route.view === 'story' && scope ? (
          <StoryPlayer index={index} scopeId={scope} onExit={() => navigate('home')} onExplore={() => navigate('explore', scope)} />
        ) : route.view === 'explore' && scope ? (
          <Explore index={index} scopeId={scope} />
        ) : (
          <Landing index={index} />
        )}
      </Suspense>
    </ArtProvider>
  );
}
