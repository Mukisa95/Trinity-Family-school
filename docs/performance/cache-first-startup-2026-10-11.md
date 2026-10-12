# Cache-first workspace startup: local implementation

Implemented on `codex/cache-first-responsive-startup`, based on `584870b9e012df1ae8c5f9d3291fd8b1cd8829e6`. No push or deployment was performed. The original checkout and its unrelated changes were preserved.

This document records the first implementation batch. The subsequent first-time-entry, page-readiness and catalogue-recovery changes and their validation are recorded in [the follow-up notes](first-time-setup-and-catalogue-recovery-2026-10-11.md).

## Resulting behavior

- Eligible saved pupil data is read and published independently of Firebase identity restoration. Dashboard and pupil detail consumers share that snapshot. A small notice identifies saved data until server reconciliation.
- A prior successful verification creates a local, seven-day viewing receipt bound to the account, school, role, family and permissions. Existing installations need one successful verification before using this new path. This receipt is local viewing history, not a cryptographically signed credential or server authorization.
- Signed identity still gates protected downloads and mutations. Account/scope changes and permission rejection remove shared private records. Late local reads cannot overwrite an authoritative server result, including a confirmed empty result.
- Temporary connection failures retain loaded records. Unknown or incomplete empty snapshots stay loading; a complete saved empty snapshot is valid. A pupil absent from the saved snapshot waits for server confirmation before being declared missing.
- Lower-priority warmups run after the initial work and with bounded concurrency. Calendar derivation uses the year rather than a newly allocated Date, and cancelled mounts clear pending scroll timers.
- Android snapshot preparation ignores unrelated query events and compares source revisions rather than serializing all private records for comparison. Relevant changes still use the existing atomic whole-snapshot export; this does not implement per-record native deltas or a worker.
- Next.js uses its normal route splitting. Pupil report PDF engines load on demand without changing report layouts or output contracts.
- Existing audit batching now captures local cache timing, signed identity wait, pupil paint, click responsiveness and shorter long tasks. Timing payloads contain durations rather than pupil data.

## Validation

- 32 focused tests passed, covering startup, selectors, cache changes, access receipts, Android contracts and audit contracts.
- Auth session, dashboard cache, parent preload and PDF workspace contract checks passed. The PDF contract checked 46 launch paths.
- Workspace recovery browser checks passed. Cache-first browser checks used the real preloader and pupil hooks with mocked external boundaries, plus a real IndexedDB snapshot of 1,007 synthetic pupils. Saved viewing and a pupil-selection click completed while Firebase restoration remained unresolved; no protected downloads or listeners started before signed identity.
- Browser checks also covered parent payment subscription startup, account switching, permission rejection, late cache versus server data, temporary connection failure, complete empty snapshots, stable calendar inputs and the saved-data notice. The notice fit a 390px viewport in light/dark themes and was hidden in print.
- The final production build passed and generated all 109 static pages. The built public/login route rendered locally with no browser page errors; a signed production session was not tested.
- Existing full-project TypeScript errors remain. Comparing changed source files with their Git baseline found 97 diagnostics in each and zero introduced diagnostics. This is not a clean full-project typecheck.
- `git diff --check` passed.

## Payload comparison and remaining checks

Initial JavaScript assets referenced by the current production dashboard totaled 8,013,891 decoded bytes. The local production dashboard references 3,409,424 decoded bytes, about 57% less. The local pupil detail references 4,573,949 bytes. These are referenced asset sizes, not measured device speed improvements or guaranteed download bytes.

QA output is under `output/cache-first-workspace-qa/`; these generated fixtures, logs, screenshots and reports should not be swept into a release. No real Android device or signed production user was used for timing. First-use PDF generation while fully offline remains unverified. The current production application is unchanged until an explicitly authorized release.
