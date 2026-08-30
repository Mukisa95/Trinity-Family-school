const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(file, 'utf8');
const subjectHook = read('src/lib/hooks/use-subjects.ts');
const subjectBootstrap = read('src/lib/hooks/use-subject-cache-bootstrap.ts');
const subjectService = read('src/lib/services/subjects.service.ts');
const subjectCache = read('src/lib/cache/subject-cache.ts');
const preloader = read('src/components/providers/global-data-preloader.tsx');
const revisionService = read('src/lib/services/dashboard-cache-revisions.service.ts');
const pupilHook = read('src/lib/hooks/use-pupils.ts');
const classPupilHook = read('src/lib/hooks/use-class-pupils.ts');
const progressivePupilHook = read('src/lib/hooks/use-progressive-pupils.ts');
const pupilService = read('src/lib/services/pupils.service.ts');
const pupilSelectors = read('src/lib/selectors/pupil-selectors.ts');
const houseHook = read('src/lib/hooks/use-houses.ts');
const houseBootstrap = read('src/lib/hooks/use-house-cache-bootstrap.ts');
const houseService = read('src/lib/services/houses.service.ts');
const houseCache = read('src/lib/cache/house-cache.ts');
const accessLevelHook = read('src/lib/hooks/use-access-levels.ts');
const accessLevelBootstrap = read('src/lib/hooks/use-access-level-cache-bootstrap.ts');
const accessLevelService = read('src/lib/services/access-levels.service.ts');
const accessLevelCache = read('src/lib/cache/access-level-cache.ts');
const aboutSchoolPage = read('src/app/about-school/page.tsx');
const pupilsPage = read('src/app/pupils/page.tsx');
const newPupilPage = read('src/app/pupils/new/page.tsx');
const pupilDetailPage = read('src/app/pupil-detail/page.tsx');
const accessLevelsManager = read('src/components/access-levels/access-levels-manager.tsx');
const usersPage = read('src/app/users/page.tsx');
const feesNotificationService = read('src/lib/services/fees-payment-notification.service.ts');

assert(
  subjectHook.includes('enabled: false') &&
    !subjectHook.includes('SubjectsService.getAllSubjects') &&
    !subjectHook.includes('SubjectsService.getSubjectById'),
  'Ordinary subject hooks must be cache-only selectors.',
);
assert(
  preloader.includes('useSubjectCacheBootstrap();') &&
    !preloader.includes('setupSubjectsListener') &&
    !preloader.includes("setQueryData(['subjects']"),
  'The global preloader must mount one subject owner and no duplicate listener.',
);
assert(
  subjectBootstrap.includes('SubjectsService.getAllForCache()') &&
    subjectBootstrap.includes('SubjectsService.getAllFromFirestoreCache()') &&
    subjectBootstrap.includes('revisionsQuery.data?.subjects') &&
    subjectBootstrap.includes('needsColdFetch') &&
    subjectBootstrap.includes('writeSubjectCache(scope, targetRevision'),
  'The subject owner must restore locally and reconcile only on cold/revision changes.',
);
assert(
  subjectCache.includes('NEXT_PUBLIC_FIREBASE_PROJECT_ID') &&
    subjectCache.includes('userId') &&
    subjectCache.includes('role') &&
    subjectCache.includes('Array.isArray(snapshot.data)'),
  'Subject persistence must be identity-scoped and accept valid empty snapshots.',
);
assert(
  subjectService.includes('getDocsFromServerWithTimeout') &&
    subjectService.includes('getDocsFromCache') &&
    subjectService.includes('bumpSubjectsRevisionInBatch') &&
    revisionService.includes("writeRevision(batch, 'reference', { subjects: increment(1) })"),
  'Subject reads must have one owner and mutations must atomically publish a revision.',
);
assert(
  houseHook.includes('enabled: false') &&
    !houseHook.includes('HousesService.getAll(') &&
    !houseHook.includes('HousesService.getById(') &&
    accessLevelHook.includes('enabled: false') &&
    !/AccessLevelsService\.(getAllAccessLevels|getActiveAccessLevels|getAccessLevelById|getDefaultAccessLevel)\s*\(/.test(accessLevelHook),
  'Ordinary house and access-level hooks must remain cache-only selectors.',
);
assert(
  preloader.includes('useHouseCacheBootstrap();') &&
    preloader.includes('useAccessLevelCacheBootstrap();') &&
    !preloader.includes('fetchAccessLevels') &&
    !preloader.includes("setQueryData(['houses']") &&
    !preloader.includes("setQueryData(['accessLevels'"),
  'The global preloader must mount exactly one owner for houses and access levels.',
);
assert(
  houseBootstrap.includes('HousesService.getAllForCache()') &&
    houseBootstrap.includes('revisionsQuery.data?.houses') &&
    accessLevelBootstrap.includes('AccessLevelsService.getAllForCache()') &&
    accessLevelBootstrap.includes('revisionsQuery.data?.accessLevels') &&
    houseCache.includes('NEXT_PUBLIC_FIREBASE_PROJECT_ID') &&
    accessLevelCache.includes("role === 'Parent'"),
  'Independent reference caches must be revision-owned, identity-scoped, and role-safe.',
);
assert(
  houseService.includes('bumpHousesRevisionInBatch') &&
    accessLevelService.includes('bumpAccessLevelsRevisionInBatch') &&
    accessLevelService.includes('getDefaultDocuments') &&
    revisionService.includes("writeRevision(batch, 'reference', { houses: increment(1) })") &&
    revisionService.includes("writeRevision(batch, 'reference', { accessLevels: increment(1) })"),
  'House and access-level mutations must atomically publish their cache revisions.',
);
assert(
  aboutSchoolPage.includes('useHouses()') &&
    aboutSchoolPage.includes('useCreateHouse()') &&
    aboutSchoolPage.includes('useUpdateHouse()') &&
    pupilsPage.includes('useHouses()') &&
    newPupilPage.includes('useHouses()') &&
    pupilDetailPage.includes('useHouses()'),
  'Every house management, list, creation, and detail page must consume the shared house snapshot.',
);
assert(
  accessLevelsManager.includes('useAccessLevels()') &&
    usersPage.includes('useActiveAccessLevels()') &&
    feesNotificationService.includes('AccessLevelsService.getAccessLevelById') &&
    !/getDoc\s*\(doc\s*\([^\n]*['"]accessLevels['"]/.test(feesNotificationService),
  'Access-level management, user assignment, and fee notifications must reuse the shared access-level snapshot.',
);
assert(
  pupilHook.includes('enabled: false') &&
    !/PupilsService\.get[A-Za-z0-9_]+\s*\(/.test(pupilHook) &&
    !/PupilsService\.get[A-Za-z0-9_]+\s*\(/.test(classPupilHook) &&
    !/PupilsService\.get[A-Za-z0-9_]+\s*\(/.test(progressivePupilHook),
  'Ordinary pupil hooks must select from the canonical snapshot without fallback reads.',
);
assert(
  pupilService.includes("if (typeof window !== 'undefined')") &&
    pupilService.includes('return selectPupilById(await this.getAllPupils(), id)') &&
    pupilService.includes('return selectPupilsByClass(await this.getAllPupils(), classId)') &&
    pupilService.includes('return selectPupilPhotos(await this.getAllPupils(), pupilIds)') &&
    pupilSelectors.includes('selectPupilsWithFilters') &&
    pupilSelectors.includes('selectPupilPhotos'),
  'Legacy browser pupil service readers must be selectors over the shared snapshot.',
);

function sourceFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

const forbidden = [];
for (const file of [...sourceFiles('src/app'), ...sourceFiles('src/components')]) {
  const normalised = file.replace(/\\/g, '/');
  if (normalised.startsWith('src/app/api/')) continue;
  if (normalised === 'src/components/providers/global-data-preloader.tsx') continue;
  const source = read(file);
  if (/SubjectsService\.(getAllSubjects|getSubjectById)\s*\(/.test(source)) forbidden.push(file);
  if (/collection\s*\([^\n]*['"]subjects['"]/.test(source)) forbidden.push(file);
  if (/PupilsService\.get[A-Za-z0-9_]+\s*\(/.test(source)) forbidden.push(file);
  if (/collection\s*\([^\n]*['"]pupils['"]/.test(source)) forbidden.push(file);
  if (/HousesService\.(getAll|getById)\s*\(/.test(source)) forbidden.push(file);
  if (/collection\s*\([^\n]*['"]houses['"]/.test(source)) forbidden.push(file);
  if (/AccessLevelsService\.(getAllAccessLevels|getActiveAccessLevels|getAccessLevelById|getDefaultAccessLevel)\s*\(/.test(source)) forbidden.push(file);
  if (/collection\s*\([^\n]*['"]accessLevels['"]/.test(source)) forbidden.push(file);
}
assert.deepEqual(
  [...new Set(forbidden)],
  [],
  `Pages/components must not privately read master data: ${[...new Set(forbidden)].join(', ')}`,
);

console.log('Master-data ownership contract passed: subjects, pupils, houses, and access levels have one browser read owner each.');
