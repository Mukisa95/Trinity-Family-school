/* Migrate complete UI colour utilities, leaving document/export templates and data alone.
   Re-running is safe. A syntax-tree fingerprint rejects any non-style mutation. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const families = { blue: 'brand', indigo: 'brand-alt', purple: 'brand-secondary', violet: 'brand-secondary-alt' };
const utility = /\b(text|bg|border(?:-[tblrxy])?|ring|from|via|to|shadow|outline|decoration|fill|stroke|divide|placeholder|caret|accent)-(blue|indigo|purple|violet)-(50|100|200|300|400|500|600|700|800|900|950)(?![\w-])/g;
const literals = new Set([ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral, ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail]);
const change = text => text.replace(/\b(text|border|bg)-(blue|indigo|purple|violet)-(350|750|850)(?![\w-])/g, (_,role,hue,shade)=>`${role}-${hue}-${Number(shade)-50}`)
  .replace(utility, (_, role, hue, shade) => `${role}-${families[hue]}${['text', 'placeholder', 'caret', 'decoration'].includes(role) ? '-ink' : ''}-${shade}`)
  .replace(/\b(bg|from|via|to)-(brand(?:-secondary-alt|-secondary|-alt)?)-(50|100|200|300|400|500|600|700|800|900|950)(?![\w-])/g, (_,role,family,shade)=>`${role}-${family}-${role !== 'bg' && text.includes('bg-clip-text') ? 'ink' : 'surface'}-${shade}`)
  .replace(/\btext-primary(?![\w-])/g, 'text-link');
function protectedContext(node, source) {
  let attribute = false;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxAttribute(parent)) attribute = true;
    if (ts.isJsxElement(parent) && /^(Text|Document|Page|View)$/.test(parent.openingElement.tagName.getText(source))) return true;
  }
  if (attribute) return false;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
    if (ts.isTaggedTemplateExpression(parent)) return true;
    if (ts.isVariableDeclaration(parent) || ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)) {
      if (parent.name && /print|pdf|export|documentHtml/i.test(parent.name.getText(source))) return true;
    }
    if (ts.isJsxElement(parent) && /^(Text|Document|Page|View)$/.test(parent.openingElement.tagName.getText(source))) return true;
  }
  return false;
}
function fingerprint(source) {
  const parts = [];
  function visit(node) {
    parts.push(node.kind);
    if (literals.has(node.kind)) { parts.push(protectedContext(node, source) ? node.getText(source) : change(node.getText(source))); return; }
    if (!node.getChildCount(source)) parts.push(node.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}
const results = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['api', 'reports', 'docx'].includes(entry.name)) walk(file); continue; }
    const viewer = /^pdf-(workspace|document-viewer|viewer)\.tsx$/.test(entry.name);
    if (!/\.(tsx|ts)$/.test(entry.name) || (/print|pdf/i.test(file.slice(root.length)) && !viewer)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, entry.name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits = [];
    function visit(node) {
      if (literals.has(node.kind) && !protectedContext(node, source)) {
        const original = node.getText(source);
        // HTML strings belong to exported documents; scoped CSS gets handled separately.
        if (!/<\/?[a-zA-Z]|[{}][^$]*[;{}]/.test(original)) {
          const updated = change(original);
          if (updated !== original) edits.push({ start: node.getStart(source), end: node.end, updated });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    if (!edits.length) continue;
    let updated = text;
    for (const edit of edits.sort((a,b)=>b.start-a.start)) updated = updated.slice(0,edit.start)+edit.updated+updated.slice(edit.end);
    const after = ts.createSourceFile(file, updated, ts.ScriptTarget.Latest, true, source.scriptKind);
    if (after.parseDiagnostics.length || fingerprint(source) !== fingerprint(after)) throw new Error(`Non-style or invalid mutation: ${file}`);
    fs.writeFileSync(file, updated);
    results.push({ file: path.relative(root,file).replaceAll('\\','/'), literals: edits.length, syntaxAndLogicUnchanged: true });
  }
}
walk(path.join(root,'src/app')); walk(path.join(root,'src/components'));
fs.mkdirSync(path.join(root,'output/theme-migration'), { recursive: true });
fs.writeFileSync(path.join(root,'output/theme-migration/utilities.json'),JSON.stringify(results,null,2));
console.log(`THEME_UTILITIES_MIGRATED ${results.length} UI files, ${results.reduce((n,r)=>n+r.literals,0)} style literals; unchanged syntax/logic fingerprints and protected export/document contexts.`);
