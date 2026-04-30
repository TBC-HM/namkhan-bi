// components/nav/Banner.tsx
import UserMenu from './UserMenu';
import { getCurrentUser } from '@/lib/currentUser';

interface Props {
  eyebrow?: string;
  title: React.ReactNode;
  titleEmphasis?: React.ReactNode;
  meta?: React.ReactNode;
}

export default async function Banner({ eyebrow, title, titleEmphasis, meta }: Props) {
  const user = await getCurrentUser();

  return (
    <div className="banner">
      <div className="banner-row">
        <div>
          {eyebrow && <div className="banner-eyebrow">{eyebrow}</div>}
          <div className="banner-title">
            {title}
            {titleEmphasis && <> · <em>{titleEmphasis}</em></>}
          </div>
        </div>
        <div className="banner-right">
          {meta && <div className="banner-meta">{meta}</div>}
          <UserMenu user={user} />
        </div>
      </div>
    </div>
  );
}
