# School branches implementation plan

Status: architecture and delivery plan only. No branch feature or production migration has been implemented. Prepared 11 October 2026 against the local Circumference worktree.

## Intended behaviour

A school can run several branches inside the existing application. An authorised user creates a branch under School Settings, chooses reusable setup records, and gives it its own identity and theme. A new branch starts with zero pupils and zero pupil activity. Selected subjects, class definitions, staff, and other setup information can already be available.

Sharing uses references to a single source record. It does not copy entire collections or pull related pupil records into the new branch. Each branch retains its own operational records, permissions, Circumference, reporting, and financial history.

## 1. Establish school and branch boundaries

Keep one application, Firebase project, and Firebase Authentication identity per user. Introduce a school record and branch records with immutable IDs, names/codes, active status, branding, theme, and provisioning status.

Recommended target storage layout:

```text
system_users/{uid}                                  existing global login identity
schools/{schoolId}                                 school administration metadata
schools/{schoolId}/branches/{branchId}              branch identity and lifecycle
schools/{schoolId}/subjects/{subjectId}             canonical subject definitions
schools/{schoolId}/classTemplates/{templateId}      reusable class definitions
schools/{schoolId}/staff/{staffId}                  selected shared staff identity
schools/{schoolId}/feeDefinitions/{definitionId}    reusable fee definitions
schools/{schoolId}/uniformDefinitions/{itemId}      reusable uniform catalogue
schools/{schoolId}/assets/{assetId}                 explicitly shared system assets
schools/{schoolId}/settingsTemplates/{templateId}   approved reusable settings
schools/{schoolId}/branches/{branchId}/memberships/{uid}
schools/{schoolId}/branches/{branchId}/staffLinks/{staffId}
schools/{schoolId}/branches/{branchId}/catalogLinks/{linkId}
schools/{schoolId}/branches/{branchId}/{collection}/{recordId}
```

The last path contains branch-owned pupils, classes, settings, academic calendars, fee applicability, payments, exams/results, attendance, timetable schedules, inventory, and other operational collections. Sharing manifests and branch links are small records; they do not duplicate the canonical definition.

Branch-owned record IDs and references must resolve within their branch. Use explicit school/branch identity for exports, jobs, logs, invoice identifiers, idempotency keys, and provider mappings. Admission numbers can remain branch-specific while internal IDs remain unambiguous.

Firestore supports hierarchical subcollections and queries within them; this storage layout is an application design recommendation based on those capabilities. [Firebase data structure guidance](https://firebase.google.com/docs/firestore/manage-data/structure-data).

## 2. Define what can be shared

| Requested category | Reused once through references | Kept separately in each branch |
| --- | --- | --- |
| Subjects | Name, code, reusable subject definition | Class/teacher assignments, examinations, marks, results |
| Classes | Level, name, code, ordering template | Class instance ID, streams/configuration, class teachers, captains, pupils, attendance |
| Selected staff | Approved identity/profile fields and selected profile photo | Employment status/roles, duties, class and subject assignments, payroll, MOFUS assignments |
| Fees management | Selected fee definitions and explicitly approved pricing-policy versions | Branch class/section/term applicability, discounts, pupil charges, balances, payments, receipts, bank/provider credentials |
| Uniform data | Catalogue definitions, sizes, selected default prices | Stock quantities, procurement, requests, sales, pupil allocations, payments |
| Selected users | Existing account identity; no copied accounts or credentials | Branch membership, role, module/action permissions and Circumference |
| System photos | Selected logos and school/branding library assets | Pupil photos, pupil documents, signatures and private attachments |
| School settings | Explicitly selected public profile/policy categories | Branch address/contact details, theme, academic periods, payment configuration, revision counters and operational state |

The current Class, Staff, FeeStructure and SchoolSettings models mix some of these fields. Refactor their reusable definitions separately from branch-specific fields before offering sharing.

Selecting a class template creates a lightweight local class instance with no pupils or captains. Its local ID is used in Circumference, fee applicability, exams and timetable creation. Sharing a staff identity does not automatically share their assignments or sensitive HR documents.

Academic years and terms start as branch-owned records. When selected fee definitions refer to existing years, terms or classes, the creation wizard requires explicit mappings to local records. Unmapped definitions stay inactive. Never carry another branch's balances or financial transactions through these mappings.

## 3. Make sharing predictable after creation

Select individual records or select all current records within an approved category. Store that explicit selection in a sharing manifest; later additions in the source branch do not automatically become available.

Chosen records remain live references. A shared-source edit affects all linked branches and requires permission to edit shared data. Show a Shared badge, source information, and an impact preview before saving. Branch editors can change allowed local fields through overrides without rewriting the shared source. Provide an explicit detach action when a branch needs an independent definition; copying happens only as a deliberate change from sharing to independence.

Version fee/policy changes by effective period and preserve the values used by posted transactions and closed terms. Shared updates must not recalculate ended-term fees, historical receipts, exam records or completed MOFUS benefits. Keep historic references resolvable when a shared item is retired. Prefer archiving to destructive deletion.

## 4. Extend Circumference with branch membership

Resolve access in this order:

```text
Verified user -> school -> active branch membership and staff link
              -> branch module/action permission -> branch Circumference
              -> pupil/family ownership where applicable
```

Each staff-linked user can have different permissions and Circumference in different branches. For example, a bursar can handle all Primary pupils in Branch A and only P4 in Branch B. Giving that user Branch B access requires the linked staff member to be active in Branch B as well. Staff sharing makes the account eligible; it does not automatically grant access.

Add separate capabilities for creating branches, managing branch metadata, managing shared staff, granting branch access, editing shared definitions and changing branch appearance. Grant operations must be checked against the creator's grant authority. A school administrator can manage branch metadata with the relevant capability; the existing Admin role must not silently bypass branch membership to read pupil records. Include the authorised creator's staff link and membership in branch provisioning so every ready branch has an administrator.

Selected users are limited to eligible staff-linked accounts. Parent access continues through their linked pupils in the relevant branch; ordinary staff switching is not granted to parents. Cross-branch parent families need a separate explicit family-access design before that capability is enabled.

Server requests validate the submitted branch against current membership and staff links. Apply the same boundary to lists, direct record reads, mutations, transactions, aggregate counts, search, exports, batch operations, Storage downloads, native requests, Functions and integrations. Check all related IDs on writes to prevent linking a Branch A payment/exam to a Branch B pupil.

Queries must select authorised branch data before retrieving pupil data. Browser filtering is insufficient: Firestore rules reject unauthorised query shapes, and server libraries bypass those rules, so authenticated server handlers need their own checks. [Firebase query and security guidance](https://firebase.google.com/docs/firestore/security/rules-query).

Keep school-wide shared catalogues visible only through authorised branch links or explicit school catalogue management permission. Shared-definition access must never expose other branches' pupils or activity. Combined pupil/finance reports are outside the initial feature.

## 5. Add creation and staff-sharing controls to School Settings

Add a Branches section alongside existing School Settings. Include branch list/status, create branch, edit identity/theme, sharing manifest, staff sharing and user access management. Hide unavailable actions and enforce their permissions on the server.

Creation wizard:

1. Enter branch name/code, location/contact details, and theme.
2. Choose an existing branch as a setup source or start blank.
3. Choose categories and individual records; separate shareable definitions from local settings and show required class/term mappings.
4. Select staff, then eligible accounts. Configure permissions and Circumference for each selected account.
5. Review the exact sharing manifest and the explicit zero-pupil/zero-history starting state.
6. Provision through an authenticated, idempotent server operation. Expose the branch for switching only after it reaches Ready.

Provisioning can be resumable for large selections. Store creating/ready/failed state and an operation ID. Failed retries must not create duplicate links or partially visible branches. A branch can start without an academic calendar, with clear setup prompts and dependent actions disabled until configured.

Staff Sharing lets authorised users add/remove a staff identity in chosen branches later. Removing a link immediately blocks that staff member's linked accounts in that branch, invalidates membership revisions, and prompts active clients to leave the branch. Retain historical actor references. Review and clear/reassign future class/subject duties; keep ended-term assignment history intact. Do not delete the person's identity or access to other branches.

## 6. Add the sidebar switcher and branch appearance

Put the branch selector in the existing school-name/logo area of the desktop and mobile sidebar. Show school name, active branch name, and only accessible Ready branches. A single-branch school retains a compact header. Use one shared switcher component across layout variants.

Switching must handle unsaved forms, stop old listeners, cancel requests, reject late responses, reset protected query state, then load the new branch's settings/data. Persist the active selection per tab so one tab does not redirect another. Bind drafts, queued offline writes, downloads and print jobs to their originating branch; never submit them using the newly selected branch.

Partition React Query keys, persisted collections, listener registries, data revision documents, native caches and offline queues by school, branch and user/access revision. Shared-definition caches use their canonical source/version. Audit the underlying Firestore persistent cache and native storage as well as UI caches; sensitive offline access must be revalidated and stale revoked data removed on reconnect. Public login branding stays separate from protected settings.

Each branch supplies its own default palette/branding. Preserve light/dark/system and accessibility preferences; scope any personal appearance overrides to the branch. Prevent the previous branch's colours/data flashing during loading. Use the active branch's identity in headers, receipts, report cards, PDFs and exports.

## 7. Cover existing module behaviour and integrations

Keep the earlier staff/class synchronisation branch-specific. Class teacher and ordered subject-teacher/assistant assignments in one branch must not alter another branch. Exams use that branch's primary subject teachers; timetables offer its eligible primary and assistant teachers. Staff detail pages show duties for the active branch, with any authorised cross-branch summary clearly separate.

MOFUS pupil links, benefit schedules and term history remain private to the branch even when the staff identity is shared. Carry branch and term identity through benefit calculations, fee snapshots and edits.

Audit fees/SchoolPay, exams, timetables, attendance, dormitories, uniforms, procurement, notifications, pupil registration, parent views, search, dashboard counts, exports and Android/PWA paths. Webhooks route using verified provider/account/invoice mappings; ambiguous events are held for review rather than assigned to an arbitrary branch. Jobs run with explicit branch context. Notification recipients and links must respect current branch membership.

## 8. Migrate the existing school safely

First designate current records as the Main Branch and record an inventory of every collection, asset path, relationship and background writer. Existing data remains in that branch; creating another branch never runs a pupil/history-copy operation.

Build a dry-run migration with backups, stable ID/reference mappings, count/relationship checks and financial-total comparisons. Extract reusable catalogues without changing recorded historic values. Migrate operational collections in controlled groups, using write pauses or a tracked handover so there is one authoritative writer during each cutover. Preserve a recoverable legacy snapshot.

A temporary legacy adapter may read current root collections only for the designated Main Branch. Missing branch context must fail closed, and no new branch may fall back to those root collections. Remove the adapter once all consumers and records have migrated. Do not keep parallel operational copies as an ongoing business model.

Keep the branches feature disabled until all private-data entry points use the verified branch boundary. Preview and validate migration output before any explicitly authorised production release or data migration.

## Delivery order and acceptance checks

| Phase | Deliverable | Required evidence |
| --- | --- | --- |
| 1 | Collection/writer inventory, schema contracts, Main Branch migration preview | Complete ownership classification; legacy counts and relations recorded |
| 2 | Branch context, memberships/staff links, server gateway and Firestore/Storage rules | Direct IDs, queries, transactions and foreign references denied across branches |
| 3 | Shared catalogues, branch instances/overrides, effective policy versions | Selected definitions stored once; local assignments and ended terms preserved |
| 4 | School Settings creation, user access and staff sharing | New branch has zero pupils/payments/results; retries safe; revocation immediate |
| 5 | Sidebar switcher, settings/theme, cache/offline/native boundaries | No late-response or cached-data bleed; separate tabs and printed output correct |
| 6 | Full module/integration coverage, migration rehearsal and release preparation | Webhook/job routing, balances, IDs and existing Circumference behaviour verified |

Use emulator integration tests with two branches, shared and unshared staff, users with different Circumferences, a school administrator, and pupil-bound parent accounts. Verify both successful authorised behaviour and attempts to cross branches. Inspect query traces to confirm that opening Branch B does not fetch Branch A pupil records. Test shared-record edits, detach/retirement, staff revocation, payment retries, offline reconnect, responsive switching, theme loading and printable branding.

Implementation and local validation do not authorise deployment. Release requires a current explicit user request, coordinated rules/index/backend/application changes, migration review and a rollback plan.

## Current planning validation

Reviewed the existing settings service/revision documents/listener registry, theme provider, sidebar entry points, user authentication/Circumference boundary, and Staff/Class/FeeStructure models. Checked Firebase's official structure and query-security documentation. This document is the only new branch-related change. Branch tests and migration checks will be created during implementation; none are claimed as passing today.
