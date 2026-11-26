import { useEffect, useState } from 'react';

/** "#/story/2026" -> { view: 'story', scope: '2026' } */
function parseHash() {
  const [, view = '', scope = ''] = window.location.hash.replace(/^#/, '').split('/');
  return { view: view || 'home', scope: decodeURIComponent(scope) };
}

export function navigate(view, scope) {
  window.location.hash = view === 'home' ? '/' : `/${view}/${encodeURIComponent(scope)}`;
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
