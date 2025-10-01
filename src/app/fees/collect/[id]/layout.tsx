import { ReactNode } from 'react';

// Generate static params for static export
export async function generateStaticParams() {
  // Return empty array to allow all dynamic parameters
  return [];
}

interface LayoutProps {
  children: ReactNode;
  params: { id: string };
}

export default function FeesCollectLayout({ children, params }: LayoutProps) {
  return <>{children}</>;
} 