import RecordResultsView from './RecordResultsView';

// For static export, we need to specify which paths to generate
// In production, you would fetch actual exam IDs from your database
export async function generateStaticParams() {
  // Return a placeholder to satisfy static export requirements
  // Actual exam IDs will be handled client-side
  return [{ examId: 'placeholder' }];
}

// Server component that renders the client component
export default function RecordResultsPage() {
  return <RecordResultsView />;
} 