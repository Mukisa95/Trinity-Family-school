import { Suspense } from 'react';
import PupilResultsClient from './PupilResultsClient';

// Return a single placeholder for static export.
// All actual exam/pupil IDs will be handled by client-side rendering.
export async function generateStaticParams() {
  return [{ examId: 'placeholder', pupilId: 'placeholder' }];
}

export default function PupilResultsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PupilResultsClient />
    </Suspense>
  );
} 