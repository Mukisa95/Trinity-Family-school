import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AndroidOfflineSession, AndroidOfflineSnapshot, AndroidOfflineTimetable } from '@/lib/offline/android-contracts';
import { activeTimetableFeed } from '@/lib/offline/timetable-feed';
import { androidOfflineRequest } from '@/lib/offline/android-bridge';
import { formatPupilName } from '@/lib/utils/name-formatter';
import { getTimetableStreamMode, findTimetableEntryForRow, getTimetableRenderedPeriodSpan } from '@/lib/utils/timetable-streams';
import type { Pupil } from '@/types';

declare const __ANDROID_APP_NAME__: string;
type Row = Record<string, any>;
type SavedReply = Awaited<ReturnType<typeof androidOfflineRequest>> & { snapshot?: AndroidOfflineSnapshot; available?: boolean; role?: string };
const date = (value?: string) => value && Date.parse(value) > 0 ? new Date(value).toLocaleString() : 'Update time unavailable';
const amount = (value: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(value);
function Missing({ children = 'Connect to load this information.' }: { children?: React.ReactNode }) { return <p className="empty">{children}</p>; }
function pairs(value: Row, keys: [string, string][]) { return <dl>{keys.filter(([key]) => value[key] != null && value[key] !== '').map(([key, title]) => <React.Fragment key={key}><dt>{title}</dt><dd>{typeof value[key] === 'object' ? JSON.stringify(value[key]) : String(value[key])}</dd></React.Fragment>)}</dl>; }
function Avatar({ pupil }: { pupil: Row }) { const local = typeof pupil.photo === 'string' && pupil.photo.startsWith('data:image/'); return <span className="avatar">{local ? <img src={pupil.photo} alt="" /> : String(pupil.lastName || pupil.firstName || '?').slice(0, 1)}</span>; }

function ParentDetails({ snapshot, pupil }: { snapshot: AndroidOfflineSnapshot; pupil: Row }) {
  const [tab, setTab] = useState('Information');
  const bundle = snapshot.datasets.parent!.data;
  const fees = bundle.fees.filter(item => item.pupilId === pupil.id);
  const banking = bundle.banking.find(item => item.pupilId === pupil.id);
  const attendance = bundle.attendance.find(item => item.pupilId === pupil.id);
  const results = bundle.results.find(item => item.pupilId === pupil.id);
  return <><div className="tabs" role="tablist" aria-label="Child information">{['Information', 'Fees', 'Attendance', 'Results', 'Banking'].map(name => <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div>
    <section className="card" role="tabpanel" aria-label={tab}>
      {tab === 'Information' && <>{pairs(pupil, [['admissionNumber', 'Admission number'], ['className', 'Class'], ['streamName', 'Stream'], ['section', 'Section'], ['gender', 'Gender'], ['dateOfBirth', 'Date of birth'], ['status', 'Status']])}</>}
      {tab === 'Fees' && (fees.length ? fees.map(item => <div key={item.key}><h3>Year {item.academicYearId} · Term {item.termId}</h3><p className="muted">Updated {date(item.preparedAt)}</p><p>Balance <strong className="amount">{amount(item.totals.totalBalance)}</strong></p><ul className="list">{item.fees.map(fee => <li key={fee.id}><strong>{fee.name}</strong><div className="row"><span>Paid {amount(fee.paid)}</span><span>Balance {amount(fee.balance)}</span></div>{fee.payments.length > 0 && <small>{fee.payments.length} payments</small>}</li>)}</ul></div>) : <Missing />)}
      {tab === 'Attendance' && (attendance ? <><p className="muted">Updated {date(attendance.preparedAt)}</p>{attendance.records.length ? <ul className="list">{attendance.records.map(record => <li key={record.id}><strong>{String(record.date)} · {record.status}</strong>{record.remarks && <p>{record.remarks}</p>}</li>)}</ul> : <Missing>No attendance records.</Missing>}</> : <Missing />)}
      {tab === 'Results' && (results ? <><p className="muted">Updated {date(results.preparedAt)}</p>{results.results.length ? results.results.map(result => <div key={result.id}><h3>{result.examName}</h3><p>{result.academicYear} · {result.term} · {result.className}</p><p>Score {result.totalScore}/{result.totalMarks} · {result.division || result.grade}</p><ul className="list">{result.subjectResults.map((subject, index) => <li key={index} className="row"><span>{subject.subject}</span><strong>{subject.score}/{subject.totalMarks} · {subject.grade}</strong></li>)}</ul></div>) : <Missing>No released results.</Missing>}</> : <Missing />)}
      {tab === 'Banking' && (banking ? <><p className="muted">Updated {date(banking.preparedAt)}</p>{banking.account ? <><p>Account {banking.account.accountNumber}</p><h2>{amount(banking.account.balance)}</h2><ul className="list">{banking.transactions.map(transaction => <li key={transaction.id}>{String((transaction as unknown as Row).date || transaction.createdAt || '')}<div className="row"><span>{transaction.type}</span><strong>{amount(transaction.amount)}</strong></div></li>)}</ul></> : <Missing>No banking account.</Missing>}</> : <Missing />)}
    </section></>;
}

function StaffDetails({ pupil }: { pupil: Row }) {
  return <><section className="card"><h2>Personal & academic information</h2>{pairs(pupil, [['admissionNumber', 'Admission number'], ['className', 'Class'], ['classCode', 'Class code'], ['streamName', 'Stream'], ['section', 'Section'], ['gender', 'Gender'], ['dateOfBirth', 'Date of birth'], ['registrationDate', 'Registration date'], ['status', 'Status'], ['nationality', 'Nationality'], ['religion', 'Religion']])}</section>
    {Array.isArray(pupil.guardians) && <section className="card"><h2>Guardians</h2>{pupil.guardians.map((guardian: Row, index: number) => <div key={index} className="card">{pairs(guardian, [['firstName', 'First name'], ['lastName', 'Last name'], ['relationship', 'Relationship'], ['phone', 'Phone'], ['secondaryPhone', 'Other phone'], ['email', 'Email'], ['address', 'Address']])}</div>)}</section>}
    {['medicalConditions', 'allergies', 'bloodGroup', 'emergencyContact'].some(key => pupil[key]) && <section className="card"><h2>Medical information</h2>{pairs(pupil, [['medicalConditions', 'Conditions'], ['allergies', 'Allergies'], ['bloodGroup', 'Blood group'], ['emergencyContact', 'Emergency contact']])}</section>}
    <section className="card"><h2>Additional records</h2><Missing>Connect to view exam history, fee collection, uniforms and requirements.</Missing></section></>;
}

function Pupils({ snapshot, selectedId, select }: { snapshot: AndroidOfflineSnapshot; selectedId: string; select: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(40);
  const all: Row[] | undefined = snapshot.datasets.parent?.data.family.pupils || snapshot.datasets.pupils?.data;
  const selected = all?.find(item => item.id === selectedId);
  if (selected) return <><button onClick={() => select('')}>Back to {snapshot.role === 'Parent' ? 'my children' : 'pupils'}</button><div className="row" style={{ margin: '20px 0' }}><Avatar pupil={selected} /><div><h1>{formatPupilName(selected)}</h1><span className="muted">{selected.className || selected.classCode || ''} {selected.streamName || ''}</span></div></div>{snapshot.role === 'Parent' ? <ParentDetails snapshot={snapshot} pupil={selected} /> : <StaffDetails pupil={selected} />}</>;
  const filtered = all?.filter(item => `${formatPupilName(item)} ${item.admissionNumber || ''} ${item.className || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <><h1>{snapshot.role === 'Parent' ? 'My children' : 'Pupils'}</h1><p className="muted">Updated {date(snapshot.datasets.parent?.preparedAt || snapshot.datasets.pupils?.preparedAt)}.</p><label htmlFor="search">Search by name, admission number or class</label><input id="search" value={search} onChange={event => { setSearch(event.target.value); setLimit(40); }} /><section className="card" style={{ marginTop: 16 }}>{!all ? <Missing /> : !filtered?.length ? <Missing>{search ? 'No pupils match your search.' : 'No pupils found.'}</Missing> : <div className="stack">{filtered.slice(0, limit).map(item => <button className="pupil" key={item.id} onClick={() => select(item.id)}><Avatar pupil={item} /><span><strong>{formatPupilName(item)}</strong><br /><small>{item.admissionNumber} · {item.className || item.classCode || 'Class unavailable'}</small></span></button>)}{filtered.length > limit && <button onClick={() => setLimit(limit + 40)}>Show more pupils</button>}</div>}</section></>;
}

function TimetableFeed({ snapshot, timeZone = 'Africa/Kampala' }: { snapshot: AndroidOfflineSnapshot; timeZone?: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  const feed = activeTimetableFeed(snapshot, timeZone, now);
  return <div className="stack" aria-label="All timetables">{feed.map(table => <section className="card" key={table.id}><h2>{table.name}</h2><div className="row"><strong>{table.title}</strong>{table.active && <span>{table.remaining} min left</span>}</div><p className="muted">{table.time}</p>{table.active && <progress max={100} value={table.progress} aria-label={`${table.name} lesson progress`} style={{ width: '100%' }} />}<ul className="list">{table.rows.map((row, index) => <li key={index} className="row"><strong>{row.className}</strong><span>{row.subject}</span></li>)}</ul></section>)}</div>;
}

function Timetable({ snapshot }: { snapshot: AndroidOfflineSnapshot }) {
  const tables = snapshot.datasets.timetables?.data || [];
  const params = new URLSearchParams(location.search);
  const [tableId, setTableId] = useState(tables.some(item => item.profile.id === params.get('tableId')) ? params.get('tableId')! : tables[0]?.profile.id || '');
  const table = tables.find(item => item.profile.id === tableId);
  const [classId, setClassId] = useState(table?.profile.classIds.includes(params.get('classId') || '') ? params.get('classId')! : table?.profile.classIds[0] || '');
  const [streamId, setStreamId] = useState(params.get('streamId') || '');
  const [day, setDay] = useState(new Date().getDay() || 7);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const current = new URLSearchParams(location.search);
    current.set('page', 'timetable'); current.set('tableId', tableId); current.set('classId', classId); current.set('streamId', streamId);
    history.replaceState(history.state, '', `?${current.toString()}`);
  }, [tableId, classId, streamId]);
  const classes = snapshot.datasets.classes?.data || [];
  const schoolClass = classes.find(item => item.id === classId) as unknown as { streams?: Row[] } | undefined;
  const periods = table?.periods.filter(period => period.dayOfWeek === day).sort((a, b) => a.periodNumber - b.periodNumber) || [];
  const label = (dataset: 'subjects' | 'teachers', id: string) => {
    const value = snapshot.datasets[dataset]?.data.find(item => item.id === id);
    return value ? String(value.name || [value.lastName, value.firstName].filter(Boolean).join(' ')) : id ? 'Information unavailable' : '';
  };
  return <><h1>Timetable</h1><TimetableFeed snapshot={snapshot} /><p className="muted">Browse the full schedule below.</p>{tables.length ? <><div className="filters"><div><label htmlFor="table">Timetable</label><select id="table" value={tableId} onChange={event => { const next = tables.find(item => item.profile.id === event.target.value); setTableId(event.target.value); setClassId(next?.profile.classIds[0] || ''); setStreamId(''); }}>{tables.map(item => <option key={item.profile.id} value={item.profile.id}>{item.profile.name}</option>)}</select></div><div><label htmlFor="class">Class</label><select id="class" value={classId} onChange={event => { setClassId(event.target.value); setStreamId(''); }}>{table?.profile.classIds.map(id => <option key={id} value={id}>{String(classes.find(item => item.id === id)?.name || id)}</option>)}</select></div><div><label htmlFor="stream">Stream</label><select id="stream" value={streamId} onChange={event => setStreamId(event.target.value)}><option value="">Consolidated</option>{schoolClass?.streams?.map(stream => <option key={stream.id} value={stream.id}>{stream.name || stream.code}</option>)}</select></div><div><label htmlFor="day">Day</label><select id="day" value={day} onChange={event => setDay(Number(event.target.value))}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></div></div>
      {!table?.complete ? <section className="card"><Missing>Connect to load the complete timetable.</Missing></section> : !periods.length ? <section className="card"><Missing>No scheduled periods for this day.</Missing></section> : periods.map((period, index) => {
        const covered = periods.slice(0, index).some((previous, previousIndex) => {
          const previousEntry = findTimetableEntryForRow(table.entries, classId, previous.id, getTimetableStreamMode(table.profile, classId, day, previous.id), streamId || undefined);
          return previousEntry && previousIndex + getTimetableRenderedPeriodSpan(periods, previousIndex, previousEntry.periodSpan) > index;
        });
        if (covered) return null;
        const mode = getTimetableStreamMode(table.profile, classId, day, period.id);
        const entry = findTimetableEntryForRow(table.entries, classId, period.id, mode, streamId || undefined);
        const span = getTimetableRenderedPeriodSpan(periods, index, entry?.periodSpan);
        return <section key={period.id} className="card lesson"><small>{period.startTime} – {periods[index + span - 1]?.endTime || period.endTime}</small><h2>{period.type !== 'lesson' ? period.customLabel || period.type : entry ? entry.activityName || label('subjects', entry.subjectId) : mode === 'separate' && !streamId ? 'Select a stream to view this lesson' : 'Unassigned lesson'}</h2>{entry && <p className="muted">{label('teachers', entry.teacherId)}{entry.optionalSubjectId ? ` / ${label('subjects', entry.optionalSubjectId)}` : ''}</p>}</section>;
      })}
      {table?.complete && <section className="card"><h2>On your home screen</h2><p className="muted">All timetables and classes appear automatically.</p><div className="stack"><button onClick={() => void androidOfflineRequest('openTimetableSettings').catch(error => setMessage(error.message))}>Card and widget settings</button><button onClick={() => void androidOfflineRequest('selectTimetable', { notificationCard: true }).then(() => setMessage('Notification card enabled.')).catch(error => setMessage(error.message))}>Enable notification card</button><button onClick={() => void androidOfflineRequest('selectTimetable', { notificationCard: false }).then(() => setMessage('Notification card hidden.')).catch(error => setMessage(error.message))}>Hide notification card</button></div><p role="status" style={{ marginTop: 12 }}>{message}</p></section>}</> : <section className="card"><Missing /></section>}</>;
}

function Dashboard({ snapshot, session, navigate }: { snapshot: AndroidOfflineSnapshot; session: AndroidOfflineSession; navigate: (page: string) => void }) {
  const parent = snapshot.datasets.parent?.data;
  return <><h1>{snapshot.role === 'Parent' ? 'My family dashboard' : 'School dashboard'}</h1><p className="muted">Welcome, {session.displayName}.</p>{parent ? <><section className="card"><h2>{parent.family.pupils.length} {parent.family.pupils.length === 1 ? 'child' : 'children'}</h2><p>Family profiles, fees, attendance, banking and released results.</p><button className="primary" onClick={() => navigate('pupils')}>View my children</button></section><section className="card"><h2>Your parent dashboard</h2><p>View your family information and school updates.</p><button onClick={() => void androidOfflineRequest('openParent').catch(() => undefined)}>Open parent dashboard</button></section></> : <><div className="grid">{Object.entries(snapshot.datasets.dashboard?.data || {}).map(([name, value]) => <section className="card" key={name}><small>{name}</small><div className="metric">{value}</div></section>)}</div>{!snapshot.datasets.dashboard && <section className="card"><Missing>Connect to load dashboard statistics for your account.</Missing></section>}{session.grants.timetable && <TimetableFeed snapshot={snapshot} timeZone={session.timeZone} />}<div className="grid">{session.grants.pupils && <section className="card"><h2>Pupil details</h2><p className="muted">Find pupil records.</p><button onClick={() => navigate('pupils')}>Open pupils</button></section>}{session.grants.timetable && <section className="card"><h2>Timetable</h2><p className="muted">View all class lessons and full schedules.</p><button onClick={() => navigate('timetable')}>Open timetable</button></section>}</div><section className="card"><h2>Other dashboard cards</h2><Missing>Connect to view attendance charts and the school calendar.</Missing></section></>}</>;
}

function App() {
  const [snapshot, setSnapshot] = useState<AndroidOfflineSnapshot>();
  const [session, setSession] = useState<AndroidOfflineSession>();
  const [available, setAvailable] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const route = new URLSearchParams(location.search);
  const initial = route.get('page') || 'dashboard';
  const [page, setPage] = useState(initial);
  const [pupilId, setPupilId] = useState(route.get('pupilId') || '');
  const navigate = (next: string) => { setPage(next); setPupilId(''); history.pushState({ page: next, pupilId: '' }, '', `?page=${next}`); window.scrollTo(0, 0); };
  useEffect(() => {
    const handle = (event: PopStateEvent) => { const params = new URLSearchParams(location.search); setPage(params.get('page') || 'dashboard'); setPupilId(params.get('pupilId') || ''); };
    window.addEventListener('popstate', handle);
    void androidOfflineRequest('status').then(reply => setAvailable(Boolean((reply as SavedReply).available))).catch(() => setAvailable(false));
    const lock = () => { setSnapshot(undefined); setSession(undefined); };
    window.addEventListener('trinity-offline-locked', lock);
    return () => { window.removeEventListener('popstate', handle); window.removeEventListener('trinity-offline-locked', lock); };
  }, []);
  const unlock = async () => {
    setBusy(true); setError('');
    try {
      const reply = await androidOfflineRequest('unlock') as SavedReply;
      if (!reply.snapshot || !reply.session) throw new Error('Connect and sign in to load your school information.');
      setSnapshot(reply.snapshot); setSession(reply.session);
      if (initial === 'timetable' && !reply.session.grants.timetable) setPage('dashboard');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not open school information.'); }
    finally { setBusy(false); }
  };
  const selectPupil = (id: string) => { setPupilId(id); history.pushState({ page: 'pupils', pupilId: id }, '', `?page=pupils${id ? `&pupilId=${encodeURIComponent(id)}` : ''}`); window.scrollTo(0, 0); };
  return <><header><span className="brand">{__ANDROID_APP_NAME__}</span><button onClick={() => void androidOfflineRequest('openOnline').catch(failure => setError(failure.message))}>Refresh</button></header><main className="shell">
    {snapshot && session ? <><div className="row" style={{ marginBottom: 16 }}><span className="pill">{session.role}</span><button onClick={() => void androidOfflineRequest('lock').then(() => { setSnapshot(undefined); setSession(undefined); })}>Lock</button></div>{page === 'pupils' ? <Pupils snapshot={snapshot} selectedId={pupilId} select={selectPupil} /> : page === 'timetable' ? <Timetable snapshot={snapshot} /> : <Dashboard snapshot={snapshot} session={session} navigate={navigate} />}</> : <section className="card" style={{ marginTop: 24 }}><h1>{__ANDROID_APP_NAME__}</h1><p className="muted">Unlock to continue.</p>{available === undefined ? <p className="loading">Loading...</p> : available ? <button className="primary" disabled={busy} onClick={() => void unlock()}>{busy ? 'Opening…' : 'Unlock'}</button> : <Missing>Connect and sign in to load your school information.</Missing>}</section>}
    {error && <p className="error" role="alert">{error}</p>}
  </main>{snapshot && session && <nav aria-label="Application"><button aria-current={page === 'dashboard' ? 'page' : undefined} onClick={() => navigate('dashboard')}>Dashboard</button>{(session.grants.pupils || session.role === 'Parent') && <button aria-current={page === 'pupils' ? 'page' : undefined} onClick={() => navigate('pupils')}>{session.role === 'Parent' ? 'My children' : 'Pupils'}</button>}{session.grants.timetable && <button aria-current={page === 'timetable' ? 'page' : undefined} onClick={() => navigate('timetable')}>Timetable</button>}</nav>}</>;
}

createRoot(document.getElementById('root')!).render(<App />);
