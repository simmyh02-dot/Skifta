// Minimal line-icon set, sized to the current font (1em) and inheriting
// `currentColor`. Stroke-based to match the light, professional aesthetic.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  );
}

export function DocIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 2.75h7L19 8.5V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z" />
      <path d="M13 2.75V8.5h5M8.5 13h7M8.5 16.5h7" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </Base>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
    </Base>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4.5v15M6 13.5l6 6 6-6" />
    </Base>
  );
}
