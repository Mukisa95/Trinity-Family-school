import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as reminders from '../src/lib/fees/fee-reminders';
import * as customNotes from '../src/lib/fees/custom-fee-notes';
import * as customEditor from '../src/app/fees/collect/[id]/components/CustomFeeNoteEditor';

const note: reminders.FeeReminder = {
  id: 'note', kind: 'pay_later', pupilId: 'joan', pupilName: 'Joan Kagwa', feeId: 'tuition', feeName: 'Tuition',
  academicYearId: 'year', termId: 'term3', academicYearName: '2026', termName: 'Term 3',
  scopes: [{ feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', feeName: 'Tuition', academicYearName: '2026', termName: 'Term 3' }],
  promisedAmount: 20000, promisedBy: 'Rose Kagwa', phone: '+256700123456', additionalNote: '', balanceAtCreation: 40000,
  baselinePaymentIds: [], createdAt: '2026-09-26T06:00:00Z', dueAt: '2026-10-03T06:00:00Z', createdBy: 'cashier',
  createdByName: 'Fee Collector', reminderStatus: 'scheduled',
};

function renderModal({ view = 'notes', ledger = [] as any[], loading = false, viewer = false, recipientIds = null as string[] | null,
  effects = undefined as undefined | Array<() => unknown>, stateChanges = undefined as undefined | any[],
  notePatch = {} as Partial<reminders.FeeReminder>, confirmCancel = false } = {}) {
  const source = fs.readFileSync('src/app/fees/collect/[id]/components/FeeNotesModal.tsx', 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} as any };
  let stateIndex = 0;
  let cardStateIndex = 0;
  const states = [view, 'tuition', '20000', 'Rose Kagwa', '+256700123456', '2026-10-03', '09:00', '', '', new Date(note.dueAt), recipientIds];
  const tag = (name: string) => ({ children, ...props }: any) => {
    delete props.variant; delete props.open; delete props.onOpenChange;
    return React.createElement(name, props, children);
  };
  vm.runInNewContext(output, { module, exports: module.exports, Date, console, navigator: {}, window: {setInterval: () => 1, clearInterval() {}},
    require: (name: string) => {
      if (name === 'react') return { ...React,
        useEffect: effects ? (effect: () => unknown) => effects.push(effect) : React.useEffect,
        useState: (initial: any) => {
          const [state, setState] = React.useState(stateIndex < states.length ? states[stateIndex++]
            : confirmCancel && cardStateIndex++ === 0 ? true : initial);
          return [state, stateChanges ? (value: any) => stateChanges.push(value) : setState];
        },
      };
      if (name === 'react/jsx-runtime') return require('react/jsx-runtime');
      if (name === 'lucide-react') return new Proxy({}, { get: () => () => React.createElement('svg') });
      if (name === '@/lib/fees/fee-reminders') return reminders;
      if (name === '@/lib/fees/custom-fee-notes') return customNotes;
      if (name === './CustomFeeNoteEditor') return customEditor;
      if (name === '@/components/ui/dialog') return { Dialog: tag('div'), DialogContent: tag('section'), DialogTitle: tag('h2'), DialogDescription: tag('p') };
      if (name === '@/components/ui/button') return { Button: tag('button') };
      if (name === '@/components/ui/input') return { Input: tag('input') };
      if (name === '@/components/ui/label') return { Label: tag('label') };
      if (name === '@/components/ui/textarea') return { Textarea: tag('textarea') };
      if (name === '@/hooks/use-toast') return { useToast: () => ({ toast() {} }) };
      if (name === '@/lib/contexts/auth-context') return { useAuth: () => ({ user: {
        id: 'cashier', role: 'Staff', isActive: true, modulePermissions: [{ module: 'fees', permission: viewer ? 'view_only' : 'edit' }],
      } }) };
      if (name === '@/lib/hooks/use-fee-reminders') return { useFeeReminders: () => ({
        notes: { data: [{...note, ...notePatch}], isLoading: false, isError: false, refetch() {} }, create: { isPending: false }, cancel: { isPending: false },
        recipients: { data: [{id: 'cashier', name: 'Fee Collector', role: 'Staff'}, {id: 'head', name: 'Head Teacher', role: 'Admin'}], isLoading: false },
        updateRecipients: { isPending: false },
      }) };
      throw new Error(name);
    },
  });
  return renderToStaticMarkup(React.createElement(module.exports.FeeNotesModal, {
    open: true, onOpenChange() {}, pupil: { id: 'joan', firstName: 'Joan', lastName: 'Kagwa', guardians: [] },
    fees: [{ id: 'tuition', name: 'Tuition', balance: 40000 }, { id: 'cleared', name: 'Already cleared fee', balance: 0 }],
    payments: ledger, academicYear: { id: 'year', name: '2026', terms: [{ id: 'term3', name: 'Term 3' }] }, termId: 'term3',
    previousBalance: null, isPaymentDataLoading: loading,
  }));
}

test('the reminder form includes every promised field, defaults to Promise, and lists only unpaid fees', () => {
  const html = renderModal({ view: 'create' });
  for (const id of ['fee-note-kind', 'fee-note-fee', 'fee-note-amount', 'fee-note-person', 'fee-note-phone', 'fee-note-date', 'fee-note-time', 'fee-note-extra']) {
    assert.ok(html.includes(`id="${id}"`)); assert.ok(html.includes(`for="${id}"`));
  }
  assert.match(html, /value="promise" selected=""/); assert.doesNotMatch(html, /Already cleared fee/);
  assert.match(html, /Rose Kagwa.*Joan Kagwa/); assert.match(html, /20,000 shillings/);
  assert.match(html, /All active users with Fees access/); assert.match(html, /East Africa time/);
});

test('a partial note card shows its shortfall and a working telephone link', () => {
  const html = renderModal({ ledger: [{ id: 'payment', pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 15000,
    paymentDate: '2026-09-30T06:00:00Z' }] });
  assert.match(html, /Partly paid/); assert.match(html, /5,000 shillings less/); assert.match(html, /href="tel:\+256700123456"/);
});

test('a fulfilled promise shows the completion state and removes the parent call action', () => {
  const html = renderModal({ ledger: [{ id: 'payment', pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 20000,
    paymentDate: '2026-09-30T06:00:00Z' }] });
  assert.match(html, /Promise paid/); assert.match(html, /full promised amount was paid/); assert.doesNotMatch(html, /href="tel:/);
});

test('loading the ledger cannot render a false no-payment claim', () => {
  const html = renderModal({ loading: true });
  assert.match(html, /Checking the latest payments/); assert.doesNotMatch(html, /No payment was made/);
});

test('view-only collectors can read note cards without creation or cancellation controls', () => {
  const html = renderModal({ viewer: true });
  assert.match(html, /No payment yet/); assert.doesNotMatch(html, /Cancel reminder/); assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, />(Promise|Custom note)<\/button>/);
  assert.doesNotMatch(html, /Change recipients/);
});

test('new notes can target specific Fees users, with accessible checkboxes', () => {
  const html = renderModal({ view: 'create', recipientIds: ['head'] });
  assert.match(html, /Choose specific people/); assert.match(html, /Head Teacher/);
  assert.match(html, /type="checkbox"/); assert.match(html, /1 people selected/);
});

test('Notes shows active promises in detail and allows recipient changes', () => {
  const html = renderModal();
  assert.match(html, /Active notes · 1/); assert.match(html, /Change recipients/);
  assert.match(html, /Created 26 September 2026/); assert.match(html, /Contact: \+256700123456/);
  assert.match(html, /Remind on 3 October 2026 at 09:00/); assert.match(html, /Recipients:/);
});

test('fully paid notes move to expandable history and have no outstanding reminder controls', () => {
  const html = renderModal({ ledger: [{ id: 'full', pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 20000,
    paymentDate: '2026-09-30T06:00:00Z' }] });
  assert.match(html, /Active notes · 0/); assert.match(html, /Completed and cancelled notes · 1/);
  assert.match(html, /Reminder dismissed · promise paid/); assert.doesNotMatch(html, /Change recipients|Cancel reminder/);
});

test('opening Notes resets a previously open creation form to the active notes list', () => {
  const effects: Array<() => unknown> = []; const stateChanges: any[] = [];
  renderModal({view: 'create', effects, stateChanges});
  effects.forEach(effect => effect());
  assert.ok(stateChanges.includes('notes'));
});

test('the cancel confirmation explains immediate recipient notification and accepts a reason even after sending', () => {
  const html = renderModal({confirmCancel: true, notePatch: {reminderStatus: 'sent'}});
  assert.match(html, /immediately notify its recipients/); assert.match(html, /Cancel and notify/);
  assert.match(html, /Cancellation reason \(optional\)/); assert.match(html, /id="fee-note-cancel-note"/);
  assert.match(html, /for="fee-note-cancel-note"/);
});

test('cancelled-note details show the reason, actor and pending update without claiming payment', () => {
  const html = renderModal({notePatch: {reminderStatus: 'cancelled', cancelledByName: 'Head Teacher',
    cancelReason: 'Parent has a new arrangement', cancelledAt: '2026-10-01T06:15:00Z',
    resolutionNotificationId: 'update', dismissalPending: true}});
  assert.match(html, /Head Teacher.*Parent has a new arrangement/);
  assert.match(html, /Cancellation itself does not confirm payment/);
  assert.match(html, /pending and will retry automatically/); assert.match(html, /Cancelled on 1 October 2026 at 09:15/);
});

test('custom creation offers free text, inline fields, scoped fee amounts, addition/subtraction and every condition', () => {
  const html = renderModal({view: 'custom'});
  for (const id of ['custom-note-message', 'custom-note-field', 'custom-note-scope', 'custom-calc-left', 'custom-calc-operation', 'custom-calc-right', 'custom-note-condition', 'custom-note-date', 'custom-note-time']) {
    assert.ok(html.includes(`id="${id}"`)); assert.ok(html.includes(`for="${id}"`));
  }
  assert.match(html, /Insert into note/); assert.match(html, /Insert calculation into note/);
  assert.match(html, /Already cleared fee/); assert.match(html, /Add<\/option>/); assert.match(html, /Subtract<\/option>/);
  for (const key of Object.keys(customNotes.CUSTOM_NOTE_CONDITIONS)) assert.ok(html.includes(`value="${key}"`));
  assert.match(html, /All active users with Fees access/); assert.match(html, /Future payments are unknown/);
  assert.doesNotMatch(html, /id="fee-note-person"|id="fee-note-phone"/);
});

test('custom cards show their words, calculations and condition without inheriting promise fulfilment or parent-call controls', () => {
  const html = renderModal({notePatch: {kind: 'custom', liveMessage: 'Joan Kagwa owes 0 shillings.', custom: {
    message: '[Pupil name] owes [Balance].', fields: [{label: 'Pupil name', metric: 'pupil_name'}, {label: 'Balance', metric: 'balance'}], condition: {type: 'scheduled'},
  }}, ledger: [{id: 'full', pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 40000, paymentDate: '2026-09-30T06:00:00Z'}]});
  assert.match(html, /Active notes · 1/); assert.match(html, /Joan Kagwa owes 0 shillings/);
  assert.match(html, /Condition: At the chosen date and time/); assert.match(html, /Change recipients/);
  assert.doesNotMatch(html, /parent\/guardian of|href="tel:|Promised amount paid/);
});
