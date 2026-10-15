# History dates and filters

History cards now sit under chronological school-date dividers. Each dated
divider and the Jump to date control opens a calendar. Selecting a date retrieves
that school's day and scrolls to its heading. Pending timestamps stay separately
labelled. The four aggregate summary cards have been removed.

Module, category, action and text filters remain. More filters contains pupil,
user, class, user-role and date-range controls. Pupil IDs distinguish identities;
names and classes label their choices. Recorded class metadata takes priority;
legacy records without it use the pupil's current class. All original entry
content and expandable pupil/day stacks remain available.

The default remains the existing live latest-300 query. Local filters and simply
opening a calendar do not read past history. Selecting a day or applying dates
runs an explicit timestamp range query in school time (Africa/Nairobi), in pages
of 200 visible records plus one continuation check. Load more requests the next
page using the last visible Firestore document. Returning to Latest 300 reuses
the existing live view. Historical reads do not create extra listeners.

Saved/offline historical results are labelled as such. Failed reads retain the
current entries. Cancelled or superseded requests cannot replace the current
view. Date range validation rejects reversed ranges and invalid calendar dates
before any Firestore query. The calendar component loads on demand.

Validation includes date-boundary and pagination tests, plus an actual-page
browser fixture with synthetic records for desktop and 320px mobile in both
themes. It checks all filters, preserved full entries/routes, date sections,
calendar jumps, pagination, offline labels, failed reads and late responses.
No school records are modified by these tests.

Local result: 11 tests passed, all four browser viewport/theme combinations
passed, the focused TypeScript check had no diagnostics, and the production
build generated all 109 pages. The Pupils startup bundle check also passed.
The build skips full-project type/lint checks; the repository's pre-existing
type errors are outside this change. This batch has not been pushed or deployed.
