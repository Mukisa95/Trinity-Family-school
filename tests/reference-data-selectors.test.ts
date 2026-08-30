import assert from 'node:assert/strict';
import test from 'node:test';
import {
  selectAccessLevelById,
  selectActiveAccessLevels,
  selectDefaultAccessLevel,
  selectHouseById,
} from '../src/lib/selectors/reference-data-selectors';
import type { House } from '../src/types';
import type { AccessLevel } from '../src/types/access-levels';

const houses: House[] = [
  { id: 'blue', name: 'Blue', motto: 'Steady', themeColor: '#0000FF', createdAt: '2026-01-01' },
  { id: 'red', name: 'Red', motto: 'Brave', themeColor: '#FF0000', createdAt: '2026-01-02' },
];

const levels: AccessLevel[] = [
  {
    id: 'teacher',
    name: 'Teacher',
    description: 'Teaching access',
    isDefault: true,
    isActive: true,
    modulePermissions: [],
    createdAt: '2026-01-01',
    createdBy: 'admin',
  },
  {
    id: 'retired',
    name: 'Retired role',
    description: 'Disabled',
    isDefault: false,
    isActive: false,
    modulePermissions: [],
    createdAt: '2026-01-02',
    createdBy: 'admin',
  },
];

test('house detail selects from the already-loaded list', () => {
  assert.equal(selectHouseById(houses, 'red')?.name, 'Red');
  assert.equal(selectHouseById(houses, 'missing'), null);
  assert.equal(selectHouseById(undefined, 'red'), null);
});

test('access-level views derive active, detail, and default values from one list', () => {
  assert.deepEqual(selectActiveAccessLevels(levels).map(level => level.id), ['teacher']);
  assert.equal(selectAccessLevelById(levels, 'teacher')?.description, 'Teaching access');
  assert.equal(selectDefaultAccessLevel(levels)?.id, 'teacher');
  assert.equal(selectDefaultAccessLevel(levels.map(level => ({ ...level, isActive: false }))), null);
});
