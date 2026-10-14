# Offline banner and startup session follow-up

Prepared locally in response to the supplied `TRI-38abb172-2918-45dd-a54b-be77713c980e` report. Included in the combined Android 1.24 calendar/events release. The user confirmed Android app 1.23.

## What the report establishes

- Three document starts are followed by `auth_revalidation_invalid` within roughly 2–3 seconds, and then `auth_identity_missing` and a return to login. The latter event can be a consequence of the app calling Firebase sign-out; it does not by itself establish that persistent storage failed.
- Each subsequent sign-in records `auth_persistence_localstorage` and `offline_access_ready`. No sign-out-on-exit event appears in this supplied timeline.
- One offline snapshot takes 29,679 ms, while later saves take 748–893 ms. Total snapshot timing includes cache projection, comparison, bridge serialization, and native saving; it is not a measurement of a frozen UI. No JavaScript stall is recorded here.
- After the offline event, `offline_section_ready` appears repeatedly, including after another document start. Authorized saved access worked in that portion of the report. Local snapshot copying while offline is distinct from network downloading.
- This report format lacks native app/build/WebView metadata, so device-level causes cannot be derived from it alone.

## Changes

- Hide the background-download banner whenever either the browser or Android reports no connection. Subscribe to both event sources, pause background recovery attempts while offline, and retain completed tasks and cached records. Reconnection restores the banner only if preparation is still unfinished.
- Use the same connection signals for first-time setup recovery, so Android's earlier connectivity notification does not leave setup trying to download.
- Wait for Firebase's local `authStateReady()` before deciding whether the persisted identity is missing. Focus and visibility validation wait for initial token verification to leave its checking state. The code previously allowed a restored profile to start a validation while Firebase `currentUser` was still temporarily null.
- Continue rejecting truly absent/mismatched identities, inactive claims, and confirmed disabled/revoked sessions after restoration. Account switches invalidate stale checks.
- Record initial identity-restoration results and validation reason codes. Future reports distinguish actual missing identity, inactive claims, SDK credential failure, and delayed restoration.
- Record slow export, revision-comparison, and native-bridge stages separately when a stage takes at least two seconds, preserving the total snapshot measurement.

The startup race is reproducible in a controlled delayed-restoration fixture and consistent with this timeline; the existing report lacks enough detail to prove it caused every observed sign-out.

## Validation

The focused session/offline/setup regression suite passed 44 tests, and the scoped TypeScript check passed. The browser fixture uses the real preparation hook and AuthProvider with simulated service boundaries to cover both offline signals, retained cached tasks, reconnect/completion visibility, cold-start focus/resume, and confirmed account revocation.

These are shared web changes and require website publication. They do not require a new Android APK. Phone testing after publication remains necessary.
