import type { Metadata } from 'next';

const description = 'Official website and portal for Trinity Family Nursery & Primary School in Kawaala, Kampala, Uganda. Learn about the school and access the Trinity Family School portal.';

export const metadata: Metadata = {
  title: {
    absolute: 'Trinity Family Nursery & Primary School | Kawaala, Kampala',
  },
  description,
  alternates: {
    canonical: '/login',
  },
  openGraph: {
    type: 'website',
    locale: 'en_UG',
    url: '/login',
    title: 'Trinity Family Nursery & Primary School | Kawaala, Kampala',
    description,
    siteName: 'Trinity Family School',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Trinity Family Nursery & Primary School in Kawaala, Kampala',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trinity Family Nursery & Primary School | Kawaala, Kampala',
    description,
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
