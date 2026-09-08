import test from 'node:test';
import assert from 'node:assert/strict';

import { omitUndefinedFields } from '../src/lib/utils/omit-undefined-fields';

test('optional blank form values are omitted before a Firestore write', () => {
  assert.deepEqual(
    omitUndefinedFields({
      name: 'Printing reams',
      purchaseUnit: 'Reams',
      purchaseCustomUnit: undefined,
      unitsPerPurchaseUnit: 500,
    }),
    {
      name: 'Printing reams',
      purchaseUnit: 'Reams',
      unitsPerPurchaseUnit: 500,
    },
  );
});
