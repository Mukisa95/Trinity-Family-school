const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/cache-first-workspace-qa');
const origin = 'https://trinityfamilyschool.vercel.app';
async function production() {
  const response = await fetch(origin + '/');
  if (!response.ok) throw new Error('Production HTML returned ' + response.status);
  const html = await response.text();
  const files = [...new Set([...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(match => match[1]))]
    .filter(file => file.startsWith('/_next/') && file.endsWith('.js'));
  const sizes = [];
  for (let offset = 0; offset < files.length; offset += 4) {
    sizes.push(...await Promise.all(files.slice(offset, offset + 4).map(async file => {
      const asset = await fetch(new URL(file, origin));
      if (!asset.ok) throw new Error(file + ' returned ' + asset.status);
      const bytes = Buffer.from(await asset.arrayBuffer());
      return { file, decodedBytes: bytes.length, gzipBytes: zlib.gzipSync(bytes).length };
    })));
  }
  return summarize(sizes);
}
function summarize(files) {
  return {
    fileCount: files.length, decodedBytes: files.reduce((sum, file) => sum + file.decodedBytes, 0),
    gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0), files,
  };
}
function local(route) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.next/app-build-manifest.json')));
  const htmlPath = path.join(root, '.next/server/app', route === '/page' ? 'index.html' : route.replace(/^\//, '').replace(/\/page$/, '') + '.html');
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
  const files = html
    ? [...new Set([...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(match => match[1]))]
      .filter(file => file.startsWith('/_next/') && file.endsWith('.js')).map(file => file.slice('/_next/'.length))
    : [...new Set([...(manifest.pages['/layout'] || []), ...manifest.pages[route]])].filter(file => file.endsWith('.js'));
  return summarize(files.map(file => {
    const bytes = fs.readFileSync(path.join(root, '.next', file));
    return { file, decodedBytes: bytes.length, gzipBytes: zlib.gzipSync(bytes).length };
  }));
}
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const baselinePath = path.join(output, 'production-bundles.json');
  if (process.argv.includes('--production-only')) {
    const baseline = await production();
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    console.log('Production initial scripts: ' + baseline.decodedBytes + ' decoded bytes, ' + baseline.gzipBytes + ' gzip bytes');
    return;
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath));
  const dashboard = local('/page'), pupilDetail = local('/pupil-detail/page');
  fs.writeFileSync(path.join(output, 'bundle-comparison.json'), JSON.stringify({ productionDashboard: baseline, localDashboard: dashboard, localPupilDetail: pupilDetail }, null, 2));
  console.log(JSON.stringify({
    productionDashboardDecodedBytes: baseline.decodedBytes, localDashboardDecodedBytes: dashboard.decodedBytes,
    localPupilDetailDecodedBytes: pupilDetail.decodedBytes,
    dashboardDecodedReductionPercent: Math.round(100 * (1 - dashboard.decodedBytes / baseline.decodedBytes)),
  }));
}
run().catch(error => { console.error(error); process.exitCode = 1; });
