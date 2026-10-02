import React from 'react';
import { Card } from './Card';
import { Radio, RefreshCw, AlertCircle } from 'lucide-react';
import { useRealtime } from '@/hooks/useRealtime';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = 'Awaiting Telemetry Ingestion',
  message = 'Connecting to NestJS WebSocket Gateway and awaiting sensor snapshots from the simulator or gateway ESP32 mesh...',
  actionText = 'Force Reconnect',
  onAction,
}: EmptyStateProps) {
  const { reconnect, isConnected } = useRealtime();

  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-[#e5e5e5] dark:border-[#14213d]">
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-[#14213d]/10 dark:bg-[#14213d] border border-[#14213d]/25 dark:border-[#fca311]/50 flex items-center justify-center text-[#14213d] dark:text-[#fca311] shadow-inner">
          <Radio className="w-8 h-8 animate-pulse" />
        </div>
        {!isConnected && (
          <div className="absolute -bottom-1 -right-1 p-1 bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-800 rounded-full text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}
      </div>

      <h3 className="text-lg font-bold text-[#000000] dark:text-white tracking-wide">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[#5c677d] dark:text-[#94a3b8] max-w-md">
        {message}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onAction || reconnect}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#fca311] hover:bg-[#ffb733] text-[#000000] text-xs font-bold tracking-wide transition-all shadow-md shadow-[#fca311]/25 hover:scale-105 active:scale-95 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {actionText}
        </button>

        <span className="text-xs text-[#5c677d] dark:text-[#94a3b8] font-mono">
          Status: {isConnected ? 'WebSocket Connected' : 'Connecting to ws://localhost:3000...'}
        </span>
      </div>
    </Card>
  );
}
