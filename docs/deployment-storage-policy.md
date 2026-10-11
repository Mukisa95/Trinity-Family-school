# Deployment and storage policy

Codex must follow the explicit-release rule in AGENTS.md. Finishing local work
does not authorize a push, merge, preview, production deployment or redeployment.

## Hosting settings applied on 11 October 2026

Project: trinityfamilyschool, team mkpatricks95-gmailcoms-projects.

- Cancelled, failed and preview retention: 1 day.
- Production retention: 1 week, subject to Vercel's protected-deployment exceptions.
- Ignored build step: skip previews and documentation/Android-source-only changes.
  The filter compares against the last successful deployment. Missing history
  proceeds with a build; VERCEL_FORCE_BUILD=1 explicitly bypasses the filter.
- Removed previews Hii7hhqF6LXz4DvkkeTcFyhi9CEu (merged touch-scroll work),
  77xVxyryv2iscXLVz86UgZA8KmJw and BG2DCmERKc9RWMYZHLfdWCDWRqBK
  (superseded performance previews). The current production and latest active
  performance preview were preserved.

## Repository release configuration

vercel.json disables automatic Git deployments outside main and uses the checked-in
Node ignored-build script. Before publication, the main-school dashboard used
a self-contained shell equivalent. The repository setting takes precedence
when this configuration is deployed.

Both school projects build from this repository, so these source changes apply
to Trinity and Ganda. Deployment retention and cleanup are separate project
settings and must be configured for each project.

## Ganda hosting settings applied on 11 October 2026

Project: trinity-school-ganda, team trinity-school-gandas-projects.

- Cancelled, failed and preview retention: 1 day.
- Production retention: 1 week, subject to Vercel's protected-deployment exceptions.
- Saved values were verified in the project dashboard. The deployed repository
  configuration already overrides the dashboard's ignored-build setting.
- Removed preview AEyZdV7hV1R6QEVCX3hRpyqc9baP (merged touch-scroll work) and
  6aoQPXnPiwo42h2wQAuByUaPu5zM (superseded startup-loader preview).
  Both appeared in Recently Deleted Deployments with 29 days left to restore.
- Preserved current production CD8as7FbR75eJMBowAa3xnYkyxRU, recent production
  rollback versions and latest performance preview 2aBfLrQiJr2PXKDarQEVTo8HC3xc.
  No source changes, Git push, promotion or redeployment were needed for cleanup.

The icon-generation route has a separate 120-second image-processing budget.
Vercel groups routes with matching duration settings and unions their traced
dependencies; this separates Sharp from the regular 60-second API handlers.
The local focused trace found 20,103,608 bytes of Sharp files on Windows. This is
not the Linux production bundle size or a measured billing saving. Inspect the
next explicitly authorized release's Resources view to measure the final effect.

## Validation and usage expectations

Run `node --test tests/vercel-ignore-build.test.cjs` for the local filter checks.
The live shell filter was also checked against real temporary Git history.
The icon route transpiles and vercel.json parses. Full local Next.js builds
were interrupted; they have not passed. The release patch preserves frontend
source, API request handling, cron schedules and cache headers. Track the exact
released commit's Vercel build status separately from these focused checks.

Deletion and shorter retention reduce future storage accumulation. They do not
erase already accrued GB-month usage. No upgrade or Vercel eligibility inquiry
was performed. Publication requires the user's explicit release request.

References:
- https://vercel.com/docs/deployment-storage
- https://vercel.com/docs/security/deployment-retention
- https://vercel.com/docs/project-configuration/git-configuration
- https://github.com/vercel/vercel/blob/main/packages/next/src/utils.ts
