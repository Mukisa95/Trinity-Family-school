import type { Metadata } from 'next';
import { ParentLayout } from '@/components/parent/parent-layout';
import { schoolWebAppManifest } from '@/lib/pwa/manifest';

export const metadata: Metadata = {
  title: 'Parent Portal - Trinity Family Schools',
  description: 'Access your child\'s school information, notifications, and updates.',
  manifest: '/api/pwa/manifest?portal=parent',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: schoolWebAppManifest(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools', true).short_name },
};

export default function ParentRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ParentLayout>{children}</ParentLayout>;
}
