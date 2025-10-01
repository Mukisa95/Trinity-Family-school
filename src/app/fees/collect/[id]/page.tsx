import PupilFeesCollectionClient from './PupilFeesCollectionClient';

// Generate static params for static export
export async function generateStaticParams() {
  // Return at least one dummy parameter for static export
  // This allows the route to be generated and handle dynamic parameters at runtime
  return [{ id: 'placeholder' }];
}

export default function PupilFeesCollection() {
  return <PupilFeesCollectionClient />;
} 