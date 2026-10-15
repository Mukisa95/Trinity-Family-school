const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { build } = require('esbuild');

async function fixture() {
    const state = {
        reads: [], writes: [], bumps: [],
        profile: { classIds: ['p7'], streamLayouts: {
            p7: { defaultMode: 'separate', dayModes: { '2': 'consolidated' }, periodModes: { lesson1: 'separate' } },
            p6: { defaultMode: 'consolidated' },
        } },
        schoolClass: { streams: [{ id: 'a' }, { id: 's' }], streamConfigurations: [
            { academicYearId: '2026', enabled: true, activeStreamIds: ['a', 's'] },
        ] },
    };
    const firestore = `
        export const doc=(_db,...parts)=>parts.join('/');
        export class FieldPath{constructor(...parts){this.parts=parts}}
        export const Timestamp={now:()=> 'now'};
        export const runTransaction=async(_db,fn)=>fn({
            get:async ref=>{state.reads.push(ref);const data=ref.startsWith('classes/')?state.schoolClass:state.profile;return {exists:()=>!!data,data:()=>data}},
            update:(...args)=>state.writes.push(args),
        });
        export const collection=()=>{throw Error('Unexpected collection access')};
        export const getDocs=collection,getDoc=collection,getDocFromServer=collection,addDoc=collection,query=collection,orderBy=collection,where=collection,writeBatch=collection,deleteField=collection;
    `;
    const built = await build({
        entryPoints: [path.resolve('src/lib/services/timetable.service.ts')], bundle: true,
        platform: 'node', format: 'cjs', write: false, alias: { '@': path.resolve('src') },
        plugins: [{ name: 'boundaries', setup(build) {
            build.onResolve({ filter: /firebase|dashboard-cache-revisions.service/ }, args => {
                if (args.path === 'firebase/firestore') return { path: 'firestore', namespace: 'mock' };
                if (args.path === '../firebase') return { path: 'firebase', namespace: 'mock' };
                if (args.path === './dashboard-cache-revisions.service') return { path: 'revision', namespace: 'mock' };
            });
            build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents:
                args.path === 'firestore' ? firestore : args.path === 'firebase' ? 'export const db={};' :
                    'export const bumpTimetableRevisionInBatch=(transaction,year,term)=>state.bumps.push({transaction,year,term});',
            }));
        } }],
    });
    const module = { exports: {} };
    new Function('state', 'module', 'exports', built.outputFiles[0].text)(state, module, module.exports);
    return { state, service: module.exports.TimetableService };
}

test('arranging streams writes only latest class layout and publishes one revision', async () => {
    const { state, service } = await fixture();
    const before = structuredClone(state.profile);
    const result = await service.setClassStreamOrder('2026', 'term3', 'main', 'p7', ['s', 'a']);
    assert.deepEqual(result, ['s', 'a']);
    assert.deepEqual(state.reads, ['academicYears/2026/terms/term3/timetables/main', 'classes/p7']);
    assert.equal(state.writes.length, 1);
    const [ref, field, layout, timestampField, timestamp] = state.writes[0];
    assert.equal(ref, state.reads[0]);
    assert.deepEqual(field.parts, ['streamLayouts', 'p7']);
    assert.deepEqual(layout, { ...before.streamLayouts.p7, streamOrder: ['s', 'a'] });
    assert.equal(timestampField, 'updatedAt'); assert.equal(timestamp, 'now');
    assert.equal(state.bumps.length, 1);
    assert.equal(state.bumps[0].year, '2026'); assert.equal(state.bumps[0].term, 'term3');
    assert.deepEqual(state.profile, before, 'No other class, stream definition or entry is mutated');
});

for (const [name, order] of [['duplicate', ['a', 'a']], ['missing', ['a']], ['unknown', ['s', 'deleted']]]) {
    test(`rejects ${name} stream IDs before writing`, async () => {
        const { state, service } = await fixture();
        await assert.rejects(() => service.setClassStreamOrder('2026', 'term3', 'main', 'p7', order), /active streams have changed/);
        assert.equal(state.writes.length, 0); assert.equal(state.bumps.length, 0);
    });
}

test('rejects a class outside the timetable and missing documents', async () => {
    const { state, service } = await fixture();
    state.profile.classIds = ['p6'];
    await assert.rejects(() => service.setClassStreamOrder('2026', 'term3', 'main', 'p7', ['s', 'a']), /not in this timetable/);
    state.profile = null;
    await assert.rejects(() => service.setClassStreamOrder('2026', 'term3', 'main', 'p7', ['s', 'a']), /Timetable not found/);
    assert.equal(state.writes.length, 0); assert.equal(state.bumps.length, 0);
});
