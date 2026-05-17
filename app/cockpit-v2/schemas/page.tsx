// app/cockpit-v2/schemas/page.tsx
// Live schema inventory — every Postgres relation across user schemas.
// Data: cockpit.fn_schema_inventory() SECURITY DEFINER RPC, which joins
//   pg_class + pg_namespace, attaches reltuples for cheap row-count
//   estimates, exposes a grant-presence flag from relacl, and joins
//   cockpit.aud_change_log for last DDL change.
// Grouped by schema in the client view (SchemasView.tsx).
//
// Author: IT-team agent · 2026-05-13 · #77.

import { fetchSchemaInventory } from '../_lib/data';
import { SchemasView } from './SchemasView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CockpitV2SchemasPage() {
  const objects = await fetchSchemaInventory();
  return <SchemasView objects={objects} />;
}
