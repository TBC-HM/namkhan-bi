// app/guest/directory/page.tsx
// Source: guest.mv_guest_profile + guest.v_directory_facets + guest.directory_headline()

import { createClient } from "@/lib/supabase/server";
import { DirectoryShell } from "./_components/DirectoryShell";

export const revalidate = 300;

export default async function GuestDirectoryPage() {
  const sb = createClient();

  const [{ data: facets }, { data: headlineRows }] = await Promise.all([
    sb
      .schema("guest")
      .from("v_directory_facets")
      .select(
        "country, guest_count, total_revenue, total_stays, repeat_guests, " +
          "contactable_email, contactable_phone, arriving_30d"
      )
      .limit(60),
    sb.schema("guest").rpc("directory_headline"),
  ]);

  const headline = (headlineRows as any[])?.[0] ?? {
    total: 0,
    repeat_guests: 0,
    upcoming_total: 0,
    next_7: 0,
    next_30: 0,
    next_90: 0,
    contactable: 0,
  };

  return (
    <DirectoryShell
      facets={(facets as any[]) ?? []}
      headline={headline}
    />
  );
}
