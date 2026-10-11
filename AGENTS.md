# Codex working rules

## Deployment requires a direct user request

- Completing an implementation, fix, review, test, or task is not permission to deploy.
- Do not push commits, merge release branches, trigger hosting builds, redeploy, publish a release, or run Vercel/Firebase deployment commands unless the human user explicitly requests that release action for the current work.
- A previous task's push or deployment authorization does not carry over to later tasks. Requests such as "start", "continue", "complete", or "implement" authorize local work only.
- Treat a push that triggers an automatic hosting deployment as a deployment action. Explain that effect when relevant; do not use a push to bypass this rule.
- Prepare and test changes locally. At task completion, report what is ready and its validation status; wait for an explicit release request.
- Batch related changes into a release rather than deploying every small edit. Stage only the requested paths and preserve unrelated work.

## End-of-run question

- At the end of every run, summarize pending changes and their validation status, then ask: "Would you like me to push the changes or continue making changes?"
- If a push will trigger a hosting deployment, include that effect in the question.
- If there are no pending changes, say there is nothing to push while still asking whether the user wants to continue making changes.
- Asking the question does not authorize a release. Wait for the user's explicit request before pushing or deploying.

## Hosting storage

- Keep failed, cancelled, and preview deployment retention short. Preserve current production and useful recent rollback deployments.
- Prefer explicit previews when needed; avoid builds for documentation-only or native-only changes.
- Do not contact Vercel about plan eligibility unless the user explicitly requests it.
