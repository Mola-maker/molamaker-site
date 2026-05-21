'use client';
import { useRef, type ReactNode } from 'react';

export default function PortraitTilt({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.transform = `perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
  };

  const leave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(600px) rotateY(0) rotateX(0)';
  };

  return (
    <div
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      style={{ transition: 'transform .3s ease', transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  );
}
