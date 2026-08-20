import assert from 'node:assert/strict';
import test from 'node:test';

import type { CommentTemplate } from '../src/types';
import {
  getApplicableSubjectComments,
  getCanonicalTermTemplateId,
  getTermAliases,
} from '../src/lib/utils/subject-comment-availability';

const template = (
  id: string,
  overrides: Partial<CommentTemplate> = {},
): CommentTemplate => ({
  id,
  type: 'subject',
  subject: 'reading',
  subjectStatus: 'good',
  comment: `Comment ${id}`,
  isActive: true,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  ...overrides,
});

test('normalizes a selected term name to the canonical comment-template term', () => {
  assert.equal(getCanonicalTermTemplateId('random-firestore-id', 'Term 2'), 'term_2');
  assert.deepEqual(
    new Set(getTermAliases('random-firestore-id', 'Term 2')),
    new Set(['random-firestore-id', 'Term 2', 'term_2', 'term2', 't2']),
  );
});

test('uses class-specific comments in preference to general comments', () => {
  const comments = getApplicableSubjectComments(
    [template('general'), template('class-a', { classId: 'class-a' })],
    'reading',
    'good',
    'class-a',
    ['term_1'],
  );

  assert.deepEqual(comments.map(comment => comment.id), ['class-a']);
});

test('falls back to general comments when the selected class has none', () => {
  const comments = getApplicableSubjectComments(
    [template('general'), template('another-class', { classId: 'class-b' })],
    'reading',
    'good',
    'class-a',
    ['term_1'],
  );

  assert.deepEqual(comments.map(comment => comment.id), ['general']);
});

test('excludes inactive, wrong-term, wrong-subject, and wrong-status comments', () => {
  const comments = getApplicableSubjectComments(
    [
      template('valid', { applicableTerms: ['term_1'] }),
      template('inactive', { isActive: false }),
      template('wrong-term', { applicableTerms: ['term_2'] }),
      template('wrong-subject', { subject: 'writing_concepts' }),
      template('wrong-status', { subjectStatus: 'weak' }),
    ],
    'reading',
    'good',
    'class-a',
    ['term_1', 'term1', 't1'],
  );

  assert.deepEqual(comments.map(comment => comment.id), ['valid']);
});

test('treats all-term and legacy comments without applicability as available', () => {
  const comments = getApplicableSubjectComments(
    [
      template('all', { applicableTerms: ['all'] }),
      template('legacy', { applicableTerms: undefined }),
    ],
    'reading',
    'good',
    'class-a',
    ['term_3'],
  );

  assert.deepEqual(comments.map(comment => comment.id), ['all', 'legacy']);
});
