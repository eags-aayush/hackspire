import React from 'react';
import { Card } from './Card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple';
  status?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  subtext,
  icon: Icon,
  variant = 'blue',
  status,
}: MetricCardProps) {
  const iconVariants = {
    blue: 'text-[#14213d] dark:text-[#fca311] bg-[#14213d]/10 dark:bg-[#14213d] border-[#14213d]/25 dark:border-[#fca311]/40',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-950/60 border-emerald-500/30 dark:border-emerald-800/50',
    amber: 'text-amber-700 dark:text-[#fca311] bg-[#fca311]/15 dark:bg-[#fca311]/20 border-[#fca311]/40',
    red: 'text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-950/60 border-red-500/30 dark:border-red-800/50',
    purple: 'text-purple-600 dark:text-purple-300 bg-purple-500/10 dark:bg-purple-950/60 border-purple-500/30 dark:border-purple-800/50',
  };

  return (
    <Card accent={variant} hoverEffect className="relative overflow-hidden group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#5c677d] dark:text-[#94a3b8]">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl lg:text-3xl font-extrabold font-mono tracking-tight text-[#000000] dark:text-white">
              {value}
            </span>
            {unit && (
              <span className="text-xs font-semibold text-[#5c677d] dark:text-[#94a3b8]">
                {unit}
              </span>
            )}
          </div>
          {subtext && (
            <p className="mt-1 text-xs text-[#5c677d] dark:text-[#94a3b8]">
              {subtext}
            </p>
          )}
        </div>
        <div
          className={cn(
            'p-3 rounded-xl border shadow-sm transition-transform duration-300 group-hover:scale-110',
            iconVariants[variant]
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {status && (
        <div className="mt-3.5 pt-2.5 border-t border-[#e5e5e5] dark:border-[#14213d]/80 flex items-center justify-between text-xs text-[#5c677d] dark:text-[#94a3b8]">
          <span>Target / Benchmark</span>
          <span className="font-mono font-bold text-[#14213d] dark:text-[#fca311]">
            {status}
          </span>
        </div>
      )}
    </Card>
  );
}
