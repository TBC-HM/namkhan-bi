// components/settings/panels/PoliciesPanel.tsx
import { PanelHeader, Field, Section, ChipList, EmptyState, formatTime, formatDate } from './_shared';

export default function PoliciesPanel({ data }: { data: any }) {
  if (!data) return <><PanelHeader title="Policies" /><EmptyState message="No policies record found." /></>;

  return (
    <>
      <PanelHeader title="Policies" subtitle="Check-in/out, booking terms, payment, cancellation" />

      <Section title="Check in / out">
        <Field label="Check-in time" value={formatTime(data.check_in_time)} />
        <Field label="Check-out time" value={formatTime(data.check_out_time)} />
        <Field label="Recommended min nights" value={data.recommended_min_nights} />
        <Field label="Policy effective from" value={formatDate(data.effective_from)} />
        <Field label="Source document" value={data.source_doc_url ? <a href={data.source_doc_url} target="_blank" rel="noopener noreferrer" className="text-[var(--terracotta,#B8542A)] hover:underline">View source ↗</a> : null} span={2} />
      </Section>

      <Section title="Booking confirmation">
        <Field label="Confirmation rules" value={<p className="leading-relaxed whitespace-pre-wrap">{data.confirmation_rules}</p>} span={3} />
        <Field label="Required guest details" value={<ChipList items={data.required_guest_details} />} span={2} />
        <Field label="Guest details deadline" value={data.guest_details_deadline_days ? `${data.guest_details_deadline_days} days` : null} />
        <Field label="Non-compliance consequence" value={<p className="leading-relaxed whitespace-pre-wrap">{data.non_compliance_consequence}</p>} span={3} />
      </Section>

      <Section title="Payment & terms">
        <Field label="FIT payment terms" value={data.fit_payment_terms} span={3} />
        <Field label="Group payment terms" value={data.group_payment_terms} span={3} />
        <Field label="Accepted payment methods" value={<ChipList items={data.accepted_payment_methods} />} span={3} />
      </Section>

      <Section title="Cancellation & changes">
        <Field label="Cancellation policy" value={<p className="leading-relaxed whitespace-pre-wrap">{data.cancellation_policy}</p>} span={3} />
        <Field label="No-show policy" value={<p className="leading-relaxed whitespace-pre-wrap">{data.no_show_policy}</p>} span={3} />
        <Field label="Early departure policy" value={<p className="leading-relaxed whitespace-pre-wrap">{data.early_departure_policy}</p>} span={3} />
        <Field label="Modification policy" value={<p className="leading-relaxed whitespace-pre-wrap">{data.modification_policy}</p>} span={3} />
      </Section>

      <Section title="Groups & retreats">
        <Field label="Group booking terms" value={<p className="leading-relaxed whitespace-pre-wrap">{data.group_booking_terms}</p>} span={3} />
      </Section>

      <Section title="Commercial approach">
        <Field label="Selling approach" value={<p className="leading-relaxed whitespace-pre-wrap">{data.selling_approach}</p>} span={3} />
        <Field label="Liability clause" value={<p className="leading-relaxed whitespace-pre-wrap">{data.liability_clause}</p>} span={3} />
        <Field label="Final note" value={<p className="leading-relaxed whitespace-pre-wrap">{data.final_note}</p>} span={3} />
      </Section>
    </>
  );
}
