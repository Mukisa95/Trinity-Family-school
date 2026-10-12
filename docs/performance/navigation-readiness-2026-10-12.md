# Pupils cache rendering and navigation correction

The connected Pixel 7 showed the Pupils route skeleton for more than five minutes on web build b171456d, although the canonical pupil cache was populated within three seconds. Other pupil consumers could use that cache. The subsequent af1e2a0 release kept navigation pending whenever any shared page skeleton was visible and introduced an automatic Android route reload. The phone still failed to show the list after normal retry, and the user reported slower browser navigation too. The underlying WebView request or call stack remains unobserved; the production app does not expose remote debugging.

## Current correction

- URL commit releases the navigation card. Page data loaders cannot start a new navigation wait. Rendered records are never made inert, and automatic full-document recovery is no longer invoked.
- The Pupils route and its loading boundary render a lightweight list from the existing `usePupils()` hook. This is an observer of the same canonical `pupilsKeys.lists()` query used by search, dashboard and other page consumers. No new pupil fetch, listener, persisted cache, or Firestore read owner was introduced.
- The large existing management screen is downloaded separately after the cached list mounts. Management-code download failure leaves the cached list usable and offers a retry for the tools, without reloading records or signing out. Search/class filters are preserved in the URL for handoff to the full management screen.
- The immediate list preserves page/action/detail permissions and the canonical hydration rules. Signed identity is not a prerequisite for already-authorized saved data; denied access and account scrubbing still hide records. A verified empty snapshot is a real empty state, not a loader.
- Class changes in the management screen filter cached data without forced transition skeletons. Rows begin with one batch of fifty and subsequent batches appear on scrolling instead of automatically mounting every pupil and photo during idle startup. Initial row entrance staggering was removed.
- Export, PDF-viewer, identifier, pay-code and sibling dialogs are deferred. Closed export/viewer/code dialogs are not mounted.
- Explicit route markers independently pause Android snapshot preparation while the management screen prepares. This pause does not control navigation UI or disable the cached list. Ordinary field loaders and browser/PWA mounts do not acquire that pause.
- Audit event priorities, bounded severity totals, navigation-start measurement, page data/paint measurements and the once-per-document pupil paint marker remain. Reference catalogues retain their change-driven policies. Financial freshness rules are unchanged.

## Validation

- 48 focused tests passed; one existing source-availability case was skipped.
- Shared-pupil-cache, mobile-navigation/native-preparation and pupil-theme browser fixtures passed, along with master-data ownership and smart-back contracts.
- The final production build generated all 109 static pages. Pupils initial route JavaScript fell from approximately 1 MB to 323 kB; management code is not in the initial route HTML script references. These bundle numbers are not real-phone timings.
- Whole-project TypeScript still reports 380 existing diagnostics. Comparison by file/error code, accounting for the moved management module, found no added diagnostic counts and no errors in the new route/cache component or modified navigation sources.
- Compiled export configuration and print counts use the complete filtered snapshot, while displayed rows remain batched. Generated worker/engine/service-worker artifacts were restored and excluded.

The shared-pipeline browser fixture uses the real Pupils route and real canonical pupil/search/class observers, while holding the management-code boundary and rejecting all database calls. It checks shared cache updates across consumers, zero database reads, usable saved records before signed-identity restoration, immediate search/class filtering, detail links, paging, an authorized empty snapshot, denial/account-transition protection, action grants and management-chunk failure recovery. It uses synthetic records only.

The actual drawer/navigation/native-provider fixture checks delayed route progress below the header/sidebar, interactive existing records, release of the card on URL commit, independent native preparation deferral, query-only changes and field loaders that neither restart progress nor invoke automatic recovery. Router/bridge boundaries are simulated.

Local browser fixtures and a successful production build are separate from production deployment and real-phone verification. These correction changes have not yet been published or verified on the phone. Private device captures and generated QA files remain excluded from Git publication.
