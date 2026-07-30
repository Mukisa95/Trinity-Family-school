const assert = require('assert');
const fs = require('fs');

const feeCard = fs.readFileSync(
  'src/app/fees/collect/[id]/components/FeeCard.tsx',
  'utf8',
);
const collectionModal = fs.readFileSync(
  'src/components/common/collection-modal.tsx',
  'utf8',
);
const trackingService = fs.readFileSync(
  'src/lib/services/uniform-tracking.service.ts',
  'utf8',
);
const trackingHook = fs.readFileSync(
  'src/lib/hooks/use-uniform-tracking.ts',
  'utf8',
);
const trackingPage = fs.readFileSync(
  'src/app/uniform-tracking/page.tsx',
  'utf8',
);
const pupilFeesHook = fs.readFileSync(
  'src/app/fees/collect/[id]/hooks/usePupilFees.ts',
  'utf8',
);
const pupilFeesPage = fs.readFileSync(
  'src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx',
  'utf8',
);
const uniformFeesService = fs.readFileSync(
  'src/lib/services/uniform-fees-integration.service.ts',
  'utf8',
);

const handlerStart = feeCard.indexOf('const handleCollectionSubmit = async');
const handlerEnd = feeCard.indexOf('// Handle unmark', handlerStart);
assert(handlerStart !== -1 && handlerEnd !== -1, 'Uniform collection handler was not found.');
const handler = feeCard.slice(handlerStart, handlerEnd);

const sizesIndex = handler.indexOf('const mergedSizes =');
assert(
  sizesIndex !== -1 && handler.includes('selectedSizes: mergedSizes'),
  'Collection sizes must be merged before the tracking record is updated.',
);
assert(
  handler.includes('stockReductions,') &&
    !handler.includes('reduceStockBatch.mutateAsync'),
  'The fee card must send stock reductions through the tracking mutation.',
);
assert(
  trackingHook.includes('updateTrackingRecordWithStock') &&
    trackingService.includes('runTransaction') &&
    trackingService.includes('UNIFORM_INVENTORY_COLLECTION') &&
    trackingService.includes('Insufficient stock'),
  'Collection tracking and inventory reductions must share one guarded transaction.',
);
assert(
  trackingPage.includes('stockReductions,') &&
    !trackingPage.includes('useReduceStockBatch'),
  'The standalone uniform tracking page must use the same atomic collection write.',
);
assert(
  !trackingService.includes('transaction.get(trackingRef)') &&
    trackingService.includes('inventoryRefs.map(({ ref }) => transaction.get(ref))') &&
    trackingService.includes('transaction.update(trackingRef'),
  'The transaction must not reread tracking data already owned by the pupil cache.',
);
assert(
  !feeCard.includes('useUniformTrackingRecord') &&
    !pupilFeesPage.includes('useUniformTrackingByPupil') &&
    pupilFeesHook.includes('useUniformTrackingByPupil(pupilId)') &&
    pupilFeesHook.includes('convertTrackingRecordsToFees') &&
    !pupilFeesHook.includes("queryKey: ['uniform-fees'"),
  'The pupil fee hook must be the only uniform tracking owner on the fees page.',
);
assert(
  uniformFeesService.includes('uniformTrackingRecord: record') &&
    pupilFeesPage.includes('uniformTrackingRecord={') &&
    pupilFeesPage.includes("record.collectionStatus === 'collected'") &&
    feeCard.includes('effectiveCollectionStatus') &&
    feeCard.includes('Collection is disabled to protect existing records.'),
  'Fee cards must receive authoritative records and preserve legacy collected state.',
);
assert(
  trackingService.includes('getDocsFromCache') &&
    trackingService.includes('getDocFromCache') &&
    trackingHook.includes('setQueriesData') &&
    trackingHook.includes('reduceCachedUniformInventory'),
  'Quota fallback and successful mutations must update cache without refetching.',
);
assert(
  collectionModal.includes('collectionQuantities: Record<string, number>') &&
    collectionModal.includes('const handleSizeChange =') &&
    collectionModal.includes('await onSubmit(') &&
    collectionModal.includes(
      'onSubmit(selectedItems, isFullCollection, collectionSizes, collectionQuantities)',
    ),
  'The shared collection modal must retain typed size and quantity selections until submission succeeds.',
);

console.log(
  'Uniform collection contract passed: quantities are typed and collection tracking plus stock update atomically.',
);
