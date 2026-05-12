// components/settings/panels/LocationPanel.tsx
import { PanelHeader, Field, Section, ChipList, Chip, EmptyState } from './_shared';

export default function LocationPanel({ data }: { data: any }) {
  if (!data) return <><PanelHeader title="Location" /><EmptyState message="No location record found." /></>;

  const addressParts = [data.street_line_1, data.street_line_2, data.village, data.district].filter(Boolean).join(', ');

  return (
    <>
      <PanelHeader title="Location" subtitle="Physical address, GPS, climate, and transport" />

      <Section title="Address">
        <Field label="Street" value={addressParts || null} span={3} />
        <Field label="City" value={data.city} />
        <Field label="Province" value={data.province} />
        <Field label="Country" value={data.country} />
        <Field label="Postal code" value={data.postal_code} />
        <Field label="Timezone" value={data.timezone ? <Chip>{data.timezone}</Chip> : null} />
        <Field label="Primary language" value={data.primary_language ? <Chip>{data.primary_language.toUpperCase()}</Chip> : null} />
        <Field label="Languages spoken" value={<ChipList items={data.languages_spoken?.map((l: string) => l.toUpperCase())} />} span={3} />
      </Section>

      <Section title="Coordinates">
        <Field label="Latitude" value={data.latitude} />
        <Field label="Longitude" value={data.longitude} />
        <Field
          label="Google Maps"
          value={data.google_maps_url ? <a href={data.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-[var(--terracotta,#B8542A)] hover:underline">Open in Maps ↗</a> : null}
        />
        <Field label="Google Plus Code" value={data.google_plus_code} />
        <Field label="what3words" value={data.what3words} span={2} />
      </Section>

      <Section title="Transport">
        <Field label="Airport distance" value={data.airport_distance_km ? `${data.airport_distance_km} km` : null} />
        <Field label="Airport drive time" value={data.airport_drive_time_min ? `${data.airport_drive_time_min} min` : null} />
        <Field label="Train distance" value={data.train_distance_km ? `${data.train_distance_km} km` : null} />
        <Field label="Train drive time" value={data.train_drive_time_min ? `${data.train_drive_time_min} min` : null} />
        <Field label="Bus drive time" value={data.bus_drive_time_min ? `${data.bus_drive_time_min} min` : null} />
        <Field
          label="Shuttle"
          value={data.shuttle_available ? <Chip tone="green">Available</Chip> : <Chip tone="muted">Not available</Chip>}
        />
        <Field label="Shuttle details" value={data.shuttle_description} span={3} />
      </Section>

      <Section title="Climate">
        <Field
          label="Temp range"
          value={
            data.climate_temp_min_c != null && data.climate_temp_max_c != null
              ? `${data.climate_temp_min_c}°C – ${data.climate_temp_max_c}°C`
              : null
          }
        />
        <Field label="Rainy months" value={data.climate_rainy_months} />
        <Field label="Summary" value={data.climate_summary} span={3} />
      </Section>
    </>
  );
}
