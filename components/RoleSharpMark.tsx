import type { SVGProps } from "react";
import { useId } from "react";

type RoleSharpMarkProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

export default function RoleSharpMark({
  size = 34,
  width,
  height,
  ...props
}: RoleSharpMarkProps) {
  const reactId = useId().replace(/:/g, "");
  const backgroundId = `rs-mark-bg-${reactId}`;
  const accentId = `rs-mark-accent-${reactId}`;

  return (
    <svg
      viewBox="0 0 64 64"
      width={width ?? size}
      height={height ?? size}
      focusable="false"
      aria-hidden={props["aria-label"] ? undefined : true}
      {...props}
    >
      <defs>
        <linearGradient id={backgroundId} x1="8" y1="6" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#174F98" />
          <stop offset=".58" stopColor="#123B7A" />
          <stop offset="1" stopColor="#071A33" />
        </linearGradient>
        <linearGradient id={accentId} x1="31" y1="35" x2="51" y2="51" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE8A8" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${backgroundId})`} />
      <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="15.25" fill="none" stroke="#FFFFFF" strokeOpacity=".18" strokeWidth="1.5" />
      <path d="M16 51V13h18.5C44 13 50 18 50 26.2c0 8.2-6 13.8-15.5 13.8H25v11H16Zm9-19h9.2c4.4 0 6.7-1.9 6.7-5.6 0-3.8-2.3-5.7-6.7-5.7H25V32Z" fill="#FFFFFF" />
      <path d="M31 34.5h8.2L51 51H40.2L30 38.2l1-3.7Z" fill={`url(#${accentId})`} />
    </svg>
  );
}
