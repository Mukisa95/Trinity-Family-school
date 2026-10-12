# Page readiness and bounded Android recovery

The connected Pixel 7 reproduced a Pupils route skeleton lasting more than five minutes on web build b171456d, even though saved pupils were available within three seconds. Other populated routes opened quickly. A URL commit had ended the navigation pause before the destination finished rendering, allowing Android preparation to resume behind the route fallback.

## Behavior

- Navigation completes when content has committed without a visible shared page skeleton. URL changes are measured separately.
- Visible skeletons retain an independent background-work pause. Clearing a navigation flag or disposing another content owner cannot release that pause prematurely. Hidden streaming fallbacks do not block ready content.
- Ready content removes the navigation card and the old-page interaction guard. The app header and sidebar remain outside this guard.
- After twenty seconds of visible workspace loading, a native Android Pupils transition attempts one full-document recovery. A session-storage cooldown prevents automatic reload loops; unavailable storage disables automatic recovery. Saved records, authentication and privacy preferences are retained. An explicit retry remains available when recovery cannot complete. Other platforms receive the retry without automatic reload.
- Hidden-document time and first-setup/welcome time do not trigger recovery.
- Navigation start, URL commit, route loading, content readiness, timeout and recovery receive separate sanitized timings. The bounded audit collector prioritizes failures, navigation and page readiness over repeated photo/click timings, including restored or failed-write batches. Overflow retains separate severity totals. Exports disclose their stage-table cap and prioritize useful route stages.
- The legacy pupils-first-paint marker is recorded once per document, independently of performance timeline eviction.

## Validation and limits

The real drawer/context/Android-provider browser fixture simulates URL commit before page readiness, delayed content, a hidden old fallback, ready-content release, foreground-only recovery, first-setup exclusion, automatic recovery bounds, explicit retry, query-only changes and desktop/mobile header/sidebar placement. The router and bridge are controlled test boundaries; this is not a real-device claim for the new release.

The earlier real-device reproduction is local evidence. The specific request or JavaScript dependency behind that stall remains unidentified because the installed production WebView does not expose remote inspection. This change corrects the verified readiness/scheduling flaw and supplies recovery for an unresolved router transition; it does not prove that every upstream route failure has been eliminated.

The release also includes the previously pending change-driven requirements, uniforms and excluded-days policy. Private device captures and generated QA output are excluded from Git publication.
