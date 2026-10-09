# Dark theme refinements — 9 October 2026

Pupil rows now use complete Tailwind utilities for gender colours, dark hover and keyboard focus. Names, class/section links, sibling names and action buttons keep readable dark colours. The original light hover colours remain available. Pupil data, navigation, handlers and exports are unchanged.

Appearance defaults to the device setting. A fresh browser follows device light/dark changes automatically; explicitly saved Light, Dark or device preferences remain respected. Existing users can return to automatic appearance through the user menu's **Appearance → Use device setting**.

The expanded desktop sidebar keeps the switch beside the user button. Collapsing the sidebar moves the full switch into the top bar, leaving the avatar enough space; expanding restores the footer switch without a duplicate desktop header switch. Mobile keeps a compact header control.

Switch motion communicates the new state: a 220 ms thumb slide using the existing ease-out curve, 180 ms colour fades and a subtle press response. CSS and native view-transition snapshots keep the switch visible above the existing 450 ms circular page reveal. Reduced motion uses short colour/fade feedback without sliding or a circular reveal. No animation dependency was added.

## Verification

| Check | Result |
| --- | --- |
| Pupil browser fixture, using class expressions extracted from the actual page | Passed for male/female hover, keyboard focus, dark action highlights and original light hover |
| Pupil text contrast | Sampled names, class links, codes and secondary details meet 4.5:1 on the dark hover surface |
| Existing pupil behaviour | Semantic AST matches the prior commit after excluding styling attributes and the helper import |
| Appearance browser fixture with actual header, footer, provider and sidebar | Passed for thumb movement/icon layering, circular reveal, collapse/expand placement, avatar bounds, desktop widths 1366/1024/768 and mobile width 390 |
| Preferences/hydration | Passed for fresh dark-device default, automatic device changes, saved manual override, reload, saved-dark server hydration, fallback and reduced motion |
| PDF browser checks | Passed: identical page/thumbnail pixels, original paper appearance, PNG exports, PDF download and print source |
| PDF workspace contract | Passed: 46 launch paths |
| Focused theme TypeScript check | Passed |
| UI syntax/dynamic theme-class coverage | Passed across 463 UI files |
| Diff whitespace check | Passed |

Browser fixtures use synthetic data and mocked services; they perform no school-account or Firebase writes. Screenshots were inspected locally under `output/theme-qa` and `output/pupil-theme-qa`. This is focused component/browser verification, not an authenticated production audit or a repository-wide type check. Git publication does not confirm a hosting deployment.

## Re-run

Use `npm.cmd run test:pupil-theme-browser`, `npm.cmd run test:theme-browser`, `npm.cmd run test:pdf-theme-browser`, `npm.cmd run test:theme-types`, `npm.cmd run test:theme-coverage` and `npm.cmd run test:pdf-workspace-contract`. Browser checks require Playwright (or `PLAYWRIGHT_MODULE` pointing to the installed module) and Microsoft Edge.
