const assert = require('node:assert/strict');
const fs = require('node:fs');

const page = fs.readFileSync('src/app/fees/family/[...slug]/page.tsx', 'utf8');
const feesHook = fs.readFileSync('src/app/fees/family/[...slug]/hooks/useFamilyFees.ts', 'utf8');

assert.ok(
  page.includes("import { usePupilsByFamily } from '@/lib/hooks/use-pupils'"),
  'Family Accounts must use the shared cache-first family-pupil hook.',
);
assert.ok(
  !page.includes('PupilsService.getPupilsByFamily'),
  'Family Accounts must not bypass the shared pupil cache with a duplicate lookup.',
);
assert.ok(
  page.includes('if (isFamilyPupilsLoading && familyPupils.length === 0)'),
  'Known family members must render while fee data is still loading.',
);
assert.ok(
  page.includes('Calculating fees…') && page.includes("summary ? money.format(summary.totalFees) : 'Calculating…'"),
  'Family Accounts must show progressive fee loading instead of temporary zero balances.',
);
assert.ok(
  feesHook.includes("import { useFeeStructures } from '@/lib/hooks/use-fees'"),
  'Family fee calculations must reuse the shared fee-structure cache.',
);
assert.ok(
  !feesHook.includes('FeeStructuresService.getAllFeeStructures')
    && !feesHook.includes("queryKey: ['fee-structures-all']"),
  'Family fee calculations must not issue duplicate full fee-structure reads.',
);
assert.ok(
  !feesHook.includes('isAllFeeStructuresLoading || isPaymentsLoading || isSnapshotsLoading || isPreviousBalancesLoading'),
  'Carry-forward calculation must not block the current-term family summary.',
);

console.log('Family fee loading contract passed: cached pupils render first and fee details load progressively.');
