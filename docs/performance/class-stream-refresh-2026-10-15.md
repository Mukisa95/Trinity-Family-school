# Class stream names after database edits

The class cache previously reconciled only a cold cache or a changed class
revision. Class writes in the app publish that revision atomically, but direct
database-console edits do not. A persisted class list could therefore keep old
stream definitions indefinitely, including across browser restarts.

The existing class bootstrap now verifies the authoritative list on mount,
on a visible return to the app (at most once per minute), on reconnect, and
every five minutes while visible and online. Focus and visibility events are
coalesced before scheduling work. Ordinary class hooks remain cache-only; the
same owner updates React Query, the shared service snapshot and local storage.
Class selectors also stop retaining the previous account's list as placeholder
data when the signed-in identity changes.
This adds one class collection read per verification; it does not read pupils
or add another Firestore listener. Failed reads preserve the saved list and
use the existing bounded retries. Workspace recovery now also verifies a warm
snapshot whose revision has not changed.

Current stream labels resolve class definitions by stable stream ID, ahead of
copied pupil labels. This fix changes neither assignments nor stream IDs.
Historical exam labels remain their recorded snapshots. Direct edits must be
made to the class's stream definitions to change those current labels.

Validation: `scripts/test-class-cache-refresh-browser.cjs` exercises the real
bootstrap, hooks and persistent cache against a synthetic database boundary.
It covers unchanged-revision renames, warm rendering, shared consumers,
focus/reconnect, failure recovery, periodic verification, revision changes,
cleanup and identity isolation. Existing class stream and draft tests and the
dashboard cache contract are also run. The live P.7 document is not inspected
or modified by this test.

Results: browser regression passed; 21 stream/draft tests passed; dashboard
cache contract and diff whitespace check passed. The full repository typecheck
was stopped after an extended run without diagnostics completing; no claim of
a clean full-repository typecheck is made.
