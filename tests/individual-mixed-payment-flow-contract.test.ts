import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('individual mixed-fee submissions use one operation for regular, uniform and carry-forward allocations', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx'),
    'utf8',
  ).replace(/\r\n/g, '\n');
  const start = source.indexOf('const useAtomicMixedPaymentOperation = true;');
  const legacyBranch = source.indexOf('\n      } else {\n\n      const regularSelections', start);
  assert.ok(start >= 0, 'the live multi-fee handler must select the atomic operation');
  assert.ok(legacyBranch > start, 'the atomic section must be bounded before the retained fallback');

  const atomicSection = source.slice(start, legacyBranch);
  assert.match(atomicSection, /prepareCarryForwardPayment/);
  assert.match(atomicSection, /uniformTracking/);
  assert.match(atomicSection, /clearPaymentOperation\(operationIntent\)/);
  assert.match(atomicSection, /fee-payment:\$\{operation\.operationId\}:\$\{paymentId\}/);
  assert.equal((atomicSection.match(/fetch\('\/api\/payments\/create'/g) || []).length, 1);
  assert.doesNotMatch(atomicSection, /processCarryForwardPayment\(/);
  assert.doesNotMatch(atomicSection, /createUniformPaymentRecord\(/);
});
