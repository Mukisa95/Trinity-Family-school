import { AndroidOfflineBoundary } from '@/components/common/android-offline-boundary';
import { AndroidOfflineProvider } from '@/components/providers/android-offline-provider';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import './theme.css';
import './brand-theme.css';
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AuthProvider } from '@/lib/contexts/auth-context';
import { SyncProvider } from '@/context/SyncContext';
import { AppLayout } from '@/components/layout/app-layout';
import { Analytics } from '@vercel/analytics/react';
import { GlobalDataPreloader } from '@/components/providers/global-data-preloader';
import { PrintProvider } from '@/lib/contexts/print-context';
import { ServiceWorkerProvider } from '@/components/providers/service-worker-provider';
import { PDFWorkspaceProvider } from '@/lib/pdf/pdf-workspace-context';
import { PDFWorkspace } from '@/components/pdf/pdf-workspace';
import { OperationalAuditProvider } from '@/components/providers/operational-audit-provider';

const geistSans = GeistSans;
const geistMono = GeistMono;

const siteUrl = 'https://trinityfamilyschool.vercel.app';
const schoolName = 'Trinity Family Nursery & Primary School';
const siteDescription = 'Official website and school portal for Trinity Family Nursery & Primary School in Kawaala, Kampala, Uganda. Learn about the school, admissions, nursery and primary education, and access the Trinity Family School portal.';

const schoolStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'School',
      '@id': `${siteUrl}/#school`,
      name: schoolName,
      alternateName: [
        'Trinity Family School',
        'Trinity Family Primary School',
        'Trinity Family School Kawaala',
        'Trinity School Kawaala',
      ],
      url: siteUrl,
      description: siteDescription,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/trinity-logo-512.png`,
        width: 512,
        height: 512,
      },
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Kawaala',
        addressRegion: 'Kampala',
        addressCountry: 'UG',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'Trinity Family School',
      alternateName: 'Trinity Family School Kawaala',
      publisher: {
        '@id': `${siteUrl}/#school`,
      },
      inLanguage: 'en-UG',
    },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'Trinity Family Nursery & Primary School | Kawaala, Kampala',
    template: '%s | Trinity Family School'
  },
  description: siteDescription,
  keywords: [
    'trinity school',
    'trinity family school',
    'trinity family kawaala',
    'trinity family school kawaala',
    'trinity family nursery and primary school',
    'trinity family primary school',
    'trinity kawaala',
    'trinity school kawaala',
    'nursery school in kawaala',
    'primary school in kawaala',
    'school in kawaala kampala',
  ],
  authors: [{ name: schoolName }],
  creator: schoolName,
  publisher: schoolName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/trinity-logo-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/trinity-logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/trinity-logo-192.png',
      },
    ],
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_UG',
    url: siteUrl,
    title: 'Trinity Family Nursery & Primary School | Kawaala, Kampala',
    description: siteDescription,
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
    description: siteDescription,
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'yiQMxdHMXKxw0sUYnnwTRtsA3ep4_kCG5xxH-oNGCrE',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#f1f7ff" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schoolStructuredData).replace(/</g, '\\u003c'),
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <PrintProvider>
              <PDFWorkspaceProvider>
                <ServiceWorkerProvider />
                <GlobalDataPreloader />
                  <AndroidOfflineProvider />
                <OperationalAuditProvider />
                <SyncProvider>
                  <AppLayout>
                    <AndroidOfflineBoundary>{children}</AndroidOfflineBoundary>
                  </AppLayout>
                  <Toaster />
                </SyncProvider>
                <PDFWorkspace />
              </PDFWorkspaceProvider>
            </PrintProvider>
          </AuthProvider>
        </QueryProvider>
        <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
