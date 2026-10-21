import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROMOTION_RANKING, isTermThree, isValidPromotionRanking, reportPromotionRanking } from '../src/lib/utils/promotion-ranking';

test('ranking recognises Term 3 names without treating any incidental digit 3 as the term', () => {
  for (const term of ['Term 3', 'TERM THREE', '3 (Three)', 'TERM III', 'Third Term']) assert.equal(isTermThree(term), true, term);
  for (const term of ['TERM 1', 'TERM 2', 'Term 2 - 3 months', 'TERM 30', '', undefined]) assert.equal(isTermThree(term), false, term);
});
test('only an enabled valid Term 3 ranking produces a promotion label', () => {
  const config = structuredClone(DEFAULT_PROMOTION_RANKING);
  assert.equal(reportPromotionRanking('TERM 3', 8, config, 'P.7'), 'PROMOTED');
  assert.equal(reportPromotionRanking('TERM 3', 28, config, 'P.7'), 'PROMOTED ON PROBATION');
  assert.equal(reportPromotionRanking('TERM 3', 34, config, 'P.7'), 'ADVISED TO REPEAT P.7');
  assert.equal(reportPromotionRanking('TERM 2', 8, config, 'P.7'), null);
  assert.equal(reportPromotionRanking('TERM 3', 8, { ...config, enabled: false }), null);
  config.ranges.promoted.max = 30;
  assert.equal(isValidPromotionRanking(config), false); assert.equal(reportPromotionRanking('TERM 3', 8, config), null);
});
