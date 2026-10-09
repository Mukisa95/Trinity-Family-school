# Dark theme implementation — 9 October 2026

Implementation and focused validation are recorded here. Git publication, hosting deployment and Android APK release are reported separately.

## Behaviour

- A sun/moon switch sits beside the user button in the staff sidebar footer, with a compact version when collapsed. The mobile header has a shortcut. Parent navigation also provides a switch.
- The user menu offers Light, Dark and Use device setting. Light remains the initial default; the preference is saved under `trinity-appearance` in local storage. No Firebase reads or writes are added.
- Manual changes reveal the new palette outward from the pressed control using the browser View Transition API and a circular clip path. The 450 ms duration lets the full viewport reveal remain legible. Unsupported browsers use a fade; reduced motion uses a short fade without a spatial reveal.
- The root provider applies the saved palette before paint through `next-themes`. Theme-dependent switch attributes stay stable during server hydration.
- Shared tokens, glass navigation, page bars, tables, cards, status colours, parent accents and calendar/chart styling support dark appearance. Dark utility counterparts were added throughout the existing UI. Existing explicit dark choices were preserved.
- PDF workspace chrome now follows appearance: toolbars, search, tabs, zoom controls, thumbnail navigation, generation/error states and minimized notifications. The legacy fallback chrome also follows appearance. PDF page canvases and thumbnail paper stay white, with their original content colours. Report generation, printable components and photo editing retain their intended colours. Printing temporarily removes dark styling and restores the selected appearance afterward.

## Validation

| Check | Result |
| --- | --- |
| Focused TypeScript check for the provider, controls and PDF viewers | Passed |
| Real Edge browser fixture using application CSS, actual sidebar footer, theme controls, shared cards, table and dialog | Passed |
| Circular reveal and radius origin, saved preference on reload, system preference changes, mobile and collapsed controls | Passed |
| Unsupported API fallback, reduced motion, opacity cleanup, saved-dark server hydration | Passed |
| Paper colours and restoration after printing | Passed; screenshot and PDF generated |
| Existing PDF workspace contract | `PDF_WORKSPACE_CONTRACT_OK 46_LAUNCH_PATHS` |
| Real PDF.js light/dark rendering | Identical RGBA pixel hashes and dimensions for both pages and thumbnails; identical paper screenshots |
| PDF download and print source | Original PDF bytes preserved; browser print-dialog appearance itself is controlled by the browser/OS |
| PNG page export | Identical SHA-256 before and after changing appearance |
| PDF workspace desktop/mobile and job states | Passed; generating, error, minimized and completion notification screenshots inspected |
| PDF source structure audit | Only appearance classes and paper boundary attributes changed; generation, rendering and action logic preserved |
| Source syntax and migration audit | Valid TSX; automatic changes preserve code structure and add dark class tokens only |
| Repository-wide typecheck | Fails on existing generated-route, archived-source, domain-type and test-target errors; no errors in the new theme modules or current root layout/parent dashboard |

Screenshots in `output/theme-qa` are synthetic-data fixtures, not screenshots of a deployed school account. Desktop light/dark, mid-reveal, dialog, collapsed-sidebar, mobile and print views were inspected.

PDF screenshots and pixel/export hashes are in `output/pdf-theme-qa`. The browser check uses the actual workspace, PDF.js worker, theme provider and two coloured synthetic pages. The original document is still used by the hidden print iframe; no printed page is recoloured by the application theme.

Native Android device testing and a full visual audit of every real module remain unverified. The existing Android wrapper already observes the root dark class; its native screens were not changed in this task.

## Re-run

`npm.cmd run test:theme-types`

`npm.cmd run test:theme-browser` requires Playwright (or `PLAYWRIGHT_MODULE` pointing to the bundled Playwright module) and Microsoft Edge. It uses synthetic fixtures and never opens a hosted school or performs account/data writes.

`node scripts/check-pdf-workspace-contract.js`

`npm.cmd run test:pdf-theme-browser` renders a synthetic two-page PDF with the real PDF.js worker. It checks page/thumbnail pixels, paper screenshots, original PDF download/print bytes, PNG export, responsive controls and job states. It requires the same Playwright/Edge setup as the theme browser check.
