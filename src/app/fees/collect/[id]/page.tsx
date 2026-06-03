import { Suspense } from 'react';
import PupilFeesCollectionClient from './PupilFeesCollectionClient';

// Generate static params for static export
export async function generateStaticParams() {
  // Return at least one dummy parameter for static export
  // This allows the route to be generated and handle dynamic parameters at runtime
  return [{ id: 'placeholder' }];
}

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

export default function PupilFeesCollection() {
  return (
    <Suspense fallback={<Loading />}>
      <PupilFeesCollectionClient />
    </Suspense>
  );
} 