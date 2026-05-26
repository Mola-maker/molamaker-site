import type { SVGProps } from 'react';

interface MarkProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export default function BracketRight({
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
      {/* Right square bracket — inner arm, down-stroke, outer arm */}
      <path d="M16 4 L20 4 L20 20 L16 20" />
    </svg>
  );
}
