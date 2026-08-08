# Exams Performance and Firestore Read-Quota Plan

Status: implementation plan only. No production code, Firestore data, rules, or deployment is changed by this document.

## 1. Outcome

Make the exams workflow feel immediate on repeat visits while reducing Firestore reads without allowing stale marks, duplicate result documents, cross-account cache exposure, or competing cache owners.

The implementation is divided into independently verifiable stages:

1. Cache exam definitions through one revision-driven owner.
2. Establish a reliable one-result-per-exam data model.
3. Cache individual exam results in IndexedDB and invalidate them by term revision.
4. Add a transactional, renewable editing lease for mark-entry routes.
5. Measure reads and loading behaviour before enabling optional background prefetching.

## 2. Success criteria

### Exam definitions

- A warm exams page renders from local cache before the network responds.
- When `dataRevisions.exams` is unchanged, opening an exams consumer performs zero reads on the `exams` collection.
- Only one browser owner may perform a full `exams` collection read.
- `useExams`, filtered exam hooks, class-detail exam lists, pupil history, and `useExamsAsEvents` derive from the same shared snapshot.
- Every exam create, update, or delete updates the exam revision atomically.
- Exam changes that affect the calendar projection also update the events revision atomically.

### Exam results

- A warm result page paints the requested result from IndexedDB immediately.
- If the cached term revision matches the server revision, opening the result performs zero `examResults` reads.
- If the revision differs, only the requested exam result is fetched; the application does not eagerly fetch three whole terms.
- A save on another device causes an already-open page for that exam to refresh automatically through the existing settings revision channel.
- All result mutation paths bump the appropriate term revision in the same commit.
- A successful save patches React Query and IndexedDB without a post-save Firestore read on the saving device.

### Security and isolation

- Cache keys include Firebase project, Firebase UID, and role.
- Full class-wide result documents are never stored in a Parent cache.
- Logout or account switching cannot expose the previous user's in-memory results.
- Only Staff/Admin users can acquire result-editing leases.

### Locking

- Two simultaneous acquisition attempts produce exactly one lease holder.
- A stale browser cannot release or delete a replacement lease.
- Losing a lease makes the editor read-only before another save can occur.
- Browser shutdown cleanup is best-effort; lease expiry and renewal provide the real recovery mechanism.

## 3. Non-goals

- Do not make IndexedDB or `localStorage` an authorization boundary.
- Do not preload all historical exam results.
- Do not use `staleTime: Infinity` without an authoritative revision comparison.
- Do not introduce another global Firestore listener for exam definitions or exam results.
- Do not make the initial implementation depend on background jobs or Cloud Functions.
- Do not destructively migrate or delete legacy result documents until a dry-run report and post-copy verification pass.

## 4. Data ownership model

| Dataset | Browser owner | Persistent cache | Invalidation | Network behaviour |
|---|---|---|---|---|
| Exam definitions | `useExamCacheBootstrap` | Scoped `localStorage` snapshot | `dataRevisions.exams` | Full collection only on cold cache or revision mismatch |
| One exam result | `useExamResultCache` / result query hook | Scoped IndexedDB entry per exam | `dataRevisions.examResults[termKey]` | Requested result only on cold cache or revision mismatch |
| Result-editing lease | `useExamLease` | None | One document listener while an editor route is mounted | One small document listener plus periodic renewal writes |
| Calendar exam projection | `useExamsAsEvents` | Existing scoped event cache | `dataRevisions.events` | Derived from shared exams; no direct `exams` read |

The existing singleton `school-settings` listener remains the only revision channel. No polling is added.

## 5. Revision model

### 5.1 Types

Modify `src/types/index.ts`:

```ts
dataRevisions?: {
  timetable?: Record<string, number>;
  events?: number;
  classes?: number;
  academicYears?: number;
  staff?: number;
  pupils?: number;
  attendance?: number;
  exams?: number;
  examResults?: Record<string, number>;
};
```

### 5.2 Stable term key

Add a helper beside the existing timetable revision-key helper:

```ts
examResults: (academicYearId: string, termId: string) =>
  `${encodeURIComponent(academicYearId)}__${encodeURIComponent(termId)}`;
```

### 5.3 Combined revision writes

Avoid adding multiple `batch.set()` operations against `settings/school-settings`. Add helpers that publish the required fields in one write:

```ts
bumpExamDefinitionRevisionsInBatch(batch, { affectsEvents: true });
bumpExamResultRevisionInBatch(batch, academicYearId, termId);
```

An exam-definition mutation normally increments both `exams` and `events`, because legacy exams are projected into the calendar even when no canonical event document is changed.

A marks/result mutation increments only `examResults[termKey]`; it must not force a full exam-definition reload.

## 6. Identity-scoped cache keys

Create one shared scope helper:

```text
{projectId}:{firebaseUid}:{role}
```

Examples:

```text
exams:v2:{scope}
examResult:v2:{scope}:{examId}
examResultManifest:v2:{scope}
```

Rules:

- Staff/Admin may use the full exam-definition cache and result cache.
- Parent must not bootstrap the school-wide exams or class-wide `examResults` collections.
- Parent result screens must continue toward pupil-safe projections keyed by UID, pupil, year, and term.
- React Query keys must include the same scope, not only `examId`.
- On scope change, remove exam/result queries and clear the service singleton before hydrating the new scope.
- Persisted entries may remain for later use because they are identity-scoped, but protected in-memory queries must be removed immediately.

## 7. Stage 0 — Baseline and mutation inventory

Before changing behaviour:

1. Record Firestore reads for:
   - cold dashboard load;
   - warm dashboard load;
   - cold exams page;
   - warm exams page;
   - cold result page;
   - warm result page;
   - result save followed by navigation away and back.
2. Record visible-data timing separately from production/server reconciliation timing.
3. Inventory every browser write to `exams` and `examResults`.
4. Add a temporary contract report listing any direct `getDocs(collection(db, 'exams'))` outside the future cache owner.
5. Run a read-only duplicate analysis for `examResults`, grouped by `examId`.

Known exam-definition mutation paths that must be covered:

- `src/lib/services/exams.service.ts`
- `src/lib/hooks/use-exams.ts`
- exam create/update/delete paths in `src/lib/hooks/use-events-fixed.ts`

Known result mutation paths that must be covered:

- create/update/delete in `src/lib/services/exams.service.ts`
- mutation hooks in `src/lib/hooks/use-exams.ts`
- grading-scale and result saves in the exams page and Record Results view
- `EditSnapshotView`
- release/revoke operations in `src/lib/services/results-release.service.ts`
- migration scripts that create result documents

Exit gate: the inventory and duplicate report are complete; no implementation path is assumed to be the only writer without evidence.

## 8. Stage 1 — Exam-definition cache

### 8.1 Add `src/lib/cache/exam-cache.ts`

Mirror the proven staff-cache structure, with an identity scope:

```ts
type ExamCacheSnapshot = {
  schema: 2;
  revision: number;
  writtenAt: number;
  data: Exam[];
};
```

Responsibilities:

- Normalize all Firestore timestamps to ISO strings.
- Sort consistently by `createdAt` descending, with a stable ID tie-breaker.
- Validate schema, revision, and array shape on read.
- Treat corrupt/legacy payloads as a cache miss.
- Use revision `-1` only for a locally patched but not yet server-confirmed snapshot.

### 8.2 Make `ExamsService` browser-cache aware

Add:

- `hydrateSharedExams(exams)`
- `clearSharedExams()`
- `refreshSharedExams(load)` for single-flight reconciliation
- `getAllForCache()` using a strict server read with timeout
- `getAllFromFirestoreCache()` for Firebase IndexedDB recovery

Browser versions of these methods must filter the shared snapshot rather than create new reads:

- `getAllExams`
- `getExamById`
- `getExamsByClass`
- `getExamsByAcademicYear`
- `getExamsByAcademicYearAndTerm`
- `getExamsByBatch`

Server/script callers may retain direct Firestore reads.

### 8.3 Add `useExamCacheBootstrap`

For authenticated Staff/Admin only:

1. Compute the identity scope.
2. Hydrate React Query and `ExamsService` synchronously from `localStorage` when available.
3. Wait for revision readiness without discarding visible cached data.
4. If cold, race the free Firebase IndexedDB recovery against the strict server refresh.
5. If the persisted revision matches, do not read Firestore.
6. If it mismatches, perform one single-flight server refresh.
7. Retry bounded network failures twice with a three-second delay.
8. On logout/scope change, remove scoped queries and clear the singleton.

Mount it in `GlobalDataPreloader`, but ensure the role guard prevents Parent collection reads.

### 8.4 Refactor all exam hooks to cache-only selectors

Refactor:

- `useExams`
- `useExamsOptimized`
- `useExam`
- `useExamsByClass`
- `useExamsByAcademicYear`
- `useExamsByBatch`

They should select from one scoped list query with `enabled: false`, `staleTime: Infinity`, and no network query function.

### 8.5 Remove the competing calendar owner

Refactor `useExamsAsEvents` so it derives from the shared exam snapshot. Remove its direct `getDocsFromServer(collection(db, 'exams'))` path.

Retain its events revision because the rendered projection also depends on canonical calendar events.

### 8.6 Patch successful mutations

After a successful exam mutation:

- patch the scoped React Query list;
- hydrate the service singleton;
- write revision `-1` to the scoped cache;
- let the settings revision confirm and reconcile once;
- do not call invalidation functions that can trigger competing collection reads.

All direct exam mutations in `use-events-fixed.ts` must publish the exam revision too.

Stage 1 exit gate:

- warm exam consumers cause zero `exams` reads when revision is unchanged;
- a remote exam mutation refreshes the list once;
- dashboard/calendar and exams page share identical exam data;
- account switching shows no previous account data;
- the ownership contract finds no unauthorized browser collection reader.

## 9. Stage 2 — Canonical exam-result model

The cache and lease assume one authoritative result document per exam. The current auto-ID creation and “first matching result” read do not guarantee that invariant.

### 9.1 Extend `ExamResult`

Add:

```ts
academicYearId: string;
termId: string;
```

New result shells must copy these fields from their exam.

### 9.2 Canonical document ID

Target model:

```text
examResults/{examId}
```

This provides:

- one-result-per-exam uniqueness;
- one point read instead of a query by `examId`;
- a deterministic cache key;
- simpler transactional saves.

### 9.3 Safe migration

Implement a separate Admin SDK migration with two modes:

1. Dry run:
   - list result documents grouped by `examId`;
   - report missing exams, missing year/term, and duplicates;
   - choose no duplicate winner automatically.
2. Apply after review:
   - copy verified unique legacy results to `examResults/{examId}`;
   - add year/term from the linked exam;
   - verify field counts and critical hashes after copy;
   - update any actual result-document references;
   - leave legacy documents intact during the compatibility period.

Use dual-read compatibility temporarily:

1. Read `examResults/{examId}`.
2. If absent, fall back to the legacy `where('examId', '==', examId)` query.
3. Log fallback usage so migration coverage is measurable.

Legacy deletion is a later, explicitly approved operation after production verification.

### 9.4 Atomic future creation

Create the exam definition and its empty result shell in a coordinated batch whenever feasible. If batch size limits require chunking, publish only fully completed chunks and report partial failures clearly.

Stage 2 exit gate:

- the dry-run report has no unresolved duplicates for migrated exams;
- new exams create deterministic result documents;
- all new results include year and term;
- dual-read fallback works without changing visible results.

## 10. Stage 3 — On-demand exam-result cache

### 10.1 Extend the IndexedDB helper

Add safe deletion support to `persistent-collection-cache.ts`:

- `deletePersistentCollection(key)`
- optionally `deletePersistentCollections(keys)` in one transaction

Cache failure must never prevent a Firestore read or result save.

### 10.2 Add `src/lib/cache/exam-result-cache.ts`

Store one result per key:

```ts
type CachedExamResult = {
  schema: 2;
  academicYearId: string;
  termId: string;
  observedTermRevision: number;
  writtenAt: number;
  data: ExamResult | null;
};
```

Store `null` explicitly for a confirmed missing result, but only with a confirmed revision. This prevents repeated empty queries while still allowing a later result creation to invalidate the entry.

The small scoped manifest contains:

```ts
type ExamResultManifestEntry = {
  examId: string;
  academicYearId: string;
  termId: string;
  lastAccessedAt: number;
};
```

### 10.3 Result hook flow

`useExamResultByExamId(examId)` becomes scope- and revision-aware:

1. Resolve the exam from the shared exam-definition cache.
2. Resolve `academicYearId`, `termId`, and current term revision.
3. Read the per-exam IndexedDB entry and seed React Query immediately.
4. If the cached revision equals the current term revision, stop.
5. If missing or mismatched, fetch only `examResults/{examId}` from the server.
6. Normalize and publish the result to React Query.
7. Persist it with the observed revision.
8. Deduplicate concurrent requests for the same scoped exam.

When the settings listener publishes a higher term revision, an open page refetches only its current exam result. This replaces the result collection listener while preserving cross-device updates.

### 10.4 Successful save flow

Every result mutation must return enough normalized data to patch local state. After the Firestore commit succeeds:

- set the scoped by-exam React Query data;
- persist the individual result with the new known/optimistic revision state;
- avoid an immediate `refetchExamResult()` on the saving device;
- let the revision channel reconcile if the final revision has not arrived yet.

Do not rewrite an entire term array after one result changes.

### 10.5 Rolling three-term retention

Retention is storage management, not a prefetch instruction.

1. Determine the current term from actual term dates/current-term logic.
2. Walk backward through chronologically sorted term start dates.
3. Keep the current term and two preceding terms.
4. Do not select future terms merely because they are the newest configured terms.
5. Delete manifest/result entries outside the window lazily when a result page opens.
6. Tolerate missing IndexedDB entries even when the manifest still references them.

Stage 3 exit gate:

- warm unchanged result opens with zero result reads;
- a term revision mismatch reads only the requested result;
- a remote save updates an already-open view automatically;
- release/revoke changes invalidate the cached result;
- empty results, deleted results, corrupt entries, and IndexedDB denial recover safely;
- the saving device does not issue a redundant post-save read.

## 11. Stage 4 — Transactional result-editing lease

### 11.1 Lease document

Collection: `examLocks`; document ID: `examId`.

```ts
type ExamLease = {
  examId: string;
  lockedByUid: string;
  lockedByName: string;
  leaseId: string;
  acquiredAt: Timestamp;
  renewedAt: Timestamp;
  expiresAt: Timestamp;
};
```

Use a random `leaseId` per mounted editor session. User ID alone is insufficient when the same user opens two tabs.

### 11.2 Transactional acquisition

`acquireExamLease` must run in a Firestore transaction:

1. Read `examLocks/{examId}`.
2. If absent or expired, write the caller's lease.
3. If it has the same `leaseId`, renew it.
4. Otherwise return the active holder without writing.

Never use unconditional `setDoc()` for acquisition.

### 11.3 Renewal and expiry

Recommended initial values:

- ten-minute lease;
- renew every two minutes while the page is visible and online;
- pause unnecessary renewal while hidden, but renew immediately on visibility return;
- schedule a local expiry timer because a snapshot listener does not fire merely because time passes;
- allow a small clock-skew margin when evaluating expiry.

If renewal fails long enough for the lease to expire, change the editor to read-only and preserve the unsaved local draft for copying/recovery.

### 11.4 Transactional release

Release must transactionally verify both:

```text
lockedByUid == current UID
leaseId == current mounted session lease
```

Unmount/navigation release is best-effort. Correctness relies on lease expiry, not on an asynchronous browser-close delete.

### 11.5 Save with lease validation

For mark-entry saves:

1. Read and verify the lease in a transaction.
2. Update `examResults/{examId}`.
3. Increment the term result revision.
4. Delete the verified lease.
5. Commit atomically.

If the lease no longer belongs to the caller, reject the save and show a conflict/recovery message rather than overwriting newer work.

### 11.6 Route coverage

Apply the lease to every UI that edits marks, grading scale, result snapshots, or other overlapping result fields—not only `RecordResultsView`.

Read-only View Results and pupil report pages do not acquire a lease.

Administrative release/revoke actions do not need the mark-entry lease, but they must bump the term revision.

### 11.7 Firestore Rules

Add a collection-specific `examLocks/{examId}` rule:

- read: Staff/Admin;
- create/update: Staff/Admin and `request.resource.data.lockedByUid == request.auth.uid`;
- delete: Staff/Admin only when the existing lease belongs to the caller, except for a separately authorized administrative recovery path;
- validate allowed fields and timestamp types;
- deny Parent writes.

The lease remains a workflow control, not the only authorization check for result writes.

Stage 4 exit gate:

- simultaneous acquisition emulator test produces one holder;
- a stale release cannot delete a newer lease;
- strict-mode remount cannot release a replacement session lease;
- expired lease recovery works;
- losing connectivity makes the editor safe/read-only;
- Parent and unauthorized users cannot write lock documents;
- save, revision bump, and lease deletion are atomic.

## 12. Stage 5 — Optional prefetch after measurement

Do not prefetch three terms in the initial rollout.

After Stages 1–4 are measured, optional idle prefetch may be considered only if:

- users repeatedly open many results in the same term;
- the cache hit-rate justifies the extra reads;
- prefetch starts after visible page work;
- it is cancelled on navigation, data-saver mode, weak connection, or low storage;
- it fetches requested/current-term results in bounded chunks;
- it never runs for Parent class-wide results.

Firestore `in` queries can reduce round trips for legacy auto-ID documents, but canonical `examResults/{examId}` point reads remain the target model.

## 13. Failure and offline behaviour

| Condition | Required behaviour |
|---|---|
| Corrupt local exam cache | Discard it and perform the one authoritative recovery read |
| Revision channel not ready | Show valid cached data, label reconciliation state internally, and avoid treating missing revision as confirmed zero |
| Offline warm result page | Show cached result with an offline/stale indicator |
| Offline record-results page | Do not grant a lease; keep editing read-only unless a future explicit offline-draft workflow is designed |
| IndexedDB unavailable | Fall back to the requested Firestore read; saving still works |
| Server refresh fails | Retain visible cached data and retry within the bounded policy |
| Account switch | Remove protected React Query data and service singletons before hydrating the next scope |
| Cache quota eviction | Treat missing values as normal cache misses |
| Result revision changes while editing | Preserve local draft, warn about remote change, and require conflict resolution before save |

## 14. Verification plan

### 14.1 Automated checks

Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:firestore-rules
npm.cmd run test:firestore-security-contract
npm.cmd run test:dashboard-cache-contract
```

Add focused contracts/tests:

- `scripts/check-exam-cache-contract.js`
  - one full-exam browser network owner;
  - scoped exam/result keys;
  - `useExamsAsEvents` has no direct exam collection read;
  - every exam-definition writer publishes the exam revision;
  - every result writer publishes a term result revision;
  - Parent bootstrap cannot read full exams/results.
- `tests/exam-result-cache.test.ts`
  - matching/mismatching revisions;
  - null-result caching;
  - per-exam patching;
  - retention and corrupt-manifest recovery.
- Firestore emulator lease tests
  - simultaneous acquisition;
  - renewal;
  - stale release;
  - expiry takeover;
  - save after lease loss;
  - Parent denial.
- migration tests
  - duplicate detection;
  - dry run performs no writes;
  - copy verification;
  - dual-read fallback.

### 14.2 Manual matrix

Test as Admin, Staff, Parent, a second Staff account, revoked user, offline device, and two tabs under one user.

Required scenarios:

1. Cold and warm dashboard calendar.
2. Cold and warm exams page.
3. Filter changes without network reads.
4. Remote exam create/update/delete.
5. Warm result view with unchanged revision.
6. Remote result save while another result page is open.
7. Release/revoke while result view is open.
8. Two users opening Record Results simultaneously.
9. Two tabs from the same user.
10. Browser crash and lease expiry recovery.
11. Account logout and immediate login as another role.
12. Future academic year configured before the current year ends.
13. IndexedDB cleared, denied, or quota-evicted.
14. Weak-device production build with CPU throttling.

### 14.3 Read-budget assertions

Record actual reads rather than relying only on visual speed:

| Scenario | Target |
|---|---|
| Warm exams consumer, unchanged revision | 0 `exams` reads |
| Exam revision mismatch | 1 full collection reconciliation by the sole owner |
| Warm result, matching term revision | 0 `examResults` reads |
| Result revision mismatch | 1 requested result read |
| Saving device after successful save | 0 post-save result reads |
| Parent dashboard | 0 full `exams` or class-wide `examResults` reads |

## 15. Rollout and rollback

Deliver in separate commits/stages:

1. Baseline contracts and mutation inventory.
2. Exam-definition cache and reader consolidation.
3. Result schema additions plus dry-run migration.
4. Dual-read canonical result support.
5. On-demand IndexedDB result cache.
6. Transactional lease and rules.
7. Optional prefetch only after evidence.

For each stage:

- deploy to one Firebase project/environment first;
- monitor permission denials, result load failures, duplicate reports, cache recovery logs, and reads;
- retain dual-read compatibility until the stage is proven;
- rollback by disabling the new browser owner and incrementing/removing only exam cache schema keys;
- never delete canonical or legacy result data as part of client rollback.

## 16. Recommended first implementation slice

The safest first slice is Stage 1 only:

1. Add scoped exam cache and `dataRevisions.exams`.
2. Make the bootstrap the sole full-exam reader.
3. Refactor all exam hooks and `useExamsAsEvents` to selectors.
4. Cover every direct exam mutation with combined exams/events revision publishing.
5. Add the ownership contract and measure warm/cold reads.

This provides the largest immediate speed/read improvement without changing exam-result storage or locking. Proceed to result caching only after Stage 1's read targets are verified.
