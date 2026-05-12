// components/settings/panels/BrandPanel.tsx
import { PanelHeader, Field, Section, ChipList, Chip, EmptyState } from './_shared';

export default function BrandPanel({ data }: { data: any }) {
  if (!data) return <><PanelHeader title="Brand" /><EmptyState message="No brand record found." /></>;

  const palette = Array.isArray(data.brand_palette) ? data.brand_palette : [];
  const typography = data.brand_typography || {};

  return (
    <>
      <PanelHeader title="Brand" subtitle="Visual identity, palette, typography, descriptions" />

      <Section title="Marketing copy">
        <Field label="Website" value={data.website_url ? <a href={data.website_url} target="_blank" rel="noopener noreferrer" className="text-[var(--terracotta,#B8542A)] hover:underline">{data.website_url} ↗</a> : null} span={2} />
        <Field label="Brand assets" value={data.brand_assets_url} />
        <Field label="Taglines" value={<ChipList items={data.brand_taglines} />} span={3} />
        <Field label="Short description" value={<p className="leading-relaxed">{data.short_description}</p>} span={3} />
        <Field
          label="Long description"
          value={
            <details className="cursor-pointer">
              <summary className="text-[var(--terracotta,#B8542A)] hover:underline text-sm">Show full description</summary>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-sm">{data.long_description}</p>
            </details>
          }
          span={3}
        />
        <Field
          label="Unique selling points"
          value={
            data.unique_selling_points?.length ? (
              <ul className="space-y-1.5 list-disc list-inside marker:text-[var(--sand,#B8A878)]">
                {data.unique_selling_points.map((usp: string, i: number) => (
                  <li key={i}>{usp}</li>
                ))}
              </ul>
            ) : null
          }
          span={3}
        />
      </Section>

      <Section title="Visual assets">
        <Field label="Logo URL" value={data.logo_url} span={2} />
        <Field label="Hero image" value={data.hero_image_url} />
        <Field
          label="Primary brand color"
          value={
            data.brand_color_hex ? (
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-6 h-6 rounded border border-[var(--sand,#B8A878)]/40"
                  style={{ backgroundColor: data.brand_color_hex }}
                />
                <code className="font-mono text-xs">{data.brand_color_hex}</code>
              </div>
            ) : null
          }
        />
      </Section>

      {palette.length > 0 && (
        <Section title="Palette">
          <div className="col-span-3 grid grid-cols-2 md:grid-cols-3 gap-3">
            {palette.map((swatch: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white/60 rounded border border-[var(--sand,#B8A878)]/20">
                <span
                  className="inline-block w-10 h-10 rounded border border-[var(--sand,#B8A878)]/40 flex-shrink-0"
                  style={{ backgroundColor: swatch.hex }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{swatch.name}</p>
                  <p className="text-xs font-mono text-[var(--primary,#1F3A2E)]/60">{swatch.hex}</p>
                  {swatch.role && <p className="text-xs text-[var(--sand,#B8A878)] uppercase tracking-wider">{swatch.role}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {Object.keys(typography).length > 0 && (
        <Section title="Typography">
          {typography.display && (
            <Field
              label="Display"
              value={
                <div>
                  <p className="font-medium">{typography.display.family}</p>
                  {typography.display.role && <p className="text-xs text-[var(--primary,#1F3A2E)]/60">{typography.display.role}</p>}
                </div>
              }
            />
          )}
          {typography.body && (
            <Field
              label="Body"
              value={
                <div>
                  <p className="font-medium">{typography.body.family}</p>
                  {typography.body.role && <p className="text-xs text-[var(--primary,#1F3A2E)]/60">{typography.body.role}</p>}
                </div>
              }
            />
          )}
        </Section>
      )}
    </>
  );
}
