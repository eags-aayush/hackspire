import React from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { Card } from '../common/Card';
import { LATENCY_BUDGET_MS } from '@/lib/constants';
import { getLatencyRating } from '@/lib/utils';
import { Gauge, CheckCircle2, AlertOctagon } from 'lucide-react';

export function LatencyTracker() {
  const { metrics } = useRealtime();
  const { avgLatency, maxLatency, count, packetsPerSec } = metrics;
  const rating = getLatencyRating(avgLatency);

  const budgetPercentage = Math.min(100, Math.round((avgLatency / LATENCY_BUDGET_MS) * 100));
  const isPassing = avgLatency <= LATENCY_BUDGET_MS;

  return (
    <Card className="bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-[#fca311]" />
            <h3 className="text-sm lg:text-base font-bold text-[#000000] dark:text-white tracking-wide">
              Realtime Transport Latency Benchmark
            </h3>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#f4f5f7] dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border border-[#e5e5e5] dark:border-[#14213d]">
              PRD Target: &lt;500ms
            </span>
          </div>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-1">
            Sensor-origin timestamp vs client DOM render latency (non-blocking pipeline proof)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>{metrics.transportFormat || 'Protobuf (Binary)'}</span>
            {metrics.estimatedBandwidthSavedPercent ? (
              <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-extrabold">
                (-{metrics.estimatedBandwidthSavedPercent}%)
              </span>
            ) : null}
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              isPassing
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
            }`}
          >
            {isPassing ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
            <span>{isPassing ? 'Budget Met (Pass)' : 'Latency Alert'}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/70 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono text-[#5c677d] dark:text-[#94a3b8] font-bold">
            {packetsPerSec} pkt/s
          </div>
        </div>
      </div>

      {/* Latency Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 my-4">
        <div className="p-3.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d]">
          <span className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] block font-semibold">Average Latency</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-2xl font-black font-mono ${rating.color}`}>
              {avgLatency}
            </span>
            <span className="text-xs text-[#5c677d] dark:text-[#94a3b8] font-mono">ms</span>
          </div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] block mt-0.5">{rating.label}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d]">
          <span className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] block font-semibold">Max Latency (Peak)</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-[#000000] dark:text-white">
              {maxLatency}
            </span>
            <span className="text-xs text-[#5c677d] dark:text-[#94a3b8] font-mono">ms</span>
          </div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] block mt-0.5">Historical maximum</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d]">
          <span className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] block font-semibold">Total Updates</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-[#14213d] dark:text-[#fca311]">
              {count.toLocaleString()}
            </span>
          </div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] block mt-0.5">Deduped readings</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d]">
          <span className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] block font-semibold">Coalesce Window</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">250</span>
            <span className="text-xs text-[#5c677d] dark:text-[#94a3b8] font-mono">ms</span>
          </div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] block mt-0.5">RxJS bufferTime batch</span>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 dark:border-blue-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">Wire Packet Size</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold">
              Protobuf
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {metrics.lastPacketBytes || 24}
            </span>
            <span className="text-xs text-[#5c677d] dark:text-[#94a3b8] font-mono">Bytes</span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
            vs ~{metrics.lastJsonBytesEquivalent || 155}B JSON (-{metrics.estimatedBandwidthSavedPercent || 80}%)
          </span>
        </div>
      </div>

      {/* Visual Budget Progress Bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs font-mono text-[#5c677d] dark:text-[#94a3b8] mb-1.5">
          <span>Budget Consumption ({budgetPercentage}% of 500ms target)</span>
          <span className="text-[#5c677d] dark:text-[#94a3b8]">0ms ---------- 250ms ---------- 500ms max</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-[#e5e5e5] dark:bg-[#000000] overflow-hidden border border-[#d4d4d4] dark:border-[#14213d]">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              avgLatency <= 250
                ? 'bg-gradient-to-r from-emerald-500 to-[#fca311]'
                : avgLatency <= 500
                ? 'bg-gradient-to-r from-[#14213d] to-[#fca311]'
                : 'bg-gradient-to-r from-[#fca311] to-red-500'
            }`}
            style={{ width: `${Math.max(4, budgetPercentage)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
