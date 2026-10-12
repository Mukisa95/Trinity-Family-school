# Mobile menu navigation and page-content loading

Follow-up to release `69c84063`. The user identified opening a page from the Android side menu as the delayed interaction. On 2026-10-12 the user explicitly authorized implementing the remaining audit priorities and pushing all pending chat changes together.

## Findings and changes

Desktop menu links remain mounted and eligible for normal Next.js prefetch. Mobile drawer links are absent while the drawer is closed. This creates a concrete opportunity to prepare common routes earlier, but does not prove the cause or duration of a real Android freeze.

- Mobile navigation prepares up to four common permitted route shells from dashboard, pupils, timetable, fee collection and SchoolPay Feed, excluding the current route. Preparation begins during idle opportunities after signed identity is ready, is spaced across tasks, and stops issuing requests while offline, hidden or navigating. Permission/account scope changes reset the local warmup history. Focus and touch intent can prepare other permitted links; prefetch never navigates or mounts their data owners.
- Only the page-content region owns the navigation card. The global header, desktop sidebar and mobile drawer remain outside that region. A low stacking layer and sticky content positioning keep the card below the app header and behind the drawer. Old page actions are inert while navigating; the header/menu remain usable, and the status announcement is outside the busy content subtree.
- The card waits 150 ms before appearing so quick switches do not flash it. It retains progress beyond the previous three-second cutoff, changes its message after four seconds and preserves a thirty-second safety timeout. Messages describe page preparation without presenting unobserved operations as completed checks.
- Navigation completes on pathname or full URL/query changes. Choosing the current page clears an old pending indicator. Disabled and modified/new-tab menu clicks do not begin an application navigation wait. The existing smart-back URL/history owner remains intact.
- Android snapshot preparation pauses during tracked menu/back navigation, then combines and resumes pending work after the switch settles. The additional audit-priority work adds cooperative pauses between record/photo batches even during an export; an individual synchronous operation still cannot be interrupted. No native APK or atomic offline snapshot contract was changed.
- `workspace:navigation:route-commit` and `workspace:navigation:timeout` join the existing staged audit timings. They record elapsed time and a sanitized route rather than menu contents or record values.

This reduces avoidable cold route requests and competition from new Android snapshot work. It does not promise instant rendering on every phone, bypass identity/access checks, or certify cached financial amounts as fresh. Desktop/PWA navigation keeps its existing route ownership and prefetch behavior; the loading-card placement is shared.

A fresh audit pasted during this work includes native Android observations from `69c84063`: input delay up to 1,310 ms, long tasks up to 1,659 ms, snapshot export up to 36,252 ms elapsed and JSON serialization up to 48 ms. Export includes asynchronous work, so its duration is not a continuous freeze measurement; the report alone does not attribute a particular input delay to export. These observations support separating route preparation, export and serialisation rather than blaming JSON conversion for the entire delay. The raw report and a copy of the pasted note are preserved locally under `output/mobile-navigation-qa/`; the original implementation note was restored after verifying the report was its only insertion. Raw observations are excluded from the release.

## Validation

- Nine focused startup, access-control/navigation and Android offline-contract tests passed. The smart-back navigation contract passed.
- Changed-source TypeScript comparison found baseline zero, current zero and zero introduced diagnostics. This covers the changed sources, not a clean typecheck of the entire existing project.
- A browser fixture used the actual mobile drawer, navigation context, content card, prefetch hook and Android synchronization provider, with simulated router, native bridge and data/identity boundaries. It kept progress through a five-second wait, reopened the drawer, clicked the header, checked old-page inertness, verified prefetch before a tap and no requests offline/unverified, completed a same-path query change, and deferred snapshot export until navigation settled.
- It checked that prepared quick switches do not flash the card. These simulated route delays validate the mechanism; their timings are not real-device speed measurements.
- Visual review covered 390 px light mode, 320 px dark mode, the drawer above the card, and desktop width. The card contains its spinner/text, stays below the header and beside the desktop sidebar, is hidden in print and disables its animations for reduced motion.
- The final production build passed and generated all 109 static pages. `git diff --check` passed. Build-generated worker/engine/version changes were restored. Local QA output under `output/mobile-navigation-qa/` is excluded from publication.

Actual signed production navigation and an Android-device before/after trace remain unverified. All pending work from this chat now consists of these changes plus the previously updated `AGENTS.md` release-choice rule; prior application batches were already pushed together in `69c84063`.
