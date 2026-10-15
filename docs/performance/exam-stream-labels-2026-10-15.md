# Corrected stream labels in Exams

The reported example was P.7, PRE-PLE - SIPRO - SET 1. The user confirmed
that pupil groups were correct and only their stream labels were wrong.

The exam chooser previously preferred labels copied into `streamScope` and
pupil snapshots, so refreshing the class cache alone could not repair them.
Recording and viewing results now resolve those labels against the exam
class's definitions by the recorded stream ID. Pupil class labels use a
presentation copy of the snapshot; the individual pupil page uses the same
projection. Saved stream IDs, membership, marks and original snapshot fields
are not rewritten. Missing/retired definitions retain recorded labels. The
chooser retains the exam's original scope instead of adding current streams.

New exam creation captures canonical class stream names/codes by ID in both
the class and pupil snapshots, ahead of stale labels copied onto pupils.
This adds no private database reads: the pages share the class cache.

Validation: the actual recording page was exercised in a browser using
synthetic swapped labels and pupils whose current assignments differ from
their exam assignments. Corrected names, stable exam groups, preservation of
unsaved marks, scope switching and saving without rewriting snapshots passed.
The combined class/stream/timetable suite passed 51 tests, and the dashboard
cache contract and whitespace checks passed. A focused TypeScript comparison
against HEAD found the same 31 existing exam/report diagnostics with zero
introduced diagnostics. The live school record was not modified or verified.

The timetable Arrange streams change remains pending alongside this fix.
