# Dark theme corrections — 9 October 2026

The dashboard screenshots exposed gaps in the first theme pass. Custom chart labels and FullCalendar CSS used fixed light colours, the attendance card lacked the dashboard surface marker, and some added dark classes joined the next dynamic class without a separating space. The original generic theme fixture did not render these dashboard widgets.

## Corrections

- Dashboard cards use a midnight navy gradient. Attendance tracks and sphere thumbs are dark; chart values, axes, grid lines, gradient headings and tooltips remain readable. The school background stays subtle and photos retain their original colours.
- Calendar headings, dates, adjacent-month dates, hover states and navigation use appearance tokens. The current day keeps a blue circle with readable white text.
- Term status badges and live timetable outlines use the dark palette. Dynamic class joins were repaired across dashboard, attendance, fees, exams, procurement, parent, settings and timetable controls.
- Week, editor and combined timetable cells use theme colours for active, past, upcoming, empty, highlighted and collision states. Subject hues remain distinct. Light and printed timetable colours retain each widget's original fallback values.
- Attendance/birthday/history/report filters, pupil result tabs, important payment-dialog classes, parent attendance panels, SchoolPay banners, settings/offline cards, glass control groups and neutral separators now support dark appearance.
- Parent navigation uses complete static Tailwind classes so its inactive/hover colours are generated reliably.
- Shared input, textarea, select and button errors use the supported `aria-[invalid=true]` selector with dark error colours. Native invalid inputs also have dark styles.

No data-fetch, payment, authentication, notification, report-generation or PDF-rendering behaviour was changed. PDF document surfaces remain explicitly white. The existing theme switch, saved/device preference and circular transition are retained.

## Verification

| Check | Result |
| --- | --- |
| UI syntax and dynamic theme-class boundaries | Passed across 463 UI files |
| Actual dashboard widgets in Edge, using synthetic data | Passed: enrollment/attendance charts, calendar, term badges and live tracker |
| Contrast | Chart values/calendar text/status labels meet 4.5:1; sampled subject palette minimum is 5.71:1 |
| Shared controls | Actual parent navigation, events, signature display, settings cards, payment dialog/invalid amount and shared invalid controls checked |
| Responsive/interactions | Calendar popover, chart tooltip, selected controls, mobile width and light restoration checked |
| Light timetable print palette | Exact computed-colour equality verified against the screen light palette |
| Existing appearance browser suite | Passed: circular reveal, saved/system preferences, fallback, reduced motion, mobile/collapsed controls, print restoration and saved-dark hydration |
| Existing PDF browser suite | Passed: identical page/thumbnail pixels, paper appearance, PNG exports, original PDF download and print source |
| PDF workspace contract | Passed: 46 launch paths |
| Focused theme TypeScript check | Passed |
| Payment reversal dialog layout tests | Passed: 2 tests |
| Payment handler completion tests | Existing failure: 2 passed, 8 failed. The unchanged HEAD source reproduces the same failures, including missing `isFinancialDataLoading` in the extracted-handler harness and reversal expectations. All seven extracted payment/reversal handler bodies match HEAD exactly. |

Source structure was compared with HEAD after excluding styling attributes and literal contents. Only the parent navigation's static colour configuration changed structure; that change was reviewed separately. Generated browser fixtures/screenshots and diagnostic results are local under `output/theme-correction-qa`, `output/theme-qa` and `output/pdf-theme-qa`.

This validates real UI components with mocked data/services. It is not an authenticated end-to-end audit of every application route or native Android screen. Git publication and hosting deployment are separate outcomes.

## Re-run

Run `npm.cmd run test:theme-coverage`, `npm.cmd run test:theme-types`, `npm.cmd run test:dashboard-theme-browser`, `npm.cmd run test:theme-browser`, `npm.cmd run test:pdf-theme-browser` and `npm.cmd run test:pdf-workspace-contract`.

Browser checks require Playwright (or `PLAYWRIGHT_MODULE` pointing to the installed module) and Microsoft Edge. They use synthetic records and do not perform school account, payment or Firebase writes.
