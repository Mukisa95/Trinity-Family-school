import Head from 'next/head';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
}

export function SEOHead({
  title = 'School Online - Comprehensive School Management System',
  description = 'Modern school management system for efficient administration, student tracking, attendance management, fee collection, and academic performance monitoring.',
  keywords = [
    'school management system',
    'student information system',
    'education software',
    'school administration',
    'attendance tracking',
    'fee management',
    'academic performance'
  ],
  ogImage = '/og-image.jpg',
  ogType = 'website',
  canonicalUrl,
  noIndex = false,
}: SEOHeadProps) {
  const baseUrl = 'https://trinityfamilyschool.vercel.app';
  const fullTitle = title.includes('Trinity School') ? title : `${title} | Trinity School Online`;
  const fullCanonicalUrl = canonicalUrl ? `${baseUrl}${canonicalUrl}` : baseUrl;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={fullCanonicalUrl} />
      
      {/* Robots */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      
      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`${baseUrl}${ogImage}`} />
      <meta property="og:url" content={fullCanonicalUrl} />
      <meta property="og:site_name" content="Trinity School Online" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${baseUrl}${ogImage}`} />
      
      {/* Additional SEO tags */}
      <meta name="author" content="Trinity School Online Team" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Language" content="en" />
      
      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": fullTitle,
            "description": description,
            "url": fullCanonicalUrl,
            "isPartOf": {
              "@type": "WebSite",
              "name": "Trinity School Online",
              "alternateName": "Trinity School",
              "url": baseUrl
            }
          })
        }}
      />
    </Head>
  );
} 