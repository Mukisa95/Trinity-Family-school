# Pupils page, stream drafts and change-driven calendars

## Behaviour

- The Pupils route renders its normal management page directly. A second populated list no longer flashes before the class selector. The cold route boundary uses the same header and select-class notice, with no substitute records table. It preserves class/search choices in the URL.
- `usePupils()` still observes the canonical `['pupils', 'list']` cache. This change introduces no new pupil read, listener or saved-data pipeline. Cached records remain usable before Firebase signed identity is ready, subject to the existing account and access checks.
- Closed management dialogs remain unmounted. The photo crop editor and PDF renderer are now loaded only when needed. The shared PDF helper imports its renderer inside the generation action rather than on a page mount. Row batching, direct cached filtering and complete export datasets remain in place.
- Stream setup initializes the selected stream IDs and saved assignments atomically. Its reconciliation effect cannot erase saved assignments using the first render's empty stream IDs. Explicit user edits survive later pupil-cache updates; untouched pupils follow their saved assignments. Removed/inactive pupils cannot inflate draft totals.
- Current stream labels resolve by stable stream ID from the class definition. Historical exam labels already present in snapshots are preserved; missing labels cannot be borrowed from a pupil's different current stream.
- A healthy saved school-day calendar no longer displays a recovery warning. Actual refreshes and failures still have a notice and retry state. The Events page retains its calendar and controls after a refresh failure when a saved dataset exists, and retries the collection rather than reloading the app.
- Events keep one account-scoped collection owner shared by all filters. A valid saved revision causes no read on mount, focus, timer or healthy reconnect. Confirmed revision changes and genuinely cold caches fetch; a revision arriving during a read is reconciled afterward. Failures retain saved records and a bounded retry/error state. Storage failure retains the in-memory revision rather than causing repeated reads.

## Investigation boundary

Read-only comparison of the reported school's current P.7 memberships with its original stream-operation record found no persisted membership changes since that operation. The saved grouping differs from the user's expected grouping. No pupil, class or exam record was changed during investigation. A roster correction needs an agreed intended membership list; the editor bug alone does not prove the reported cause.

## Validation

- Focused stream, revision-cache, catalogue and pupil-selector tests.
- Browser fixture using the actual Pupils page, canonical cache observers and stream editor with synthetic pupils; database boundaries reject unexpected reads. It checks first paint, cached filtering, shared updates before signed identity readiness, deferred tools, denial, empty data, cold-route class handover and saved stream drafts.
- Browser fixture using the actual event hook checks zero unchanged-revision reads, shared concurrent consumers, revision changes during reads, bounded failures, reconnect recovery, in-memory persistence recovery and account/parent isolation.
- Browser fixture using the actual Calendar wrapper checks that a refresh error retains saved events and controls; a cold failure has a retry which does not reload the application.
- Browser fixture using the actual PDF helper and job context checks deferred renderer initialization, preservation of the generation input and filename, progress and failure handling. The synthetic renderer boundary avoids real school documents. A post-build contract verifies that photo-editing and PDF-renderer chunks are absent from Pupils startup references.
- Production build and comparison of TypeScript diagnostics against the published source. Browser fixtures simulate service and native boundaries and do not establish real-phone navigation timings.

The final production build generated all 109 pages. Next reports 484 kB initial JavaScript for Pupils; its route manifest references 473.9 KiB of compressed JavaScript. PDF-renderer and photo-crop chunks do not appear in those startup references. These are bundle measurements, not Android navigation timings.

The published source has 380 TypeScript diagnostics. The full comparison identified two additional diagnostics in the historical stream helper and its test. Both were corrected and the final scoped check of those files returned zero diagnostics; all other full-comparison diagnostic messages/counts match the published baseline. The project-wide type check is not clean.

QA output and private investigation files remain in `output/` and are excluded from publication. Changes are local until the user requests a release.
