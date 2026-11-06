import type { SVGProps } from "react";

// Lucide-style stroke icons (SVG, no emoji). 1.8 stroke, currentColor.
export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

const S = ({ size = 20, ...props }: IconProps): SVGProps<SVGSVGElement> => ({
  ...props,
  width: props.width ?? size,
  height: props.height ?? size,
  viewBox: props.viewBox ?? "0 0 24 24",
  fill: props.fill ?? "none",
  stroke: props.stroke ?? "currentColor",
  strokeWidth: props.strokeWidth ?? 1.8,
  strokeLinecap: props.strokeLinecap ?? "round",
  strokeLinejoin: props.strokeLinejoin ?? "round",
  focusable: props.focusable ?? "false",
  "aria-hidden":
    props["aria-label"] || props["aria-labelledby"]
      ? props["aria-hidden"]
      : (props["aria-hidden"] ?? true),
});

export const Check = (p: IconProps) => <svg {...S(p)}><path d="M20 6 9 17l-5-5" /></svg>;
export const X = (p: IconProps) => <svg {...S(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>;
export const Menu = (p: IconProps) => <svg {...S(p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
export const Target = (p: IconProps) => <svg {...S(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
export const FileText = (p: IconProps) => <svg {...S(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>;
export const Sparkles = (p: IconProps) => <svg {...S(p)}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" /></svg>;
export const Download = (p: IconProps) => <svg {...S(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
export const Lock = (p: IconProps) => <svg {...S(p)}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
export const Bolt = (p: IconProps) => <svg {...S(p)}><path d="M13 2 3 14h9l-1 8 10-12h-9z" /></svg>;
export const Shield = (p: IconProps) => <svg {...S(p)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>;
export const Coins = (p: IconProps) => <svg {...S(p)}><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82" /></svg>;
export const User = (p: IconProps) => <svg {...S(p)}><circle cx="12" cy="8" r="4" /><path d="M6 21v-1a6 6 0 0 1 12 0v1" /></svg>;
export const Settings = (p: IconProps) => <svg {...S(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.81 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
export const LogOut = (p: IconProps) => <svg {...S(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>;
export const ChevronRight = (p: IconProps) => <svg {...S(p)}><path d="m9 18 6-6-6-6" /></svg>;
export const Briefcase = (p: IconProps) => <svg {...S(p)}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
export const MessageSquare = (p: IconProps) => <svg {...S(p)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
export const Bell = (p: IconProps) => <svg {...S(p)}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
export const Linkedin = (p: IconProps) => <svg {...S(p)}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>;
export const Moon = (p: IconProps) => <svg {...S(p)}><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" /></svg>;
export const Sun = (p: IconProps) => <svg {...S(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>;
export const Plus = (p: IconProps) => <svg {...S(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const Pencil = (p: IconProps) => <svg {...S(p)}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>;
export const Copy = (p: IconProps) => <svg {...S(p)}><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>;
export const Trash = (p: IconProps) => <svg {...S(p)}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" /></svg>;
export const Grip = (p: IconProps) => <svg {...S(p)}><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></svg>;
export const ChevronDown = (p: IconProps) => <svg {...S(p)}><path d="m6 9 6 6 6-6" /></svg>;
export const ChevronUp = (p: IconProps) => <svg {...S(p)}><path d="m18 15-6-6-6 6" /></svg>;
export const Info = (p: IconProps) => <svg {...S(p)}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>;
export const AlertTriangle = (p: IconProps) => <svg {...S(p)}><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>;
export const Upload = (p: IconProps) => <svg {...S(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 9l5-5 5 5M12 4v12" /></svg>;
export const Grid = (p: IconProps) => <svg {...S(p)}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
export const Server = (p: IconProps) => <svg {...S(p)}><rect x="2" y="3" width="20" height="8" rx="2" /><rect x="2" y="13" width="20" height="8" rx="2" /><path d="M6 7h.01M6 17h.01" /></svg>;
export const Users = (p: IconProps) => <svg {...S(p)}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
export const Activity = (p: IconProps) => <svg {...S(p)}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
export const CreditCard = (p: IconProps) => <svg {...S(p)}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
export const RefreshCw = (p: IconProps) => <svg {...S(p)}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></svg>;
export const LifeBuoy = (p: IconProps) => <svg {...S(p)}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><path d="m4.93 4.93 4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M14.83 9.17 18.36 5.64M4.93 19.07l4.24-4.24" /></svg>;
export const BarChart3 = (p: IconProps) => <svg {...S(p)}><path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" /></svg>;
export const GraduationCap = (p: IconProps) => <svg {...S(p)}><path d="M22 10v6M2 10l10-5 10 5-10 5Z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>;
export const ArrowLeft = (p: IconProps) => <svg {...S(p)}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
export const Search = (p: IconProps) => <svg {...S(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
export const Globe = (p: IconProps) => <svg {...S(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
export const Mail = (p: IconProps) => <svg {...S(p)}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>;
export const Github = (p: IconProps) => <svg {...S(p)}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>;
export const Scan = (p: IconProps) => <svg {...S(p)}><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></svg>;
export const Eraser = (p: IconProps) => <svg {...S(p)}><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>;
