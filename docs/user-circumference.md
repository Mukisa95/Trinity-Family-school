# User Circumference

Circumference limits pupil access by the intersection of class, section and gender. Page/action permissions continue to determine which operations an account can perform.

| Account example | Classes | Section | Gender |
| --- | --- | --- | --- |
| Primary bursar | Select the Primary classes | All | All |
| P4 teacher | P4 | All | All |
| Girls boarding matron | All | Boarding | Female |

The user account forms and linked staff account dialog provide these controls. Existing staff accounts without a Circumference remain unrestricted. Admin accounts retain school access; parent accounts retain their existing explicit family access. An empty axis grants no pupil access. A restricted account manager cannot grant a scope outside their own.

## Enforcement

- Canonical `system_users` profiles determine server and Firestore access, including scope changes during an active session.
- Pupil live queries include the selected class/section/gender before fetching. Joined ledgers and mixed result, release, attendance and dormitory documents use an authenticated server boundary. Mixed documents are projected before the browser receives them.
- Direct pupil IDs, financial writes, class/exam selections, stream setup and relevant notifications enforce the same boundary. Pupil changes must satisfy both their old and new scope.
- Scope-specific persistent/in-memory cache identities prevent reuse of a broader account cache. Android saved sessions with a different scope are rejected and cleared on reconnection.
- Bulk scoped attendance uses small batches to fit Firestore rule lookup limits. Scoped daily summary updates preserve hidden pupils and other classes.
- School/class-wide administration that would change hidden pupils requires whole-class access. Mixed exam result writes by section/gender-restricted users are denied by the SDK rules; the existing class-wide teacher result workflow remains available. Unsupported private collections fail closed instead of falling back to a school-wide query.

## Release requirements

Release the app/API, `firestore.rules`, and `firestore.indexes.json` together for each school's Firebase project. A Vercel Git deployment alone does not deploy Firebase rules or build Firestore indexes. Allow the new indexes to finish building before enabling scopes on live accounts.

Local verification includes scope policy and API query tests, Firestore emulator allow/deny tests, mixed attendance preservation, payment transaction/retry regressions, Android scope contracts, and the actual account editor at phone/desktop sizes in both themes. Browser fixtures use a synthetic class catalogue. No live account or production data was changed. The repository has pre-existing TypeScript errors; the comparison against HEAD checks for new diagnostics separately.

Run `npm run test:circumference` for the focused unit/SDK/native contracts and `npm run test:firestore-rules` for the existing and new emulator tests (Java is required).
