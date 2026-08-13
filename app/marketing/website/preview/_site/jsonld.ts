// app/marketing/website/preview/_site/jsonld.ts
// CMS-4 JSON-LD generator for website pages (enhanced for SEO layer v2)
export function generatePageJsonLd(page: {
  slug: string;
  title: string | null;
  page_kind: string | null;
  meta?: { description?: string; title?: string; og_image?: string };
}, siteData: {
  base_url: string;
  site?: { domain?: string };
}): object | null {
  const baseUrl = siteData.base_url || `https://${siteData.site?.domain}` || 'https://www.thenamkhan.com';
  const url = `${baseUrl}${page.slug === '/' ? '' : page.slug}`;

  // Schema type is driven off the page row: the homepage is the page_kind='core'
  // row at slug '/' (verified against website.pages) → Hotel; everything else → WebPage.
  const isHomepage = page.page_kind === 'core' && page.slug === '/';

  if (isHomepage) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Hotel',
      '@id': url,
      name: page.title || 'The Namkhan',
      url,
      description: page.meta?.description || page.meta?.title || '',
      image: page.meta?.og_image ? `${baseUrl}${page.meta.og_image}` : undefined,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'LA',
        addressLocality: 'Luang Prabang',
        addressRegion: 'Luang Prabang Province',
        streetAddress: 'Nam Khan Riverside'
      },
      telephone: '+856 71 253 888',
      priceRange: '$$$',
      starRating: {
        '@type': 'Rating',
        ratingValue: '5'
      }
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    name: page.meta?.title || page.title || '',
    description: page.meta?.description || '',
    url,
    image: page.meta?.og_image ? `${baseUrl}${page.meta.og_image}` : undefined
  };
}
