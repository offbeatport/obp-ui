import {
  siReddit, siYcombinator, siX, siBluesky, siYoutube,
  siTrustpilot, siProducthunt,
  siStackoverflow, siGithub, siDevdotto, siMastodon,
  siIndiehackers, siLobsters,
  siFirefox, siApplepodcasts, siLemmy, siGooglesearchconsole,
} from "simple-icons";
import {
  MessageSquare, Briefcase,
  FileText, Scale,
} from "lucide-react";
import type { ChannelType } from "./channels";

type IconProps = {
  size?: number;
  style?: React.CSSProperties;
};

function SiIcon({ path, size = 13, style }: IconProps & { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      style={{ flexShrink: 0, ...style }}
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

const ICONS: Record<ChannelType, (props: IconProps) => React.ReactElement> = {
  reddit:        (p) => <SiIcon path={siReddit.path} {...p} />,
  hn:            (p) => <SiIcon path={siYcombinator.path} {...p} />,
  twitter:       (p) => <SiIcon path={siX.path} {...p} />,
  bluesky:       (p) => <SiIcon path={siBluesky.path} {...p} />,
  youtube:       (p) => <SiIcon path={siYoutube.path} {...p} />,
  podcast:       (p) => <SiIcon path={siApplepodcasts.path} {...p} />,
  trustpilot:    (p) => <SiIcon path={siTrustpilot.path} {...p} />,
  producthunt:   (p) => <SiIcon path={siProducthunt.path} {...p} />,
  stackoverflow: (p) => <SiIcon path={siStackoverflow.path} {...p} />,
  github:        (p) => <SiIcon path={siGithub.path} {...p} />,
  devto:         (p) => <SiIcon path={siDevdotto.path} {...p} />,
  mastodon:      (p) => <SiIcon path={siMastodon.path} {...p} />,
  indie_hackers: (p) => <SiIcon path={siIndiehackers.path} {...p} />,
  lobsters:      (p) => <SiIcon path={siLobsters.path} {...p} />,

  community:     ({ size = 13, style }) => <MessageSquare size={size} style={{ flexShrink: 0, ...style }} aria-hidden />,
  jobs:          ({ size = 13, style }) => <Briefcase size={size} style={{ flexShrink: 0, ...style }} aria-hidden />,
  firefox:       (p) => <SiIcon path={siFirefox.path} {...p} />,
  edgar:         ({ size = 13, style }) => <FileText size={size} style={{ flexShrink: 0, ...style }} aria-hidden />,
  regulatory:    ({ size = 13, style }) => <Scale size={size} style={{ flexShrink: 0, ...style }} aria-hidden />,
  lemmy:         (p) => <SiIcon path={siLemmy.path} {...p} />,
  google_trends: (p) => <SiIcon path={siGooglesearchconsole.path} {...p} />,
};

export function ChannelIcon({ type, size = 13, style }: { type: ChannelType } & IconProps) {
  const Icon = ICONS[type];
  return Icon ? <Icon size={size} style={style} /> : null;
}
