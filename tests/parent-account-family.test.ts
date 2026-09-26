import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Pupil, SystemUser } from '../src/types';
import {
  collapsePupilsToParentAccountFamilies,
  getActiveParentAccountId,
  getParentAccountChildren,
  getPupilsWithoutParentAccounts,
} from '../src/lib/users/parent-account-families';

function pupil(id: string, familyId?: string): Pupil {
  return {
    id,
    familyId,
    firstName: id.toUpperCase(),
    lastName: 'Family',
    admissionNumber: `ADM-${id}`,
    gender: 'Male',
    classId: 'class-1',
    section: 'Day',
    status: 'Active',
    guardians: [],
    createdAt: '2026-09-26T00:00:00.000Z',
  };
}

function parent(id: string, pupilId: string, familyId?: string): SystemUser {
  return {
    id,
    username: id,
    role: 'Parent',
    isActive: true,
    pupilId,
    familyId,
    createdAt: '2026-09-26T00:00:00.000Z',
  };
}

test('one parent account covers every pupil in the same family', () => {
  const pupils = [pupil('a', 'family-1'), pupil('b', 'family-1'), pupil('c', 'family-2')];
  const account = parent('parent-1', 'a', 'family-1');

  assert.deepEqual(getParentAccountChildren(account, pupils).map(child => child.id), ['a', 'b']);
  assert.deepEqual(getPupilsWithoutParentAccounts(pupils, [account]).map(child => child.id), ['c']);
});

test('legacy pupil-linked accounts still cover siblings through the pupil family', () => {
  const pupils = [pupil('a', 'family-1'), pupil('b', 'family-1'), pupil('c')];
  const legacyAccount = parent('legacy-parent', 'a');

  assert.deepEqual(getParentAccountChildren(legacyAccount, pupils).map(child => child.id), ['a', 'b']);
  assert.deepEqual(getPupilsWithoutParentAccounts(pupils, [legacyAccount]).map(child => child.id), ['c']);
});

test('standalone pupils remain separately eligible and use their own parent account', () => {
  const pupils = [pupil('a'), pupil('b')];
  const account = parent('parent-a', 'a');

  assert.deepEqual(getParentAccountChildren(account, pupils).map(child => child.id), ['a']);
  assert.deepEqual(getPupilsWithoutParentAccounts(pupils, [account]).map(child => child.id), ['b']);
  assert.equal(getActiveParentAccountId({
    parentAccountId: account.id,
    parentAccountActive: account.isActive,
  }), 'parent-a');
});

test('bulk selection creates one representative per family', () => {
  const selected = [pupil('a', 'family-1'), pupil('b', 'family-1'), pupil('c'), pupil('d')];
  assert.deepEqual(
    collapsePupilsToParentAccountFamilies(selected).map(child => child.id),
    ['a', 'c', 'd'],
  );
});

test('payment routing uses only an explicitly active pupil account marker', () => {
  assert.equal(getActiveParentAccountId({ parentAccountId: 'parent-1', parentAccountActive: true }), 'parent-1');
  assert.equal(getActiveParentAccountId({ parentAccountId: 'parent-1', parentAccountActive: false }), null);
  assert.equal(getActiveParentAccountId({ parentAccountActive: true }), null);
});

test('server account creation routes enforce the family uniqueness boundary', () => {
  const usersRoute = readFileSync('src/app/api/users/route.ts', 'utf8');
  const linkedRoute = readFileSync('src/app/api/users/linked/route.ts', 'utf8');
  const userRoute = readFileSync('src/app/api/users/[id]/route.ts', 'utf8');

  assert.match(usersRoute, /where\('familyId', '==', familyId\)/);
  assert.match(usersRoute, /PARENT_FAMILY_EXISTS/);
  assert.match(usersRoute, /parentAccountId: userRef\.id/);
  assert.match(usersRoute, /parentAccountActive: true/);
  assert.doesNotMatch(usersRoute, /family-\$\{pupilId\}/);
  assert.match(linkedRoute, /where\('familyId', '==', parentFamilyId\)/);
  assert.match(linkedRoute, /FAMILY_LINK_EXISTS/);
  assert.match(linkedRoute, /parentAccountId: userRef\.id/);
  assert.doesNotMatch(linkedRoute, /family-\$\{targetId\}/);
  assert.match(userRoute, /parentAccountActive: cleanUpdates\.isActive === true/);
  assert.match(userRoute, /parentAccountId: null/);
});

test('family membership changes reconcile account scope, markers, claims, and notifications', () => {
  const transitionSource = readFileSync('src/lib/server/parent-family-membership.ts', 'utf8');
  const preloaderSource = readFileSync('src/components/providers/global-data-preloader.tsx', 'utf8');
  const siblingsSource = readFileSync('src/components/pupils/link-siblings-modal.tsx', 'utf8');
  const pupilsPageSource = readFileSync('src/app/pupils/page.tsx', 'utf8');

  assert.match(transitionSource, /parentAccountId: canonical\?\.id \|\| null/);
  assert.match(transitionSource, /parentAccountActive: canonical\?\.data\(\)\.isActive === true/);
  assert.match(transitionSource, /isActive: false/);
  assert.match(transitionSource, /transferableCandidates/);
  assert.match(transitionSource, /membersAfter\.get\(text\(document\.data\(\)\.familyId\)\)/);
  assert.match(transitionSource, /export async function syncParentScopeClaims/);
  assert.match(transitionSource, /has joined your family\. Click here to view their details\./);
  assert.match(transitionSource, /is no longer a member of your family\. Contact the school to find out why\./);
  assert.match(preloaderSource, /where\('parentAccountId', '==', userId\)/);
  assert.match(preloaderSource, /where\('parentAccountActive', '==', true\)/);
  assert.match(siblingsSource, /PupilsService\.transitionFamilyMembership/);
  assert.match(pupilsPageSource, /familyId: null/);
});

test('ordinary pupil registration stays standalone while sibling registration reuses a family', () => {
  const newPupilSource = readFileSync('src/app/pupils/new/page.tsx', 'utf8');
  const familyAssignment = newPupilSource.match(
    /const familyIdToSave = addingSibling([\s\S]*?);\s*const pupilData/,
  );

  assert.ok(familyAssignment);
  assert.match(familyAssignment[0], /originalPupil\?\.familyId \|\| familyId \|\| `fam-\$\{Date\.now\(\)\}`/);
  assert.match(familyAssignment[0], /:\s*undefined/);
});

test('parent projections and revision signals are account-scoped for family and standalone pupils', () => {
  const functionsSource = readFileSync('functions/index.js', 'utf8');
  const revisionHookSource = readFileSync('src/lib/hooks/use-parent-dashboard-revision.ts', 'utf8');
  const rulesSource = readFileSync('firestore.rules', 'utf8');

  assert.match(functionsSource, /pupilData\.parentAccountActive === true/);
  assert.match(functionsSource, /pupilData\.parentAccountId/);
  assert.match(functionsSource, /requireParentOwnedPupil\(request, pupilId, db\)/);
  assert.doesNotMatch(functionsSource, /pupil\.data\(\)\?\.familyId !== familyId/);
  assert.match(revisionHookSource, /doc\(db, PARENT_DASHBOARD_REVISIONS, accountId\)/);
  assert.match(rulesSource, /request\.auth\.uid == accountId/);
  assert.match(rulesSource, /allow write: if isTrustedServerApp\(\) \|\| isStaffOrAdmin\(\);/);
});
