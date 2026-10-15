# Change-driven school catalogues — October 12, 2026

Follow-up to b171456d, included in the combined release explicitly requested on October 12 together with page-readiness and Android route-recovery changes.

## Policy

Requirements, uniforms and excluded school days reuse a complete saved list on mount, including a confirmed empty list. They do not expire on a five-minute timer, refresh on every page mount, or redownload healthy data merely because connectivity returns. The existing tiny reference revision channel is shared; this adds no separate collection listeners or polling.

A complete scoped saved snapshot now includes its source revision. Matching revisions require no collection read across page navigation, reconnect or application restart. Missing data, an older unversioned snapshot (one-time migration), a newer published revision, explicit query invalidation/manual refresh, and transient-read recovery can perform an authoritative download. A missing receipt never grants saved viewing; existing identity/access boundaries remain.

The preloader and page/filtered hooks share one reconciler per QueryClient, catalogue and permission scope. It restores IndexedDB before deciding whether to fetch, ignores unrelated revision changes, combines simultaneous requests and rechecks when another revision arrives during a download. Catalogue data, status and revision metadata share infinite freshness/retention; normal query garbage collection cannot forget an unobserved counter while retaining the list and cause another unchanged download. Disposing an owner while disk restoration is pending cannot start a later download. Failed refreshes preserve saved records; denied modules discard their reusable copy. First-time devices still fetch their initial list and report real loading/error states.

Every application create/edit/delete/status-toggle commits catalogue content and its reference revision in one Firestore batch. It publishes the existing temporary legacy revision bridge too. Other refreshed application sessions receive the counter update and reconcile that catalogue. Catalogue writes from an older client or direct database/admin scripts must also publish this revision; no server trigger or backend migration was deployed as part of this local task.

## Validation

Focused cache/financial-consumer tests cover stable mounts and reconnects, confirmed empty lists, explicit invalidation, real mutation batching, failed-commit atomicity, changed revisions, in-flight changes, disposal, account/permission isolation and pupil-specific tracking. The browser fixture runs real hooks, the shared revision listener, query owners and IndexedDB with controlled Firebase/service boundaries. It verifies old-format migration once, matching-revision restart without downloads, repeated mounts/reconnect without downloads, one affected catalogue refresh for all filtered consumers, failure recovery and access isolation. Existing cache-first and recovery browser fixtures remain part of verification.

Initial catalogue-only validation passed 55 tests, including an accelerated idle garbage-collection check, and six browser fixtures. The combined navigation/catalogue release passed 72 focused tests and seven browser fixtures, followed by a successful production build generating 109 pages. The repository-wide typecheck reports 380 diagnostics, with none in the edited files; the build retains the repository's existing type/lint skip configuration. Logs, screenshots and generated build-only edits are excluded from publication. These controlled catalogue tests do not establish a real multi-device Firestore session; real-phone navigation follow-up is reported separately.
