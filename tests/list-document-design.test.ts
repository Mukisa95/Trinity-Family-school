import assert from 'node:assert/strict';
import test from 'node:test';
import { listDocumentStyles, listSchoolHeading } from '@/lib/printing/list-document-theme';
import { listDocumentHeaderHTML } from '@/lib/printing/list-document-html';

test('list styling preserves column layout and keeps accumulated header overrides', () => {
  const original = { page: { fontSize: 9 }, tableColHeader: { width: '30%', backgroundColor: '#123456', padding: 8 }, tableRowAlt: { minHeight: 22, backgroundColor: '#fff', borderBottom: '1 solid #aaa' }, tableCell: { fontSize: 12 } };
  const saved = structuredClone(original);
  const styled = listDocumentStyles(original);
  assert.deepEqual(original, saved);
  assert.equal(styled.page.fontSize, 11.3);
  assert.equal(styled.tableColHeader.width, '30%');
  assert.equal(styled.tableColHeader.backgroundColor, '#222222');
  assert.equal(styled.tableColHeader.padding, 5);
  assert.equal(styled.tableRowAlt.minHeight, 22);
  assert.equal(styled.tableRowAlt.backgroundColor, '#f1f2f3');
  assert.equal(styled.tableRowAlt.borderBottom, '0.3 solid #dddddd');
});

test('list mastheads share school identity and escape inserted HTML content', () => {
  for (const name of ['Trinity Family Schools', 'TRINITY FAMILY NURSERY AND PRIMARY SCHOOL']) {
    assert.deepEqual(listSchoolHeading(name), { name: 'TRINITY FAMILY', subtitle: 'NURSERY AND PRIMARY SCHOOL' });
  }
  assert.deepEqual(listSchoolHeading('Example Primary School'), { name: 'EXAMPLE', subtitle: 'PRIMARY SCHOOL' });
  const html = listDocumentHeaderHTML({ schoolName: 'Trinity Family School', title: 'Pupils List', context: 'P.7 <A> & B', date: 'Term 3', count: '79 PUPILS' });
  assert.ok(html.includes('PUPILS LIST') && html.includes('79 PUPILS'));
  assert.ok(html.includes('P.7 &lt;A&gt; &amp; B'));
  assert.ok(!html.includes('<A>'));
});
