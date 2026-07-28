import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import {
  acquireSharedFirestoreSubscription,
  clearSharedFirestoreSubscriptions,
  getSharedFirestoreSubscriptionCount,
} from '../src/lib/firebase/firestore-subscription-registry';

test.afterEach(() => {
  clearSharedFirestoreSubscriptions();
});

test('shares one listener and publishes its data to every query client', () => {
  const firstClient = new QueryClient();
  const secondClient = new QueryClient();
  let subscribeCount = 0;
  let unsubscribeCount = 0;
  let emit: ((data: string[]) => void) | undefined;

  const subscribe = ({ next }: { next: (data: string[]) => void }) => {
    subscribeCount += 1;
    emit = next;
    return () => {
      unsubscribeCount += 1;
    };
  };

  const releaseFirst = acquireSharedFirestoreSubscription({
    key: 'test:users:user-a',
    queryClient: firstClient,
    queryKey: ['users'],
    subscribe,
  });
  const releaseSecond = acquireSharedFirestoreSubscription({
    key: 'test:users:user-a',
    queryClient: secondClient,
    queryKey: ['users'],
    subscribe,
  });

  assert.equal(subscribeCount, 1);
  assert.equal(getSharedFirestoreSubscriptionCount(), 1);

  emit?.(['first', 'second']);
  assert.deepEqual(firstClient.getQueryData(['users']), ['first', 'second']);
  assert.deepEqual(secondClient.getQueryData(['users']), ['first', 'second']);

  releaseFirst();
  assert.equal(unsubscribeCount, 0);
  releaseSecond();
  assert.equal(unsubscribeCount, 1);
  assert.equal(getSharedFirestoreSubscriptionCount(), 0);
});

test('keeps identity-scoped subscriptions separate', () => {
  const client = new QueryClient();
  let subscribeCount = 0;

  const subscribe = () => {
    subscribeCount += 1;
    return () => undefined;
  };

  const releaseA = acquireSharedFirestoreSubscription({
    key: 'test:attendance:pupil-1:user-a',
    queryClient: client,
    queryKey: ['attendance', 'pupil', 'pupil-1'],
    subscribe,
  });
  const releaseB = acquireSharedFirestoreSubscription({
    key: 'test:attendance:pupil-1:user-b',
    queryClient: client,
    queryKey: ['attendance', 'pupil', 'pupil-1'],
    subscribe,
  });

  assert.equal(subscribeCount, 2);
  releaseA();
  releaseB();
});

test('runs one shared recovery fetch only when no initial snapshot arrives', async () => {
  const client = new QueryClient();
  let fallbackCount = 0;

  const releaseFirst = acquireSharedFirestoreSubscription({
    key: 'test:recovery:user-a',
    queryClient: client,
    queryKey: ['recovery'],
    subscribe: () => () => undefined,
    fallbackDelayMs: 0,
    fallback: async () => {
      fallbackCount += 1;
      return ['recovered'];
    },
  });
  const releaseSecond = acquireSharedFirestoreSubscription({
    key: 'test:recovery:user-a',
    queryClient: client,
    queryKey: ['recovery'],
    subscribe: () => () => undefined,
    fallbackDelayMs: 0,
    fallback: async () => ['should-not-run'],
  });

  await new Promise(resolve => setTimeout(resolve, 10));

  assert.equal(fallbackCount, 1);
  assert.deepEqual(client.getQueryData(['recovery']), ['recovered']);
  releaseFirst();
  releaseSecond();
});
