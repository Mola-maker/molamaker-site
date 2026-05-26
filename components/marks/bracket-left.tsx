import type { SVGProps } from 'react';

interface MarkProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export default function BracketLeft({
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
      {/* Left square bracket — outer arm, down-stroke, inner arm */}
      <path d="M8 4 L4 4 L4 20 L8 20" />
    </svg>
  );
}
