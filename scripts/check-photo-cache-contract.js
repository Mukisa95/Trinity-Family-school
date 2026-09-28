const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const hook = read('src/lib/hooks/use-photos.ts');
const cache = read('src/lib/cache/photo-cache.ts');
const liteCache = read('src/lib/cache/lite-cache.ts');
const service = read('src/lib/services/photos.service.ts');
const revisions = read('src/lib/services/dashboard-cache-revisions.service.ts');
const revisionHook = read('src/lib/hooks/use-school-settings.ts');
const preloader = read('src/components/providers/global-data-preloader.tsx');
const uploadRoute = read('src/app/api/upload-photo/route.ts');
const manager = read('src/components/common/slides-manager.tsx');

const failures = [];
const requireContract = (condition, message) => {
  if (!condition) failures.push(message);
};

requireContract(
  /photos:\s*Number\.MAX_SAFE_INTEGER/.test(liteCache)
    && cache.includes('revision: -1')
    && cache.includes('writePhotoCache'),
  'Photos must retain a complete persistent snapshot with an explicit revision and no timed expiry.',
);
requireContract(
  hook.includes('getRevisionCachePolicy')
    && hook.includes('cachePolicy.shouldFetch')
    && hook.includes("PhotosService.getAllPhotos(revisionsReady ? 'server' : 'default')")
    && hook.includes('if (currentCache !== undefined) return currentCache')
    && !hook.includes('liteInvalidate'),
  'The canonical photo hook must read only on a cold cache or confirmed revision change and retain cached data on failure.',
);
requireContract(
  revisionHook.includes("['pupils', 'attendance', 'events', 'photos']")
    && revisions.includes('bumpPhotosRevisionInBatch')
    && service.match(/bumpPhotosRevisionInBatch\(batch\)/g)?.length >= 4
    && uploadRoute.includes('bumpPhotosRevisionInBatch(batch)'),
  'Every normal photo mutation must publish the shared photo revision in its atomic database commit.',
);
requireContract(
  !preloader.includes('fetchPhotos')
    && !preloader.includes("getDocs(collection(db, 'photos'))"),
  'The global preloader must not compete with the canonical photo cache owner.',
);
requireContract(
  manager.includes('useUploadPhotoHybrid')
    && manager.includes('uploadMutation.mutateAsync')
    && !manager.includes('window.location.reload()'),
  'Photo uploads must patch the shared cache without a page reload or forced collection re-read.',
);

if (failures.length) {
  console.error('Photo revision cache contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Photo revision cache contract passed: warm dashboards are read-free and mutations publish atomically.');
