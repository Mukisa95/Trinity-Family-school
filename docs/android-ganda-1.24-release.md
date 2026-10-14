# Trinity Ganda Android 1.24 release

The user requested publishing Ganda's native update after the shared website changes in `7c094cec`. Ganda moves from 1.22/code 24 to 1.24/code 26 using the same native implementation as the Trinity Live 1.24 release: offline calendar and events, scrollable event widgets with automatic tomorrow/ongoing cards, local event reminders, App help, and session/offline recovery.

Identity: `ug.trinityfamilyganda.live`; website `https://trinityfamilyganda.vercel.app`; Firebase project `trinity-family-ganda`. The signed non-debuggable APK retains Ganda's permanent certificate `5D:13:68:CC:38:C1:49:45:87:B5:3E:0D:70:5A:2A:28:4B:16:DF:FF:0C:2A:43:8C:4D:F2:C6:C7:58:B0:B3:3F`. APK size: 4,691,313 bytes; SHA-256 `0a6ae587eb667c3a3594956172d2fdfa36700539f9cc81cd8d13819db9c0927f`.

Validation: signed Ganda release build and release lint passed; 69 Android JVM tests passed; 22 download/update/school-isolation/passkey/event-negotiation tests passed; real-browser offline event and preparation fixtures passed using Ganda's packaged reader; packaged HTML/JavaScript identifies Trinity Ganda and contains Events & Calendar. No Android device was connected during this Ganda release. Earlier Trinity Live 1.24 device checks cover the shared implementation, not a Ganda-specific device run.

Publication scope is the Ganda configuration, its APK, its registry entry, and this release note. Trinity Live's APK and legacy release metadata remain unchanged. The registry and download artifact require a hosting build so Ganda's website can serve the update.
