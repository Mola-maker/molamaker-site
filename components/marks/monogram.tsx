import type { SVGProps } from 'react';

interface MarkProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export default function Monogram({
  size = 24,
  className,
  ...props
}: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/*
        Geometric lowercase "m" monogram.
        Three vertical legs connected by a horizontal top bar,
        built to remain legible down to favicon sizes (16 px).
        Outer-boundary path traces clockwise:
          bottom-left up to top-left, across top bar,
          down right edge, then steps back through the
          leg gaps before closing.
      */}
      <path d="M 4 21 V 4 H 20 V 21 H 17 V 7 H 14 V 21 H 11 V 7 H 8 V 21 Z" />
    </svg>
  );
}
