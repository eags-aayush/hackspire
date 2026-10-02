"use client";

import React from 'react';

interface TooltipPayloadItem {
  name: string;
  value: number | string;
  color?: string;
  dataKey?: string;
  unit?: string;
  payload?: any;
}

interface RechartsCustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  sensorType?: string;
  unit?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  invertedRisk?: boolean; // e.g. distance where LOWER is dangerous
}

export function RechartsCustomTooltip({
  active,
  payload,
  label,
  unit,
  warningThreshold,
  criticalThreshold,
  invertedRisk = false,
}: RechartsCustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const primary = payload[0];
  const dataPoint = primary.payload || {};
  const numericVal = typeof primary.value === 'number' ? primary.value : parseFloat(primary.value as string);

  // Determine safety state
  let status: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
  if (!isNaN(numericVal) && warningThreshold !== undefined && criticalThreshold !== undefined) {
    if (invertedRisk) {
      if (numericVal <= criticalThreshold) status = 'CRITICAL';
      else if (numericVal <= warningThreshold) status = 'WARNING';
    } else {
      if (numericVal >= criticalThreshold) status = 'CRITICAL';
      else if (numericVal >= warningThreshold) status = 'WARNING';
    }
  }

  const statusColors = {
    SAFE: 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10',
    WARNING: 'text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10',
    CRITICAL: 'text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10',
  };

  return (
    <div className="z-50 min-w-[200px] p-3 rounded-2xl bg-white/95 text-slate-900 border-slate-200/90 shadow-2xl dark:bg-[#090d16]/95 dark:text-white dark:border-slate-800 text-xs font-mono backdrop-blur-xl transition-all pointer-events-none border">
      {/* Tooltip Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold text-slate-800 dark:text-slate-300">
          {dataPoint.nodeId ? `Node: ${dataPoint.nodeId}` : label || 'Telemetry Point'}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${statusColors[status]}`}
        >
          {status}
        </span>
      </div>

      {/* Series Items */}
      <div className="mt-2 space-y-1.5">
        {payload.map((item, idx) => {
          const displayUnit = item.unit || unit || '';
          const valNum = typeof item.value === 'number' ? item.value.toFixed(2) : item.value;
          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: item.color || '#fca311' }}
                />
                <span className="capitalize font-medium">{item.name || 'Value'}:</span>
              </div>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {valNum} {displayUnit}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer Meta */}
      <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>{dataPoint.timeLabel || label || 'Live'}</span>
        {dataPoint.sequenceNumber !== undefined && (
          <span className="text-slate-600 dark:text-slate-400 font-semibold">Seq #{dataPoint.sequenceNumber}</span>
        )}
      </div>
    </div>
  );
}
