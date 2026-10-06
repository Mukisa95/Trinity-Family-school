// The committed worker keeps first-run/offline processing independent of Next.js chunks.
const fs = require('fs');
const output = 'public/photo-tools/v4/photo-worker.js';
require('esbuild').buildSync({ entryPoints: ['src/lib/photo/photo-worker.ts'], bundle: true,
  platform: 'browser', format: 'iife', target: 'es2020', outfile: output,
  legalComments: 'inline' });
// esbuild indents blank lines in preserved licence blocks; keep generated diffs clean.
fs.writeFileSync(output, fs.readFileSync(output, 'utf8').replace(/[ \t]+$/gm, ''));
