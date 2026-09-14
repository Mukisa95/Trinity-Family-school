# Optimization implementation audit — 13 September 2026

The reviewed changes are safer after the corrections below, and the focused tests pass. **The entire plan is not complete or release-verified.** Earlier statements that R1–R5 were fully complete were too broad. R6's proposed switch to stored fee summaries is excluded following the user's instruction to preserve how fees are fetched and displayed.

## Scope and evidence

Reviewed the current optimization changes against repository HEAD `b701ea259ec2f0b01b30d3c9c05efbbbd822a50e`, the original optimization plan, and the R1–R7 remaining-work plan. The working tree already contains unrelated changes; this is a review of the optimization paths, not approval of every pending file. Nothing was committed, deployed, backfilled, or written to production.

Covered payment operations/API, individual and family collection handlers/hooks, uniform and carry-forward allocation, operation recovery, signatures/history, banking commands, progressive fee processing, historical snapshots, reference catalogs, SchoolPay recovery, development tooling, and the notification outbox/worker.

The separate collection print-dialog changes, exam/report/PDF edits, navigation, offline work, service worker, images and fonts were preserved. Their presence prevents a blanket claim that every pending frontend change is invisible to users.

## Defects corrected during this review

| Finding | Correction | Regression evidence |
|---|---|---|
| The payment route enqueued notifications and also sent them independently. A later worker could send them again. | Initial delivery and replay now use the same event worker. Re-enqueue is create-only and preserves completed recipients, attempts and leases. | Concurrent workers, repeated enqueue and route ownership tests. |
| Future retries could occupy the worker's limited query before ready events. Crashed jobs could retry indefinitely. | Select due time before limiting; use bounded attempts, exponential delay and terminal failure. | Future-job starvation and exhausted-worker fixtures. |
| An expired worker could overwrite a newer worker's result. | Each claim has a unique token; preparation, recipient progress, completion and retry writes verify that token. | Replaced-lease fixture. |
| Provider failures and recipient lookup errors could be recorded as success. A partial retry could notify successful recipients again. | Inspect delivery failures, propagate lookup failure, and persist progress per recipient with a stable notification identifier. | Partial-recipient failure, lookup failure and stable-ID tests. |
| Retry balances could change after later payments; enqueued payment data was not independently checked. | Read the confirmed payment, skip reversals, and freeze the first prepared notification. Share pupil, fee, scoped-ledger and recipient-policy reads within a worker run. | Canonical-payment, reversed-payment, fixed-balance and read-count fixtures. |
| A new top-level outbox would inherit broad existing browser access. | Internal events now reside under `scheduledNotifications/fee-payment-events/outbox`, which is excluded by the existing rules. No rule or authentication change. | Source review and existing security contract pass. Added a real rules test for anonymous/admin/parent denial; emulator execution remains pending. |
| Signature retry handling could attach a new audit action to an existing, incomplete signature. Empty metadata could introduce an undefined Firestore field. | Refuse incomplete/mismatched pairs; retain the original pair on valid replay; omit absent metadata. | Replay, mismatch, incomplete-pair and undefined-field tests. |
| Enhanced loan creation had started disbursing loans even without academic-year/term context, unlike the previous behavior. Metadata and Firestore timestamp ordering also differed. | Preserve loan-only creation without period context, retain `processedBy: System` on enhanced disbursements, and normalize timestamps before oldest-first repayment ordering. | Enhanced-loan and oldest-first allocation tests, alongside concurrent withdrawal/repayment tests. |
| The family batch query did not exactly match the previous per-pupil query's ordering/document eligibility. | Restore the existing payment-date ordering on batched pupil queries. | Compare each batched pupil ledger against the established per-pupil result. |
| A failed family ledger could be interpreted as missing/empty fee information without reporting the failure. | Propagate the error, avoid another family's placeholder ledger, prevent submission from an already-open modal, and use the existing error toast. | Hook failure test; unchanged page template test. |

These changes preserve normal fee information and payment layouts. The deliberate failure-state improvement is that an unavailable ledger produces an error and blocks payment, rather than permitting an action based on incomplete data.

## Verification

- **76 focused tests pass**, through `npm run test:payment-optimization`. This includes payment operation replay, changed-payload rejection, grouped rollback, uniform tracking, carry-forward, discounts/assignments, banking concurrency, notification retries, catalogs, snapshots, and operation recovery fixtures. See `optimization-audit-tests-2026-09-13.txt`.
- **11 existing contract checks pass:** SchoolPay inbox and push, family loading, read-only snapshots, Firestore security contract, auth session flow, discount-aware payment flows, uniform collection, notification recipient settings, notification history, and scheduled notifications.
- Source parity checks pass for existing authentication/rules implementations and SchoolPay webhook verification. Existing payment authentication calls and user checks were retained; no additional authentication step was added.
- AST comparisons against HEAD pass for the individual payment page, family page and family payment modal. This proves their JSX templates match; it is not a browser screenshot or a proof of every displayed value.
- The fee calculator was not switched to stored summaries. Existing formula tests pass. No R6 summary reader/backfill was introduced.
- Scoped `git diff --check` passes.
- Full TypeScript checking remains unsuccessful with **435 diagnostics**; see `optimization-audit-typecheck-2026-09-13.txt`. Errors include generated layout declarations, fee summary settings, requirements model mismatches and other application areas. Do not describe the full build as passing. No diagnostic suppression was introduced.
- `npm run test:firestore-rules` was attempted using the local demo project. It cannot start because Java is missing (`Could not spawn java -version`). The new server-only event test is therefore **written but unexecuted**.
- Tests use controlled in-memory services and fault injection. No real financial mutation, live push, authenticated browser payment, production billing measurement, or production build acceptance was performed.

Read-count evidence is limited to fixtures: 61 unique pupil scopes use three batched queries; two notifications for the same pupil/fee/period share one pupil read, one fee read, one scoped ledger query and one recipient-policy lookup. Batching reduces requests; it does not imply the same reduction in billed document reads. Queue reliability adds reads and writes of its own. There is no measured p50/p95 improvement or basis for promising instant server confirmation.

## Actual plan status and remaining work

| Phase | Current status | What still prevents completion |
|---|---|---|
| R1: baseline and protection | Repeatable tests and source comparisons implemented. | Browser/value/receipt baselines, measurements and release diagnostics remain. |
| R2: payment completion and recovery | Grouped financial/history/uniform writes and stable payment operation replay are tested; signature pairs are independently atomic and retryable. | Signature creation still follows the financial commit, so payment plus signature is not one atomic operation. Recovery references are session-scoped; cross-tab behavior, unavailable storage and changed/recalculated payload recovery need acceptance work. |
| R3: banking | Core transaction consistency and enhanced loan behavior tested. | Stable command identities are not implemented across all deposit/withdrawal/loan commands. A repeated user command can still create another operation. Legacy duplicate accounts are blocked, not reconciled; remaining account/loan consistency scenarios need integration coverage. |
| R4: shared data | Family batching, pupil ownership improvements, request reuse, catalog refresh and bulk snapshot loading tested. | Older resolved year-payment caches can remain stale after remote edits; complete owner sharing, source revision invalidation and a reusable historical calculator are unfinished. Legacy requirements model/filter discrepancies remain visible in type checking. |
| R5: notifications | Lease/retry/progress worker is substantially corrected and tested. | See the deployment and durability gaps below. It is not yet a complete durable pipeline. |
| R6: stored-summary reader switch | **Excluded by user instruction.** | Preserve the existing fee source, fetch behavior, calculation contract and display; no backfill or reader switch. |
| R7: acceptance and release | Local focused/contract checks performed. | Real Firestore/emulator, browser and receipt parity, clean release checks, timing/read measurements and an explicitly authorized rollout remain. |

### R5 gaps that must not be hidden by passing worker tests

1. **Crash before enqueue:** the event is still written in an after-response callback, after financial commit. A restart before that callback can leave a confirmed payment without an event. Replaying the same payment safely attempts the handoff again, but is not automatic reconciliation. A complete solution needs a commit-time durable marker or a bounded recovery scanner compatible with the existing access model.
2. **Scheduler activation:** the cron route exists with its existing secret check, but no deployment scheduler wiring was found for it. Failed events need a scheduled worker; a route alone does not provide this. Configure it during an authorized rollout and verify real retry/terminal-state visibility.
3. **Balance meaning:** notifications preserve the previous base-fee-minus-nonreverted-ledger formula and freeze it at first preparation. This is not guaranteed to equal a discount/holiday-aware balance at payment time. Resolve this explicitly with fixtures before changing the financial message formula. Fee screens were not changed to this formula.
4. **Delivery uncertainty:** a provider can accept a push before progress persistence fails. Stable notification IDs and recipient progress reduce duplicates, but do not guarantee exactly once on every endpoint. Mixed success across one recipient's devices can still repeat a device delivery.
5. **Execution limits:** the after-response eight-second race stops waiting; it does not cancel a provider request or bound enqueue time. Confirm hosting limits, expired-lease recovery and real provider failure handling in integration tests.
6. **Existing deployment state:** no live inventory or migration was performed. If the earlier top-level outbox was ever deployed, its pending events need a read-only inventory and deliberate migration before enabling the new path.

## Recommended next package

First close the payment/signature recovery and banking command-replay gaps, and make notification handoff recoverable without introducing another authentication check. Then address cache freshness using the current fee calculation and display contract. Run the missing emulator/browser acceptance and comparable timing/read measurements before any release. Keep R6's summary-reader redesign out of that package.

Rollback must retain confirmed payments, operation IDs, signature/audit records and pending notification events. Pause a failing worker while preserving retry evidence; never repeat a financial command merely to retry a notification.
