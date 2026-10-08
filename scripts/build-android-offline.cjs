const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const school = require('./android-school-config.cjs').loadSchool();
const output = path.join(root, 'android-app/app/src/main/assets/offline');
fs.mkdirSync(output, { recursive: true });
require('esbuild').buildSync({
  absWorkingDir: root, entryPoints: ['src/android-offline/app.tsx'], bundle: true,
  platform: 'browser', format: 'iife', target: 'es2020', minify: true,
  define: { 'process.env.NODE_ENV': '"production"', '__ANDROID_APP_NAME__': JSON.stringify(school.appName) },
  alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'app.js'), legalComments: 'eof',
});
fs.copyFileSync(path.join(root, 'src/android-offline/app.css'), path.join(output, 'app.css'));
fs.writeFileSync(path.join(output, 'index.html'), fs.readFileSync(path.join(root, 'src/android-offline/index.html'), 'utf8').replace('<title>Trinity School</title>', `<title>${school.appName}</title>`));
console.log('Packaged Android offline interface:', output);
