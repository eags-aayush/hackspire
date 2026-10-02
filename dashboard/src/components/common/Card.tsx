import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: 'none' | 'blue' | 'emerald' | 'amber' | 'red' | 'purple';
  hoverEffect?: boolean;
}

export function Card({
  children,
  accent = 'none',
  hoverEffect = false,
  className,
  ...props
}: CardProps) {
  const accentBorders = {
    none: 'border-[#e5e5e5] dark:border-[#14213d]',
    blue: 'border-[#14213d]/30 dark:border-[#14213d]/80 hover:border-[#14213d] dark:hover:border-[#38bdf8]',
    emerald: 'border-emerald-500/30 dark:border-emerald-500/40 hover:border-emerald-500/70',
    amber: 'border-[#fca311]/40 dark:border-[#fca311]/40 hover:border-[#fca311]',
    red: 'border-red-500/30 dark:border-red-500/50 hover:border-red-500/80',
    purple: 'border-purple-500/30 dark:border-purple-500/40 hover:border-purple-500/70',
  };

  return (
    <div
      className={cn(
        'bg-white/95 dark:bg-[#14213d]/40 backdrop-blur-xl rounded-2xl border p-5 shadow-sm dark:shadow-xl dark:shadow-black/50 text-[#14213d] dark:text-[#ffffff] transition-all duration-300',
        accentBorders[accent],
        hoverEffect &&
          'hover:-translate-y-1 hover:shadow-md dark:hover:shadow-[0_12px_32px_-10px_rgba(252,163,17,0.15)] hover:border-[#fca311]/60',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
