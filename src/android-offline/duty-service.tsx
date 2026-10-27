import React, { useState } from 'react';
import type { AndroidOfflineSnapshot } from '@/lib/offline/android-contracts';
import type { DutyRota, DutyAssignment } from '@/types/duty-service';
import { dutyRotaStatus, dutyWeekAssignments, staffOnDutyToday } from '@/lib/duty-service/selectors';
import { useSchoolDate } from '@/lib/hooks/use-school-date';
import { generateDutyTimeline } from '@/lib/duty-service/timeline';

function SavedDutyRota({ rota, assignments, date, memberName, onTimeline }: {
  rota: DutyRota; assignments: DutyAssignment[]; date: string; memberName: (id: string, type: string) => string; onTimeline: () => void;
}) {
  const [choice, setChoice] = useState<boolean>();
  const status = dutyRotaStatus(rota, date);
  const open = choice ?? status === 'Active';
  const week = dutyWeekAssignments(rota, assignments, date);
  return <section className="card" data-duty-rota={rota.id}>
    <button className="duty-toggle" aria-expanded={open} onClick={() => setChoice(!open)}><strong role="heading" aria-level={2}>{rota.dutyName}</strong><span>{status} · {open ? 'Hide' : 'Show'}</span></button>
    <p className="muted">{rota.startDate} – {rota.endDate} · {rota.frequency}</p>
    {open && <><h3>This week’s assignments</h3>{week.length ? <ul className="list">{week.map(item => <li key={item.id}><strong>{memberName(item.memberId, item.memberType)}</strong><p className="muted">{item.memberType}{item.isSupervisor ? ' · Supervisor' : ''} · {item.startDate} – {item.endDate}</p>{item.service && <p>{item.service}</p>}</li>)}</ul> : <p className="muted">No assignments this week.</p>}
      {(rota.staffArrivalTime || rota.staffDepartureTime) && <p>Arrival {rota.staffArrivalTime || 'Usual time'} · Departure {rota.staffDepartureTime || 'Usual time'}</p>}</>}
    <button onClick={onTimeline}>View timeline</button>
  </section>;
}

/** Packaged restart view uses the same saved records and timeline calculation. */
export function DutyService({ snapshot }: { snapshot: AndroidOfflineSnapshot }) {
  const date = useSchoolDate();
  const saved = snapshot.datasets.dutyService;
  const data = saved?.data;
  const [tab, setTab] = useState('duties');
  const [year, setYear] = useState('all');
  const [term, setTerm] = useState('all');
  const [rotaId, setRota] = useState('');
  if (!data) return <section className="card"><h1>Duty & Service</h1><p>Connect once to save Duty & Service information on this device.</p></section>;
  const years = snapshot.datasets.academicYears?.data || [];
  const rotas = data.dutyRotas.filter(rota => year === 'all' || rota.academicYearId === year).sort((a, b) => Number(dutyRotaStatus(b, date) === 'Active') - Number(dutyRotaStatus(a, date) === 'Active'));
  const people = staffOnDutyToday(rotas, data.dutyAssignments, date);
  const rota = rotas.find(item => item.id === rotaId);
  const timeline = rota ? generateDutyTimeline(rota, data.dutyAssignments) : null;
  const memberName = (id: string, type: string) => (type === 'staff' ? data.staff : data.pupils).find(item => item.id === id)?.name || 'Member information unavailable';
  return <><h1>Duty & Service</h1><p className="muted">Saved {new Date(saved!.preparedAt).toLocaleString()}. Connect to refresh or make changes.</p>
    <section className="card" data-duty-staff-today><h2>Staff on duty today</h2><p className="muted">{date} · {people.length} {people.length === 1 ? 'staff member' : 'staff'}</p>{people.length ? <ul className="list">{people.map(person => <li key={person.memberId}><strong>{memberName(person.memberId, 'staff')}</strong>{person.duties.map(duty => <p key={duty.id} className="muted">{duty.dutyName}{duty.isSupervisor ? ' · Supervisor' : ''}{duty.service ? ` · ${duty.service}` : ''}</p>)}</li>)}</ul> : <p className="muted">No staff are assigned to duty today.</p>}</section>
    <label htmlFor="duty-year">Academic year</label><select id="duty-year" value={year} onChange={event => { setYear(event.target.value); setRota(''); }}><option value="all">All years</option>{years.map(item => <option key={String(item.id)} value={String(item.id)}>{String(item.name)}</option>)}</select>
    <div className="tabs" role="tablist" aria-label="Duty & Service sections">{[['duties', 'Duty Management'], ['prefects', 'Prefectoral']].map(([id, label]) => <button role="tab" aria-selected={tab === id} key={id} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div role="tabpanel">{tab === 'duties' ? <>{rota && timeline ? <><button onClick={() => setRota('')}>Back to Duty Rotas</button><h2>{rota.dutyName}</h2><p>{rota.startDate} – {rota.endDate} · {rota.frequency}</p>{timeline.periods.map(period => <section className="card" key={period.periodNumber}><h3>{period.periodName}</h3><p className="muted">{period.startDate} – {period.endDate}</p>{period.assignments.length ? <ul className="list">{period.assignments.map(assignment => <li key={assignment.id}><strong>{memberName(assignment.memberId, assignment.memberType)}</strong><p>{assignment.memberType}{assignment.isSupervisor ? ' · Supervisor' : ''}{!assignment.isActive ? ' · Inactive' : ''}</p>{assignment.service && <p>{assignment.service}</p>}{assignment.notes && <p className="muted">{assignment.notes}</p>}</li>)}</ul> : <p className="muted">No assignments for this period.</p>}</section>)}</> : rotas.length ? rotas.map(item => <SavedDutyRota key={item.id} rota={item} assignments={data.dutyAssignments} date={date} memberName={memberName} onTimeline={() => setRota(item.id)} />) : <section className="card">No duty rotas for this year.</section>}</> : <><label htmlFor="leadership-term">Leadership term</label><select id="leadership-term" value={term} onChange={event => setTerm(event.target.value)}><option value="all">All leadership terms</option>{data.leadershipTerms.filter(item => year === 'all' || item.academicYearId === year).map(item => <option key={item.id} value={item.id}>{item.termName}{item.isActive ? ' (Active)' : ''}</option>)}</select>{data.prefectoralPosts.length ? data.prefectoralPosts.map(post => {
      const assignments = data.postAssignments.filter(item => item.postId === post.id && (term === 'all' || item.leadershipTermId === term));
      return <section className="card" key={post.id}><h2>{post.postName}</h2><small>Rank {post.positionOfHonour}{!post.isActive ? ' · Inactive' : ''}</small>{assignments.length ? <ul className="list">{assignments.map(item => <li key={item.id}><strong>{memberName(item.pupilId, 'pupils')}</strong><p>{data.pupils.find(pupil => pupil.id === item.pupilId)?.className} · {data.leadershipTerms.find(leadership => leadership.id === item.leadershipTermId)?.termName} · {item.isActive ? 'Active' : 'Previous assignment'}</p>{item.notes && <p className="muted">{item.notes}</p>}</li>)}</ul> : <p className="muted">No prefect assigned.</p>}</section>;
    }) : <section className="card">No prefectoral posts.</section>}</>}</div></>;
}
