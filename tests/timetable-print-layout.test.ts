import assert from 'node:assert/strict';
import test from 'node:test';
import type { Class, GeneratedPeriod, TimetableEntry, TimetableProfile } from '../src/types';
import { buildTimetablePrintDayCells, fitTimetablePrintText, layoutTimetablePrintText, type TimetablePrintCell } from '../src/lib/utils/timetable-print-layout';
import type { TimetableClassRow } from '../src/lib/utils/timetable-streams';

const classes = [1, 2, 3].map(n => ({ id: `p${n}`, name: `Primary ${n}`, code: `P.${n}` } as Class));
const rows = classes.map(classItem => ({ classItem, streamIndex: 0, streamCount: 1 }));
const periods = [1, 2, 3, 4].map(n => ({ id: `p-${n}`, dayOfWeek: 5, periodNumber: n, type: 'lesson', startTime: '08:00', endTime: '09:00' } as GeneratedPeriod));
const entry = (data: Partial<TimetableEntry>) => ({ id: 'entry', classId: 'p1', periodId: 'p-1', subjectId: 'eng', teacherId: '', createdAt: '', ...data });

function assertExactCoverage(plan: TimetablePrintCell[][], columnCount: number) {
    const occupied = plan.map(() => Array(columnCount).fill(false));
    plan.forEach((cells, rowIndex) => cells.forEach(cell => {
        assert.ok(rowIndex + cell.rowSpan <= plan.length);
        assert.ok(cell.periodIndex + cell.colSpan <= columnCount, 'No trailing column');
        for (let r = rowIndex; r < rowIndex + cell.rowSpan; r++) {
            for (let c = cell.periodIndex; c < cell.periodIndex + cell.colSpan; c++) {
                assert.equal(occupied[r][c], false, `Slot ${r},${c} must not be emitted twice`);
                occupied[r][c] = true;
            }
        }
    }));
    assert.ok(occupied.every(row => row.every(Boolean)), 'Every real column is occupied exactly once');
}

test('a four-slot Prayers activity suppresses both covered columns on the next class row', () => {
    const plan = buildTimetablePrintDayCells(rows, periods, periods, [entry({ entryType: 'activity', activityName: 'PRAYERS', linkedClassIds: ['p2'], periodSpan: 2 })], 5);
    assert.equal(plan[0][0].rowSpan, 2);
    assert.equal(plan[0][0].colSpan, 2);
    assert.deepEqual(plan[1].map(cell => cell.periodIndex), [2, 3]);
    assertExactCoverage(plan, 4);
});

test('a double consolidated lesson on separated stream rows emits no duplicate covered column', () => {
    const streams = ['A', 'S'].map(id => ({ id, name: id, code: id, createdAt: '' }));
    const streamRows: TimetableClassRow[] = streams.map((stream, streamIndex) => ({ classItem: classes[0], stream, streamIndex, streamCount: 2 }));
    const profile = { streamLayouts: { p1: { defaultMode: 'separate', periodModes: { 'p-1': 'consolidated', 'p-2': 'consolidated' } } } } as Pick<TimetableProfile, 'streamLayouts'>;
    const plan = buildTimetablePrintDayCells(streamRows, periods, periods, [entry({ periodSpan: 2 })], 5, profile);
    assert.deepEqual(plan[1].map(cell => cell.periodIndex), [2, 3]);
    assertExactCoverage(plan, 4);
});

test('last-column spans stay inside the actual header columns', () => {
    const plan = buildTimetablePrintDayCells(rows, periods, periods, [entry({ periodId: 'p-4', periodSpan: 10, entryType: 'activity', linkedClassIds: ['p2'] })], 5);
    assert.equal(plan[0].at(-1)?.colSpan, 1);
    assertExactCoverage(plan, 4);
});

test('grouped activity spans stop at a break and preserve the following lessons', () => {
    const withBreak = periods.map(p => p.periodNumber === 2 ? { ...p, type: 'break' as const } : p);
    const plan = buildTimetablePrintDayCells(rows, withBreak, withBreak, [entry({ entryType: 'activity', linkedClassIds: ['p2'], periodSpan: 4 })], 5);
    assert.equal(plan[0][0].colSpan, 1);
    assert.deepEqual(plan[1].map(cell => cell.periodIndex), [2, 3]);
});

test('non-adjacent linked classes never merge over an unrelated class', () => {
    const plan = buildTimetablePrintDayCells(rows, periods, periods, [entry({ entryType: 'activity', linkedClassIds: ['p3'], periodSpan: 2 })], 5);
    assert.equal(plan[0][0].rowSpan, 1);
    assert.equal(plan[1][0].entry, undefined);
    assert.equal(plan[2][0].entry?.entryType, 'activity');
    assertExactCoverage(plan, 4);
});

const measure = (text: string) => ({ width: text.length * 60, height: 75 });
test('long labels use spare height while staying within the cell text bounds', () => {
    const text = 'Integrated Science and Health Education';
    const layout = layoutTimetablePrintText(text, 90, 250, measure);
    assert.ok(layout.lines.length > 1);
    assert.equal(layout.lines.join(' '), text);
    assert.ok(layout.fontSize > fitTimetablePrintText([text], 90, 250, measure));
    assert.ok(Math.max(...layout.lines.map(line => measure(line).width)) * layout.fontSize / 100 <= 90 * 0.75);
    assert.ok(((layout.lines.length - 1) * 100 + 75) * layout.fontSize / 100 <= 250 * 0.75);
    assert.deepEqual(layoutTimetablePrintText('PRAYERS', 180, 60, measure).lines, ['PRAYERS']);
});
test('each label fits its own dimensions with one quarter reserved as whitespace', () => {
    const short = fitTimetablePrintText(['SCI'], 90, 30, measure);
    assert.equal(short, 19.5);
    const long = fitTimetablePrintText(['INTEGRATED SCIENCE'], 90, 30, measure);
    assert.ok(long < short);
    const activity = fitTimetablePrintText(['PRAYERS'], 180, 60, measure);
    assert.ok(activity > short, 'Merged activity grows independently of ordinary lessons');
    assert.ok(activity * measure('PRAYERS').width / 100 <= 180 * 0.75);
    assert.ok(activity * measure('PRAYERS').height / 100 <= 60 * 0.75);
});

test('dense rows reserve clearance for the complete line box rather than only capital-letter ink', () => {
    for (const height of [10, 12, 27, 54]) {
        const fontSize = fitTimetablePrintText(['SCI'], 90, height, measure);
        const lineHeight = fontSize * 1.15;
        assert.ok(lineHeight <= height - 2 * Math.max(2, height * 0.125));
        assert.ok((height - lineHeight) / 2 >= 2);
    }
});

test('rotated day labels and stacked breaks fit their respective axes', () => {
    const rotated = fitTimetablePrintText(['MON'], 65, 150, measure, 'rotated');
    assert.ok(rotated * measure('MON').width / 100 <= 150 * 0.75);
    assert.ok(rotated * measure('MON').height / 100 <= 65 * 0.75);
    const vertical = fitTimetablePrintText(Array.from('BREAK'), 64, 800, measure, 'vertical');
    assert.ok(vertical * 60 / 100 <= 64 * 0.75);
    assert.ok(vertical * 75 * 5 / 100 <= 800 * 0.75);
});
