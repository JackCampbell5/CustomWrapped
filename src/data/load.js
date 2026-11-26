// The app only reads precomputed JSON from src/generated/ (written by `npm run build:data`).
import { useEffect, useState } from 'react';

const files = import.meta.glob('../generated/*.json', { import: 'default' });
const loaders = Object.fromEntries(Object.entries(files).map(([p, f]) => [p.replace(/^.*\/(.+)\.json$/, '$1'), f]));
const cache = new Map();

export const hasGeneratedData = () => Boolean(loaders.index);

export function loadJson(name) {
  if (!cache.has(name)) cache.set(name, loaders[name] ? loaders[name]() : Promise.resolve(null));
  return cache.get(name);
}

/** @returns {{ loading: boolean, data: any }} */
export function useJson(name) {
  const [state, setState] = useState({ loading: Boolean(name), data: null, name });
  useEffect(() => {
    if (!name) return undefined;
    let live = true;
    setState((s) => (s.name === name ? s : { loading: true, data: null, name }));
    loadJson(name).then((data) => live && setState({ loading: false, data, name }));
    return () => {
      live = false;
    };
  }, [name]);
  return state.name === name ? state : { loading: true, data: null, name };
}
