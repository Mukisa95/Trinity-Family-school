const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'android-app/app/src/main/assets/offline');
fs.mkdirSync(output, { recursive: true });
require('esbuild').buildSync({
  absWorkingDir: root, entryPoints: ['src/android-offline/app.tsx'], bundle: true,
  platform: 'browser', format: 'iife', target: 'es2020', minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'app.js'), legalComments: 'eof',
});
for (const file of ['index.html', 'app.css']) fs.copyFileSync(path.join(root, 'src/android-offline', file), path.join(output, file));
console.log('Packaged Android offline interface:', output);
