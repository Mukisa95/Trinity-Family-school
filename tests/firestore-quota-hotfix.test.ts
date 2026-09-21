import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isFirestoreQuotaError } from '../src/lib/utils/firestore-quota-error';

const read = (path: string) => readFileSync(path, 'utf8');

test('Firestore quota errors are recognized without exposing unrelated failures', () => {
  assert.equal(isFirestoreQuotaError({ code: 8, message: 'RESOURCE_EXHAUSTED: Quota exceeded.' }), true);
  assert.equal(isFirestoreQuotaError({ code: 'resource-exhausted' }), true);
  assert.equal(isFirestoreQuotaError({ cause: { code: 'firestore/resource-exhausted' } }), true);
  assert.equal(isFirestoreQuotaError(new Error('permission denied')), false);
});

test('parent background preparation uses one revision listener and never mounts fee hooks', () => {
  const preparer = read('src/components/parent/parent-offline-dataset-preparer.tsx');
  const revisions = read('src/lib/hooks/use-parent-dashboard-revision.ts');

  assert.match(preparer, /useParentDashboardRevisions\(familyId\)/);
  assert.match(preparer, /requestIdleCallback/);
  assert.match(preparer, /saved\.revision < bankingRevision/);
  assert.match(preparer, /saved\.revision < attendanceRevision/);
  assert.match(preparer, /saved\.revision < resultsRevision/);
  assert.doesNotMatch(preparer, /ParentOfflineFeePreparer|usePupilFees|Promise\.all/);
  assert.equal((revisions.match(/onSnapshot\(/g) || []).length, 1);
  assert.match(revisions, /revisionEntries = new Map/);
});

test('staff pupil data and secondary catalogs are not eagerly read by the global preloader', () => {
  const preloader = read('src/components/providers/global-data-preloader.tsx');

  assert.match(preloader, /usePupilCacheBootstrap\(\);/);
  assert.doesNotMatch(preloader, /setupPupilsListener\(\)\.catch/);
  assert.doesNotMatch(preloader, /const fetch(?:Fees|Requirements|Uniforms|Photos)/);
  assert.doesNotMatch(preloader, /firestoreQuery\(collection\(db, 'pupils'\)\)/);
});

test('quota failures return a retryable service response and payment dialogs are described', () => {
  const route = read('src/app/api/payments/create/route.ts');
  assert.match(route, /FIRESTORE_QUOTA_EXHAUSTED/);
  assert.match(route, /status: 503/);
  assert.match(route, /'Retry-After': '900'/);

  for (const path of [
    'src/app/fees/collect/[id]/components/PaymentModal.tsx',
    'src/app/fees/collect/[id]/components/CarryForwardPaymentModal.tsx',
    'src/app/fees/collect/[id]/components/MultiFeePaymentModal.tsx',
  ]) {
    assert.match(read(path), /<DialogDescription className="sr-only">/);
  }
});

test('routine operational audit writes are limited to one hourly summary', () => {
  const audit = read('src/components/providers/operational-audit-provider.tsx');
  assert.match(audit, /const FLUSH_INTERVAL_MS = 60 \* 60 \* 1000/);
  assert.match(audit, /const MIN_EARLY_FLUSH_MS = 15 \* 60 \* 1000/);
  assert.match(audit, /const ABANDONED_SESSION_MS = 2 \* FLUSH_INTERVAL_MS/);
});
