import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx'),
  'utf8',
).replace(/\r\n/g, '\n');
const reversalStart = source.indexOf('<AlertDialog\n        open={Boolean(pendingPaymentReversal)}');
const reversalEnd = source.indexOf('\n      <PrintModal', reversalStart);
const reversalDialog = source.slice(reversalStart, reversalEnd);

test('payment reversal dialog uses compact responsive information and actions', () => {
  assert.ok(reversalStart >= 0, 'the payment reversal dialog must exist');
  assert.match(reversalDialog, /w-\[calc\(100%-1rem\)\] max-w-md/);
  assert.match(reversalDialog, /grid grid-cols-2 overflow-hidden rounded-xl/);
  assert.match(reversalDialog, /text-\[10px\][\s\S]*?>Pupil/);
  assert.match(reversalDialog, /className="sr-only">\s*Confirm reversal of this recorded school payment\./);
  assert.match(reversalDialog, /grid grid-cols-2 gap-2.*bg-slate-50/);
  assert.match(reversalDialog, /rounded-full/);
  assert.match(reversalDialog, /Keep payment/);
  assert.match(reversalDialog, /Reverse payment/);
});

test('payment reversal dialog removes the long introductory and five-item warning copy', () => {
  assert.doesNotMatch(reversalDialog, /Review the payment and its effect before confirming/);
  assert.doesNotMatch(reversalDialog, /Nothing will change unless you choose to reverse it/);
  assert.doesNotMatch(reversalDialog, /<ul className="mt-2 list-disc/);
  assert.match(reversalDialog, /Marks this school record as reversed, recalculates the balance/);
  assert.match(reversalDialog, /It does not send money back/);
});
