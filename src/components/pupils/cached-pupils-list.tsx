'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { useNavigation } from '@/lib/contexts/navigation-context';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { formatPupilDisplayName, matchesPupilSearch, sortPupilsByName } from '@/lib/utils/name-formatter';
import { getPupilClassDisplay } from '@/lib/utils/class-streams';
import { usePageDataTiming } from '@/lib/hooks/use-page-data-timing';

const BATCH_SIZE = 50;
const readParameter = (name: string, fallback = '') => typeof window === 'undefined'
  ? fallback : new URLSearchParams(window.location.search).get(name) ?? fallback;

/** The route and management-code fallbacks share the already-authorized cache.
 * No Firestore read, persisted-file read, or signed-identity wait is introduced.
 */
export function CachedPupilsList({ preparingManagement = true }: { preparingManagement?: boolean }) {
  const { user, isAuthenticated } = useAuth();
  const { data: pupils, error, isSavedData } = usePupils();
  const { data: classes = [] } = useClasses();
  const { goBack, startNavigation } = useNavigation();
  const [search, setSearch] = useState(() => readParameter('q'));
  const [classId, setClassId] = useState(() => readParameter('classId') === 'all' ? '' : readParameter('classId'));
  const [visible, setVisible] = useState(BATCH_SIZE);
  const allowed = isAuthenticated && GranularPermissionService.canAccessPage(user, 'pupils', 'list');
  const canSearch = allowed && GranularPermissionService.canPerformAction(user, 'pupils', 'list', 'search_filter');
  const canOpen = allowed && GranularPermissionService.canPerformAction(user, 'pupils', 'list', 'view_details_link')
    && GranularPermissionService.canAccessPage(user, 'pupils', 'detail');
  usePageDataTiming('pupils-cached-list', allowed && pupils !== undefined && !error);
  const status = readParameter('status', 'Active');
  const gender = readParameter('gender', 'all');
  const section = readParameter('section', 'all');
  const classMap = useMemo(() => new Map(classes.map(item => [item.id, item])), [classes]);
  const filtered = useMemo(() => {
    if (!allowed) return [];
    return sortPupilsByName((pupils ?? []).filter(pupil =>
      (!classId || classId === 'all' || pupil.classId === classId)
      && (status === 'all' || pupil.status === status)
      && (gender === 'all' || pupil.gender?.toLowerCase() === gender.toLowerCase())
      && (section === 'all' || pupil.section?.toLowerCase() === section.toLowerCase())
      && matchesPupilSearch(pupil, search, [pupil.admissionNumber, pupil.className])));
  }, [pupils, classId, search, allowed, status, gender, section]);
  const updateFilter = (name: string, value: string) => {
    // Next observes native history changes. The management screen receives the
    // same filters when its code finishes, without a route/data request.
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(name, value); else url.searchParams.delete(name);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    setVisible(BATCH_SIZE);
  };

  if (!allowed) return <div className="p-6 text-muted-foreground">Pupil access is unavailable.</div>;
  if (error) return <div role="alert" className="p-6 text-destructive">{error.message}</div>;
  if (pupils === undefined) return <div data-route-content-pending className="p-6">
    <h1 className="text-xl font-semibold">Pupils</h1>
    <p role="status" className="mt-3 text-muted-foreground">Loading pupil records…</p>
  </div>;

  // Defer Android snapshot serialization while management code prepares;
  // this signal does not control a loader or disable these ready records.
  return <section className="mx-auto max-w-7xl space-y-4 p-3 sm:p-6" data-cached-pupils-list data-route-content-pending={preparingManagement ? '' : undefined}>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => goBack('/')} className="rounded-lg border bg-card px-3 py-2 text-sm">Back</button>
      {canSearch && <select aria-label="Class" value={classId} onChange={event => {
        setClassId(event.target.value); updateFilter('classId', event.target.value);
      }} className="min-w-0 max-w-[12rem] rounded-lg border bg-card px-3 py-2 text-sm">
        <option value="">All classes</option>
        {classId && !classMap.has(classId) && <option value={classId}>{pupils?.find(pupil => pupil.classId === classId)?.className || 'Selected class'}</option>}
        {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>}
      <h1 className="text-xl font-semibold">Pupils</h1>
      <span className="text-sm text-muted-foreground">{filtered.length} pupils</span>
    </div>
    {canSearch && <input aria-label="Search pupils" placeholder="Search pupils" value={search} onChange={event => {
      setSearch(event.target.value); updateFilter('q', event.target.value);
    }} className="w-full rounded-lg border bg-card px-3 py-2 text-sm" />}
    <p className="text-xs text-muted-foreground">{isSavedData ? 'Showing saved records. ' : ''}{preparingManagement ? 'Additional management tools are preparing.' : 'Pupil records are available.'}</p>
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50"><tr><th className="p-3">Pupil</th><th className="p-3">Class</th></tr></thead>
        <tbody>{filtered.slice(0, visible).map(pupil => {
          const href = `/pupil-detail?id=${encodeURIComponent(pupil.id)}`;
          return <tr key={pupil.id} className="border-t">
            <td className="p-3">{canOpen ? <Link href={href} prefetch={false} className="font-medium text-foreground underline underline-offset-4"
              onClick={event => {
                if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
                startNavigation('Pupil details', href);
              }}>{formatPupilDisplayName(pupil)}</Link>
              : formatPupilDisplayName(pupil)}
              <div className="text-xs text-muted-foreground">{pupil.admissionNumber}</div>
            </td>
            <td className="p-3">{getPupilClassDisplay(pupil, classMap.get(pupil.classId)).name || 'Unassigned'}</td>
          </tr>;
        })}</tbody>
      </table>
      {!filtered.length && <p className="p-4 text-muted-foreground">No pupils match these filters.</p>}
    </div>
    {visible < filtered.length && <button type="button" onClick={() => setVisible(value => value + BATCH_SIZE)}
      className="rounded-lg border bg-card px-4 py-2 text-sm">Show more pupils</button>}
  </section>;
}
