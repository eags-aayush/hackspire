import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  pulse?: boolean;
}

export function Badge({
  children,
  variant = 'default',
  pulse = false,
  className,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default:
      'bg-[#f4f5f7] dark:bg-[#14213d] text-[#14213d] dark:text-[#e5e5e5] border-[#e5e5e5] dark:border-[#14213d]',
    success:
      'bg-emerald-500/15 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 dark:border-emerald-800/60',
    warning:
      'bg-[#fca311]/15 dark:bg-[#fca311]/20 text-amber-800 dark:text-[#fca311] border-[#fca311]/40',
    danger:
      'bg-red-500/15 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-500/30 dark:border-red-800/60',
    info:
      'bg-[#14213d]/10 dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border-[#14213d]/25 dark:border-[#fca311]/40',
    outline:
      'bg-transparent text-[#14213d] dark:text-[#e5e5e5] border-[#e5e5e5] dark:border-[#14213d]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border transition-colors select-none',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              variant === 'success' && 'bg-emerald-400',
              variant === 'warning' && 'bg-[#fca311]',
              variant === 'danger' && 'bg-red-400',
              variant === 'info' && 'bg-[#fca311]',
              variant === 'default' && 'bg-slate-400'
            )}
          />
          <span
            className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              variant === 'success' && 'bg-emerald-500',
              variant === 'warning' && 'bg-[#fca311]',
              variant === 'danger' && 'bg-red-500',
              variant === 'info' && 'bg-[#fca311]',
              variant === 'default' && 'bg-slate-500'
            )}
          />
        </span>
      )}
      {children}
    </span>
  );
}
