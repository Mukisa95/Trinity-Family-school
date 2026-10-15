import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const page = 'src/app/exams/[examId]/page.tsx';
const output = ts.transpileModule(fs.readFileSync(page, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

for (const query of [{}, { classId: 'primary four', streamId: 'stream/1', openPrint: '1' }]) {
  test('existing bare exam links redirect to the results route and preserve academic context: ' + JSON.stringify(query), async () => {
    let destination = '';
    const module = { exports: {} as { default?: (props: unknown) => Promise<void> } };
    vm.runInNewContext(output, {
      module, exports: module.exports, URLSearchParams,
      require: (name: string) => {
        assert.equal(name, 'next/navigation');
        return { redirect: (url: string) => { destination = url; } };
      },
    });
    await module.exports.default!({
      params: Promise.resolve({ examId: '4MullFSBVOKgzFUndxTe' }),
      searchParams: Promise.resolve(query),
    });
    const url = new URL(destination, 'https://fixture.invalid');
    assert.equal(url.pathname, '/exams/4MullFSBVOKgzFUndxTe/view-results');
    assert.deepEqual(Object.fromEntries(url.searchParams), query);
    assert.ok(fs.existsSync('src/app/exams/[examId]/view-results/page.tsx'), 'The destination must be a real app route');
  });
}
