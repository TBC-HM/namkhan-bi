import { GreyPlaceholder, Section } from '@/components/sections/Section';

export default function CompSet() {
  return (
    <Section title="Comp Set" tag="Phase 2" greyed greyedReason="Comp Set scraper agent — Phase 2 backlog">
      <div className="text-muted text-sm">
        Live competitor rates · parity score · rate-to-rating ratio. Requires the comp-set
        AI scraper from <span className="serif text-sand">12_BACKLOG_AND_ROADMAP</span> §Phase 2.
      </div>
    </Section>
  );
}
