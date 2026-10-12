# Codex working rules

## Deployment requires a direct user request

- Completing an implementation, fix, review, test, or task is not permission to deploy.
- Do not push commits, merge release branches, trigger hosting builds, redeploy, publish a release, or run Vercel/Firebase deployment commands unless the human user explicitly requests that release action for the current work.
- A previous task's push or deployment authorization does not carry over to later tasks. Requests such as "start", "continue", "complete", or "implement" authorize local work only.
- Treat a push that triggers an automatic hosting deployment as a deployment action. Explain that effect when relevant; do not use a push to bypass this rule.
- Prepare and test changes locally. At task completion, report what is ready and its validation status; wait for an explicit release request.
- Batch related changes into a release rather than deploying every small edit. Preserve unrelated work.
- A request to push covers ALL pending changes made as part of the current chat, including earlier implementation batches and the latest batch, unless the user explicitly narrows the scope. Review the full chat's pending files and unpushed commits across its worktrees; do not release only the most recent edits.
- Stage only changes belonging to this chat. Unrelated checkout changes and generated QA output are not part of the release. Verify the target branch and validate the combined release before pushing.

## Conditional release choices

- Offer release choices only after making or updating changes that leave pending, unpushed work from this chat, and only when the user has not already authorized its release.
- Before offering the choices, summarize ALL pending chat changes and their validation status, including earlier batches. Explain if pushing will trigger a hosting deployment.
- Prefer clickable follow-up actions labeled "Push all chat changes" and "Continue making changes". Use supported UI actions, such as `codex-followup`, with self-contained prompts. The push action's prompt must explicitly request pushing all pending changes from this chat together; include the deployment effect when applicable.
- Clicking and submitting the push action is an explicit release request. Merely displaying the action or preselecting an option is not authorization. "Continue making changes" authorizes local work only.
- Do not ask the release question after a successful push when no chat changes remain, on read-only questions or status updates, or merely because unrelated changes or local test logs/screenshots exist. Do not repeatedly use "Would you like me to push the changes or continue making changes?" when there is nothing from this chat to push.
- If release is already authorized, complete the combined push and report its result without asking for permission again.

## Hosting storage

- Keep failed, cancelled, and preview deployment retention short. Preserve current production and useful recent rollback deployments.
- Prefer explicit previews when needed; avoid builds for documentation-only or native-only changes.
- Do not contact Vercel about plan eligibility unless the user explicitly requests it.
