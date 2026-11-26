// Dark dashboard tokens (validated reference palette, dark column).
export const T = {
  page: '#0b0b0b',
  surface: '#191919',
  text: '#efefef',
  text2: '#9c9c9c',
  grid: '#303030',
  axis: '#474747',
  border: 'rgba(255,255,255,0.10)',
  // categorical, fixed order
  series: ['#338ced', '#e76624', '#00a888', '#d28e05', '#e24d8b', '#0aac23', '#9887ef', '#eb6263'],
  // sequential blue for magnitude on a dark surface: low = dark (recedes), high = light
  seq: ['#0f4a96', '#1b64be', '#338ced', '#6aabf1', '#b6d5f8'],
  empty: '#242424',
};
export const MUSIC = T.series[0];
export const PODCAST = T.series[1];

/** Bin a value into the sequential ramp using thresholds from the non-zero values (quantiles). */
export function seqScale(values) {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] ?? 0;
  const cuts = [q(0.2), q(0.4), q(0.6), q(0.8)];
  return (v) => {
    if (!v) return T.empty;
    let i = 0;
    while (i < cuts.length && v > cuts[i]) i++;
    return T.seq[i];
  };
}
