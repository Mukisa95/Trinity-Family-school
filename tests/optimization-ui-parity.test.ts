import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

// Keep the pre-optimization baseline fixed after committing the review branch.
const baselineRef = 'b701ea259ec2f0b01b30d3c9c05efbbbd822a50e';
const releaseBaseRef = 'e5b964de3e75f8bd8ba62c52b81a6f1f0661b3a6';

function renderedMarkup(source: string) {
  source = source.replace(/\r\n/g, '\n');
  const file = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const printer = ts.createPrinter({ removeComments: true });
  const markup: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      markup.push(printer.printNode(ts.EmitHint.Unspecified, node, file));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return markup;
}

function withoutRequestedPaymentReversalDialog(source: string) {
  source = source.replace(/\r\n/g, '\n');
  const start = source.indexOf('<AlertDialog\n        open={Boolean(pendingPaymentReversal)}');
  const end = source.indexOf('\n      <PrintModal', start);
  assert.ok(start >= 0 && end > start, 'payment reversal dialog must remain a bounded page section');
  return `${source.slice(0, start)}<RequestedPaymentReversalDialog />${source.slice(end)}`;
}

// The pupil and family pages are deliberately changed by the fees collection
// release. Keep the untouched payment dialog's markup parity contract.
for (const file of [
  'src/app/fees/family/[...slug]/components/FamilyPaymentModal.tsx',
]) {
  test(`optimization preserves rendered page markup: ${file}`, () => {
    let current = fs.readFileSync(file, 'utf8');
    let baseline = execFileSync('git', ['show', `${baselineRef}:${file}`], { encoding: 'utf8' });
    assert.deepEqual(renderedMarkup(current), renderedMarkup(baseline));
  });
}

test('authentication, rules and SchoolPay verification implementations are unchanged by this release', () => {
  for (const file of ['firestore.rules', 'middleware.ts', 'src/middleware.ts', 'src/lib/server/ensure-server-firestore-auth.ts', 'src/lib/server/app-auth.ts', 'src/lib/server/firestore-rest-auth.ts', 'src/lib/contexts/auth-context.tsx']) {
    if (!fs.existsSync(file)) continue;
    assert.equal(execFileSync('git', ['diff', releaseBaseRef, '--', file], { encoding: 'utf8' }), '');
  }
  const file = 'src/lib/services/schoolpay-integration.service.ts';
  const sources = [execFileSync('git', ['show', `${releaseBaseRef}:${file}`], { encoding: 'utf8' }), fs.readFileSync(file, 'utf8')];
  const methods = sources.map(source => {
    const fileNode = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    let method = '';
    const visit = (node: ts.Node) => {
      if (ts.isMethodDeclaration(node) && node.name.getText(fileNode) === 'verifyWebhookSignature') method = node.getText(fileNode).replace(/\r\n/g, '\n');
      ts.forEachChild(node, visit);
    };
    visit(fileNode);
    return method;
  });
  assert.ok(methods[0]);
  assert.equal(methods[1], methods[0]);
});
