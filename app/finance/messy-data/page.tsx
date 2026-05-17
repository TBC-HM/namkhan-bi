// app/finance/messy-data/page.tsx
// PBS 2026-05-15: Messy Data hub moved into Finance dept (was at /messy-data
// root). Re-exports the existing root page so behaviour is identical; the
// dept-cfg now links here under Finance · Messy data.
// Future enhancement: add sub-tab strip linking Catalog cleanup · Account
// mapping · Supplier mapping · DQ registry as a single hub.

export { default } from '@/app/messy-data/page';
export { dynamic, revalidate } from '@/app/messy-data/page';
