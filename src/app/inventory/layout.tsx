import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Inventory Management | Trinity Family School',
    description: 'Track and manage school property inventory including furniture, electronics, laboratory equipment, and more.',
    keywords: ['inventory', 'school property', 'asset management', 'stock tracking'],
};

export default function InventoryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
