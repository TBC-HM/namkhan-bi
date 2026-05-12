// components/settings/panels/IdentityPanel.tsx
import { PanelHeader, Field, Section, ChipList, Chip, EmptyState } from './_shared';

export default function IdentityPanel({ data, propertyId }: { data: any; propertyId: number }) {
  if (!data) return <><PanelHeader title="Identity" /><EmptyState message="No identity record found." /></>;

  return (
    <>
      <PanelHeader
        title="Identity"
        subtitle="Legal entity, classification, and licensing"
        action={<Chip>Property ID {propertyId}</Chip>}
      />
      <Section title="Legal Entity">
        <Field label="Legal name" value={data.legal_name} span={2} />
        <Field label="Trading name" value={data.trading_name} />
        <Field label="Business license #" value={data.business_license_no} />
        <Field label="Tax ID" value={data.tax_id} />
        <Field label="VAT registered" value={data.vat_registered ? <Chip tone="green">Yes</Chip> : <Chip tone="muted">No</Chip>} />
      </Section>
      <Section title="Classification">
        <Field
          label="Star rating"
          value={data.star_rating ? '★'.repeat(data.star_rating) + ` (${data.star_rating})` : null}
        />
        <Field label="Category" value={data.category} span={2} />
        <Field label="Affiliations" value={<ChipList items={data.affiliations} />} span={3} />
      </Section>
    </>
  );
}
