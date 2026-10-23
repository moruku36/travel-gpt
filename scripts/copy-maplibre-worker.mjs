// MapLibre v6 loads its worker from a file next to its ES module. Bundlers move the module,
// so the worker is copied to /public and its URL is set explicitly in MapView.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('maplibre-gl/dist/maplibre-gl.css'));
mkdirSync('public', { recursive: true });
copyFileSync(join(dist, 'maplibre-gl-worker.mjs'), join('public', 'maplibre-gl-worker.mjs'));
console.log('copied maplibre-gl-worker.mjs to public/');
