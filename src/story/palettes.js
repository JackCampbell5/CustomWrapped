// One palette per slide, cycled in order so neighbors never match.
// stops: background gradient; ink: text color chosen for contrast; blobs: floating light.
export const PALETTES = [
  { name: 'ember', stops: ['#ff2e63', '#ff7a18', '#ffd23f'], ink: '#1a0509', blobs: ['#ffe66d', '#ff006e'], deco: 'rings' },
  { name: 'ultraviolet', stops: ['#22085c', '#6a11cb', '#c2189b'], ink: '#ffffff', blobs: ['#ff4ecd', '#4cc9f0'], deco: 'dots' },
  { name: 'lime', stops: ['#e2ff47', '#6df27f', '#14c9a7'], ink: '#08190f', blobs: ['#ffff8a', '#00ffa3'], deco: 'stripes' },
  { name: 'cobalt', stops: ['#001654', '#0040ff', '#00b7ff'], ink: '#ffffff', blobs: ['#7df9ff', '#6b2bff'], deco: 'rings' },
  { name: 'bubblegum', stops: ['#ffb1dc', '#ff5ea8', '#b44cf5'], ink: '#1e0322', blobs: ['#ffe3f2', '#ff2fa0'], deco: 'dots' },
  { name: 'midnight', stops: ['#04040c', '#151a55', '#33207a'], ink: '#ffffff', blobs: ['#3d5afe', '#ff3df2'], deco: 'stars' },
  { name: 'sunflower', stops: ['#fff06a', '#ffb800', '#ff7700'], ink: '#1b1000', blobs: ['#fff8c4', '#ff4d00'], deco: 'stripes' },
  { name: 'cherry', stops: ['#5c0014', '#d1003a', '#ff5a5f'], ink: '#ffffff', blobs: ['#ffb3c1', '#ff2d55'], deco: 'rings' },
  { name: 'forest', stops: ['#03241b', '#0d6b4e', '#2fd18c'], ink: '#ffffff', blobs: ['#c2ff6e', '#00ffcc'], deco: 'dots' },
  { name: 'tangerine', stops: ['#ff5c00', '#ff1f7a', '#7000ff'], ink: '#ffffff', blobs: ['#ffd000', '#ff00aa'], deco: 'stripes' },
  { name: 'ice', stops: ['#f0faff', '#aee6ff', '#8aa9ff'], ink: '#071431', blobs: ['#ffffff', '#a18cff'], deco: 'stars' },
  { name: 'volt', stops: ['#0d0d0d', '#1f1f1f', '#2a2a2a'], ink: '#d9ff3f', blobs: ['#d9ff3f', '#00e1ff'], deco: 'rings' },
];
