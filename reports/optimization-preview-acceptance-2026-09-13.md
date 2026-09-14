# Preview acceptance for fee and payment optimizations

Purpose: compare the review deployment with the current main deployment using the same phone/computer, connection, signed-in role and pupil/term scope. Keep the existing authentication and fee display behavior. This review does not authorize a merge to main.

## Before financial tests

Confirm the Firebase project configured for the preview on both client and server. The application has a live-school fallback project, so a preview hostname alone is not database isolation. Until the environment is confirmed, restrict testing to opening screens, reading information and generating local previews. Do not create dummy payments or trigger SchoolPay sync, banking mutations or notifications against live records.

Use an existing separate test Firebase environment and controlled pupils/payments for mutation tests. If none exists, prepare that environment first using the existing authentication design. Never copy production credentials into this report or pull request.

## Compare normal usage first

1. Open the same individual, family and class collection scopes on main and preview. Compare fee names, amounts, discounts, paid totals, balances, order and available actions. Cover active and ended terms, uniforms and carry-forward.
2. Compare receipt and statement fields, newest-receipt selection and desktop/mobile layouts. Check a phone-sized view, scrolling, modal controls and refresh behavior.
3. Record page opening and refresh timing separately. Use 20 comparable runs for each route: cold runs from a fresh browser context, then warm runs after the data is loaded. Compare medians and p95; do not mix cold and warm samples.
4. Record time to visible rows and time to complete usable fee values separately. Confirm that faster loading has not hidden rows or temporarily shown false zero balances.

## Payment tests in the confirmed test environment

Cover single, mixed and family payments, uniforms, carry-forward, discounts, reversal and bank-account actions. For each test compare the expected amount with saved ledger rows, history, signature, uniform tracking and displayed balance. Verify the receiving staff identity and receipt fields.

Exercise rapid double clicks, an interrupted response followed by retry, page reload, two tabs and simultaneous withdrawals. Verify confirmed IDs and totals directly; a success toast alone is not evidence of a correct write. Record unresolved cross-tab/storage and banking command-replay gaps rather than assuming the existing unit fixtures cover them.

Measure click-to-feedback, request/commit time and time until the confirmed balance is visible. Keep signature completion and notification arrival as separate measurements. Notifications may arrive later without delaying payment confirmation. Do not manufacture duplicate payments to collect more timing samples.

Test notification failure/retry with a test recipient and controlled worker invocation. Preview deployment does not establish a scheduled retry worker. Do not invoke unrelated production cron jobs.

## Results sheet

| Scenario | Build/commit | Device/network | Cold/warm | Samples | Median ms | p95 ms | Expected/result match | Notes |
|---|---|---|---|---:|---:|---:|---|---|
| Individual fee opening | | | | | | | | |
| Family fee opening | | | | | | | | |
| Class fee opening | | | | | | | | |
| Explicit refresh | | | | | | | | |
| Single payment confirmation | | | | | | | | |
| Mixed/family payment confirmation | | | | | | | | |

Use non-identifying fixture IDs in shared results. Count requests and returned documents separately. Browser network requests are not a Firestore billing measurement; use the test project's usage evidence for any billed-read claim.

## Merge gate

All tested financial values and receipt fields must match; no lost/duplicated financial operation in the accepted scenarios; no authentication or fee-source redesign; relevant browser and Firestore integration checks pass. Record speed results honestly, including any regression. The audit's payment/signature recovery, banking replay, stale year-cache and notification durability gaps remain open until explicitly fixed and verified. Existing build configuration skips TypeScript/lint checking, so a successful Vercel build is not a clean typecheck.
