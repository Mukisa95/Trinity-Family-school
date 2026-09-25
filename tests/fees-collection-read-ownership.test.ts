import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('pupil fees share catalogue data and historical calculation inputs', () => {
  const hook = read('src/app/fees/collect/[id]/hooks/usePupilFees.ts');
  const processing = read('src/app/fees/collect/[id]/utils/feeProcessing.ts');
  assert.match(hook, /useFeeStructures\(\)/);
  assert.doesNotMatch(hook, /FeesService\.getAllFeeStructures\(/);
  assert.match(hook, /feesHolidays, uniformFees: allUniformFees, getHistoricalSnapshot, throwOnError: true/);
  assert.match(processing, /preloaded\?\.feesHolidays \?\?/);
  assert.match(processing, /preloaded\?\.uniformFees \?\?/);
  assert.match(processing, /if \(preloaded\?\.throwOnError\) throw error/);
});

test('shared fee catalogue is server-confirmed without a second normal read', () => {
  const service = read('src/lib/services/fees.service.ts');
  const hook = read('src/lib/hooks/use-fees.ts');
  const preloader = read('src/components/providers/global-data-preloader.tsx');
  assert.match(service, /getDocsFromServer\(q\)/);
  assert.match(hook, /'server-confirmed-v1'/);
  assert.match(hook, /refetchOnReconnect: query => query\.state\.status === 'error'/);
  assert.match(preloader, /ensureQueryData\(\{[\s\S]*?queryKey: FEES_QUERY_KEYS\.structures\(\),[\s\S]*?queryFn: FeesService\.getAllFeeStructures/);
});

test('an offline fee read fails instead of accepting an empty local catalogue', async () => {
  const source = read('src/lib/services/fees.service.ts');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} as any };
  let cacheReads = 0;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console: { error() {} },
    require: (name: string) => {
      if (name === 'firebase/firestore') return {
        collection: () => ({}), query: (reference: unknown) => reference, orderBy: () => ({}),
        getDocs: async () => { cacheReads += 1; return { docs: [] }; },
        getDocsFromServer: async () => { throw new Error('backend unavailable'); },
      };
      if (name === '../firebase') return { db: {} };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  await assert.rejects(module.exports.FeesService.getAllFeeStructures(), /backend unavailable/);
  assert.equal(cacheReads, 0);
});

test('missing academic-year data is not described as a valid empty period', () => {
  const page = read('src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx');
  assert.match(page, /academicYears\.length === 0[\s\S]*?Academic years could not be loaded/);
  assert.match(page, /academicYears\.length === 0 && \([\s\S]*?Retry loading/);
  assert.match(page, /Fee information could not be verified[\s\S]*?Retry loading/);
});

test('pupil controls render while financial cells wait for verified inputs', () => {
  const page = read('src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx');
  assert.doesNotMatch(page, /shouldShowFullLoading/);
  assert.match(page, /const isFinancialDataLoading = isPupilFeesLoading \|\| isLoadingAcademicYears \|\| isWaitingForTermYear/);
  assert.match(page, /if \(isFinancialDataLoading\) \{[\s\S]*?Verifying fee amounts and payment history/);
  assert.match(page, /hasTermSelectionError \? '—' : isFinancialDataLoading \? <span/);
  assert.match(page, /disabled=\{isFinancialDataLoading \|\| isPaymentDataLoading\}/);
  assert.match(page, /!isFinancialDataLoading && pupil && selectedAcademicYear && \(/);
  assert.match(page, /isUniformTrackingModalOpen && pupil && \(/);
  assert.match(page, /if \(pupilFees\.length === 0 && schoolPayGeneralPayments\.length === 0\)/);
});

test('a graduated pupil recovers a term cleared during the year switch', () => {
  const page = read('src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx');
  assert.match(page, /if \(selectedAcademicYear && validTerms\.length > 0\) \{[\s\S]*?const isCurrentTermValid = validTerms\.find\(t => t\.id === selectedTermId\);[\s\S]*?if \(!isCurrentTermValid\) \{[\s\S]*?setSelectedTermId\(newestValidTerm\.id\)/);
  assert.doesNotMatch(page, /validTerms\.length > 0 && selectedTermId/);
});

test('Requirements refresh cannot assign records without explicit confirmation', () => {
  const page = read('src/app/requirement-tracking/page.tsx');
  const refresh = page.match(/const refreshTracking = async \(\) => \{([\s\S]*?)\n  \};/)?.[1];
  assert.ok(refresh);
  assert.doesNotMatch(refresh, /autoAssignEligibleRequirements|mutateAsync|\.create\(/);
  assert.match(refresh, /refetchTracking\(\)/);
  assert.match(page, /<AlertDialogAction[\s\S]*?autoAssignEligibleRequirements\(\)/);
  assert.doesNotMatch(page, /setAutoAssignedTerms/);
});

test('family carry-forward reuses holidays and uniforms without nested collection reads', () => {
  const hook = read('src/app/fees/family/[...slug]/hooks/useFamilyFees.ts');
  assert.match(hook, /feesHolidays: feesHolidaysMap\.get\(pupil\.id\)/);
  assert.match(hook, /uniformFees: uniformFeesMap\.get\(pupil\.id\)/);
  assert.doesNotMatch(hook, /getAllUniformFeesForPupil\(/);
  assert.doesNotMatch(hook, /JSON\.stringify\(\[\[\.\.\.allPaymentsMap\]/);
});

test('missing uniform catalogue entries retain their stored balance and empty sets cannot appear paid', () => {
  const converter = read('src/lib/services/uniform-fees-integration.service.ts');
  const modal = read('src/components/common/uniform-tracking-modal.tsx');
  assert.match(converter, /Unknown uniform \(\$\{id\}\)/);
  assert.doesNotMatch(converter, /if \(uniformDetails\.length === 0\)[\s\S]*?return null/);
  assert.match(modal, /formData\.selectionMode === 'full' && eligibleUniforms\.length === 0/);
  assert.match(modal, /const isPaid = hasSelectedItem && paidAmount >= finalAmount/);
});

test('a missing uniform catalogue item keeps its financial tracking record visible', () => {
  const source = read('src/lib/services/uniform-fees-integration.service.ts');
  const module = { exports: {} as any };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console: { warn() {}, error() {} },
    require: () => ({}),
  });
  const record = {
    id: 'tracking-1', pupilId: 'pupil-1', uniformId: 'missing-uniform',
    selectionMode: 'item', academicYearId: 'year-1', termId: 'term-1',
    originalAmount: 40000, finalAmount: 35000, paidAmount: 10000,
    createdAt: '2026-09-01', selectedQuantities: {},
  };
  const fee = module.exports.UniformFeesIntegrationService.convertTrackingRecordToFee(record, []);
  assert.equal(fee.name, 'Uniform - Unknown uniform (missing-uniform)');
  assert.equal(fee.amount, 35000);
  assert.equal(fee.paid, 10000);
  assert.equal(fee.balance, 25000);
});
