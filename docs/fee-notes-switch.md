# Per-pupil Notes switch

Each pupil's Notes dialog has a switch. Missing settings mean **Off**, including existing pupils. Off hides notes and creation forms, stops their queries, polling and service-worker listener, and skips reminder processing for payments and charge changes. Saved notes are preserved. Switching off cancels pending fee queue jobs, clears the pupil's fee-target index and sends existing recipients a pause explanation. Switching on restores original deadlines and reconciles payments made while paused.

The authoritative switch is the `fee_notes_enabled_pupils` string parameter in Firebase Remote Config's **server** namespace (`firebase-server`). Its JSON array contains SHA-256 fingerprints of explicitly enabled pupil IDs. It contains no names, phone numbers, amounts or note text. The optional `pupils.feeNotesEnabled` field is only a display copy delivered through the ordinary pupil cache revision pipeline.

The server must check Remote Config before reading reminder data or authenticating a disabled Notes request. Lookups coalesce simultaneous requests but never retain a completed result. A Remote Config failure stops reminder work before Firestore access; financial recording remains successful, and the shared scheduler continues considering non-fee jobs. Deadline and resume retries use the existing dispatch queue. No Firebase Functions are required.

The project's deployed Firebase Admin service account needs Remote Config read/update permissions (`roles/cloudconfig.admin`). Both schools are configured. No billing upgrade is needed to use the free Remote Config allowance. Remote Config lookups have their own [usage allowance](https://firebase.google.com/docs/remote-config/pricing); they are not Firestore reads.

While Off, the feature adds zero ongoing Firestore reads for that pupil. The ordinary fees page, payment recording and shared scheduler retain their existing reads. **Changing the switch itself is an explicit operation with one-time Firestore reads/writes**, including cache updates, queue cleanup and recipient explanations. An operation already started before switching off cannot have its completed reads undone.

Before deploying to another school, pause existing active notes, cancel only scheduled `fee_reminder` / `fee_reconcile` jobs, and clear existing fee-target entries. Preserve unrelated dispatch jobs and notification history. Existing displayed overdue notices should receive a pause explanation and be marked resolved in the inbox. Do not automatically enable pupils during migration.

Run `npm run test:fee-reminders`. The switch tests cover zero-read guards, default-Off rendering, recipient explanations, pause/resume, publish failures, concurrent switches and scheduler isolation.
