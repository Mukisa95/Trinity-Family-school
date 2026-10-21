import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';
import { calculateFeesCollectionTotals } from '@/lib/utils/fees-collection-totals';
import { matchesPupilSearch, formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { listDocumentStyles } from '@/lib/printing/list-document-theme';

const pupils = [
  { id: 'alice', firstName: 'Alice', lastName: 'Test', admissionNumber: '001', classId: 'p1', section: 'Day', status: 'Active' },
  { id: 'ben', firstName: 'Ben', lastName: 'Test', admissionNumber: '002', classId: 'p1', section: 'Boarding', status: 'Active' },
  { id: 'carol', firstName: 'Carol', lastName: 'Test', admissionNumber: '003', classId: 'p1', section: 'Day', status: 'Inactive' },
  { id: 'david', firstName: 'David', lastName: 'Test', admissionNumber: '004', classId: 'p2', section: 'Day', status: 'Active' },
];
const fee = (id: string, amount: number, paid: number) => ({ feeStructureId: id, name: id, amount, paid, balance: amount - paid });
const ledger = (tuitionPaid: number, transport?: ReturnType<typeof fee>) => ({
  totalFees: 100000 + (transport?.amount || 0),
  totalPaid: tuitionPaid + (transport?.paid || 0),
  balance: 100000 - tuitionPaid + (transport?.balance || 0),
  applicableFees: [fee('tuition', 100000, tuitionPaid), ...(transport ? [transport] : [])],
});
const feesInfo = {
  alice: ledger(40000, fee('transport', 20000, 20000)),
  ben: ledger(100000, fee('transport', 30000, 0)),
  carol: ledger(0),
  david: ledger(50000),
};

test('totals include only visible pupils and respect the selected fee', () => {
  assert.deepEqual(calculateFeesCollectionTotals(pupils.slice(0, 2), feesInfo), {
    totalFees: 250000, totalPaid: 160000, balance: 90000,
  });
  assert.deepEqual(calculateFeesCollectionTotals(pupils.slice(0, 2), feesInfo, 'transport'), {
    totalFees: 50000, totalPaid: 20000, balance: 30000,
  });
});

test('empty results, missing fee items, and pending calculations contribute zero', () => {
  const zero = { totalFees: 0, totalPaid: 0, balance: 0 };
  assert.deepEqual(calculateFeesCollectionTotals([], feesInfo), zero);
  assert.deepEqual(calculateFeesCollectionTotals([{ id: 'pending' }], feesInfo), zero);
  assert.deepEqual(calculateFeesCollectionTotals([pupils[2]], feesInfo, 'transport'), zero);
  assert.deepEqual(calculateFeesCollectionTotals(pupils, feesInfo, 'missing'), zero);
});

test('totals update as progressive calculations arrive and preserve credits', () => {
  assert.deepEqual(calculateFeesCollectionTotals(pupils.slice(0, 2), { alice: feesInfo.alice }), {
    totalFees: 120000, totalPaid: 60000, balance: 60000,
  });
  assert.deepEqual(calculateFeesCollectionTotals([{ id: 'alice' }], { alice: ledger(110000) }), {
    totalFees: 100000, totalPaid: 110000, balance: -10000,
  });
});

// Exercise the actual page's filters and report callbacks using synthetic hook data.
// Leaf components stay as React elements so no browser, Firebase, or writes are needed.
function pageHarness() {
  type Element = { type: string; props: Record<string, any> };
  const states: any[] = [];
  const effects: Array<() => void> = [];
  let stateIndex = 0;
  let report: any;
  const source = fs.readFileSync('src/app/fees/collection/page.tsx', 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const modules: Record<string, any> = {
    react: {
      ...React,
      useState(initial: any) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
      },
      useMemo: (callback: () => unknown) => callback(),
      useCallback: (callback: unknown) => callback,
      useEffect: (callback: () => void) => { effects.push(callback); },
      useRef: (value: unknown) => ({ current: value }),
      useTransition: () => [false, (callback: () => void) => callback()],
    },
    'react-dom': { flushSync: (callback: () => void) => callback() },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'framer-motion': { motion: { button: 'motion-button' }, AnimatePresence: 'animate-presence' },
    '@tanstack/react-query': { useQuery: () => ({ data: [{ id: 'tuition', name: 'Tuition' }, { id: 'transport', name: 'Transport' }] }) },
    '@/lib/utils/name-formatter': { matchesPupilSearch, formatPupilDisplayName },
    '@/lib/utils/fees-collection-totals': { calculateFeesCollectionTotals },
    '@/lib/printing/list-document-theme': { listDocumentStyles },
    '@/lib/printing/list-document-react-pdf': { ListDocumentHeader: 'list-header', ListDocumentFooter: 'list-footer' },
    '@/lib/hooks/use-pupils': { usePupils: () => ({ data: pupils }) },
    '@/lib/hooks/use-classes': { useClasses: () => ({ data: [{ id: 'p1', name: 'Primary One' }, { id: 'p2', name: 'Primary Two' }] }) },
    '@/lib/hooks/use-academic-years': { useAcademicYears: () => ({ data: [{ id: 'year', name: '2026', terms: [{ id: 'term', name: 'Term 3', startDate: '2026-09-01', endDate: '2026-12-01' }] }] }) },
    '@/lib/hooks/use-term-status': { useTermStatus: () => ({ effectiveTerm: {} }) },
    '@/lib/hooks/use-progressive-fees': { useProgressiveFees: () => ({ pupilFeesInfo: feesInfo, totals: { totalFees: 999999, totalPaid: 999999, balance: 999999 } }) },
    '@/lib/contexts/auth-context': { useAuth: () => ({ user: { id: 'staff' } }) },
    '@/lib/contexts/print-context': { usePrint: () => ({ registerPrintHandler() {} }) },
    '@/lib/hooks/use-pdf-viewer': { usePDFViewer: () => ({ openPDF: async (document: any) => { report = document; } }) },
    '@/hooks/use-toast': { toast() {} },
    '../collect/[id]/utils/feeProcessing': { isPupilValidForTerm: () => true },
    '@/lib/printing/monochrome-react-pdf': { Document: 'pdf-document', Page: 'pdf-page', Text: 'pdf-text', View: 'pdf-view', StyleSheet: { create: (styles: unknown) => styles } },
  };
  const module = { exports: {} as { default: () => Element } };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console, URLSearchParams,
    window: { location: { search: '?classId=p1&year=year&term=term' }, addEventListener() {}, removeEventListener() {} },
    require: (id: string) => modules[id] || new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : String(key) }),
  });
  const render = () => { stateIndex = 0; effects.length = 0; return module.exports.default(); };
  render();
  effects[0](); // Apply the notification/deep-link class, year and term.
  function nodes(tree: unknown, predicate: (element: Element) => boolean): Element[] {
    if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
    if (!React.isValidElement(tree)) return [];
    const element = tree as unknown as Element;
    return [...(predicate(element) ? [element] : []), ...Object.values(element.props).flatMap(value => nodes(value, predicate))];
  }
  const text = (tree: any): string => {
    if (Array.isArray(tree)) return tree.map(text).join('');
    if (React.isValidElement(tree)) return text((tree.props as any).children);
    return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '';
  };
  const summary = (tree: Element) => text(nodes(tree, element => element.type === 'GlassSummaryBar')[0].props.right);
  const setFilter = (name: string, value: string) => {
    // Native filter controls follow their labels in the expanded panel.
    const labels = { section: 'Section', status: 'Status', balanceStatus: 'Balance', feeItem: 'Fee Item' };
    const group = nodes(render(), element => element.type === 'div' && element.props.className === 'space-y-1')
      .find(element => text(element.props.children).startsWith(labels[name as keyof typeof labels]));
    assert.ok(group, `${name} filter is present`);
    nodes(group, element => element.type === 'select')[0].props.onChange({ target: { value } });
  };
  const click = (label: string) => {
    const button = nodes(render(), element => element.props.label === label || (element.props.onClick && text(element).trim() === label))[0];
    assert.ok(button, `${label} button is present`);
    return button.props.onClick();
  };
  return { render, nodes, text, summary, setFilter, click, getReport: () => report };
}

test('page summaries and PDF follow fee, balance, section, status, search, and class filters', async () => {
  const page = pageHarness();
  assert.match(page.summary(page.render()), /Total Fees:Shs\. 250,000Collected:Shs\. 160,000Outstanding:Shs\. 90,000/);
  page.click('Filters');
  assert.equal(page.nodes(page.render(), element => element.type === 'select').length, 4, 'only section, status, balance, and fee item remain');
  page.setFilter('feeItem', 'transport');
  assert.match(page.summary(page.render()), /Total Fees:Shs\. 50,000Collected:Shs\. 20,000Outstanding:Shs\. 30,000/);
  page.setFilter('balanceStatus', 'with_balance');
  const tree = page.render();
  assert.match(page.summary(tree), /Total Fees:Shs\. 30,000Collected:Shs\. 0Outstanding:Shs\. 30,000/);
  const sms = page.nodes(tree, element => element.type === 'BulkSMSModal')[0];
  assert.deepEqual(Array.from(sms.props.pupils, (pupil: { id: string }) => pupil.id), ['ben']);
  assert.equal(sms.props.selectedFeeId, 'transport');
  assert.equal(sms.props.yearName, '2026');
  assert.equal(sms.props.termName, 'Term 3');
  assert.equal(sms.props.pupilFeesInfo.ben.balance, 30000);
  const footer = page.nodes(tree, element => element.type === 'tr' && page.text(element).includes('Collection Rate:'))[0];
  assert.match(page.text(footer), /1 students.*Collection Rate: 0%.*Shs\. 30,000Shs\. 0Shs\. 30,000/);
  const pdfLabel = page.nodes(tree, element => element.props.onClick && page.text(element).trim() === 'Generate PDF').length ? 'Generate PDF' : 'Create PDF';
  await page.click(pdfLabel);
  assert.ok(page.getReport(), 'PDF was generated');
  assert.match(page.text(page.getReport()), /Total Fees: Shs\. 30,000, Paid: Shs\. 0, Balance: Shs\. 30,000/);
  const reportHeader = page.nodes(page.getReport(), element => element.type === 'list-header')[0];
  assert.equal(reportHeader.props.title, 'Fees Collection Report');
  assert.equal(reportHeader.props.context, 'Primary One');
  page.click('Clear');
  assert.match(page.summary(page.render()), /Total Fees:Shs\. 250,000/);
  assert.equal(page.nodes(page.render(), element => element.type === 'ClassSelector')[0].props.selectedClassId, 'p1');
  assert.deepEqual(page.nodes(page.render(), element => element.type === 'Select').slice(0, 2).map(element => element.props.value), ['year', 'term']);
  page.setFilter('balanceStatus', 'custom_range');
  const minimum = page.nodes(page.render(), element => element.type === 'input' && element.props.placeholder === 'Min')[0];
  assert.ok(minimum, 'custom balance minimum input is present');
  minimum.props.onChange({ target: { value: '40000' } });
  assert.match(page.summary(page.render()), /Total Fees:Shs\. 120,000Collected:Shs\. 60,000Outstanding:Shs\. 60,000/);
  page.click('Clear');
  page.setFilter('section', 'Day');
  assert.match(page.summary(page.render()), /Total Fees:Shs\. 120,000Collected:Shs\. 60,000Outstanding:Shs\. 60,000/);
  page.setFilter('status', 'Inactive');
  assert.match(page.summary(page.render()), /Total Fees:Shs\. 100,000Collected:Shs\. 0Outstanding:Shs\. 100,000/);
  page.setFilter('status', 'Active');
  const search = page.nodes(page.render(), element => element.type === 'GlassPageSearchInput')[0];
  search.props.onChange({ target: { value: 'no match' } });
  assert.match(page.summary(page.render()), /Total Fees:Shs\. 0Collected:Shs\. 0Outstanding:Shs\. 0/);
  page.click('Clear');
  const selector = page.nodes(page.render(), element => element.type === 'ClassSelector')[0];
  selector.props.onClassChange('p2');
  assert.match(page.summary(page.render()), /Total Fees:Shs\. 100,000Collected:Shs\. 50,000Outstanding:Shs\. 50,000/);
});
