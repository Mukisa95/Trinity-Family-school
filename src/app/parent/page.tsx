/**
 * Parent Portal — root page
 *
 * Next.js requires a page.tsx at every route segment that should be
 * publicly reachable.  The ParentLayout (applied by layout.tsx) already
 * handles all view routing (dashboard / home / notifications) via its own
 * internal state, so this page intentionally renders nothing — the layout
 * does all the heavy lifting.
 */
export default function ParentPage() {
  // The ParentLayout (from layout.tsx) renders the full UI.
  // When no children are passed it falls back to <ParentDashboard />.
  return null;
}
