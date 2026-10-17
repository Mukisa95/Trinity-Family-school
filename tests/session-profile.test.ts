import assert from 'node:assert/strict';
import test from 'node:test';
import type { SystemUser } from '../src/types';
import { normalizeSessionProfile, sessionAccessKey } from '../src/lib/access/session-profile';
import { setCircumferenceUser, registerCircumferencePupils, circumferencePupil } from '../src/lib/access/circumference-session';

const staff = { id: 'staff', username: 'Example', role: 'Staff', isActive: true,
  circumference: { classIds: ['p4'], sections: null, genders: null },
  modulePermissions: [{ module: 'reports', permission: 'view_only' }],
  granularPermissions: [{ moduleId: 'reports', pages: [{ pageId: 'dashboard', canAccess: true, actions: [] }] }],
} as SystemUser;

test('legacy empty links and default active status have one session meaning', () => {
  for (const link of [undefined, null, '', '   ']) {
    const profile = { ...staff, isActive: undefined, familyId: link, pupilId: link } as unknown as SystemUser;
    assert.equal(sessionAccessKey(profile), sessionAccessKey(staff));
    const normalized = normalizeSessionProfile(profile);
    assert.equal(normalized.familyId, undefined);
    assert.equal(normalized.pupilId, undefined);
    assert.equal(normalized.isActive, true);
  }
  assert.equal(normalizeSessionProfile({ ...staff, isActive: false }).isActive, false);
});

test('equivalent transport ordering does not drop the permitted pupil registry', () => {
  setCircumferenceUser(staff);
  const pupil = { id: 'girl', classId: 'p4', gender: 'Female', section: 'Boarding' };
  registerCircumferencePupils([pupil]);
  try {
    const snapshot = { ...staff, familyId: '', pupilId: '',
      modulePermissions: [{ permission: 'view_only', module: 'reports' }],
      granularPermissions: [{ pages: [{ actions: [], canAccess: true, pageId: 'dashboard' }], moduleId: 'reports' }],
    } as SystemUser;
    assert.equal(setCircumferenceUser(snapshot), false);
    assert.equal(circumferencePupil('girl'), pupil);
  } finally { setCircumferenceUser(null); }
});

test('real account, active, role, family, pupil, permission and class changes invalidate private scope', () => {
  const changes = [
    { ...staff, id: 'different' }, { ...staff, isActive: false }, { ...staff, role: 'Parent' },
    { ...staff, familyId: 'new-family' }, { ...staff, pupilId: 'new-pupil' },
    { ...staff, modulePermissions: [] }, { ...staff, granularPermissions: [] },
    { ...staff, circumference: { classIds: [], sections: null, genders: null } }, null,
  ] as Array<SystemUser | null>;
  try {
    for (const changed of changes) {
      setCircumferenceUser(staff);
      registerCircumferencePupils([{ id: 'previous-pupil' }]);
      assert.equal(setCircumferenceUser(changed), true);
      assert.equal(circumferencePupil('previous-pupil'), undefined);
    }
  } finally { setCircumferenceUser(null); }
});
