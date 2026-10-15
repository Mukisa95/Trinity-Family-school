# Android 1.25: remove floating App help

Trinity Live and Trinity Ganda advance to version 1.25 (code 27). The native
floating button and its web fallback are removed. Background diagnostics and
problem reports on recovery screens remain available. The web root mounts the
invisible `AppDiagnosticsMonitor` instead of the report dialog.

Release lint also exposed existing theme attributes declared below their
supported Android versions. The day/night themes now put navigation-bar styling
in API 27 resources and `isLightTheme` in API 29 resources, preserving Android
8.0 support and the existing appearance on newer devices. WebKit 1.12.1's public
`WEB_AUTHENTICATION` constant is absent from its own lint StringDef; a local
suppression covers that annotation mismatch while retaining the runtime feature
check. No broad lint suppression or higher minimum Android version is used.

## Artifacts

Both APKs are signed, non-debuggable releases. Each retains the existing permanent
school certificate, application ID, website and Firebase project. The local
publisher verified the signatures, manifest versions and shortcut targets.

| App | Bytes | SHA-256 |
| --- | ---: | --- |
| Trinity Live | 4,697,249 | `15efdaee88244ce6f12587a9a1fee95565e1641be43f32b156a3980963796bec` |
| Trinity Ganda | 4,697,221 | `e4cc7d086d2f31ef732950d3b0e0bbcd131894ab92e58c247745906c358c5ad9` |

## Validation

- Both signed release builds and release lint passed; each school passed 69
  native JVM tests. Lint retains non-blocking warnings in existing native code.
- The browser fixture confirms no floating help UI, retained private bounded
  diagnostics, persistence and inactivity in ordinary browsers.
- Session-reliability tests and the focused TypeScript check passed after
  integrating the current production branch.
- Download, update, school-isolation, certificate/passkey and event-negotiation
  contracts validate the combined registry and exact local artifacts.

The build machine was configured with JDK 17, SDK platform 35 and build tools
34/35. A Windows Gradle 8.9 temporary-cache rename failure was repaired locally;
successful builds ran with file watching disabled. Build caches, signing keys,
packaged reader intermediates and QA output are excluded from the release.

No physical-device installation was performed. Users must install their own
school's 1.25 APK for removal of the native button; updating web assets alone
cannot remove an overlay in an older installed APK.
