import type { Metadata } from 'next';
import { ParentLayout } from '@/components/parent/parent-layout';

export const metadata: Metadata = {
  title: 'Parent Portal - Trinity Family Schools',
  description: 'Access your child\'s school information, notifications, and updates.',
};

export default function ParentRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ParentLayout>{children}</ParentLayout>;
}
