import assert from 'node:assert/strict';
import test from 'node:test';

import { progressiveFeesProcessingKey } from '@/lib/hooks/use-progressive-fees';

const fees = [{
  id: 'tuition', amount: 500, academicYearId: 'year-1', termId: 'term-1', classIds: ['class-1'],
}] as any;

test('progressive fee processing distinguishes same-sized classes', () => {
  const classOne = [{ id: 'pupil-1', classId: 'class-1', section: 'Day', assignedFees: [] }] as any;
  const classTwo = [{ id: 'pupil-2', classId: 'class-2', section: 'Day', assignedFees: [] }] as any;

  assert.notEqual(
    progressiveFeesProcessingKey('legacy', 'year-1', 'term-1', classOne, fees),
    progressiveFeesProcessingKey('legacy', 'year-1', 'term-1', classTwo, fees),
  );
});

test('progressive fee processing changes when a fee is edited without changing catalog size', () => {
  const pupils = [{ id: 'pupil-1', classId: 'class-1', section: 'Day', assignedFees: [] }] as any;
  const before = progressiveFeesProcessingKey('legacy', 'year-1', 'term-1', pupils, fees);
  const after = progressiveFeesProcessingKey('legacy', 'year-1', 'term-1', pupils, [{ ...fees[0], amount: 550 }] as any);

  assert.notEqual(before, after);
});
