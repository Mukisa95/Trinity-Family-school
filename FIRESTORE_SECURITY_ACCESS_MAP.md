# Firestore Security Access Map and Rollout Gate

Status: **implementation in progress — do not replace the live transitional rules yet.**

This document is the working contract for the two production Firebase projects. It
records the query and ownership shape that rules must protect, while preserving the
existing cache-first dashboard behaviour and avoiding new Firestore reads or writes.

## Non-negotiable release gates

1. **No anonymous or arbitrary Firebase account access.** This is already enforced
   by the current `appUser` and `isActive` token claims.
2. **No rule-level document lookups.** `get()`, `exists()`, and `getAfter()` in
   Firestore Rules can create additional billed reads. They are prohibited in this
   rollout and are checked by `npm run test:firestore-security-contract`.
3. **No session polling through Firestore.** The 15-minute session revalidation is
   Firebase Authentication token work, not a Firestore document read.
4. **No new dashboard listener or read-on-mount.** Cached dashboard data continues
   to render immediately; an existing listener then reconciles it with the server.
5. **No write caused by a read.** In particular, the fee and requirement flows must
   not create snapshots merely because a parent opens a page.
6. **No live rule change without emulator, preview, and production canary evidence.**
   The two Firebase projects are rolled out separately, never together.

## Identity data available to rules without a Firestore read

Firebase custom claims already provide `appUser`, `isActive`, `role`, and where
applicable `familyId`, `pupilId`, and `staffId`. Rules may use those claims directly.
They must not fetch `system_users` to decide access.

Before parent-specific rules are enabled, every active parent must have a current
trusted ownership claim. For multi-child families, the target is an explicit,
bounded `pupilIds` claim or a denormalized `familyId` on child-owned records. The
choice will be made from the live data audit; it must not rely on a client-supplied
pupil ID or browser cache.

## Current collection and access inventory

| Data area | Current client access | Target rule boundary | Read/write impact and implementation work |
| --- | --- | --- | --- |
| `authCredentials` | Server/Admin SDK only | No browser access, including admins | Already denied; no client reads or writes. |
| `system_users` | User lists, recipient pickers, current profile | Parent: own profile only. Staff/admin: scoped directory access required by their permitted feature. Writes through protected API routes only. | Remove parent-wide profile reads before restricting. Keep user edits server-side. |
| `pupils` | Global staff listener; parent listener uses `where(familyId == claim)` | Parent: documents whose trusted ownership matches their claim. Staff/admin: retained during the first canary, then permission-scoped. | Existing parent query is already narrow and cache-first. Add verified parent ownership coverage before enforcement. |
| `attendanceRecords`, `payments`, `bankAccounts`, `bankLoans`, `bankTransactions`, `examResults`, `pupilSnapshots`, `requirement-tracking`, `uniformTracking` | Per-pupil parent views; broad staff services | Parent: only records for an authorised child. Staff/admin: feature permission boundary. | Do not use a rule `get()` to look up a pupil. First add and backfill a trusted `familyId`/owner field or bounded `pupilIds` claim, then make every parent query include it. |
| `feeStructures`, `requirements`, `uniforms`, `academicYears`, `classes`, `subjects`, `events` | Dashboard preloader and feature pages | Parent: read-only public-to-parents subset; no create/update/delete. Staff/admin: retain current feature access during canary. | Parent preloader currently fetches several whole collections. Keep only the reference data that the parent dashboard actually displays; load the rest on demand. This reduces reads. |
| `notifications`, `notificationDeliveries` | Parent components call `getAllNotifications()` and filter locally; an existing delivery collection is available | Parent: only their own inbox/delivery documents. Notification authoring stays staff/admin only. | New notifications now store resolved `recipientIds` in their existing document write. Backfill historical documents in a controlled batch before switching parent reads; do not use rules to look up a delivery record. |
| `staff`, `accessLevels`, `settings` | Admin/staff dashboard preloads | Parent: deny. Admin/staff: feature-specific boundary. | Parent preloader must not request these collections. No new listener is required. |
| `photos`, `pushSubscriptions`, `nativePushTokens`, `fcmTokens` | Photo and device/push flows | Owner-only for a user/device, or server-only where the client does not require it | Treat device tokens as sensitive. Confirm document fields before rule implementation. |
| Finance and operations: `feeAdjustments`, `feesHolidays`, `dynamicDiscounts`, `inventoryItems`, `inventoryTransactions`, `issuedItems`, `procurementItems`, `procurementPurchases`, `procurementBudgets`, `digital_signatures`, `audit_trail`, `historyLogs`, `smsLogs`, `smsTemplates`, `smsProviders`, `scheduledSMS`, `schoolPaySyncLogs`, `pushNotificationLog` | Staff/admin feature pages and API routes | Parent: deny. Staff/admin: phase in module-based protection after the privileged query map is tested. | These are not loaded by a parent dashboard. Deny parents first without changing staff queries; then move privileged writes behind API routes where needed. |
| Timetable and leadership: `timetables/*`, `periods/*`, `entries/*`, `leadershipTerms`, `prefectoralPosts`, `postAssignments`, `dutyRotas`, `dutyAssignments`, `dutyAssessments`, `polls`, `performanceRankings` | Staff/admin feature services | Parent: deny unless a parent-facing timetable view is explicitly confirmed. Staff/admin: phase in after feature tests. | Collection paths and nested subcollections need explicit emulator tests; do not rely on a catch-all rule. |
| Migration/administration: `migrations`, `historicalPupilSeeds`, `promotionBatches`, `users` | Local scripts and administrative tools | Browser clients: deny unless a current page demonstrably needs it. Server/Admin SDK bypasses rules. | Removing browser access does not affect server migrations. Verify no production client uses each collection before denial. |

## Confirmed high-priority code changes before strict parent rules

1. **Notification inbox:** replace `getAllNotifications()` in parent surfaces
   with a query that only returns that user's delivery/inbox records. Existing
   notifications must remain visible during the transition; backfill is required
   before changing the rule. This is now implemented as one shared per-user
   delivery listener in place of the previous 10- and 30-second broad polling;
   all parent notification surfaces reuse the same cached live state.
2. **Parent record ownership:** inventory every child-owned document and add a
   rule-checkable ownership field without fetching another document in rules.
3. **Stop write-on-read:** audit `getOrCreateSnapshot()` in fees and requirements.
   Creation belongs in an explicit staff action or protected server workflow, not
   a parent/dashboard data fetch. The read-only resolver is now used by fee,
   requirement, and historical-selector screens; the checked creation method is
   confined to the snapshot lifecycle service.
4. **Reference-data preloading:** remove parent-unneeded reference collections
   from the global preloader rather than filtering them after download.
5. **Cache isolation:** cache keys must include Firebase UID and the parent/family
   scope; cached records must be cleared on account switch and sign-out.

### Notification recipient-ID migration safety protocol

New notification sends now write `recipientIds` as part of the document's normal
create/update flow, without adding a new recipient document or a new write. Before
the parent UI switches to `where('recipientIds', 'array-contains', currentUserId)`,
run `npm run analyze:notification-recipient-backfill` against the intended project.
The default command is analysis-only: it reports counts and does not inspect
delivery records or write data. Review its count, read impact, and backup decision
first. Only then run the double-confirmed apply command:

`npx tsx src/scripts/backfill-notification-recipient-ids.ts --apply --confirm-recipient-ids`

The apply mode derives IDs from existing delivery records, writes only an absent
`recipientIds` field on a notification, never changes recipients, message content,
credentials, user profiles, or delivery records, and leaves notifications without
delivery records untouched for manual review. The sole safe exception is a legacy
notification whose recipient list consists only of explicit individual user IDs;
those existing IDs can be copied without guessing a group membership.

## Safe rollout order

1. Establish a read/write usage baseline in each Firebase project and capture the
   existing critical user journeys.
2. Complete the collection/query map with field samples from each live project;
   check that both projects use the same required ownership fields.
3. Ship the query/data changes behind the current authenticated-only rules. This
   is safe because the old working access remains available while we prove the
   new, narrower requests and cache behaviour.
4. Backfill only missing ownership/inbox metadata in a controlled, resumable,
   idempotent server script. Take a count and backup/export plan first. Never
   overwrite existing identity or API credentials.
5. Add emulator tests for allowed and denied Admin, Staff, Parent, inactive,
   anonymous, wrong-family, and direct-document-ID scenarios. Test queries, not
   only single-document reads.
6. Deploy the rules to a preview/canary target for the first project. Test sign-in,
   restore from auto-lock, cached dashboard first paint, live update, parent pupil,
   fee, attendance, results, notification, staff finance, and admin user edits.
7. Compare canary reads/writes and permission-denied errors with the baseline. If
   any critical flow or usage regresses, restore the previous rules immediately.
8. After an agreed observation period, repeat for the second project using its own
   data audit and baseline.

## Completion evidence required

- `npm run test:firestore-security-contract` passes.
- `npm run test:firestore-rules` passes with the Firestore emulator.
- No `get()`, `exists()`, or `getAfter()` in deployed rules.
- Parent network trace shows no broad `pupils`, `notifications`, `system_users`,
  `staff`, or finance collection request.
- Cached dashboard shows data before the server snapshot; the server snapshot
  then reconciles using the existing listener.
- Firestore metrics show no new recurring authentication reads, no new dashboard
  listeners, and no unexpected writes during read-only journeys.
