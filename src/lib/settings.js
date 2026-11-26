import { useEffect, useState } from 'react';

const KEY = 'jw.settings';
const DEFAULTS = { slideSeconds: 6 };

const read = () => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
};

export function useSettings() {
  const [settings, setSettings] = useState(read);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);
  return [settings, (patch) => setSettings((s) => ({ ...s, ...patch }))];
}
