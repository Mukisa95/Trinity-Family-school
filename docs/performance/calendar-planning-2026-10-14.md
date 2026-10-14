# School calendar planning: first implementation batch

The first priorities are the layout and interactive details panel. This batch
also implements the adjacent calendar interactions against existing event data;
it does not turn on a new messaging or background scheduling service.

## Implemented

- Calendar-first layout, collapsible filters, and a collapsible planning column.
  Narrow screens use a filter drawer and put planning below the calendar.
- Compact period navigation and Month, Week, Day, Agenda and Term controls.
- Soft category colours, preserved custom hues, a today indicator, selected date
  outline, visible draft/cancelled states, and three-event daily overflow.
- Inclusive multi-day date handling, including moving, resizing and editing.
- Event details, attachments, participants, reminder settings and recorded
  delivery statuses. Existing attendance and source exam routes remain available.
- Edit, duplicate, cancel, publish and delete through the existing mutations.
  Generated holidays and legacy exam projections cannot be edited as ordinary
  event documents; exams link to their real source records.
- Date selection, double-click creation, and confirmation before moving/resizing.
- Cumulative type/class/term/search/date filters, device-local personal filter
  views scoped to the account, and a personal calendar using existing teaching
  assignments, invitations, organisers and school-wide staff activities.
- An upcoming panel with today's activities, the next week, drafts, approval
  metadata and possible resource conflicts. Staff default to My calendar;
  administrators default to School calendar.
- Venue, exam-class and shared participant conflict checks against the loaded
  school schedule. Only administrators can explicitly proceed despite a conflict.
- Save failures retain the form; saves wait for mutations before closing. Updates
  exclude immutable creation metadata. Successful individual creations are kept
  out of an unchanged multi-date retry.

## Data and validation boundaries

`useEvents` remains the existing identity/revision-scoped cache owner. The page
applies filters after combining canonical events, legacy exam projections and
public holidays. Filtering does not add Firestore reads. Cached records remain
available when a refresh fails; the retry action does not reload the app.

Conflict checks are a planning aid over currently loaded records, not a server
resource reservation or transactional conflict lock. Calendar personalisation is
a view of authorised cached data, not an additional authorisation grant.

Automated recurring-instance generation, background reminder delivery, outbound
parent/staff announcements, a full approval workflow and automatic Duty & Service
or Timetable projections remain later phases. Existing reminder configurations
and recorded delivery outcomes are displayed without implying that a new worker
was installed or that a notice was sent.

## Verification

- `node --import tsx --test tests/calendar-planning.test.ts tests/android-events.test.ts`
- `node scripts/test-calendar-planning-browser.cjs`
- `node scripts/test-events-recovery-browser.cjs`
- `node scripts/check-dashboard-cache-contract.js`

The planning browser harness renders the actual FullCalendar, event editor and
shared header with synthetic service data. It covers layout at 1680, 1280, 768
and 390 pixels in light/dark themes; source links; combined filters; saved views;
personal scope; failed saves; all-day ranges; date creation; overflow; mutation
actions; offline/read-only behavior; and reschedule callbacks and confirmation.
These checks do not write to the school database or send communications.

Repository-wide type checking still reports pre-existing unrelated errors;
focused type checks and the calendar route compilation are checked separately.
