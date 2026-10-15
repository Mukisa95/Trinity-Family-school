# Arrange timetable streams

In timetable edit mode, open a class's stream layout control and choose
**Arrange streams**. Move streams up/down, then save or cancel. The order
applies to that class throughout this timetable, including its weekly view
and printed/PDF output. Together/separate mode remains independently set for
the timetable, day or lesson.

Order is stored as stable IDs in
`TimetableProfile.streamLayouts[classId].streamOrder`. The existing active
stream order remains the default. New active streams append; duplicate,
disabled or deleted saved IDs are ignored when rendering.

The save transaction reads the current timetable and class to validate that
the submitted order contains every active stream exactly once. It updates
only that class's layout metadata and the timetable revision. It never reads,
deletes, recreates or reassigns a lesson entry, and it does not change pupil
assignments or class stream definitions. Concurrent layout settings are
preserved. Failed saves retain the proposed arrangement for retry.

Validation: 33 timetable/stream tests and five service-boundary tests passed.
The browser fixture uses the real editor, popover and PDF renderer, checking
keyboard ordering, cancellation, failed-save retention, row/lesson identity,
reload, mobile fit, read-only mode and preview/PDF parity. Its synthetic save
boundary is complemented by the actual service transaction tests. The
exported PDF was rasterised and visually inspected. Focused TypeScript,
dashboard cache contract and whitespace checks passed. No live school data
was modified during validation.
