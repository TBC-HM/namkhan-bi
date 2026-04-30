// components/nav/Banner.tsx
// Top moss-green banner with eyebrow, serif title, and right-aligned meta.

interface Props {
  eyebrow: string;       // mono caption above title
  title: string;         // main title; wrap accent in <em>...</em>
  titleEmphasis?: string;// optional italic accent (rendered after title)
  meta?: React.ReactNode;// right-side meta block
}

export default function Banner({ eyebrow, title, titleEmphasis, meta }: Props) {
  return (
    <div className="banner">
      <div className="banner-row">
        <div>
          <div className="banner-eyebrow">{eyebrow}</div>
          <div className="banner-title">
            {title}
            {titleEmphasis && <> · <em>{titleEmphasis}</em></>}
          </div>
        </div>
        {meta && <div className="banner-meta">{meta}</div>}
      </div>
    </div>
  );
}
