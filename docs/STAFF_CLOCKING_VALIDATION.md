# Staff Clocking local validation — 24 October 2026

All work and fixtures stayed local. No application deployment, Firebase deployment, live staff-data mutation, push notification, Git commit or Git push was performed.

## Results

| Check | Result | Scope |
|---|---|---|
| Schedule and permission contracts | 6 passed | Scope precedence, closure rules, grace boundaries and explicit management permissions. |
| Server workflow tests | 19 passed | Actual Admin Firestore transactions against a demo-project emulator; concurrent scan retries, missing configuration, expired-operation recovery, revoked accounts/sessions, duplicate guard, clock-out, saved schedule, enrolment/session revision, review, report completeness, CSV safety and paused/idempotent finalization. |
| Clocking collection rules | Passed | Existing records were seeded, then all nine collections were tested for get/list/create/update/delete plus nested note denial across anonymous, Admin, Staff and Parent clients. |
| Browser camera/display tests | 4 passed | Real React components and HTTP hooks, mocked login/API and synthetic video in Chromium; rotation/revocation, one scan submission, track cleanup, late permission cancellation and actual QR decoding through the fallback. |
| Focused TypeScript | Passed | `tsconfig.staff-clocking-check.json` includes the module and its imported dependencies while excluding generated release output. |
| Full repository TypeScript | Failed outside clocking | The root config includes old `output/exam-ui-release/exams.merged.tsx` files containing merge-conflict markers. Those generated files were preserved. |
| Full Firestore rules suite | 20 passed, 1 failed | Existing `parents can read only their own compact dashboard revision` fails with permission denied. The parent access rule was not loosened as part of clocking work. |
| Android build and physical camera | Not run | No configured Android SDK or connected device was available in this session. Synthetic browser media is not physical-camera or WebView permission evidence. |

## Fixes made during validation

- Corrected module type errors and two imported type/permission issues exposed by the focused check.
- Preserved a completed day's status when approving an exemption, and kept raw arrival facts when applying corrections.
- Rejected malformed dates, invalid review decisions and corrections with reversed times.
- Added a short duplicate guard, transaction-time account checks, operation-payload matching and committed-operation recovery after QR expiry.
- Preserved a day's saved schedule for clock-out when a recurring rule changes or disappears.
- Read matching report ranges before pagination, preserving screen/export/summary parity instead of silently dropping older rows; ranges exceeding 5,000 rows return an explicit range error.
- Escaped CSV cells and neutralized spreadsheet formulas.
- Made finalization transactional and idempotent, skipped completed/exempted records, and prohibited finalizing an unfinished work date.
- Added display-session revocation, hidden expired QR codes and stale-response guards.
- Released camera tracks on cancellation/backgrounding and added a lazy QR-only fallback decoder for browsers without `BarcodeDetector`.
- Updated Android source to cancel pending grants on navigation/destruction and request the runtime camera permission for the existing full-size native-photo action. This preserves its permission path after declaring CAMERA for WebView scanning; the source change still needs Android build/device verification.
- Scoped clocking query caches by identity/link/permission and rejected late HTTP responses after an identity switch.

## Repeatable commands

```text
npm run test:staff-clocking
npm run test:staff-clocking:types
npm run test:staff-clocking:server
npm run test:staff-clocking:browser
```

The emulator requires Java 21 or newer. This run used a temporary JRE under the system temporary directory; it did not replace the system Java installation. Server tests refuse to run without `FIRESTORE_EMULATOR_HOST` and use demo projects only. The browser command needs Playwright; `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_EXECUTABLE_PATH` can point to an existing local runtime and Chromium binary. The harness never uses production credentials or endpoints. Output under `output/staff-clocking-validation` is generated QA material, not release source.

## Remaining evidence and implementation limits

- Run signed-in full-application browser testing and physical Android camera permission/denial/navigation/backgrounding scenarios before enabling a pilot.
- Verify production indexes, QR signing configuration, scheduler authentication and calendar integration in a deliberately authorized release. Local configuration does not prove deployed behavior.
- The current finalizer handles existing open days. Expected-staff roster creation, automatic absence classification and missed-day catch-up remain unimplemented; no attendance policy was invented.
- Group labels currently select schedules; versioned attendance-group membership and group-limited manager visibility are not implemented.
- Date-range summaries and CSV exist; dedicated weekly/monthly/term aggregates are not implemented.
- Decision notices are a clocking inbox, not a durable push-delivery outbox. Push retries and notification-settings integration remain unimplemented.
- The full cache-first revision/bundle repository in the original plan is not implemented by the current in-memory React Query cache. Calendar/staff mutation authority and the complete audit/revocation workflow still need integration work.

These limits supersede earlier statements that only testing or a school policy remained. Passing the listed tests establishes the tested flows, not completion of every item in the original blueprint.
