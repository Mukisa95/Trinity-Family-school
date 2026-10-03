import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

function compile(file: string) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
}

function elements(root: any): React.ReactElement<any>[] {
  if (Array.isArray(root)) return root.flatMap(elements);
  return React.isValidElement(root) ? [root, ...elements((root.props as any).children)] : [];
}

function fixture() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let reads = 0;
  let price = 30000;
  const subscriptions: Array<() => void> = [];
  const catalogueModule = { exports: {} as any };
  vm.runInNewContext(compile('src/lib/hooks/use-uniforms.ts'), {
    module: catalogueModule, exports: catalogueModule.exports,
    require(name: string) {
      if (name === '@tanstack/react-query') return { useQueryClient: () => client, useQuery: (options: any) => options };
      if (name === '../services/uniforms.service') return { UniformsService: { getAllUniforms: async () => {
        reads++;
        return [{ id: 'shirt', name: 'SHIRT', group: 'Shirts', price, isActive: true }];
      } } };
      throw new Error(name);
    },
  });
  const pageObserver = new QueryObserver(client, catalogueModule.exports.useUniforms());
  const unsubscribePage = pageObserver.subscribe(() => {});
  const cardModule = { exports: {} as any };
  vm.runInNewContext(compile('src/app/fees/collect/[id]/components/FeeCard.tsx'), {
    module: cardModule, exports: cardModule.exports, console, Intl,
    require(name: string) {
      if (name === 'react') return { ...React, useState: (initial: unknown) => [initial, () => {}], useMemo: (compute: () => unknown) => compute() };
      if (name === 'react/jsx-runtime') return require('react/jsx-runtime');
      if (name === '@tanstack/react-query') return { useQueryClient: () => client };
      if (name === '@/lib/hooks/use-uniforms') return { useUniforms: () => {
        const observer = new QueryObserver(client, catalogueModule.exports.useUniforms());
        subscriptions.push(observer.subscribe(() => {}));
        return observer.getCurrentResult();
      } };
      if (name === '@/lib/services/uniform-fees-integration.service') return { UniformFeesIntegrationService: { isUniformFee: (fee: any) => !!fee.uniformTrackingId } };
      if (name === '../utils/uniformCollectionState') return { getCollectedUniformItemIds: (record: any) => record.collectedItems || [] };
      if (name === '@/lib/hooks/use-uniform-inventory') return {
        useUniformInventory: () => ({ data: [] }), useIncrementStockBatch: () => ({ mutateAsync: async () => {} }),
      };
      if (name === '@/lib/hooks/use-uniform-tracking') return { useUpdateUniformTracking: () => ({ mutateAsync: async () => {} }) };
      if (name === '@/lib/hooks/use-school-settings') return { useSchoolSettings: () => ({ data: null }) };
      if (name === '@/lib/hooks/use-staff') return { useStaffById: () => ({ data: null }) };
      if (name === '@/lib/hooks/use-pdf-viewer') return { usePDFViewer: () => ({}) };
      if (name === '@/hooks/use-toast') return { useToast: () => ({ toast() {} }) };
      return new Proxy({}, { get: (_, key: string) => key === '__esModule' ? false : key });
    },
  });
  return {
    getReads: () => reads,
    setPrice: (value: number) => { price = value; },
    refresh: () => pageObserver.refetch(),
    renderCard(index: number) {
      return cardModule.exports.FeeCard({
        fee: { id: `fee-${index}`, name: 'Uniform - SHIRT', amount: price, paid: 0, balance: price, payments: [], category: 'Uniform', uniformTrackingId: 'tracking' },
        pupil: { id: 'pupil', firstName: 'Test', lastName: 'Pupil' },
        onPayment() {}, selectedTerm: 'term', selectedAcademicYear: null,
        uniformTrackingRecord: { id: 'tracking', uniformId: 'shirt', selectionMode: 'item', collectionStatus: 'pending', collectedItems: [] },
        allUniforms: client.getQueryData(['uniforms']),
      });
    },
    unmountCards() { subscriptions.splice(0).forEach(unsubscribe => unsubscribe()); },
    cleanup() { subscriptions.splice(0).forEach(unsubscribe => unsubscribe()); unsubscribePage(); client.clear(); },
  };
}

test('mounting and remounting fee cards cannot trigger a catalogue refresh/loading loop', async () => {
  const subject = fixture();
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(subject.getReads(), 1, 'Opening the page must still read live uniform data');
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let card = 0; card < 4; card++) subject.renderCard(card);
      await new Promise<void>(resolve => setImmediate(resolve));
      subject.unmountCards();
    }
    assert.equal(subject.getReads(), 1, 'Fee cards must consume page data without refreshing the shared query');
  } finally {
    subject.cleanup();
  }
});

test('a page refresh supplies current uniforms to the fee card collection dialog', async () => {
  const subject = fixture();
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    subject.setPrice(40000);
    await subject.refresh();
    const modal = elements(subject.renderCard(0)).find(element => element.type === 'CollectionModal');
    assert.ok(modal);
    assert.equal(modal.props.uniforms[0].price, 40000);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(subject.getReads(), 2, 'Refreshing the page data must not be followed by a card-triggered fetch');
  } finally {
    subject.cleanup();
  }
});
