// Compare diagnostics against HEAD without changing either checkout.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const changed = cp.execFileSync('git', ['diff', '--name-only', '--', 'src'], { cwd: root, encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(file => /\.tsx?$/.test(file));
const added = cp.execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'src'], { cwd: root, encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(file => /\.tsx?$/.test(file));
const originals = new Map(changed.map(file => [path.resolve(root, file).toLowerCase(),
  cp.execFileSync('git', ['show', 'HEAD:' + file], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })]));
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
function diagnostics(baseline) {
  const files = (baseline ? changed : [...changed, ...added]).map(file => path.join(root, file));
  const host = ts.createCompilerHost(parsed.options);
  const getSourceFile = host.getSourceFile.bind(host);
  if (baseline) host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => {
    const original = originals.get(path.resolve(file).toLowerCase());
    return original === undefined ? getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile)
      : ts.createSourceFile(file, original, languageVersion, true);
  };
  const program = ts.createProgram(files, { ...parsed.options, incremental: false }, host);
  return files.flatMap(file => {
    const source = program.getSourceFile(file);
    return source ? [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]
      .map(diagnostic => ({
        file: path.relative(root, file).replaceAll('\\', '/'),
        code: diagnostic.code, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      })) : [];
  });
}
const baseline = diagnostics(true);
if (global.gc) global.gc();
const current = diagnostics(false);
const counts = new Map();
baseline.forEach(diagnostic => { const key = JSON.stringify(diagnostic); counts.set(key, (counts.get(key) || 0) + 1); });
const introduced = current.filter(diagnostic => {
  const key = JSON.stringify(diagnostic), count = counts.get(key) || 0;
  if (!count) return true;
  counts.set(key, count - 1); return false;
});
fs.mkdirSync(path.join(root, 'output/cache-first-workspace-qa'), { recursive: true });
fs.writeFileSync(path.join(root, 'output/cache-first-workspace-qa/type-comparison.json'),
  JSON.stringify({ baselineCount: baseline.length, currentCount: current.length, introduced }, null, 2));
console.log('Changed-source type diagnostics: baseline=' + baseline.length + ', current=' + current.length + ', introduced=' + introduced.length);
if (introduced.length) { console.error(introduced); process.exitCode = 1; }
