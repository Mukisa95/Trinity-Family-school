const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');

const feeProcessing = read('src/app/fees/collect/[id]/utils/feeProcessing.ts');
const familyHook = read('src/app/fees/family/[...slug]/hooks/useFamilyFees.ts');
const familyModal = read('src/app/fees/family/[...slug]/components/FamilyPaymentModal.tsx');
const pupilCollection = read('src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx');
const multiFeeModal = read('src/app/fees/collect/[id]/components/MultiFeePaymentModal.tsx');

assert.ok(
  feeProcessing.includes('calculateFeeAmountAfterDiscounts({'),
  'Pupil fee processing must use the shared discount-aware payable amount.',
);

assert.ok(
  familyHook.includes('const processedFees = processPupilFees(') &&
    familyHook.includes('selectedTermId, selectedAcademicYear, academicYears, activeFeesHolidays'),
  'Family fees must include assigned discounts and active fee holidays.',
);
assert.ok(
  familyModal.includes('maxAmount: fee.balance') &&
    familyModal.includes('findDiscountAwarePaymentViolation(') &&
    familyModal.includes('selectedFees: payableSelections'),
  'Family Payment must distribute and submit only within current discount-adjusted balances.',
);

assert.ok(
  pupilCollection.includes('balance: fee.balance') &&
    pupilCollection.includes('fees={pupilFees.map'),
  'Multi-Fee Payment must receive the processed pupil fee balance.',
);
assert.ok(
  multiFeeModal.includes('maxAmount: fee.balance') &&
    multiFeeModal.includes('findDiscountAwarePaymentViolation(') &&
    multiFeeModal.includes('selectedFees: payableSelections'),
  'Multi-Fee Payment must distribute and submit only within current discount-adjusted balances.',
);

console.log('Discount-aware payment flow contract passed for Family Payment and Multi-Fee Payment.');
