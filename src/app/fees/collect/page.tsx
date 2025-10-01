'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PupilFeesCollectionClient from './[id]/PupilFeesCollectionClient';

function FeesCollectionContent() {
  const searchParams = useSearchParams();
  const pupilId = searchParams.get('pupilId');

  if (!pupilId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Pupil Selected</h1>
          <p className="text-gray-600">Please select a pupil to view their fees.</p>
        </div>
      </div>
    );
  }

  // Pass the pupilId as a prop to the client component
  return <PupilFeesCollectionClient pupilId={pupilId} />;
}

export default function FeesCollectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <FeesCollectionContent />
    </Suspense>
  );
} 