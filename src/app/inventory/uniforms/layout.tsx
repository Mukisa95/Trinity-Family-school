import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Uniform Inventory | Trinity Family School',
    description: 'Manage uniform stock levels by size',
};

export default function UniformInventoryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
