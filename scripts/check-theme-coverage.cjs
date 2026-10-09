const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const problems = [];
let files = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['api', 'pdf', 'docx', 'reports'].includes(entry.name)) walk(file); }
    else if (entry.name.endsWith('.tsx') && !/print|pdf|photo|camera/i.test(entry.name)) {
      files++;
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      if (source.parseDiagnostics.length) problems.push(`${file}: invalid TSX`);
      function visit(node) {
        // Complete theme classes must be separated from the next expression.
        // A trailing hyphen is an existing partial utility such as dark:text-${colour}.
        if ([ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle].includes(node.kind) && /dark:[^\s]+[^\s-]$/.test(node.text)) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          problems.push(`${path.relative(root, file)}:${line}: theme class joins the next expression`);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}
walk(path.join(root, 'src/app')); walk(path.join(root, 'src/components'));
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log(`THEME_COVERAGE_OK ${files} UI files: valid syntax and separated dynamic theme classes.`);
