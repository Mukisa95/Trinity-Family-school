// The committed worker keeps first-run/offline processing independent of Next.js chunks.
require('esbuild').buildSync({ entryPoints: ['src/lib/photo/photo-worker.ts'], bundle: true,
  platform: 'browser', format: 'iife', target: 'es2020', outfile: 'public/photo-tools/v3/photo-worker.js',
  legalComments: 'inline' });
