# Staff Clocking: concrete integration and implementation plan

Prepared 24 October 2026 against the local working tree identified in [discovery](STAFF_CLOCKING_DISCOVERY.md). This is a development plan, not an implementation or production-readiness claim. Existing paths below were inspected; paths marked **new** are proposed. The user's version 1.1 blueprint remains the product reference except where a correction or unresolved decision is explicitly identified here.

## 1. Recommended implementation

Build one module in the existing Next.js application, with three sections: **Record**, **Clock**, and **Clock Records**. Use Firebase Admin SDK APIs for all clocking authority. Reuse the app's Firebase login, canonical staff IDs, embedded academic terms, React Query, IndexedDB infrastructure, glass controls, shared push transport and scheduled-dispatch infrastructure.

The core is a server engine producing one authoritative daily record per employee and work date. The UI, reports, corrections, notifications and proposed assessments consume that daily record. The scanner does not calculate an official late classification, and pupil attendance collections remain separate.

The first usable milestone includes defaults, holiday-aware schedules, approved exemptions, a school display, a working scanner, idempotent events, daily/weekly views, correction review, audit, durable finalization and basic notifications. Monthly/termly aggregates, advanced group controls, assessments and richer exports follow. Group/effective-date support belongs in the schema/resolver from the start even if its full editor follows later.

## 2. Changes to make to the supplied plan

| Blueprint proposal | Concrete decision for this app |
|---|---|
| Integrate existing staff and roles | Use `SystemUser.id -> SystemUser.staffId -> Staff.id`. Keep Admin/Staff/Parent roles; define timekeeper/reviewer through a new granular permission module. |
| Scope by school ID | Derive school from server deployment/project configuration. Introduce clocking school keys without migrating the entire school application into multi-tenancy. |
| Use Events & Calendar as holiday/term authority | Introduce one shared calendar resolver used by both clocking and calendar UI. Terms continue to come from `academicYears.terms`. Generated public holidays must be visible to the server. |
| Reuse departments/groups | Staff departments/roles are arrays of labels, not versioned attendance groups. Allow group selectors based on those labels, with stable clocking group IDs, explicit priority and effective-dated membership. Do not reuse notification groups as attendance policy. |
| Reuse existing cache | Reuse its single-owner pattern and storage primitives; add permission version, scope purge, response-generation guards, coherent revision/payload writes, and bounded report retention. |
| Tiny revision reconciliation | Initial implementation may read a tiny durable manifest. An unchanged result saves bundle reads, not necessarily the auth/manifest reads. Track those costs separately. |
| No DB reads at each QR rotation | Create a narrow display capability once, then issue short tokens using signature/time checks. Actual scans read authoritative session/rules versions. Do not call ordinary `requireAppUser` on every refresh and claim it is zero-read. |
| Optional token-issues collection | Omit per-token issue documents. Signed short tokens need no row per refresh. Keep hourly display sessions and security/audit records. |
| Validate QR before idempotency | Authenticate first, then allow an already-committed operation to be recovered even if the original QR has expired. Validate the QR before any *new* event. |
| All jobs in a later phase | Implement day opening/finalization and durable outbox processing before the MVP pilot. Holiday reminders can be enhanced later. |
| One day-status field with many states | Separate session state, attendance outcome, arrival/departure classification, review state and finalization state. These can coexist. |
| Automatic production launch after phases | Local implementation/testing only until a direct release request. Pilot enablement and live data changes also need deliberate authorization. |

## 3. Application and file boundaries

Proposed layout:

```text
src/app/staff-clocking/                         new
  layout.tsx                                   shared provider + access boundary
  page.tsx                                     chooses permitted default section
  record/page.tsx                               display + Manage/Exempt dialogs
  clock/page.tsx                                own overview + scanner
  records/page.tsx                              day/week/month/term + review drawer

src/app/api/staff-clocking/                     new
  bootstrap/revisions/route.ts
  bootstrap/bundles/route.ts
  me/today/route.ts
  me/history/route.ts
  me/corrections/route.ts
  operations/[id]/route.ts
  scan/route.ts
  display/sessions/route.ts
  display/current/route.ts
  settings/route.ts
  schedules/route.ts
  overrides/route.ts
  exemptions/route.ts
  exemptions/[id]/review/route.ts
  corrections/[id]/review/route.ts
  holiday-decisions/route.ts
  records/daily/route.ts
  records/weekly/route.ts
  records/monthly/route.ts                       later release
  records/termly/route.ts                        later release
  assessments/route.ts                          later release, disabled initially
  audit/route.ts
  exports/route.ts

src/lib/staff-clocking/                         new, pure shared types/logic
  contracts.ts                                 API DTOs and machine error codes
  dates.ts                                     school date/instant conversion
  schedule-resolver.ts                          pure precedence/holiday logic
  projection.ts                                pure day state/classification
  metrics.ts                                   pure report contributions
  cache-keys.ts                                identity/permission/schema keys

src/lib/server/staff-clocking/                  new, server-only
  access.ts                                    actor, linked staff, capability checks
  schema.ts                                    Zod input validation
  settings.ts / schedules.ts / calendar.ts
  revisions.ts / bundles.ts / rule-cache.ts
  display-sessions.ts / qr-tokens.ts
  clock.ts / operations.ts
  exemptions.ts / corrections.ts
  projections.ts / reports.ts
  jobs.ts / notifications.ts / audit.ts / telemetry.ts

src/lib/services/staff-clocking.service.ts      new authenticated HTTP client
src/lib/cache/staff-clocking-cache.ts           new scoped persistent repository
src/lib/hooks/use-staff-clocking.ts             new selectors + mutations
src/components/staff-clocking/                 new view components + provider
tests/staff-clocking-*.test.ts                  new behavior tests
tests/staff-clocking.rules.test.mjs             new direct-client denial tests
```

Use route handlers that delegate to server modules, following `/api/payroll/profiles/route.ts`, rather than accumulating the engine in page components. Shared pure code must not import `firebase/firestore`, UI hooks or server credentials. Server modules use `server-only` and Admin SDK. No separate microservice or new database is required.

Existing integration files to extend deliberately:

| Existing source | Change |
|---|---|
| `src/config/nav.ts` | Add Staff Clocking with exactly three children; keep Staff management available. |
| `src/types/permissions.ts` | Add module/pages/actions and precise route mappings. |
| `granular-permissions.service.ts`, `use-permissions.ts`, permissions editor | Ensure clocking privileged access is explicit; prevent legacy Staff/Attendance grants from automatically granting management/export/leave-note access. |
| `src/components/layout/app-layout.tsx`, sidebar components | Verify route guards and filtered child links; use existing navigation machinery where sufficient. |
| `src/app/api/users/linked/route.ts`, user create/update/delete routes | Preserve canonical staff links; add permission/link generation updates where clocking depends on them. |
| `src/lib/services/staff.service.ts`, staff forms/hooks, **new** staff mutation APIs | Protect canonical employment/group inputs; retain the current shared directory cache owner. |
| `src/lib/hooks/use-events-fixed.ts`, `use-events.ts`, calendar wrapper | Route attendance-relevant mutations through a trusted adapter; share holiday resolution without breaking exam-linked event changes. |
| `academic-years.service.ts`, academic-year management | Protect term-date mutations and expose a canonical term revision. |
| `auth-context.tsx` | Clear clocking-protected data and cancel in-flight work at identity loss/switch; support permission changes. |
| `persistent-collection-cache.ts` | Reuse storage functions; add only narrowly needed repository support. |
| `notification-destinations.ts`, notification settings/link picker | Add safe destinations and separate staff-clocking categories. |
| `scheduled-dispatch-queue.ts`, scheduled communications API | Register dedicated staff-clock job types and handlers. |
| `firestore.rules`, `firestore.indexes.json` | Server-owned collection boundary and actual query indexes. |
| Android Manifest, MainActivity.java, device tests | Add restricted live-camera permission support and verify lifecycle. |
| `package.json`, package lock, test scripts | Add one decoder dependency and meaningful focused checks when implementation starts. |

## 4. Identity and authorization before clocking

### 4.1 School and employee identity

Use the configured Firebase Admin project as the deployment boundary. Set `STAFF_CLOCKING_SCHOOL_ID` on the server, falling back to that project ID for the initial single-school deployment. Include `firebaseProjectId` and `schoolId` in new records and cache keys. Do not accept the request body's school as authority. Fail startup/requests if client and Admin project configuration disagree.

Use `Staff.id` as the canonical employee key. `Staff.employeeId` can be shown, edited under existing rules, and included in authorized exports, but must not change the attendance linkage. Derive the staff link from the fresh server account record, not from a submitted staff ID or a stale custom claim.

Add a dry-run link/enrollment audit with counts and a restricted exception list:

- Active Staff/Admin accounts with no staff link.
- Linked staff documents missing or inactive/suspended.
- Multiple accounts pointing to the same employee.
- Staff with no account, missing group inputs or conflicting group assignment.
- Staff eligibility start/end dates and selected pilot enrollment.

The linked-account creation endpoint already checks for a duplicate staff link in a transaction. Preserve that behavior; review other account write paths rather than assuming all historical accounts satisfy it. Do not create attendance history or new staff identities as a side effect of opening Clock.

`getStaffStatus` treats missing legacy status as active. Normalize that explicitly in the adapter. `onLeave` is not a dated approved exemption and must not silently excuse an unlimited period. Inactive/suspended cannot self-clock; an authorized manual review remains possible. Accounts without a staff link may manage the module if granted access but cannot self-clock.

### 4.2 Permission contract

Add `staff_clocking` to `MODULE_ACTIONS` with pages `record`, `clock`, `records`. Keep management/review within these sections, using dialogs/drawers.

| Page | Capabilities |
|---|---|
| Clock | `view_own`, `clock_self`, `request_exemption`, `request_correction` |
| Record | `display_qr`, `manage_settings`, `manage_schedules`, `manage_holidays`, `create_exemption`, `manual_clock` |
| Clock Records | `view_all`, `view_group`, `review_exemptions`, `review_corrections`, `view_restricted_notes`, `export_data`, `view_audit`, `manage_assessments` |

Grant own-clock/history to explicitly enrolled, active linked staff using one policy shared by layout and backend. Do not require directory-management permission to clock oneself. Manager group visibility is a backend filter, not merely a front-end filter. Global Admin capability does not permit self-approval of an exemption/correction; review must enforce `reviewer != subject account` independently.

`requireClockingActor(request)` wraps `requireAppUser`, resolves the server school and staff link, checks applicable pilot/scope access, and authorizes the requested action. Apply the enabled flag to new scans/mutations separately: turning the feature off must not automatically block authorized history reads or committed-operation recovery. For an actual scan or privileged write, reread the relevant account/staff/version documents in the transaction so a concurrent deactivation or policy edit cannot slip between authorization and commit.

Add `clockingAccessVersion` to the server-owned account or a deterministic clocking access marker. Increment it when clocking grants, staff link or relevant active status changes. Permission checks still consult current authority. A version is an invalidation aid, not permission by itself. Update it atomically with relevant account changes; retain existing Firebase refresh-token revocation behavior.

### 4.3 Protect authority inputs

Before the feature flag can turn on:

1. Exclude all new staffClock collections from the generic Firestore fallback and deny browser writes; use authenticated APIs for their reads too, except deliberately scoped revision signals if selected.
2. Add protected server mutation paths for staff create/update/archive, preserving employee-ID validation, returned merge semantics and atomic reference revision bumps. Update existing callers and deny bypass writes to protected staff identity/status fields. Hard deletion of staff with clock history becomes archive/restricted administrative handling, preserving event references.
3. Protect all public-holiday-affecting event create/update/delete operations, including changing an event into/out of Holiday, approval/lifecycle/date changes and recurrence handling. Choose a common server mutation function used by active calendar callers; prohibit bypass edits through the old hook/direct SDK. Preserve ordinary event attendance and exam linkage.
4. Protect academic-year term-boundary edits through the equivalent authorized mutation path, atomically updating its canonical revision and audit.
5. Review `settings` write scope: the existing broad Staff allowance is not sufficient for authoritative clocking policies. New policies/manifests live outside public `school-settings`; unrelated legacy dashboard counters are never trusted as clocking security authority.

This is focused protection for inputs the new engine relies on. Record any broader existing directory/privacy issue separately and do not claim a clocking-safe projection repairs the whole application.

## 5. Shared calendar, terms and time

Create **new** `src/lib/calendar/school-calendar.ts` for pure, shared calendar resolution and a server adapter under `server/staff-clocking/calendar.ts`. Extract/reuse `utils/uganda-holidays.ts`; the calendar and backend must call the same resolver/version.

Normalize each calendar item as an ID, local date/range, source (`generated_public_holiday`, `event`, `official_adjustment`), approval/lifecycle state, explicit effect (`public_holiday`, `school_closure`, `informational`) and source revision. Do not treat every red Holiday event or every exam event as a universal staff closure.

Generated fixed/Easter holidays are reference inputs; provide an authorized correction/additional-holiday mechanism in the existing Events & Calendar flow for officially confirmed dates that are not generated. Do not create a clocking-only second holiday master. Cancellation/duplicate source IDs and date changes must have deterministic effects and an audit. Uncertain calendar coverage must be visible to managers; automated adverse absence classification must pause for affected unresolved dates.

Academic-year terms remain embedded in `academicYears`. Normalize legacy Timestamp, seconds/nanoseconds-map and string dates at the adapter boundary. Store the school-local calendar date explicitly. Avoid converting an arbitrary midnight UTC instant using the server's default timezone. Term reports intersect exact term bounds with month bounds; staff may have legitimate work during recess, and those work dates do not automatically enter the prior term just because a UI selector defaults to it.

Policy precedence:

1. Approved specific-date staff override.
2. Approved specific-date attendance-group override, using explicit priority.
3. Approved specific-date school override.
4. If a public holiday/closure applies and no higher applicable work decision exists: not scheduled.
5. Effective recurring employee schedule.
6. Effective recurring group schedule.
7. Effective school default.
8. No schedule.

Reject equal-priority conflicting overrides. An exemption changes attendance justification/requirement; it does not silently rewrite ETA/ETD. A manager's non-working school-wide decision and a higher staff work assignment must produce the same deterministic answer in Manage, Clock and reports.

Snapshots include local work date, timezone `Africa/Kampala`, scheduled flag, ETA/ETD as UTC instants and local wall times, grace, cutoff, source/version IDs, calendar/term versions and calculation version. Store expected schedules for the day's roster even for people who never scan, otherwise future rule edits could alter historical absences. Future rule changes create effective-dated versions. Changes to an already opened/finalized day require an explicit prospective/retroactive choice and audited recalculation.

Use a single testable date utility based on explicit IANA timezone conversion. Existing pupil `isSchoolDay` and smart term selectors remain presentation references; they do not define staff workdays. V1 disallows overnight schedule configuration until its work-date matching policy is implemented. A permitted late departure attaches to the existing open day within a configured window; ambiguity yields review, not a new day's IN.

## 6. Firestore data model and indexes

Use existing camelCase naming conventions. Every new record carries `schoolId`; deterministic IDs encode or hash bounded components so arbitrary employee IDs cannot introduce path separators.

| Collection | Key / authority |
|---|---|
| `staffClockSettings` | School ID; enabled/pilot list, timezone, default times/grace, guard, cutoffs, QR policy, launch date, version. Default disabled. |
| `staffClockAccess` | School + account; access/version marker and allowed scope if separated from account. Server-owned. |
| `staffClockGroups` | Stable group ID with priority, active state and selector metadata. |
| `staffClockMemberships` | Group/staff/effective interval; overlapping membership follows explicit priority, not array order. |
| `staffClockSchedules` | Effective-dated immutable schedule versions for school/group/staff targets. |
| `staffClockOverrides` | Effective date/range, target, working decision, custom hours, approval, version. |
| `staffClockHolidayDecisions` | School + canonical holiday/source occurrence + scope/version; pending decisions deduplicated. |
| `staffClockDisplaySessions` | Random session ID; school, display identity, issuer, validity, generation, revoked state. No manager credentials. |
| `staffClockOperations` | Hash of school + staff + operation key; request digest, durable result, created/completed time, linked day/event. |
| `staffClockEvents` | Deterministic accepted-operation event ID; append-only IN/OUT/MANUAL/CORRECTION, actor/source/timestamps. |
| `staffClockDays` | Hash of school + staff + work date; transaction serialization point, schedule snapshot, raw/effective times and state axes. |
| `staffClockDayRosters` | Date + deterministic staff shard; eligible staff and expected schedule snapshot references, enrollment bounds and source revisions. |
| `staffClockExemptions` | Date-range request, coverage/category, approval/revocation references; no private narrative in list projection. |
| `staffClockPrivateNotes` | Separately protected request/staff/reviewer notes; not placed in shared bundles or general push. |
| `staffClockCorrections` | Requested effective times, reason, subject, version, reviewer decision and event reference. |
| `staffClockAudit` | Append-only actor/action/target/old-new references, reason and server timestamp. |
| `staffClockRevisions` | Separate school/group/staff/calendar/report scope documents; never an unbounded school-wide staff-day map. |
| `staffClockRuleBundles` | Optional small materialized scope/version payload; no raw directory/notes/secrets. |
| `staffClockOutbox` | Event ID + type; projection/invalidation/notification work with leases, retries, source version and dedupe keys. |
| `staffClockReportChunks` | Date or period + bounded shard/version; authorized rows, coverage and completeness metadata. |
| `staffClockContributions` | Staff/day applied version + last contribution; supports idempotent aggregate deltas. |
| `staffClockPeriodSummaries` | Per staff/month or staff/term (and bounded report chunks); aggregation watermark/version. |
| `staffClockAssessmentPolicies`, `staffClockAssessments` | Later release only; effective-dated review proposals, separate from payroll. |

The schema should separate `sessionState` (none/in/out), `arrivalClass` (on-time/grace/late), `departureClass`, `dayOutcome`, `reviewState`, `finalizationState`, `rawFirstInAt`/`effectiveFirstInAt` and `sourceVersion`. A present employee can simultaneously be late, missing-out and under review. An exempt employee who actually attends keeps both the approval and the scans; UI/count definitions must avoid double-counting them as absent.

Implement uniqueness using deterministic document IDs and transactions, not SQL-style unique-index assumptions. Store event timestamps as Admin `Timestamp` UTC instants, explicit local work dates as validated `YYYY-MM-DD`, and money as integer UGX when that release is enabled.

Initial composite-index families, finalized from actual query implementations:

- Days/events: `schoolId, workDate, staffId`; personal history `schoolId, staffId, workDate desc`.
- Group/day views: use authorized roster/chunk membership rather than cross-joining all events on every request.
- Schedules/memberships: `schoolId, targetType, targetId, effectiveFrom`; filter a bounded effective interval or use materialized applicable references.
- Exemptions/corrections: `schoolId, staffId, startDate` and reviewer queue `schoolId, status, createdAt` as used.
- Outbox/due jobs: `status, dueAt` (school included when dispatch is school-filtered).
- Reports: `schoolId, periodKind, periodKey, shardKey` as used.

Avoid unrestricted two-ended date-range scans per employee. Resolve approved exemption ranges against a bounded day roster or materialized per-day references. Exclude large nested snapshots/payload/notes from indexing where queries do not use them. Apply explicit chunk byte/row limits and cursor pagination; do not place the whole school term in one document.

## 7. Cache and revision design

### 7.1 One owner and allowed contents

Mount `StaffClockingProvider` in the module layout. Do not mount attendance listeners or clocking data loaders on every dashboard boot. The provider owns one in-memory store and one in-flight promise per scope; views are selectors. A small feature/access gate may participate in the existing shell, without preloading private report data.

Key format:

```text
projectId / schoolId / firebaseUid / staffId-or-management-scope /
clockingAccessVersion / cacheSchemaVersion / resourceScope / revision
```

Use existing IndexedDB primitives for sanitized schedules/calendar bundles and authorized report chunks. Persist only own minimum identity/status on staff phones. A manager directory projection contains ID, display name, department/group and active eligibility, not the complete Staff object. Reuse the existing staff cache only where the current user is already authorized for those directory fields; do not fetch another full staff collection.

Existing snapshots are not encrypted. Default to no persistent sensitive leave narratives, no tokens/credentials/frames, and memory-only management reports on shared kiosks. Trusted-device report persistence needs a retention choice and purge behavior. Do not describe identity-keyed IndexedDB or a hash/checksum as encryption. If protected native storage is later required, design its key ownership/recovery explicitly.

On logout, account/school switch, permission reduction or definitive auth failure: close camera/listeners, cancel fetches, increment an identity-generation guard, clear memory/query keys and delete only that identity's clocking persistent keys. Reject late responses belonging to the old generation. Broadcast the identity/purge signal across tabs. Cache writes must never restore a departed user's data after purge.

### 7.2 Revision scopes and consistency

Use independent revisions for school rules, group rules, employee rules, calendar, terms, directory projection, personal day, date/shard reports and specific periods. Scans update day/report-related versions; they do not touch school settings, academic-year or directory revisions.

An authorized mutation transaction writes canonical data + its relevant revision + audit + durable outbox item. Notification/push publication happens after commit in a worker. The existing mirrored dashboard revision functions can continue supporting their current consumers, but clocking rules must not use a browser-writable legacy counter as security proof.

Read a durable compact revision vector before serving a supposedly verified bundle. Cache immutable payloads by their exact revision; on cold/mismatch load only the necessary scope. Recheck the vector after assembling data, or assemble in a consistent transaction, so a concurrent edit cannot produce a new revision paired with an old payload. Never label a cached bundle current merely because it has not expired.

An in-process map alone is insufficient across Vercel instances. Initial correctness-first choice: bounded durable revision reads on sign-in, foreground/reconnect, active invalidation and authoritative scan operations. Add a shared invalidation/cache service only if a measured benefit justifies its operational cost. Backend response headers can report source `memory/persistent/db`, but cannot claim invoice-accurate read counts without reconciliation.

### 7.3 Reconciliation flow

1. Restore the allowed bundle immediately, labelled last verified/unverified as appropriate.
2. Deduplicate one reconciliation per meaningful foreground/reconnect/login/module activation; switching between already-mounted sections does not repeat it.
3. Call `/bootstrap/revisions` with a private ETag and known vector. Authenticate before evaluating `If-None-Match`; the ETag includes permission/schema scope.
4. If unchanged, preserve the existing bundle. If changed, request only those small scopes. Apply payload and revision coherently to memory/disk.
5. Use an app event/BroadcastChannel for same-device accepted mutations. Cross-device correctness uses the durable manifest, not browser events alone.
6. For an actively viewed manager day, use at most a narrow authorized revision/summary signal. Attach on view, detach on leave/hidden, recheck on return. An optional scoped signal document must have explicit read rules and no private details. No all-school raw-events listener on staff phones.
7. For rule changes while staff remain foreground, deliver targeted invalidation through a verified data-message path or an active narrow revision signal. Existing visible-notification push is not assumed to implement silent invalidation. Reconcile if delivery is missed; scans always validate current authority.

Private API responses must never enter shared CDN or service-worker caches. Use `Cache-Control: private, no-cache` for conditional small GETs and `no-store` for scan/mutation/session responses, with `Vary: Authorization` as appropriate. The app repository owns persistent copies. `public/sw.js:748` already bypasses APIs; preserve it. The HTTP client must handle bodyless 304 explicitly and must not blindly call `response.json()` like a conventional mutation helper.

### 7.4 Honest read budgets

| Operation | Expected data behavior | Necessary exceptions to zero-read goals |
|---|---|---|
| Switch among the three open sections | Shared rules reused; no duplicate bundle queries | Newly opened date/report data can load. |
| Restart/reconnect/return | One deduplicated manifest/access reconciliation | Auth/user and tiny durable revision reads may occur. |
| Digital clock tick | Monotonic elapsed time plus returned server offset | Zero database reads caused by ticks. |
| QR rotation | Narrow locally verifiable display capability + server signing/time | Session start, hourly renewal, cold/revocation handling are measured separately. |
| Accepted scan | One authoritative API operation; no directory/calendar collection reread | Account/staff/session/operation/day/revision and required changed-rule reads; transaction retries add reads. |
| Reopen finalized history | Persisted report payload reused until scoped revision changes | Current access/manifest check may read small documents. |
| Manager closes live view | All view-owned listeners detach | Durable background finalization still runs. |

Firestore persistence does not make reconnects free; track listener reads/reconnects separately from local cache hits. See [Firestore billing](https://firebase.google.com/docs/firestore/pricing#listening_to_query_results). The blueprint's 80% goal is a pilot target against a controlled naive baseline, not an achieved saving or a guarantee for the whole app.

## 8. QR display and Android/browser scanner

### 8.1 Display session

An authorized operator uses Record to create a random hourly display session. Pair the terminal with a narrow session credential/capability that can only obtain QR values for that school/session/generation, with an expiry no later than the session. Store capability only in memory; a page reload reauthorizes. The public display must not retain the operator's privileged dashboard session or cached staff data. Use a display-only account or a deliberate operator-to-display handoff with independent restricted credentials.

`POST /display/sessions` uses full current app authorization and writes session/audit. `GET /display/current` verifies the display capability and its bounds, then signs a short-lived QR token using a server-only secret and server time. It does not call the general user-document loader or persist an issuance record on every 45-second rotation. A server-held signing secret with explicit key ID supports rotation; never ship it to the browser.

QR payload has an application audience/version prefix, school/project identity, session ID/generation, issued/expiry instants and nonce, authenticated by a server signature. Cap token lifetime on validation, reject unexpected fields/length/audience, and never navigate to a decoded URL or run its contents. Shared QR tokens remain usable by multiple different employees during their lifetime.

Actual scans read the durable session inside the event transaction, together with a current display/issuer access-generation marker. Bind the session to that marker; removing the issuer's display authority or deactivating the display increments it, making old sessions unusable without enumerating every token. A valid signature alone does not bypass expiry/revocation. An old display capability may still request unusable short tokens until its expiry if its issuance path has no live revocation lookup; those tokens must fail scanning after revocation. State this tradeoff explicitly. If immediate issuance shutdown is also required, add a bounded/shared revocation check and account for its cost. Do not promise simultaneous zero checks and immediate cross-instance issuance revocation.

Return trusted `serverNow`, token `expiresAt` and renewal bounds. Render the clock from server offset plus monotonic time. Clear the QR at expiry/renewal failure and label offline; never leave an expired code looking active. No per-second network calls, no minute heartbeat documents, and no batch of future valid QR tokens.

### 8.2 Scanner implementation

Use existing `react-qr-code`/`qrcode` for display. Add one QR decoder, provisionally `@zxing/browser`, dynamically imported only when scanning opens. Its upstream API offers video/constraint decoding and stop/torch controls; verify the selected locked version on actual target devices. See [ZXing browser upstream](https://github.com/zxing-js/browser). Native BarcodeDetector can be an optimization with a tested decoder fallback.

The scanner controller owns camera startup, candidate lock, operation key, pending verification and cleanup. Prefer rear camera without assuming availability; request video only, never microphone. Stop decoding/tracks on exit, hidden app, success and identity loss; reinitialize intentionally on return. Torch/switch-camera appear only when supported. Send the decoded token, never photos/video. Handle permission denied, no camera, already-in-use, rotation/expiry, poor lighting and weak network distinctly.

The Android wrapper currently lacks both CAMERA permission and `WebChromeClient.onPermissionRequest`. Implement a runtime CAMERA request only after the user opens scanning; accept only `RESOURCE_VIDEO_CAPTURE` for the exact trusted HTTPS school origin and eligible active main-frame route. Deny audio/unknown resources, cancel pending requests on navigation/lifecycle cancellation and avoid granting the full requested resource array. Connect pause/resume to JS scanner cleanup; verify WebView behavior rather than assuming desktop getUserMedia behavior transfers. Android's default permission callback denies access when unimplemented: [Android API reference](https://developer.android.com/reference/android/webkit/WebChromeClient#onPermissionRequest(android.webkit.PermissionRequest)).

This reuses the web scanner inside the existing wrapper. A separate CameraX/native QR bridge is a later fallback if device testing establishes a need; do not repurpose the external JPEG capture flow. A web release cannot retrofit manifest/Java permission support into an already installed old APK. Keep PWA and new-APK readiness/rollout evidence separate and offer an ordinary-browser/manual-assistance path for unsupported installed versions.

## 9. Atomic clocking and uncertain responses

### 9.1 Request contract

`POST /api/staff-clocking/scan` accepts a strict object containing `qrToken` and `idempotencyKey`. Optional expected day revision/next-action hints are race guards, never authoritative IN/OUT instructions. Reject client timestamps, amount/classification fields and client-selected staff/school as authority. Require bounded JSON, validate operation-key format, rate-limit by authenticated identity/session using a multi-instance-safe strategy, and avoid logging tokens.

The response includes result, raw/effective official time as applicable, work date, timezone, saved day snapshot/version, next eligible action, duplicate-guard-until, operation ID and serverNow. GET own operation status returns a committed result without requiring a still-valid original QR.

### 9.2 Transaction sequence

1. Verify the Firebase token and resolve the current account/school. Capture one trusted request-received instant for a new operation and enforce a bounded processing deadline. It is not reset on a Firestore transaction retry; retries after a committed operation return the original stored result. Reject expired processing attempts rather than accepting indefinitely delayed receipt timestamps.
2. Validate input structure and compute operation ID plus request digest. Obtain and verify cached immutable rule payloads against authoritative revision IDs; load changed scope on mismatch.
3. Start an Admin SDK transaction. Read all required documents before writes: operation record, account/access marker, linked staff/enrollment, feature settings/version, display session/issuer access-generation marker, relevant rule/calendar versions and the deterministic day/roster references.
4. Confirm current access. If this operation already committed, verify owner/digest and return that exact result; it remains recoverable after the QR's expiry. Reusing an operation key with a different body is a conflict.
5. For a new operation, verify signature, expiry against trusted time, school/session/generation and session revocation. Resolve the assigned work date and frozen or eligible effective schedule. If required rule payload/version changed, abort/reload and retry boundedly rather than trusting a stale hot cache.
6. Recheck eligibility/launch bounds and day state. First valid scan becomes IN; a valid subsequent scan outside the guard becomes OUT; a third scan returns COMPLETE. Full-day approved leave preserves the exemption and permits an otherwise authorized scan without inventing events.
7. Duplicate guard applies to concurrent/double callbacks and repeated departure callbacks too. A guarded or already-completed operation stores a stable result without creating an attendance event. If configured, stale expected-state guards require reconfirmation after another device changed the day; backend still determines the action.
8. Atomically create the immutable event, update the daily projection/version, persist the operation result, append audit metadata and enqueue affected projection/invalidation/notification work. Rejected new scans do not create attendance events.
9. After commit, return the saved response. Workers deliver side effects. Never send push, mutate React state, or call external APIs inside the retryable transaction.

Firestore reruns transactions on conflicting reads and requires reads before writes. Deterministic day/operation IDs are the serialization/uniqueness mechanism here. See [Firebase transactions](https://firebase.google.com/docs/firestore/manage-data/transactions).

### 9.3 Retry behavior

Generate one operation key before submitting a detected token and disable concurrent candidate submission. On a timeout, preserve the key and query `/operations/{id}`. If committed, show its result even if the QR is now expired. A temporary not-found result does not prove an in-flight request cannot commit; keep the uncertainty state and retry/status-check the same operation before allowing a fresh intended scan.

An authorized retry of the same token/body/key may recover the operation. A truly uncommitted operation with an expired QR needs a new current scan after the prior attempt is resolved. Keep only non-secret pending-operation metadata for recovery; do not persist usable QR tokens. The UI never displays success until a durable result is known. Offline scans are not queued as official attendance; assisted entries are a separately authorized audited flow.

## 10. Exemptions, corrections and immutable history

Use one range request for approved leave with category, coverage, local start/end, requester, subject, approval/revocation metadata and restricted-note reference. Apply it only to eligible scheduled work dates. Pending requests remain visibly unresolved; they do not grant ordinary staff approval authority. Define how unresolved reviews affect finalization without presenting a pending decision as an approved excuse.

Coverage is explicit: full-day absence, lateness only, early departure, or clocking requirement waived. Full-day leave plus an actual IN is a worked day with retained leave context; partial lateness approval does not excuse a whole-day absence. Changing a Staff profile to `onLeave` is not a substitute for a dated request.

Approvals/rejections/revocations use a request-version precondition and a transaction that saves decision, audit, affected day version and outbox. Reject self-approval and duplicate/racing reviews. For long date ranges, commit the approval once and process bounded day batches with progress/checkpoints. The API must report that projections are updating rather than claiming all historical totals changed atomically in one huge transaction.

Correction approval appends a CORRECTION event with references to the original event/day and requested effective time. Preserve raw server scan times; projections expose effective times with a correction indicator. Reject impossible in/out order, future invented attendance, out-of-scope dates or time ambiguity. Require another authorized reviewer where the subject/reviewer would coincide.

Assisted manual entries record actual asserted occurrence time separately from server entry/approval time, operator, evidence/reason, source and subject. A manager-entered 07:30 cannot be presented as a server-observed QR scan at 07:30. A rejected correction never mutates the original event. An accepted retroactive change reopens the day and produces a new report version; old versions remain explainable.

Write a minimal school-history entry in `historyLogs` only if useful for the existing activity page. Detailed canonical clock audit stays in `staffClockAudit`, server-only, with no leave narrative in public history or push. Append-only application access is not a claim of cryptographic tamper evidence against a database administrator; stronger immutable retention needs a separate infrastructure design.

## 11. Daily roster, reporting and background work

### 11.1 Expected staff and finalization

At the configured school day-open point, a durable job resolves enrolled eligible staff and freezes expected schedules into bounded roster shards. A first scan can safely create the staff/day snapshot if the day-open job is delayed; the job must converge to the same frozen version. Record enrollment/termination/launch bounds so new hires, suspended/inactive periods and dates before launch do not become fictitious absences.

At each relevant cutoff plus allowed departure window, a server job processes bounded roster shards. No IN and no approved full-day exemption becomes unexcused absence only after finalization. IN without OUT becomes missing-out; never synthesize an OUT at ETD. A pending approval/calendar-coverage problem is marked unresolved under the agreed policy. Reports show job lag/unfinished coverage instead of zeros or premature absences.

Day-open/finalize/repair job keys include school, date, shard and planner version. Jobs use leases, retry/backoff, attempt limits and checkpointed progress. On a later run, catch up due dates without scanning every historical staff event. Disabling the module stops new scans/jobs/notifications; it preserves readable recorded history and permits a controlled drain or pause of existing outbox work.

### 11.2 Projections and aggregate correctness

The accepted scan transaction commits the employee's daily truth immediately. It queues derived report work durably. Do not synchronize every scan through a single school-wide summary document or a global dashboard revision.

Use deterministic staff shards for daily report chunks. A worker reads the relevant source day version and its last applied contribution; in one transaction it removes the old contribution, applies the new one, advances the processed version and updates affected summaries. Repeated or out-of-order delivery cannot double-count a day or apply an older version over a newer one. Coalesce multiple events for the same day before rebuilding a report chunk when possible.

School/date or period report manifests identify chunk revisions. Personal devices receive only own scopes. Managers fetch only authorized shards/pages. Coalesce manifest updates where necessary; measure contention and write cost rather than promising a zero-cost aggregate update for every scan. The UI merges an accepted own scan immediately and labels the school summary Updating until its watermark catches up.

Report snapshots include selected filters/scope, revision, complete/pending state and source watermark. Cursors are tied to snapshot/revision; if that snapshot changes during pagination, either serve retained snapshot chunks or return a clear reset-required result. Never silently concatenate rows from incompatible revisions.

### 11.3 View implementations

| View | Specific implementation |
|---|---|
| Daily | Rows from staffClockDays/report chunks joined to minimal authorized directory projection; Staff, IN, OUT/status. Counts come from complete projections, not the current page. |
| Weekly | Reuse cached day payloads and changed date/shards. Exactly two rows per staff, name cell spanning IN/OUT, all seven days, sticky name and horizontal phone scroll. Arrival colors use that day's snapshot; departure has separate early/missing markers. |
| Monthly | Per-staff materialized contributions; scheduled/present/on-time/grace/raw-late/excused-late/unexcused-late/exempt/absent/incomplete. Assessment column is visibly Proposed and available only when configured. |
| Termly | Exact canonical term intersection, separate intersecting month panels and term summary. Mid-month boundaries use day contributions, not full calendar-month totals. |
| Own history | Server-filtered staffId from the actor. Query parameters cannot elevate to another employee. |
| Review drawer | Effective/raw times, frozen schedule and rule sources, allowed exemption/correction details and audit references. |

Status counts have declared denominators. Present includes on-time/grace/late. Exempt absence excludes days actually worked. Missing-out and pending-review are additional flags, not categories to add blindly to present/absent totals. A scheduled day with the clocking requirement waived has its own excused outcome; it is not automatically absent merely because it has no IN.

Reuse `GlassPageTopBar`, `GlassStickyTableShell`/Scroller/Table, `GlassSummaryBar`, date/term controls and accessible dialogs. The existing pupil attendance page is a large, pupil-specific report; do not copy its data hooks, exclusion logic or calculations. Keep daily details below stable summary/card grids or in drawers rather than expanding one card inside its sibling grid.

### 11.4 Exports and assessment separation

Daily/weekly records and review are MVP. Basic CSV may be added in that batch if required operationally; the full monthly/termly export suite follows the reporting release. Export the same server snapshot/filters/revision as the screen, include school/timezone/generated time/status legend, and keep notes out unless separately authorized. Escape spreadsheet-formula prefixes in CSV, enforce permission again at download, and record export metadata. Printable PDFs use the existing document/PDF workspace and must match screen data after corrections.

Later assessment policies produce one active review proposal per eligible staff/date/policy snapshot, using integer UGX and staff > group > school precedence. Approved lateness exemption/waiver updates only affected proposals and report versions. No changes to `staffSalary*` collections, fee accounts, wallets or salary allocation functions. Payroll policy/legal review is outside this implementation; the blueprint's legal citation has not been independently assessed here.

## 12. Notification and scheduler integration

Extend existing `scheduledDispatchQueue` with distinct job types, for example `staff_clock_day_open`, `staff_clock_finalize`, `staff_clock_holiday_decision`, `staff_clock_outbox`, and later `staff_clock_missing_out`. Extend the dispatcher channel union, validation, lease/error handling and handlers together. Keep new categories/configuration separate from pupil attendance; changing staff reminder preferences must not alter pupil reminder times/recipients.

Use the existing scheduled communications dispatcher as the initial owner. Its repository workflow is scheduled every five minutes, so finalization/notification delivery is eventual and may be later than five minutes; it is not a precise-time guarantee. Actual QR timestamps are independent of that scheduler. Plan/config/calendar mutations can enqueue due work; the dispatcher drains it and catches up safely. A daily planner seeds a bounded horizon; every task rechecks its current configuration/version before execution.

The repository also contains Firebase scheduled/task attendance code, some gated/legacy. Do not enable it as a second owner for the same staff jobs. Before pilot, verify the live scheduler, secrets, runtime support, function/hosting plan, retries and actual invocation history. `firebase.json` declares an older nodejs18 functions runtime; current deployment support was not checked. The chosen Next.js queue path should not depend on deploying new functions unless deliberately needed.

For a holiday decision, create one persistent task keyed by school + canonical occurrence/scope/version, visible in Record > Manage even with push blocked. An unanswered decision remains non-working. A manager response saves approval/override/revision/audit atomically, then queues targeted staff notices. Calendar cancellation invalidates the task/decision version; an old queued task rechecks before sending.

Call shared `getServerPushSubscriptionsForUsers` and `sendServerWebPush`; despite its name, the latter also routes native FCM. Resolve eligible account IDs from current permissions/staff links; do not reuse `user-groups.ts` as the attendance identity authority because some fallback lookups still use the legacy `users` collection.

Reuse the established in-app delivery schema and idempotent delivery patterns from notification/payment workers, without writing staff events into payment-named containers. Save the inbox item/delivery intent before attempting push, mark per-recipient progress and retry delivery without duplicate inbox rows. Avoid sending a manager push for every scan by default; start with actionable holiday/review tasks and later missing-out notices.

Add destinations such as `/staff-clocking/clock?date=...` and `/staff-clocking/records?date=...&review=...` through the existing safe internal URL resolver. General notifications carry generic leave/review labels and record IDs, never sensitive notes or reusable QR credentials. Verify open-app navigation and closed-app Web Push/FCM navigation separately.

## 13. Phased implementation backlog and gates

Each batch ends with a concrete locally reviewable change and its focused checks. A passed local gate is not permission to release.

### Batch A: baseline, scope and contracts

- Reconcile the current dirty checkout with the chosen development baseline; preserve unrelated edits. Confirm current versions of referenced files before coding.
- Review the two stale parent-specific contract checks with their owners; update assertions to intended behavior when authorized, without reverting parent access semantics.
- Add typed contracts, feature settings default-off, provisional error codes, source fixtures and dry-run identity/calendar coverage checks.
- Record real staff/account counts, display choice, workday policy and cache/read baseline from an authorized test environment. No production backfill during discovery.

Gate: agreed capabilities, pilot eligibility, schedule/cutoff decisions, actual staging/emulator setup and documented baseline limitations. Engineering can implement the pure resolver/contracts before school working-hour values are chosen.

### Batch B: trusted inputs, authorization and data boundary

- Implement server school/actor resolution, staff-link checks, access generation and granular permission registration.
- Add staff mutation gateway and protect attendance-driving calendar/term mutations; retain cache revision integration and existing event/exam behavior.
- Create server-owned collection rules/exclusions, emulator fixtures and required index definitions.
- Audit/gate `useStaffCacheBootstrap` for clock-only/display-only identities: they must not preload full private Staff profiles merely because the role is Staff. Where other modules need teacher names, provide an authorized minimal projection and update affected consumers deliberately.

Gate: ordinary staff/parents cannot mutate clock truth or its protected inputs, staff cannot fetch others' protected records, self-approval is blocked, display-only identity sees no private directory. Existing staff management and calendar workflows still pass focused regression tests.

### Batch C: calendar, versioned schedules and cache foundation

- Extract shared calendar resolver; normalize canonical terms and explicit calendar effects; handle deletion/cancellation/additional holidays.
- Implement effective-dated schedules/groups/overrides, conflict detection and pure day projection functions.
- Implement scoped manifest/bundle APIs, IndexedDB repository, one module provider, 304 handling, request dedupe, purge and generation guards.
- Implement authoritative version checks around backend rule-cache use and coherent payload/revision construction.

Gate: deterministic precedence/time boundaries; identical UI/server calendar results; no repeated rules payload on warm navigation; role/identity changes cannot expose old data; offline/reference data is correctly labelled. Group UI can remain basic at this point.

### Batch D: Manage, Exempt and day lifecycle

- Build school defaults, recurring days and date-specific overrides within Record > Manage; validate and show rule source/conflicts.
- Build exempt range request/review, restricted notes and own-request path; append audit/outbox.
- Implement roster snapshot/open and finalizer jobs with selected scheduler ownership, checkpointing and launch/employment bounds.
- Add durable derived-work worker and visible job/backlog status for administrators.

Gate: no-scan employee receives the correct frozen schedule; approved ranges cover only real scheduled dates; no premature absence, fabricated OUT, or pre-launch attendance. This gate precedes the pilot.

### Batch E: secure display and atomic scan engine

- Build hourly display sessions/capabilities, short signed tokens, key handling, expiry/revocation and rate limits.
- Implement operation-status API, deterministic operation/day IDs and transactional state machine with current authority checks.
- Test race/retry/expiry/revocation behavior before connecting a live camera.
- Render Record time/QR/fullscreen and stale/offline state with real API contracts.

Gate: several employees can use the same valid QR; rapid requests produce one intended event; no revoked/wrong-school/expired new scan succeeds; saved operations remain recoverable; warm QR issuance avoids per-rotation Firestore calls.

### Batch F: staff scanner, Android and daily/weekly review

- Implement own overview, just-in-time camera start, decoder, locked candidate submission, state recovery, saved-time feedback and complete cleanup.
- Add Android permission path; build/test a new APK locally if Android is an intended pilot target.
- Build daily/weekly tables, narrow live summary updates, own history, correction/manual review and complete audit drawer.
- Add basic actionable in-app/push notices and staff instructions/manual fallback.

Gate: browser and intended installed targets show durable truth; camera releases reliably; denial/offline/timeout behavior is clear; daily/weekly views reconcile to source days; closed views stop listeners. Unsupported old APKs show a useful assistance/browser path.

### Batch G: monthly/termly, advanced policies and exports

- Complete per-staff/date contribution ledger, scoped aggregate revisions and versioned report chunks/watermarks.
- Add exact term-by-month views, group/individual management refinements, exports, review-only proposals and later reminder flows.
- Test audited retroactive changes, duplicate/out-of-order worker execution, pagination under updates and screen/export parity.

Gate: every period total reconciles to contributing day versions, partial terms are correct, permission-restricted notes never enter general export/push, and materialization write cost is justified.

### Batch H: pilot preparation and separately authorized rollout

- Run full targeted QA/device/read-cost workload, document support/rollback and train the chosen operator/reviewers.
- Produce a release manifest covering Next.js source, rules, indexes, new env/config, scheduler work and Android artifact if required.
- Wait for explicit push/deployment/migration/pilot-enablement authorization; sequence live rule/index/config updates safely before enabling scans.
- Compare observed pilot attendance to recorded results before widening enrollment.

Gate: no unresolved integrity/access failure, declared target devices pass, measured cache/read behavior matches the claims, finalization catches up, and disable/rollback preserves data. Do not estimate calendar dates until baseline and policy decisions are established.

## 14. Test plan mapped to the blueprint

Use Node's test runner + tsx already in `package.json` for pure/server behavior tests, Firebase emulator tests for transactions/rules, browser integration for cache/camera behavior, and Android instrumentation for the wrapper. Static source checks supplement behavior tests; they cannot establish race correctness or cloud billing.

| Test group / proposed file | Coverage |
|---|---|
| `staff-clocking-schedule.test.ts` | T01-T13, T31, T36-T38: exact ETA/grace seconds, staff/group/school precedence, holiday cancellation/duplicates, Saturdays, range coverage, partial terms, join/leave/launch dates, fixed school timezone with host/device timezone changed. |
| `staff-clocking-access.test.ts` | T28-T29/C14-C15: active/inactive/missing links, scoped roles/actions, reviewer vs subject, API parameter tampering, account changes during a write, display-only identity. |
| `staff-clocking-transactions.test.ts` | T14-T21/T33: concurrent same/different keys, one QR used by multiple people, IN/OUT/COMPLETE, duplicate departure callbacks, same-key different body, lost response + expired token recovery, stale next-state guard, rollback on write failure. Use emulator concurrency, not only mocks. |
| `staff-clocking-display.test.ts` | T15-T16/T23/C09-C10/C19: wrong audience/project/school, expiry bounds, key/session generation, durable revoke across independent instances, cold start, no per-token issue rows and rotation-path DB-call counters. |
| `staff-clocking-cache.test.ts` | C01-C08/C11-C19: warm navigation/restart, changed-scope only, coherent versions under edit, missed signals, hidden-view detach, corruption/schema migration, cross-tab logout, late response after purge and permission reduction. |
| `staff-clocking-projection.test.ts` | T24-T27/T30/T32/T37: frozen schedules for no-scan staff, absence after cutoff only, missing-out, raw/effective correction history, exempt-and-worked, waived clocking, contribution replacement and out-of-order jobs. |
| `staff-clocking-jobs.test.ts` | T09-T10/T40: idempotent holiday task, non-response default, scheduling change/cancel, lease/retry/crash recovery, long-range batching, flag-off behavior and one scheduler owner. |
| `staff-clocking-reports.test.ts` | T30-T32/T39/C17-C18: distinct-date counts, exact period intersections, aggregate watermarks, stable pagination, correction/revocation propagation, CSV safety, screen/export source parity. |
| `staff-clocking.rules.test.mjs` | Anonymous/Parent/Staff/Admin direct-client reads/writes denied for all new server-owned paths; test list/get/create/update/delete and nested outbox/notes. Add tests ensuring fallback does not override explicit denial. |
| Browser scanner/cache integration | T22-T23/T34-T35: mocked media lifecycle + real browser rear camera, torch absence, screen reader/live region, keyboard, large font, reduced motion, 320/390/768/1366px, light/dark, tab/app background, offline mid-request. |
| Android device instrumentation | Permission first grant/deny/permanent deny, trusted origin only, navigation/cancellation, camera release on pause/lock, process restart/pending operation, old-APK assistance, external/native notification links. |

Extend current rules test tooling rather than running a standalone unprotected Firebase project. Run focused staff/calendar/auth/cache/notification regressions for touched files. Review existing failed source assertions independently; document whether a changed test corrects a stale contract or accompanies a real behavior fix.

For the controlled performance workload, use the blueprint's illustrative 30 staff/2 scans/day + managers as fixtures, then compare representative actual pilot traffic. Record auth/user reads, rule-version reads, changed-bundle reads, scan transaction attempts/reads, report chunk reads, rule-dependent reads if client signals are used, listener reconnects, writes, response latency and cache hits. Sum across instances. Do not log personal payloads/QR tokens; reconcile estimated application counters with authorized provider metrics. An instrumented emulator shows logical reads, not a production invoice.

## 15. Decisions to record before enabling the pilot

These are policy/hardware decisions, not reasons to stop all local engineering. Keep their values explicit and provisional until provided.

| Decision | Proposed engineering default / boundary |
|---|---|
| Staff attendance timezone | Africa/Kampala, matching current school scheduling utilities. User-facing chat date/time remains the user's Africa/Nairobi context. |
| Week start | Monday for reporting, seven days available; validate school preference. |
| Actual workdays/ETA/ETD | No invented school hours. Require an administrator to save a valid initial schedule. |
| Grace | Configurable whole minutes; Grace is separate from Late and not assessed. Actual value requires policy. |
| QR lifetime/session | 45 seconds / one hour, with bounded server transition handling only after measured tests. |
| Duplicate guard | Start pilot at 90 seconds, configurable; explain inability to intentionally clock out immediately after IN. |
| Absence/missing-out cutoff | Required per applicable schedule; no production automatic absence until configured. |
| Recess/term breaks | Staff schedule decides working status; term report boundaries do not define employment attendance. |
| Multiple departments/groups | Explicit group priority; conflicting equal-priority active schedules block save. |
| Own self-service | Active linked enrolled staff; unlinked managers may manage but cannot fabricate a staff identity. |
| Exempt/correction approval | No self-approval; named authorized alternate reviewer required, including for administrators. |
| Overnight/split shift | Unsupported configuration in v1; bounded late departure on the original work date only. |
| Cache retention/device trust | Persist sanitized own rules; no sensitive notes; manager reports memory-only on shared terminals until a retention policy exists. |
| Display security | Restricted display identity/capability; separate operator management access. |
| Financial assessments | Disabled until explicitly enabled as review-only policy; no payroll integration. |
| Initial clients | Shared responsive web/PWA plus Android wrapper upgrade if Android is in pilot; exact devices need testing. |
| Hosting/cache extras | No assumed Redis/shared-cache purchase, paid plan upgrade or new Firebase scheduled deployment. Measure before adding infrastructure. |

Remote access revocation can block future server operations immediately after the relevant transactional state change, but cannot physically delete already-cached data from an unreachable offline device. Keep sensitive contents out of offline caches, bound retention where appropriate, and purge on the next observable auth/permission change. Do not make an impossible immediate-offline-erasure promise.

## 16. Implementation status and remaining work

The local implementation now includes the protected module routes and permissions, deterministic schedule resolution, feature settings, school recurring schedules, signed rotating QR display sessions, server-authoritative scan recording, a basic Clock Records view, public-holiday and explicitly marked approved calendar-closure handling, and origin-restricted Android WebView camera permission support. These changes are local only and have not been deployed.

The QR signer requires a server-only `STAFF_CLOCKING_QR_SECRET` of at least 32 characters. The template documents the variable; no secret is included in source control.

The local implementation now also provides selected-staff enrolment, staff/group/school schedule creation and editing, manager-defined closures, self-service requests with reviewer queues, corrected/exempted daily projections, date/name filters, CSV export, summary metrics, in-app decision notices, and manual or CRON-authorized missing-clock-out finalization. It intentionally does not fabricate an absence for a staff member who never scanned because the school has not configured a roster/cutoff policy.

The validation pass and current limitations are recorded in [STAFF_CLOCKING_VALIDATION.md](STAFF_CLOCKING_VALIDATION.md). That evidence supersedes earlier completeness estimates: expected-roster/absence processing, durable push delivery, versioned manager group scope, dedicated period aggregates and the full cache-first bundle/revision architecture still require implementation. Physical Android and signed-in application testing also remain outstanding. Policy configuration and implementation completion are separate requirements.

The first code slice should be Batches A-B plus the pure resolver/contracts from C: settle the working baseline, establish trusted employee/calendar inputs, register explicit capabilities, add server-only collection rules and test the typed schedule engine. That produces a useful foundation without displaying a QR that cannot yet save authoritative attendance.

Pending local changes from this chat are only this plan and `STAFF_CLOCKING_DISCOVERY.md`. Existing application modifications predate this review and are not part of its release scope. Any later release must identify all changes owned by this chat, validate their combined behavior and wait for direct user release authorization. Documentation-only pushes are normally ignored by the current build script, but an unknown deployment baseline or explicit override can still build; no push is authorized by this plan.

## 17. Reference and validation notes

Primary repository evidence and observed baseline check results are recorded in [STAFF_CLOCKING_DISCOVERY.md](STAFF_CLOCKING_DISCOVERY.md). Current external documentation was checked only for the narrow technical constraints cited inline: Firestore transactions, overlapping rules, listener billing, upstream browser decoding APIs and Android WebView permission behavior. It was not used as evidence that any of those paths work in the current deployed application.

No secrets were read from environment files, no production reads/mutations were needed for this planning run, and no package installs, migrations, commits, pushes or deployments were performed.
