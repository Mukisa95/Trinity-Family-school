# App Settings and app sharing

Staff open `/settings/app`; parents open `/parent/settings` from their sidebar account controls. Settings are searchable across sections, including when a section is selected. Look and feel links preserve the existing colour, typography, surface and motion controls. Account forms remain separate from school-administration permissions; the parent account form is now `/parent/settings/account`.

The hub groups appearance, profile/account details, security, live tracking, push notifications, lesson reminders, widgets, saved information and About app. Existing passkey/device-unlock and automatic privacy-lock components are reused, including native Android authentication and browser passkeys. The parent layout enforces the same privacy lock. Home-screen browser storage/installation controls remain available.

Android-only controls use the actual native bridge. Browser user agents and narrow windows do not expose widgets, timetable cards, native lesson reminders or native update actions. Calendar event tracking and reminder alerts are separate from school push announcements. Turning off the ongoing card preserves widget selections and lesson reminders; the explicit card choice survives cache expiry and logout. Older APKs open their native settings when a direct control is unavailable, and unknown status is not presented as a confirmed switch value.

Browser push Off persists for this account on this device, suppresses prompts and automatic registration, and waits for in-flight registration before unsubscribing.

Desktop Get the school app links open a QR dialog. Mobile browsers open the public `/download` page directly. Native Android and installed web apps hide these links. QR codes and sharing use only the current school's absolute public download URL, without account or session data. Downloading requires no sign-in. Existing school identity, signing-certificate and artifact checks remain intact.

About app is the last section and includes sharing QR, app/platform information, school website, web version, and installed native version/build when supplied by the APK. The available Android release is labelled separately from the installed version. Older APKs show an honest unavailable status.

`tests/app-settings.test.ts`, platform/public-download and push-preference tests cover filtering, status compatibility and notification preferences. `scripts/test-app-settings-browser.cjs` checks actual hub/download components with simulated OS/service replies; `scripts/test-page-zoom-browser.cjs` checks real PDF rendering and browser gestures. Android packages use permanent school signing keys. Physical biometric prompts and launcher/widget behavior still require device testing.
