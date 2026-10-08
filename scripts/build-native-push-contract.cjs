const path = require('node:path');
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/lib/server/native-push-contract.ts')],
  outfile: path.join(__dirname, '../functions/native-push-contract.js'), bundle: true, platform: 'node', format: 'cjs', target: 'node22' });
console.log('Built shared native push contract for Firebase Functions.');
