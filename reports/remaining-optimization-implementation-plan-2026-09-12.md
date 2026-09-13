# Plan for the remaining optimization work

Prepared: 12 September 2026.

Source: [optimization behavior review](./optimization-behavior-review-2026-09-12.md). This plan covers the unfinished work identified by that review. It follows the corrected implementation status in the [original plan](./optimization-plan-authentication-unchanged-2026-09-11.md).

**Audit update, 13 September:** the implementation is partial. See [the current audit](optimization-implementation-audit-2026-09-13.md) for verified fixes, tests and open acceptance gates. R5 is not fully durable yet; R6's stored-summary reader switch is excluded by user instruction. Earlier progress counts below are historical.

**Original planning status: planned, not implemented by this document.** R1–R7 are seven remaining-work phases; their numbering does not imply that the original phases were completed. The review recorded 46 passing focused tests and 438 repository TypeScript diagnostics. Re-establish those results in R1 rather than assuming they remain current.

## Outcome and boundaries

Make recording more reliable and reduce repeated reads while preserving the existing screens, fee information, legitimate payment outcomes and receipt history.

- Keep sign-in, session handling, existing payment authentication calls, user checks, Firestore rules and SchoolPay signature verification unchanged. Add no per-payment authentication lookup or login prompt.
- Preserve fee applicability, discounts, holidays, historical class/section, carry-forward attribution, reversals, account arithmetic, receiving-staff identity, receipt fields and existing notification recipients.
- Use financial validation and duplicate-operation checks to protect records. These do not change how the user authenticates.
- Preserve form layout, navigation, printable receipts and parent data scope. Correct misleading error states through the current interface. Record any discovered business-rule discrepancy explicitly instead of silently changing a formula during a refactor.
- Use controlled test data for failure, concurrency and migration tests. Keep unrelated worktree changes out of these implementation packages.
- Treat existing ledgers as authoritative. No automatic deletion, merging or rewriting of historical payments or duplicate bank accounts.
- New background jobs and collections must fit the existing access model. Verify that in integration tests; do not resolve a failure by weakening rules or adding an authentication redesign.

## Sequence

| Phase | Main result | Depends on | Completion evidence |
|---|---|---|---|
| R1 | Baseline and protected behavior | Current reviewed changes | Reproducible fixtures, scoped checks and diagnostic baseline |
| R2 | Complete payment and audit operations; recover after reload | R1 | Whole-submission rollback and lost-response/reload tests |
| R3 | Complete banking consistency and retry protection | R1; reuse R2 conventions | Concurrent command and replay tests for every migrated path |
| R4 | Shared fresh data and reusable historical calculations | R1; integrate R2 responses | Exact calculation parity, remote-change tests and measured read reduction |
| R5 | Durable notification processing | R2 and R4 | Crash/retry tests, unchanged recipient policy and correct balances |
| R6 | Excluded: stored-summary reader redesign | User preservation constraint | Existing fee fetch and display contract retained |
| R7 | Browser acceptance, measured performance and rollout | Retained R2–R5 scope | Passing release checks, comparison report and tested rollback |

Use that order for implementation. Each package must pass its own checks; a completed package does not imply that the remaining phases are complete.

## R1 — establish a reliable baseline

**Progress, 12 September:** started. The focused payment review is now reproducible with `npm run test:payment-optimization` and currently passes 52 tests. The initial implementation corrects the individual fee-statement nullable-settings diagnostic and adds session-scoped payment-operation recovery for individual and family submissions. Screenshot, emulator, production performance and unrelated type-error triage remain pending.

1. Capture an immutable baseline of the reviewed optimization files and a manifest of unrelated changes. Use a scoped branch/checkpoint without sweeping unrelated files into a commit.
2. Consolidate the focused tests into a repeatable review command. Re-run the existing SchoolPay, snapshot, family-loading, permission and receipt contracts.
3. Create controlled fixtures covering active and ended terms, discounts, holidays, uniforms, carry-forward, edited/reverted payments, sibling families and historical class changes. Capture expected amounts, balances, receipt fields and audit metadata from the established calculations. Identify known defects separately from expected behavior.
4. Capture desktop/mobile screenshots and displayed values for individual, family and class collection screens. Include receipt/PDF content, not only page JSX.
5. Establish cold/warm payment and navigation measurements. Separate click feedback, request time, database commit, signature work and displayed-balance update. Record sample count, network conditions, query counts and returned documents. Keep names, payment details and credentials out of measurement logs.
6. Triage current type/build failures. Fix affected payment, banking and shared-data blockers in small packages; track unrelated failures separately. Do not suppress diagnostics or disable checks to obtain a green result.

**Done when:** another run can reproduce the baseline; unchanged authentication is checked; expected data and screen outputs are recorded. Any unavailable browser/test-environment evidence remains explicitly pending.

## R2 — finish payment completion and recovery

**Progress, 12 September:** individual mixed regular/uniform/carry-forward submissions now prepare their existing allocation records and send them through one payment operation. The focused suite includes a rollback/replay fixture for that mix. Individual, mixed and family payment signatures now use the confirmed operation and payment IDs as a retry key, so a lost-response replay reuses the original signature and audit record. Signatures remain a separate audit write from the financial operation, and durable recovery references intentionally retain only the operation identifier/fingerprint in browser session storage.

Primary paths: `payments.service.ts`, the existing payment creation route, individual and family submit handlers, uniform integration, carry-forward allocation, digital-signature service/hook and history builders.

1. Convert individual mixed regular/uniform/carry-forward selection into one bounded allocation command. Preserve the source-period attribution of carry-forward and existing fee/tracking identifiers.
2. Build required payment history and digital-signature records with the existing schema and actor/session/device metadata. Separate record construction from persistence so required records can be included in the financial transaction. Preserve the signature's current meaning; do not substitute a generic server actor or describe a signature as saved when it is not.
3. Read all needed financial documents before transaction writes. Commit payments, required audit/signature records, uniform changes and operation result together. Validate allocation count and payload size before attempting the commit; reject oversize interactive submissions without partial writes.
4. Return the saved IDs and canonical receipt fields so the screen can update immediately after confirmed commit. Avoid another full ledger or catalog fetch before closing the payment dialog.
5. Add durable pending-operation references for reload recovery, using storage that fits the existing signed-in account/session boundary. Store minimal operation identity, fingerprint and state; no credentials or unnecessary pupil/payment details. Persist the reference before submission.
6. On reload or uncertain response, reconcile the original operation through the existing access path before allowing a repeat to acquire a new operation ID. Replay only the same financial payload; changed details must not masquerade as a retry. A missing status read caused by a network error is not proof of non-payment.
7. Cover multiple tabs, storage failure and account changes. Do not automatically resubmit payments on reconnect. Clear confirmed references according to retention policy; unresolved references must not expire in a way that silently allows duplicate payment. Do not introduce an offline payment queue.

**Done when:** regular, uniform, carry-forward, mixed and family submissions have one financial completion boundary; injected required-write failure leaves no partial records; a committed operation survives a lost response/reload and returns the original IDs with no second audit or balance increment. Existing screens and receipt fields match the fixtures.

## R3 — finish banking coverage

**Progress, 12 September:** started. Overdue-loan collection now reads its account and active loans before transaction writes, then commits the loan updates, repayment records and account balance together. Concurrent overdue runs have a replay fixture proving that only one repayment is recorded. Any balance-changing command now stops for a pupil with multiple bank accounts instead of selecting the first legacy record. Enhanced-loan creation and stable operation IDs for every banking command remain outstanding.

Primary paths: `banking.service.ts`, standard/enhanced banking hooks and their calling forms.

1. Inventory every balance-changing command: standard/enhanced deposits, withdrawals, loan creation/disbursement, repayments, overdue processing, cancellation and reversal. Mark paths that still split a command across writes.
2. Migrate enhanced loan creation and remaining multi-step paths into a transaction containing the relevant loan, ledger, balance, history and operation result. Preserve current repayment ordering and account arithmetic.
3. Give each logical command a stable operation ID. Define a distinct identity for automated overdue processing and user-initiated actions so a retry cannot create another repayment/disbursement.
4. Reuse the same result on replay and reject a changed payload. Ensure loan status and account balance are re-read inside transaction retries; retain document-reference reads supported by the installed SDK.
5. Produce a read-only report for pupils with multiple accounts or inconsistent loan/ledger relationships. Do not choose an arbitrary account for ambiguous new commands or silently merge historical accounts; keep those records on a reconciliation list.

**Done when:** simultaneous withdrawals, deposit/repayment, loan/cancellation and repeated reversal scenarios reconcile correctly; repeated operation IDs produce no second financial effect; ambiguous account records cannot be silently misapplied. Document any legacy business-rule defect separately from the transaction migration.

## R4 — consolidate reads and preserve historical calculations

Primary paths: individual/family fee hooks, payment and snapshot services, progressive collection processing, `feeProcessing.ts`, catalogs and the existing revision/cache utilities.

1. Define one reusable owner for each pupil's payment data, shared by individual/family consumers and receipt views within the existing access boundary. Share subscriptions by scope and dispose them when no consumer remains. Preserve account-switch cleanup.
2. Merge canonical mutation results and listener updates by ID. Handle listener-before-response, remote edits/reversals and stale snapshots; retain confirmed rows only within the same pupil/period scope.
3. Audit older caches, including year-payment caching. Make explicit refresh authoritative. Replace failed-read-to-empty fallbacks with a distinguishable error state; an unavailable ledger must not look like zero paid. Preserve the last confirmed value only with an honest refresh state.
4. Split historical data loading from a pure calculator. Supply payments, fee definitions, assignments, adjustments/discounts, holidays, uniform tracking and historical pupil data explicitly. Preserve the established calculation and date/term interpretation.
5. Reuse loaded dependencies and batch missing reads with bounded concurrency. Use relevant pupil/period scopes under the existing query and rule contracts; do not load the whole school for a family view. Validate any required indexes separately from rules.
6. Use source revisions/freshness signals for shared historical inputs. Ensure recaptured snapshots, changed fees and remote reversals invalidate dependent calculations without broad reloads.

**Done when:** old/new calculators agree exactly on controlled fixtures; unchanged warm recalculation performs no additional historical reads; explicit refresh observes remote changes; failed reads do not display false zero balances; two same-sized classes, empty selections and rapid term changes show only their own data. Report read-count changes, including the cost of any revision checks.

## R5 — make notifications recoverable

Primary paths: payment operation/route, fee notification server service and existing scheduled/background notification infrastructure. Inspect the attendance outbox and scheduled-dispatch patterns for reuse; do not assume their authorization or delivery contracts are interchangeable.

1. Save a durable notification event with the payment operation so a server restart after financial commit cannot lose all evidence that follow-up work is needed. Include operation/receipt identity and a versioned payload; avoid another financial write or callback-dependent enqueue.
2. Prepare the correct post-payment balance using the R4 calculation contract. Define whether the message reports balance at payment time and persist that meaning, so a delayed retry does not produce a different receipt message after later payments.
3. Preserve existing message fields and recipient policy. Resolve eligibility under the existing permission behavior when dispatching; reuse lookups within a bounded run. Keep any correction to legacy discount-inaccurate balances documented and tested.
4. Use an existing approved scheduler/worker mechanism with leases, bounded attempts, retry backoff and a terminal failure state. Record attempt status and errors independently from the cashier response.
5. Deduplicate by operation, notification kind and recipient. Where the push provider cannot guarantee exactly-once delivery, explicitly handle the send-succeeded/status-write-failed window and use supported recipient-side deduplication. Do not promise that every device will receive a push.
6. Retain operational visibility for pending/failed events and safe retry of the same event. A notification retry must never retry the financial command.

**Done when:** worker crash, concurrent workers, timeout and provider rejection do not lose the durable event or duplicate financial effects; successful notices contain the established receipt information and reconciled balance; slow delivery does not extend payment confirmation time.

## R6 — summary reader redesign excluded

**Superseded by the user's instruction:** preserve how the fee component fetches and displays fees. Do not implement the previously proposed stored-summary reader switch, backfill, or reader feature flag. Improve repeated work and freshness within the existing fee data and calculation contract instead.

R6 is excluded, not a completed implementation. R7 acceptance applies to the retained R1–R5 improvements without depending on a summary migration.

## R7 — verify the experience and measure the release

1. Run actual Firestore emulator/rules integration tests with existing rules and controlled data; retain the fast unit and contract suite. Exercise browser requests through the real application path rather than mocks alone.
2. Verify all payment types, current/ended terms, discounts, holidays, remote reversals, historical class changes, two tabs/devices, lost responses, reload recovery, offline reads and reconnect. Never display an offline unconfirmed write as a completed payment.
3. Compare individual/family/class values, receipt/PDF fields and mobile/desktop screenshots with R1. Include parent-view access and the existing sign-in/dashboard transition. Data loading must not become a new condition for completing the visual sign-in handoff.
4. Measure payment feedback/confirmation and cold/warm navigation p50/p95, returned documents, subscription counts, repeated reads, download size and table responsiveness under comparable conditions. Use backend usage evidence for billing claims; client query counts alone are not billed reads.
5. Apply further startup/table/image/PDF-loading changes only where the measurements show a material bottleneck. Preserve access to every existing row and action if pagination or virtualization is introduced. Defer a worker or bundle-layout change unless the measured problem justifies it.
6. Complete the affected-path type/build checks and resolve remaining release-blocking repository errors without suppressing them. If a full build still fails, report that clearly and leave the release gate incomplete.
7. Prepare the exact deployable change set, migration status and rollback instructions. Use gradual reader switches where available; confirm production behavior after an explicitly authorized release. No production deployment or historical backfill is authorized merely by creating this plan.

**Done when:** browser/data parity and integration tests pass, authentication remains unchanged, the build/release gate is satisfied and measured results show where performance improved. Do not claim “instant recording” or a percentage reduction without evidence.

## Rollback and progress reporting

- Keep new financial records additive and preserve operation IDs through rollback. Never fall back to a legacy writer that bypasses duplicate protection for an operation that may already have committed.
- Roll summary readers back to the canonical ledger calculator. Pause a failing notification worker while retaining pending events for recovery.
- Reverse only the intended code changes. Do not delete payments, signatures, operation records or migration evidence to make a rollback appear clean.
- After each phase, report: implemented paths, checks actually run, unchanged-behavior evidence, measured read/timing results where available, unresolved issues and exact remaining phases. Distinguish code complete, test complete and deployed.

The recommended first implementation package is R1 followed by R2. Complete the remaining phases in sequence, with each acceptance check satisfied before its dependent reader or workflow is enabled.
