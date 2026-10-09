import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getTimetablePeriodWidth } from '../src/lib/utils/timetable-density';

test('mobile lessons fit more columns while retaining proportional durations', () => {
    assert.equal(getTimetablePeriodWidth(40, 1, true), 48);
    assert.equal(getTimetablePeriodWidth(60, 1, true), 72);
    assert.equal(getTimetablePeriodWidth(40, 1, false), 72);
    assert.equal(getTimetablePeriodWidth(60, 1, false), 108);
});

test('pinch zoom scales both densities with a readable minimum for short blocks', () => {
    assert.equal(getTimetablePeriodWidth(40, 2, true), 96);
    assert.equal(getTimetablePeriodWidth(40, 2, false), 144);
    assert.equal(getTimetablePeriodWidth(15, 0.5, true), 40);
});

test('invalid period durations retain a valid fallback column', () => {
    for (const duration of [0, -20, NaN, Infinity]) {
        assert.equal(getTimetablePeriodWidth(duration, 1, true), 48);
        assert.equal(getTimetablePeriodWidth(duration, 1, false), 72);
    }
});
