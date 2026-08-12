// app/marketing/website/preview/_site/jsonld.ts
// CMS-4 JSON-LD generator for website pages
export function generatePageJsonLd(page: {
  slug: string;
  title: string | null;
  page_kind: string | null;
  meta?: { description?: string; title?: string };
}, siteData: {
  base_url: string;
  site?: { domain?: string };
}): object | null {
  const baseUrl = siteData.base_url || `https://${siteData.site?.domain}` || 'https://www.thenamkhan.com';
  const url = `${baseUrl}${page.slug === '/' ? '' : page.slug}`;
  
  if (page.slug === '/' || page.page_kind === 'core' && page.slug === '/') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Hotel',
      '@id': url,
      name: page.title || 'The Namkhan',
      url,
      description: page.meta?.description || page.meta?.title || '',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'LA',
        addressLocality: 'Luang Prabang'
      }
    };
  }
  
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    name: page.meta?.title || page.title || '',
    description: page.meta?.description || '',
    url
  };
}