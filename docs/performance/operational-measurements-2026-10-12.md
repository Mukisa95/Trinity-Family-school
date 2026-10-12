# Operational measurement improvements

Item 4 of the agreed follow-up plan, combined with the pending cache-first startup and first-time-entry changes. These measurements diagnose elapsed work; they do not establish the cause of a real device freeze without a reproduction.

## What the collector now records

- Deployed application SHA, browser/PWA/native-Android web-workspace context, broad browser family/major version, OS family and whether the welcome marker was incomplete at session start. No raw user agent or device identifier is saved.
- Observed first/last times and the separate batch-save time in both Markdown exports and audit cards. Performance observations use the browser timeline's time origin and entry boundaries, including when observer delivery is delayed.
- Original version, context, session and observation times when replaying saved batches. Failed replay retains the original disk batch. Older batches lacking context remain explicitly unknown. Reattaching observers or restoring an already populated buffer does not count the same stage entry again.
- Broad mutation keys for pupil, fee-structure, payment, requirement, uniform, collection-tracking and excluded-day save operations. Keys contain operation names rather than record IDs or submitted values. Other mutation owners may still use the legacy unnamed fallback.
- A dedicated export table includes informational stage timings as well as warnings, so fast stages remain visible for comparison. Routine query signals can be combined to preserve space for stage and interaction measurements within the existing forty-event batch limit.

## Separate measurements

| Measurement | Meaning |
|---|---|
| `identity-wait` | Waiting for initial Firebase authentication state restoration before a protected read; not the complete token/access check |
| `identity:token-verification` | Existing token-result verification request; this adds no authentication or profile read |
| `startup:workspace-visible` | Time from document navigation to workspace entry after its startup/welcome overlay closes |
| `page:<page>:data-ready` | Page mount/visit to a React commit with the relevant records ready |
| `page:<page>:first-data-visible` | Page mount/visit to a frame/task opportunity with those records, visible document and no startup/welcome overlay |
| `android:snapshot-export` | Gathering, projecting and preparing the existing atomic snapshot, including photos |
| `android:snapshot-revision` | Comparing the prepared snapshot's source revisions |
| `android:snapshot-serialize` | Converting the bridge message to JSON |
| `android:snapshot-post` | Synchronous native bridge posting |
| `android:snapshot-save` | Total save request to native acknowledgement, including serialisation, posting, bridge and storage wait |
| `android:app-shell-preparation` | Existing app-shell preparation, including page/asset downloads |
| `payment:create-request`, `schoolpay:reconcile-request` | Request start to response headers; parsing, rendering and payment-authority decisions remain unchanged |
| `interaction-to-paint`, `interaction-input-delay` | Slower click/key Event Timing and its input-queue delay when supported |
| `click-handler-to-paint-opportunity` | Unsupported-browser fallback; begins when the click handler runs and cannot measure input-queue delay |

Page measurements cover dashboard pupil/staff statistics independently, pupils, pupil details, fee collection and SchoolPay Feed. Confirmed empty query results are eligible; unknown records or loading/error states are not recorded as ready. Switching the pupil/visit restarts the page measurement without exporting the private visit key.

First-data-visible is an approximation at a paint opportunity, not screenshot confirmation, complete rendering or financial freshness. The pupil observer's earlier first-paint metric does not certify page visibility; use the new page-specific timings for that question. The native standalone offline viewer is outside this web collector. Event Timing thresholds and unsupported APIs mean an absent signal is not proof of instant interaction. Background/Doze time, retries and network waits can contribute to elapsed measurements.

## Reproducing the remaining freeze

1. Record the deployed SHA from the exported audit and use the same device, account, connection and four routes: startup, pupils/pupil details, fee collection and SchoolPay Feed.
2. Compare a fresh browser profile/first-time setup with repeat opening after records were saved. Do not clear or modify school records to create a test.
3. Compare browser, installed PWA and native Android web workspace separately. Record whether the app was resumed or restarted and whether it was offline.
4. Capture a browser/WebView performance trace during the actual delay, alongside the audit export. Compare identity wait, data readiness, first-data-visible, long tasks, input delay and Android preparation intervals.
5. Decide on further Android snapshot restructuring only after the trace shows where expensive processing overlaps delayed input or paint.

Real-device, signed production and same-device first/repeat startup experiments remain outstanding. The browser fixture deliberately introduces slow work to validate collection and attribution; its timings are not claimed as production speed improvements.

## Validation and release

The local focused suite passed 69 tests, including seven new measurement tests. The measurement browser fixture passed with real User Timing, IndexedDB-independent audit persistence, query/mutation caches and click timing; its native bridge and Firestore audit writes are simulated. It verified original-version recovery, failed replay retention, welcome-overlay paint gating, named mutations, native save stages, Event Timing fallback and bounded aggregation. Existing auth/session, dashboard-cache, parent-preload, uniform-collection and SchoolPay-inbox contract checks passed.

The final production build passed and generated all 109 static pages. Existing cache-first pupil and welcome browser checks passed again; setup, workspace recovery and catalogue browser checks also passed in the preceding batch. The changed-source TypeScript comparison found baseline 126 diagnostics, current 114, and zero introduced diagnostics; full-project type errors remain and the build configuration skips full type/lint checks. Ten additional reference-refresh/mixed-payment contract checks passed after updating fixtures for the shared catalogue owner and measured request wrapper.

The broader payment-optimization suite retains eleven failures in untouched banking tests (an unsupported name-formatter dependency in their mocks) and the existing family-payment markup parity fixture. Running the same tests with source read from the original Git HEAD reproduced those eleven failures. They do not originate in this patch, but that broader suite is not entirely green.

The release is explicitly authorized by the user's request to make the measurement improvements and push the combined pending changes. Git publication and Vercel deployment results are reported separately in the conversation. Generated `output/` files are local evidence and are excluded from the commit.
