import { Section } from '@/components/sections/Section';

export default function Promotions() {
  return (
    <Section title="Promotions" tag="Phase 2" greyed greyedReason="Cloudbeds getPromotions endpoint not yet synced">
      <div className="text-muted text-sm">
        Active promo tracking · wash rate · ADR uplift. Pending Cloudbeds promo endpoint integration.
      </div>
    </Section>
  );
}
