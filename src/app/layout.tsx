import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/lib/contexts/auth-context';
import { SyncProvider } from '@/context/SyncContext';
import { AppLayout } from '@/components/layout/app-layout';
import { Analytics } from '@vercel/analytics/react';

const geistSans = GeistSans;
const geistMono = GeistMono;

// Metadata configuration - uncomment when ready to use
// export const metadata: Metadata = {
//   title: {
//     default: 'Trinity School Online - Comprehensive School Management System',
//     template: '%s | Trinity School Online'
//   },
//   description: 'Trinity School Online - Modern school management system for efficient administration, student tracking, attendance management, fee collection, and academic performance monitoring. Official Trinity School digital platform.',
//   keywords: [
//     'trinity school online',
//     'trinity school',
//     'trinity school management',
//     'trinity school portal',
//     'trinity school system',
//     'school management system',
//     'student information system',
//     'education software',
//     'school administration',
//     'attendance tracking',
//     'fee management',
//     'academic performance',
//     'student portal',
//     'teacher dashboard',
//     'school ERP',
//     'educational technology',
//     'school software',
//     'trinity education',
//     'trinity academy',
//     'trinity learning'
//   ],
//   authors: [{ name: 'Trinity School Online Team' }],
//   creator: 'Trinity School Online',
//   publisher: 'Trinity School Online',
//   formatDetection: {
//     email: false,
//     address: false,
//     telephone: false,
//   },
//   metadataBase: new URL('https://trinityfamilyschool.vercel.app'),
//   alternates: {
//     canonical: '/',
//   },
//   openGraph: {
//     type: 'website',
//     locale: 'en_US',
//     url: 'https://trinityfamilyschool.vercel.app',
//     title: 'Trinity School Online - Comprehensive School Management System',
//     description: 'Trinity School Online - Modern school management system for efficient administration, student tracking, attendance management, fee collection, and academic performance monitoring.',
//     siteName: 'Trinity School Online',
//     images: [
//       {
//         url: '/og-image.jpg',
//         width: 1200,
//         height: 630,
//         alt: 'Trinity School Online - School Management System',
//       },
//     ],
//   },
//   twitter: {
//     card: 'summary_large_image',
//     title: 'Trinity School Online - Comprehensive School Management System',
//     description: 'Trinity School Online - Modern school management system for efficient administration, student tracking, attendance management, fee collection, and academic performance monitoring.',
//     images: ['/og-image.jpg'],
//     creator: '@trinityschoolonline',
//   },
//   robots: {
//     index: true,
//     follow: true,
//     googleBot: {
//       index: true,
//       follow: true,
//       'max-video-preview': -1,
//       'max-image-preview': 'large',
//       'max-snippet': -1,
//     },
//   },
//   verification: {
//     google: 'yiQMxdHMXKxw0sUYnnwTRtsA3ep4_kCG5xxH-oNGCrE',
//   },
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        {/* Structured data script - uncomment when ready to use
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Trinity School Online",
              "alternateName": ["Trinity School Management System", "Trinity School Portal"],
              "description": "Comprehensive school management system for Trinity School - efficient administration, student tracking, and academic performance monitoring",
              "applicationCategory": "EducationalApplication",
              "operatingSystem": "Web Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "provider": {
                "@type": "Organization",
                "name": "Trinity School Online",
                "alternateName": "Trinity School",
                "url": "https://trinityfamilyschool.vercel.app",
                "sameAs": [
                  "https://facebook.com/trinityschool",
                  "https://twitter.com/trinityschool"
                ]
              },
              "keywords": "trinity school online, trinity school, school management system, student portal, education software"
            })
          }}
        />
        */}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <QueryProvider>
          <AuthProvider>
            <SyncProvider>
              <AppLayout>
                {children}
              </AppLayout>
              <Toaster />
            </SyncProvider>
          </AuthProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  );
}
