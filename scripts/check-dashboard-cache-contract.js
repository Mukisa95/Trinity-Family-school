const assert = require('assert');
const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const section = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(startIndex !== -1 && endIndex !== -1, `Could not locate contract section: ${start}`);
  return source.slice(startIndex, endIndex);
};

const classesHook = read('src/lib/hooks/use-classes.ts');
const academicYearsHook = read('src/lib/hooks/use-academic-years.ts');
const eventsHook = read('src/lib/hooks/use-events-fixed.ts');
const eventCache = read('src/lib/cache/event-cache.ts');
const timetableService = read('src/lib/services/timetable.service.ts');
const timetableHook = read('src/lib/hooks/use-timetable.ts');
const preloader = read('src/components/providers/global-data-preloader.tsx');
const batchReports = read('src/components/exam/BatchReportGenerator.tsx');
const settingsHook = read('src/lib/hooks/use-school-settings.ts');
const classBootstrap = read('src/lib/hooks/use-class-cache-bootstrap.ts');
const academicYearBootstrap = read('src/lib/hooks/use-academic-year-cache-bootstrap.ts');
const classesService = read('src/lib/services/classes.service.ts');
const academicYearsService = read('src/lib/services/academic-years.service.ts');
const firestoreHelpers = read('src/lib/utils/firestore-helpers.ts');
const classCache = read('src/lib/cache/class-cache.ts');
const academicYearCache = read('src/lib/cache/academic-year-cache.ts');

assert(
  classesHook.includes('enabled: false') &&
    !classesHook.includes('queryFn: () => ClassesService.getAll'),
  'Ordinary class hooks must remain cache-only.',
);
assert(
  academicYearsHook.includes('enabled: false') &&
    !academicYearsHook.includes('queryFn: () => AcademicYearsService.getAllAcademicYears'),
  'Ordinary academic-year hooks must remain cache-only.',
);
assert(
  preloader.includes('useClassCacheBootstrap();') &&
    preloader.includes('useAcademicYearCacheBootstrap();'),
  'The application preloader must mount the sole class and academic-year cache owners.',
);
assert(
  settingsHook.includes('currentRevisions === undefined'),
  'An empty first revision snapshot must still publish readiness.',
);
assert(
  classBootstrap.includes('needsColdFetch') &&
    academicYearBootstrap.includes('needsColdFetch'),
  'Cold class and academic-year caches must not wait for revision readiness.',
);
assert(
  classBootstrap.includes('getAllFromFirestoreCache') &&
    academicYearBootstrap.includes('getAllFromFirestoreCache') &&
    classesService.includes('getDocsFromServerWithTimeout') &&
    academicYearsService.includes('getDocsFromServerWithTimeout') &&
    firestoreHelpers.includes('Authoritative collection read for revision reconciliation'),
  'Cold owners may paint local data, but only an authoritative server read may stamp a revision.',
);
assert(
  classCache.includes('CLASS_CACHE_SCHEMA = 2') &&
    academicYearCache.includes('ACADEMIC_YEAR_CACHE_SCHEMA = 2') &&
    eventCache.includes('EVENT_CACHE_SCHEMA = 2') &&
    timetableHook.includes('TIMETABLE_CACHE_SCHEMA = 2'),
  'The corrected rollout must reject empty snapshots written by the initial deployment.',
);
assert(
  batchReports.includes('useClasses()') && !batchReports.includes("api.get('/classes')"),
  'Exam reports must reuse the global class snapshot.',
);

assert(
  eventCache.includes('projectId') &&
    eventCache.includes('userId') &&
    eventCache.includes('role') &&
    eventCache.includes("familyId || 'school'"),
  'Persistent event data must be scoped to project and signed-in identity.',
);
assert(
  eventsHook.includes("where('isPublic', '==', true)") &&
    eventsHook.includes("user?.role === 'Parent'"),
  'Parent calendar reads must remain public-event scoped.',
);
assert(
  !eventsHook.includes('bumpEventsRevision()'),
  'Event mutations must publish their revision in the source write batch.',
);
assert(
  eventsHook.includes("const isCreate = 'createdBy' in eventData") &&
    !eventsHook.includes('isExamEvent: eventData.isExamEvent || false'),
  'Partial event edits must not reset fields omitted by the editor.',
);
assert(
  eventsHook.includes('if (existing) {'),
  'Mutation cache patches must never publish a partial event collection as a complete cache.',
);

const updateTimetable = section(
  timetableService,
  'static async updateTimetable(',
  'static async deleteTimetable(',
);
const cloneTimetable = section(
  timetableService,
  'static async cloneTimetable(',
  'Generated Periods',
);
assert(
  (updateTimetable.match(/\.commit\(\)/g) || []).length === 1,
  'Timetable replacement must publish in one atomic commit.',
);
assert(
  (cloneTimetable.match(/\.commit\(\)/g) || []).length === 1,
  'Timetable cloning must publish in one atomic commit.',
);
assert(
  timetableHook.includes('user.familyId') &&
    timetableHook.includes('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  'Timetable caches must be scoped to project and signed-in identity.',
);
assert(
  timetableHook.includes('(revisionsReady || initialData === undefined)') &&
    eventsHook.includes('(revisionsReady || !hasUsableCachedData)') &&
    timetableHook.includes('getDocsFromServer') &&
    eventsHook.includes('getDocsFromServer'),
  'Cold timetable and event caches must fail open while warm caches remain read-free.',
);

console.log(
  'Dashboard cache contract passed: shared owners, scoped caches, and atomic mutation publication are intact.',
);
