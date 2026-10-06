import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { matchesPupilSearch, formatPupilDisplayName } from '../src/lib/utils/name-formatter';

// Execute the search expressions wired into real screens without mounting their data hooks.
const pupil = { id: 'fictional', firstName: 'Mary', lastName: 'Kato', otherNames: 'Grace', status: 'Active', admissionNumber: 'TFS-001', className: 'Primary Four', learnerIdentificationNumber: 'LIN/123', familyId: 'FAMILY-001' };
const queryNames = ['Grace', 'Kato Mary', 'Mary Kato', 'Kato Mary Grace', 'Mary Kato Grace', 'Grace Kato', '  GRACE, kato  '];

function expressions(file: string, select: (node: ts.Node, value: string) => boolean) {
  const source = ts.createSourceFile(file, readFileSync(resolve(file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (select(node, node.getText(source))) { found.push(node.getText(source)); return; }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
function execute(expression: string, bindings: Record<string, unknown>, argument: unknown) {
  const code = ts.transpileModule(`const predicate = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(bindings), `${code}\nreturn predicate;`)(...Object.values(bindings))(argument);
}

const arrowCases: Array<[string, string, (query: string) => Record<string, unknown>, unknown]> = [
  ['src/app/pupils/page.tsx', 'pupil', query => ({ searchQuery: query }), pupil],
  ['src/components/PupilSelector.tsx', 'pupil', query => ({ searchTerm: query }), pupil],
  ['src/components/users/filtered-pupil-selector.tsx', 'pupil', query => ({ filters: { searchTerm: query } }), pupil],
  ['src/components/users/bulk-parent-account-creator.tsx', 'pupil', query => ({ searchTerm: query }), pupil],
  ['src/components/staff/staff-pupil-assignment-modal.tsx', 'pupil', query => ({ searchTerm: query }), pupil],
  ['src/app/pupils/promote/page.tsx', 'p', query => ({ searchQuery: query }), pupil],
  ['src/app/pupils/promotion-history/[batchId]/page.tsx', 'pupil', query => ({ searchTerm: query }), pupil],
  ['src/app/remark-report/page.tsx', 'pupil', query => ({ searchTerm: query }), pupil],
  ['src/app/attendance/record/page.tsx', 'p', query => ({ searchQuery: query }), pupil],
  ['src/app/assign/[feeId]/page.tsx', 'pupil', query => ({ searchText: query }), pupil],
  ['src/components/pupils/link-siblings-modal.tsx', 'pupil', query => ({ searchTerm: query }), pupil],
  ['src/components/class/class-requirements-overview-modal.tsx', 'pupil', query => ({ searchTerm: query }), pupil],
  ['src/components/duty-service/PrefectoralManagement/AssignPupilToPostModal.tsx', 'p', query => ({ searchTerm: query }), pupil],
  ['src/app/whatsapp/page.tsx', 'pupil', query => ({ query }), pupil],
  ['src/app/bulk-sms/page.tsx', 'pupil', query => ({ searchTerm: query }), pupil],
  ['src/app/banking/page.tsx', 'account', query => ({ searchTerm: query }), { pupil, accountNumber: 'BANK/555', accountName: 'School savings' }],
  ['src/app/banking/list/page.tsx', 'account', query => ({ searchTerm: query }), { pupil, accountNumber: 'BANK/555' }],
  ['src/app/classes/pending/page.tsx', 'pupil', query => ({ searchQuery: query, allClasses: [] }), pupil],
  ['src/app/pupil-history/page.tsx', 'pupil', query => ({ searchTerm: query }), { ...pupil, guardian: { name: 'Ann Other' } }],
  ['src/components/events/attendance/parent-attendance-form.tsx', 'pupil', query => ({ pupilSearchTerm: query, allClasses: [] }), pupil],
  ['src/components/docx/thank-you-card-studio.tsx', 'pupil', query => ({ search: query, normalizedSearch: query.trim().toLowerCase() }), pupil],
  ['src/components/docx/custom-photo-studio.tsx', 'pupil', query => ({ pupilSearch: query, query, classFilter: 'all', statusFilter: 'all', photoFilter: 'all' }), pupil],
  ['src/app/exams/ple-results/[pleId]/view-results/page.tsx', 'pupil', query => ({ searchTerm: query }), pupil],
  ['src/app/exams/ple-results/[pleId]/record-results/page.tsx', 'pupil', query => ({ searchTerm: query }), pupil],
];
for (const [file, parameter, bindings, argument] of arrowCases) {
  test(`${file}: three-part names and both orders reach the actual search callback`, {
    skip: file === 'src/app/whatsapp/page.tsx' && !existsSync(resolve(file))
      ? 'WhatsApp is a local feature not yet present on the deployment branch'
      : false,
  }, () => {
    const found = expressions(file, (node, value) => ts.isArrowFunction(node) && node.parameters.length === 1 && node.parameters[0].name.getText() === parameter && value.includes('matchesPupilSearch('));
    assert.equal(found.length, 1, 'search callback must be unambiguous');
    for (const query of queryNames) assert.equal(!!execute(found[0], { matchesPupilSearch, ...bindings(query) }, argument), true, query);
    assert.equal(!!execute(found[0], { matchesPupilSearch, ...bindings('Mary Missing') }, argument), false);
  });
}

test('both fees branches use all names and preserve admission-number matching', () => {
  const found = expressions('src/app/fees/collection/page.tsx', (node, value) => ts.isVariableDeclaration(node) && node.name.getText() === 'matchesSearch' && value.includes('matchesPupilSearch('));
  assert.equal(found.length, 2);
  for (const declaration of found) {
    const expression = `pupil => ${declaration.slice(declaration.indexOf('=') + 1)}`;
    for (const searchQuery of [...queryNames, ' tfs-001 ']) assert.equal(!!execute(expression, { matchesPupilSearch, searchQuery }, pupil), true);
    assert.equal(!!execute(expression, { matchesPupilSearch, searchQuery: 'Primary Four' }, pupil), false);
  }
});

test('live names replace display labels while historical snapshot fields remain intact', () => {
  for (const file of ['src/app/exams/[examId]/record-results/RecordResultsView.tsx', 'src/app/exams/[examId]/view-results/ViewResultsView.tsx']) {
    const found = expressions(file, (node, value) => ts.isPropertyAssignment(node) && node.name.getText() === 'name' && value.includes('formatPupilName(actualPupil'));
    assert.equal(found.length, 1);
    const expression = found[0].slice(found[0].indexOf(':') + 1);
    const snap = { name: 'Old Two-Part Name', ageAtExam: 9, streamIdAtExam: 'historical-stream' };
    const { formatPupilName } = require('../src/lib/utils/name-formatter');
    const result = new Function('formatPupilName', 'actualPupil', 'snap', `return ${expression}`)(formatPupilName, pupil, snap);
    assert.equal(result, 'Kato Mary Grace');
    assert.equal(snap.name, 'Old Two-Part Name');
    assert.equal(snap.streamIdAtExam, 'historical-stream');
    assert.equal(new Function('formatPupilName', 'actualPupil', 'snap', `return ${expression}`)(formatPupilName, undefined, snap), snap.name);
  }
});
