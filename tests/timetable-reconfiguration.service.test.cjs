const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { build } = require('esbuild');
const { initializeApp, deleteApp } = require('firebase/app');
const sdk = require('firebase/firestore');

// Validate writes with the real Firebase serializer, but never contact a server.
async function fixture(t) {
    const app = initializeApp({ projectId: 'demo-timetable-reconfiguration', apiKey: 'test' }, t.name);
    t.after(() => deleteApp(app));
    const db = sdk.getFirestore(app);
    const prefix = 'academicYears/year/terms/term/timetables/main';
    const state = {
        commits: [], failCommit: false,
        docs: {
            [prefix]: { name: 'Existing', classIds: ['p1'], createdAt: 'original' },
            [prefix + '/periods/lesson']: { dayOfWeek: 1, type: 'lesson', periodNumber: 1, startTime: '08:00', endTime: '09:00' },
            [prefix + '/periods/break']: { dayOfWeek: 1, type: 'break', periodNumber: 0, startTime: '09:00', endTime: '09:30', customLabel: 'BREAK' },
            [prefix + '/entries/math']: { classId: 'p1', periodId: 'lesson', subjectId: 'math', teacherId: 'teacher' },
        },
    };
    const firestore = `
        export const {collection,doc,Timestamp,FieldPath,deleteField}=sdk;
        export const getDocs=async ref=>{
            const docs=Object.entries(state.docs).filter(([key])=>key.startsWith(ref.path+'/')&&!key.slice(ref.path.length+1).includes('/'))
                .map(([key,value])=>({ref:sdk.doc(database,key),id:key.split('/').pop(),data:()=>value}));
            return {docs,size:docs.length};
        };
        export const getDocsFromServer=getDocs;
        export const getDoc=()=>{},getDocFromServer=getDoc,addDoc=getDoc,query=getDoc,orderBy=getDoc,where=getDoc,runTransaction=getDoc;
        export function writeBatch(){
            const native=sdk.writeBatch(database),ops=[];
            return {
                update(ref,value){native.update(ref,value);ops.push(['update',ref.path,value]);},
                set(ref,value,options){options?native.set(ref,value,options):native.set(ref,value);ops.push(['set',ref.path,value,options]);},
                delete(ref){native.delete(ref);ops.push(['delete',ref.path]);},
                async commit(){
                    if(state.failCommit)throw Error('Commit failed');
                    state.commits.push(ops);
                    for(const [kind,key,value,options]of ops){
                        if(kind==='delete')delete state.docs[key];
                        else state.docs[key]=kind==='update'||options?.merge?{...state.docs[key],...value}:value;
                    }
                },
            };
        }
    `;
    const mocks = {
        '@/lib/access/scoped-firestore': firestore,
        '../firebase': 'export const db=database;',
        './dashboard-cache-revisions.service': `export const dashboardRevisionKeys={};export const bumpTimetableRevisionInBatch=(batch)=>batch.set(sdk.doc(database,'settings/revision'),{revision:1});`,
        './dashboard-revision-documents': 'export const dashboardRevisionDocumentRef=()=>{};',
    };
    const built = await build({
        entryPoints: [path.resolve('src/lib/services/timetable.service.ts')], bundle: true,
        platform: 'node', format: 'cjs', write: false, alias: { '@': path.resolve('src') },
        plugins: [{ name: 'firebase-validation', setup(build) {
            build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined);
            build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path] }));
        } }],
    });
    const module = { exports: {} };
    new Function('sdk', 'database', 'state', 'module', 'exports', built.outputFiles[0].text)(sdk, db, state, module, module.exports);
    return { state, prefix, service: module.exports.TimetableService };
}

const profile = {
    name: 'Reconfigured', classIds: ['p1'], timeFormat: '12h', createdBy: undefined,
    timeBlocks: [
        { id: '1', type: 'lessons', count: 1, duration: undefined, label: 'Lessons', blockDuration: undefined, individualDurations: undefined },
        { id: '2', type: 'break', count: undefined, duration: 20, label: 'BREAK', blockDuration: undefined },
    ],
    streamLayouts: { p1: { defaultMode: 'consolidated', dayModes: undefined } },
};
const periods = [
    { dayOfWeek: 1, type: 'lesson', periodNumber: 1, startTime: '08:00', endTime: '09:00', customLabel: undefined },
    { dayOfWeek: 1, type: 'break', periodNumber: 0, startTime: '09:00', endTime: '09:20', customLabel: 'BREAK' },
];

test('reconfigures reopened optional settings using Firebase-valid writes and preserves lesson links', async t => {
    const { state, prefix, service } = await fixture(t);
    const entry = structuredClone(state.docs[prefix + '/entries/math']);
    await service.updateTimetable('year', 'term', 'main', profile, periods);
    assert.equal(state.commits.length, 1);
    const saved = state.docs[prefix];
    assert.equal(saved.name, 'Reconfigured');
    assert.equal(saved.createdAt, 'original');
    assert.equal('createdBy' in saved, false);
    assert.deepEqual(saved.timeBlocks, [
        { id: '1', type: 'lessons', count: 1, label: 'Lessons' },
        { id: '2', type: 'break', duration: 20, label: 'BREAK' },
    ]);
    assert.deepEqual(saved.streamLayouts, { p1: { defaultMode: 'consolidated' } });
    assert.equal(state.docs[prefix + '/periods/break'].endTime, '09:20');
    assert.ok(state.docs[prefix + '/periods/break'].updatedAt instanceof sdk.Timestamp);
    assert.deepEqual(state.docs[prefix + '/entries/math'], entry);
    assert.ok(state.docs[prefix + '/periods/' + entry.periodId]);
    assert.deepEqual(state.docs['settings/revision'], { revision: 1 });
    assert.equal('duration' in profile.timeBlocks[0], true, 'Input is not mutated');
});

test('a failed reconfiguration commits neither settings, periods nor the revision', async t => {
    const { state, service } = await fixture(t);
    const before = structuredClone(state.docs);
    state.failCommit = true;
    await assert.rejects(service.updateTimetable('year', 'term', 'main', profile, periods), /Commit failed/);
    assert.equal(state.commits.length, 0);
    assert.deepEqual(state.docs, before);
});
