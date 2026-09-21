import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

const paymentPaths = [
  'src/app/fees/family/[...slug]/page.tsx',
  'src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx',
  'src/app/fees/collect/[id]/hooks/usePaymentProcessing.ts',
  'src/app/fees/collect/[id]/utils/paymentReversal.ts',
  'src/app/fees/collect/[id]/utils/carryForwardPayments.ts',
  'src/app/fees/collect/[id]/components/SchoolPayRedistributeModal.tsx',
  'src/lib/hooks/use-payments.ts',
  'src/lib/services/uniform-fees-integration.service.ts',
];

test('interactive payment paths reuse the signed-in Firebase session', () => {
  assert.equal(fs.existsSync('src/app/api/payments/create/route.ts'), false);

  for (const path of paymentPaths) {
    const source = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\/api\/payments\/create/);
    assert.doesNotMatch(source, /ensureServerFirestoreAuth|signInWithCustomToken|getIdToken|onAuthStateChanged/);
  }

  const command = fs.readFileSync('src/lib/services/payment-command.service.ts', 'utf8');
  assert.match(command, /PaymentsService\.createPaymentOperation/);
  assert.match(command, /PaymentsService\.createPayment/);
  assert.doesNotMatch(command, /ensureServerFirestoreAuth|signInWithCustomToken|getIdToken|onAuthStateChanged/);
});

test('payment authentication changes do not alter Firestore security configuration', () => {
  for (const path of ['firestore.rules', 'firestore.indexes.json', 'firebase.json']) {
    assert.equal(
      execFileSync('git', ['diff', '27c70d6d5e1c6c6cb1146a27906a322b87cfabf3', '--', path], { encoding: 'utf8' }),
      '',
    );
  }
});
