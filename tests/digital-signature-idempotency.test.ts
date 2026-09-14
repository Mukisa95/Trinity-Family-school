import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

type StoredDocument = Record<string, unknown>;

function loadSignatureService() {
  const documents = new Map<string, StoredDocument>();
  const db = { name: 'db' };
  let generatedId = 0;
  const firestore = {
    Timestamp: { now: () => ({ kind: 'timestamp' }) },
    collection: (_db: unknown, collectionName: string) => ({ collectionName }),
    doc: (...args: Array<unknown>) => {
      if (args.length === 1 && typeof args[0] === 'object' && args[0] && 'collectionName' in args[0]) {
        generatedId += 1;
        const collectionName = (args[0] as { collectionName: string }).collectionName;
        return { path: `${collectionName}/generated-${generatedId}`, id: `generated-${generatedId}` };
      }
      const [, collectionName, documentId] = args as [unknown, string, string];
      return { path: `${collectionName}/${documentId}`, id: documentId };
    },
    serverTimestamp: () => ({ kind: 'server-timestamp' }),
    runTransaction: async (_db: unknown, callback: (transaction: {
      get: (ref: { path: string }) => Promise<{ exists: () => boolean; data: () => StoredDocument }>;
      set: (ref: { path: string }, value: StoredDocument) => void;
    }) => Promise<unknown>) => {
      const staged = new Map<string, StoredDocument>();
      const result = await callback({
        get: async ref => ({
          exists: () => documents.has(ref.path),
          data: () => documents.get(ref.path) || {},
        }),
        set: (ref, value) => {
          assert.ok(Object.values(value).every(item => item !== undefined), 'Firestore rejects undefined fields');
          staged.set(ref.path, value);
        },
      });
      staged.forEach((value, key) => documents.set(key, value));
      return result;
    },
    writeBatch: () => ({ set() {}, commit: async () => {} }),
    getDocs: async () => ({ docs: [], empty: true }),
    query: () => ({}),
    where: () => ({}),
    orderBy: () => ({}),
  };

  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/services/digital-signature.service.ts'),
    'utf8',
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require(name: string) {
      if (name === 'firebase/firestore') return firestore;
      if (name === '../firebase') return { db };
      if (name === '../contexts/auth-context') return { useAuth: () => ({ user: null }) };
      throw new Error(`Unexpected import: ${name}`);
    },
    console: { error() {} },
    Date,
  }, { filename: 'digital-signature.service.ts' });

  return {
    DigitalSignatureService: module.exports.DigitalSignatureService as {
      createSignature: (
        user: Record<string, unknown>,
        data: Record<string, unknown>,
        additionalMetadata?: Record<string, unknown>,
        idempotencyKey?: string,
      ) => Promise<{ id: string }>;
    },
    documents,
  };
}

const user = {
  id: 'cashier-1', firstName: 'Amina', lastName: 'Kato', username: 'amina', role: 'cashier',
};

const paymentSignature = (recordId = 'payment-1') => ({
  recordType: 'fee_payment', recordId, action: 'collected', description: 'Payment collected',
  metadata: { amount: 5000, paymentMethod: 'cash' },
});

test('a retried confirmed payment reuses its signature and paired audit record', async () => {
  const subject = loadSignatureService();
  const key = 'fee-payment:operation-1:payment-1';

  const first = await subject.DigitalSignatureService.createSignature(user, paymentSignature(), undefined, key);
  const replay = await subject.DigitalSignatureService.createSignature(user, paymentSignature(), undefined, key);

  assert.equal(replay.id, first.id);
  const signatureDocuments = [...subject.documents.entries()].filter(([path]) => path.startsWith('digital_signatures/'));
  const auditDocuments = [...subject.documents.entries()].filter(([path]) => path.startsWith('audit_trail/'));
  assert.equal(signatureDocuments.length, 1);
  assert.equal(auditDocuments.length, 1);
  assert.equal((auditDocuments[0][1].signature as { id: string }).id, first.id);
});

test('a retry key cannot silently be reused for another payment', async () => {
  const subject = loadSignatureService();
  const key = 'fee-payment:operation-1:payment-1';
  await subject.DigitalSignatureService.createSignature(user, paymentSignature(), undefined, key);

  await assert.rejects(
    subject.DigitalSignatureService.createSignature(user, paymentSignature('payment-2'), undefined, key),
    /different action/,
  );
  assert.equal([...subject.documents.keys()].filter(path => path.startsWith('digital_signatures/')).length, 1);
});

test('individual and family confirmed payment paths derive signature retries from their payment operation', () => {
  const files = [
    'src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx',
    'src/app/fees/family/[...slug]/page.tsx',
  ];

  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
    assert.match(source, /fee-payment:\$\{operation\.operationId\}:\$\{paymentId\}|fee-payment:\$\{\(uniformPaymentOperation \|\| regularPaymentOperation\)!.operationId\}:\$\{paymentId\}/);
  }
});

test('an incomplete signature pair is not repaired using a different payment identity', async () => {
  const subject = loadSignatureService();
  const key = 'fee-payment:operation-1:payment-1';
  const signature = await subject.DigitalSignatureService.createSignature(user, paymentSignature(), undefined, key);
  subject.documents.delete('audit_trail/signature-' + signature.id);
  await assert.rejects(subject.DigitalSignatureService.createSignature(user, paymentSignature('other'), undefined, key), /different action/);
  assert.equal([...subject.documents.keys()].filter(path => path.startsWith('audit_trail/')).length, 0);
});

test('a signature without optional metadata contains no undefined audit field', async () => {
  const subject = loadSignatureService();
  const { metadata, ...data } = paymentSignature();
  await subject.DigitalSignatureService.createSignature(user, data, undefined, 'no-metadata');
  const audit = [...subject.documents.entries()].find(([path]) => path.startsWith('audit_trail/'))![1];
  assert.equal('metadata' in audit, false);
});
