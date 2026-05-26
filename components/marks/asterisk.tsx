import type { SVGProps } from 'react';

interface MarkProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export default function Asterisk({
  size = 24,
  className,
  ...props
}: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/* Vertical */}
      <line x1="12" y1="2" x2="12" y2="22" />
      {/* Horizontal */}
      <line x1="2" y1="12" x2="22" y2="12" />
      {/* Diagonal NE-SW */}
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      {/* Diagonal NW-SE */}
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
    </svg>
  );
}
