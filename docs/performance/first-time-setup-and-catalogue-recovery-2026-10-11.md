# First-time entry, page readiness and catalogue recovery

Local follow-up to `cache-first-startup-2026-10-11.md` on `codex/cache-first-responsive-startup`. No push or deployment is authorized for this work.

## 1. First-time entry

The welcome flow now finishes after the current Firebase identity and application access are verified and the user finishes or skips preferences. It does not wait for the opening page, pupils, payments or every offline dataset to download. Appearance, device colour, privacy and enrollment choices remain available; enrollment operations must finish or be cancelled before entry.

The completion marker means entry and preferences are complete. It does not certify that offline preparation is complete. Returning installations retain their existing completion markers and the previously implemented eligible saved-data path. A brand-new installation has no verified saved records to display, so each page loads its own necessary records after sign-in.

A collapsible background-download status shows unfinished work without blocking navigation or clicks. It retries failed tasks through their existing owners, with bounded automatic retries and reconnect recovery. Its text describes records already saved on the device rather than promising full offline coverage.

## 2. Independent page readiness

The pupil list can display loaded pupils while school settings and class controls finish loading. Failed initial pupil loading has an error state rather than a false empty list; the dashboard and pupil detail also distinguish missing data from a failed request. Loaded records remain visible through temporary refresh failures.

Requirement and uniform management show local loading, error/retry and saved-data notices. Attendance dashboard, record, view, excluded-days management and parent attendance consumers distinguish an unavailable calendar from an authoritative empty calendar. Unavailable excluded days are not silently treated as ordinary school days.

These are shared web components used by browsers, the PWA and the native Android application's web workspace. This does not establish real-device performance or change the standalone Android offline viewer's contract.

## 3. Shared catalogue restoration and refresh

Requirements, uniforms and excluded school days now have one account/access-scoped query owner per catalogue. Filtered views derive from that owner rather than downloading the same catalogue separately. Protected server reads still require the current signed Firebase identity.

Complete IndexedDB snapshots can display while identity restoration proceeds, subject to the existing local seven-day viewing receipt and matching account, school, role, family and permission scope. Missing or incomplete snapshots remain unknown; a complete empty snapshot is a valid result. The receipt records previous local verification and is not a signed server credential.

The server refresh runs on opening a catalogue and reconnecting. Inactive warmup owners also recover on reconnection. A temporary network failure retains displayed records and identifies the refresh failure. An authoritative empty result replaces old records. Permission rejection clears the affected catalogue and makes its saved snapshot ineligible for later reuse. Late local reads, cancelled requests and account changes cannot overwrite current authoritative data.

Uniform and requirement server-only reads are explicit options for catalogue owners. Existing direct requirement reads used in financial calculations retain their prior behavior. This change does not certify cached financial amounts or balances as current.

## Validation

- 62 focused tests passed, including seven new catalogue tests using actual query-cache behavior and mocked Firebase/storage boundaries.
- Five browser fixture suites passed: welcome, setup, workspace recovery, cache-first pupil viewing and shared catalogues. The catalogue suite used real IndexedDB and checked saved data before identity readiness, confirmed empty results, filtered-view request deduplication, reconnect, account isolation and denied access.
- Welcome checks confirmed pending downloads permit workspace clicks while preserving account separation and privacy choices. The background status was visually inspected at mobile width; the welcome review was inspected in the dark theme.
- Auth-session, dashboard-cache, parent-preload and uniform-collection contract checks passed.
- Changed-source TypeScript comparison: baseline 126 diagnostics, current 114, introduced zero. Existing project errors remain; this is not a clean full-project typecheck.
- The final production build passed and generated all 109 static pages. The build configuration skips its full type/lint checks; the separate changed-source comparison above records the TypeScript validation performed.
- `git diff --check` passed. Build-generated service-worker version and unrelated generated engine/worker changes were restored after validation.

Production, a signed production session and a real Android device have not been tested or modified by this local follow-up. Generated QA fixtures and logs under `output/` are evidence files and should not be included indiscriminately in a release.
