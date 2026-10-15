# Follow-up to the October 12 operational audit

The user authorized the combined implementation and push on 2026-10-12. The audit contains released version 69c84063 and older/unknown observations; it cannot establish performance of this follow-up.

## Changes

- Retain the pending mobile route preparation, truthful page-content loading card, navigation timings and Android export deferral in this combined release.
- Project pupil records in batches of at most 32 or roughly six milliseconds, yielding to the browser between batches. An in-progress export pauses at checkpoints during tracked navigation or a hidden document. Account change, privacy lock and effect disposal abort it; cancelled work cannot publish a later snapshot.
- Prepare at most two photo decoders concurrently. Decode inline images through local data URLs and encode thumbnails asynchronously with canvas.toBlob. Keep original pupil photos untouched, preserve remote image links without downloading them, and omit damaged thumbnails without discarding the record.
- Reuse unchanged image promises without hashing them again within the bounded current-account source cache. Persist at most 600 small JPEG thumbnails under a project/account-specific IndexedDB key. A restart hashes the source to validate reuse but avoids decoding/encoding matching thumbnails. This optimization is not an authorization source: export still needs its existing signed Android session and grants. Raw retained source text is limited to 12 million characters; thumbnail values remain at most 8192 characters and snapshot inline photos remain bounded to 5 MiB. Silent thumbnail-cache writes do not trigger another native export.
- Measure Android cache reading, record projection, total photo preparation, source hashing, decoding, encoding and derived-thumbnail cache reads/writes. These async elapsed measurements can include cooperative waits; long-task and input-delay observations remain the evidence of UI-thread blocking.
- Keep the existing first-data-visible wall measurement for compatibility. Add foreground-to-visible and background-wait durations for each page visit. Visibility is tracked from mount, including before data becomes ready. Active durations retain real visit observation boundaries rather than pretending the excluded pauses happened after the visit.
- Add broad pupil-cache reasons for missing/expired receipts, changed profile/permission scope, missing/incomplete snapshots and publication before signed identity restoration. No account IDs, records or receipt values enter these timings. Record the initial Firebase listener restoration separately from token verification. Existing local receipt expiry, protected server reads, revocation and edit authorization are unchanged.

## Verification

Focused tests cover clock transitions, navigation pause/resume, abort, receipt boundaries, startup, audit exports and Android contracts. Browser fixtures use actual IndexedDB, thumbnail preparation, the scheduler and page timing; they verify warm hashing reuse, restart thumbnail reuse, account isolation, silent writes, original-photo preservation and a hidden interval excluded from foreground time. Mobile-navigation and cache-first fixtures check the pending menu/card work and saved viewing before Firebase with protected downloads still gated. First-setup/welcome fixtures exercise access checks, preferences and pending background downloads.

The combined focused run passed 45 tests. Seven browser fixtures passed (Android preparation, mobile navigation, cache-first viewing, operational measurements, first setup, welcome and recovery), along with auth-session and smart-back contracts. The changed-source TypeScript comparison against release HEAD has zero baseline/current/introduced diagnostics. This is not a whole-project clean typecheck. The final production build passed, generating 109 static pages; existing build settings skip full-project lint/type validation. Logs and screenshots are local QA artifacts outside the commit.

## Real-device boundary and repeatable check

ADB was available but reported no connected devices. Browser fixtures simulate the native bridge/router and cannot establish actual Android speed. No physical-phone improvement or first-install download speed is claimed.

After deployment, confirm the running commit on the same phone. Compare a genuinely fresh app setup with a repeat launch, then visit pupils, fees, SchoolPay and timetable from the drawer. Record tap-to-route-commit, page foreground-to-visible, long tasks and export substeps. Hide/resume once to confirm background-wait increases without becoming foreground loading time. Compare with PWA/browser on that phone, and separately with the desktop. Inspect photo preparation versus cache read before attributing remaining snapshot time to either. An old 4.3-second identity wait cannot establish whether a receipt or snapshot was present; the new broad reasons provide that missing evidence.
