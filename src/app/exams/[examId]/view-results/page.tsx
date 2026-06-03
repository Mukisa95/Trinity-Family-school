import ViewResultsView from './ViewResultsView';

// Server component that renders the client component
// This is a dynamic route, so we don't need generateStaticParams
export default function ViewResultsPage() {
  return <ViewResultsView />;
} 