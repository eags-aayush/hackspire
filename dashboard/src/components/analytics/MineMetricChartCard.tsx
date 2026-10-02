"use client";

import React, { useState, useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  Maximize2,
  Minimize2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Layers,
  ShieldAlert,
} from 'lucide-react';

export interface MineSeriesConfig {
  key: string;
  name: string;
  color: string;
  unit?: string;
  type?: 'line' | 'area';
}

interface MineMetricChartCardProps {
  metricId: string; // e.g. mine.mesh/tilt/biaxial
  title: string;
  unit: string;
  data: any[];
  series: MineSeriesConfig[];
  warningThreshold?: number;
  criticalThreshold?: number;
  invertedRisk?: boolean; // e.g. distance where lower is dangerous
  height?: number;
  chartType?: 'line' | 'area';
  onExpand?: () => void;
  isExpanded?: boolean;
}

export function MineMetricChartCard({
  metricId,
  title,
  unit,
  data,
  series,
  warningThreshold,
  criticalThreshold,
  invertedRisk = false,
  height = 220,
  chartType: defaultChartType = 'line',
  onExpand,
  isExpanded = false,
}: MineMetricChartCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeChartType, setActiveChartType] = useState<'line' | 'area'>(defaultChartType);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    series.forEach(s => {
      init[s.key] = true;
    });
    return init;
  });

  // Calculate live statistics for each series from real data
  const seriesMetrics = useMemo(() => {
    return series.map(s => {
      const vals = data
        .map(d => (typeof d[s.key] === 'number' ? d[s.key] : null))
        .filter((v): v is number => v !== null && !isNaN(v));

      if (vals.length === 0) {
        return {
          ...s,
          last: 0,
          min: 0,
          max: 0,
          mean: 0,
          status: 'NORMAL' as const,
        };
      }

      const last = vals[vals.length - 1];
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = sum / vals.length;

      let status: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
      if (warningThreshold !== undefined && criticalThreshold !== undefined) {
        if (invertedRisk) {
          if (last <= criticalThreshold) status = 'CRITICAL';
          else if (last <= warningThreshold) status = 'WARNING';
        } else {
          if (last >= criticalThreshold) status = 'CRITICAL';
          else if (last >= warningThreshold) status = 'WARNING';
        }
      }

      return {
        ...s,
        last: Number(last.toFixed(2)),
        min: Number(min.toFixed(2)),
        max: Number(max.toFixed(2)),
        mean: Number(mean.toFixed(2)),
        status,
      };
    });
  }, [series, data, warningThreshold, criticalThreshold, invertedRisk]);

  const hasCritical = seriesMetrics.some(m => m.status === 'CRITICAL');
  const hasWarning = seriesMetrics.some(m => m.status === 'WARNING');

  const toggleSeries = (key: string) => {
    setVisibleSeries(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div
      className={`rounded-2xl border font-sans shadow-md transition-all flex flex-col justify-between backdrop-blur-xl relative overflow-hidden ${
        isDark
          ? 'bg-[#090d16]/95 text-slate-100'
          : 'bg-white/95 text-slate-900'
      } ${
        hasCritical
          ? 'border-red-500/70 shadow-red-500/15'
          : hasWarning
          ? 'border-amber-500/60 shadow-amber-500/10'
          : isDark
          ? 'border-[#14213d] hover:border-[#fca311]/40 shadow-black/40'
          : 'border-slate-200/90 hover:border-slate-300 shadow-slate-200/50'
      } ${isExpanded ? 'col-span-full' : ''}`}
    >
      {/* Card Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b rounded-t-2xl ${
          isDark
            ? 'bg-[#0d1424]/90 border-[#14213d]/80'
            : 'bg-slate-50/90 border-slate-200/80'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              hasCritical
                ? 'bg-red-500 animate-ping'
                : hasWarning
                ? 'bg-[#fca311] animate-pulse'
                : 'bg-emerald-500'
            }`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black tracking-wide font-mono truncate text-slate-900 dark:text-white">
                {title}
              </h4>
              <span className="text-[10px] font-mono text-amber-700 dark:text-[#fca311] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-[#fca311]/10 border border-amber-200 dark:border-[#fca311]/30 font-bold">
                {unit}
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
              {metricId}
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveChartType(prev => (prev === 'line' ? 'area' : 'line'))}
            className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
              activeChartType === 'area'
                ? 'bg-[#fca311]/20 text-amber-800 dark:text-[#fca311] border-[#fca311]/50 font-bold'
                : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Toggle Line/Area waveform"
          >
            {activeChartType === 'area' ? 'Area' : 'Line'}
          </button>

          {onExpand && (
            <button
              onClick={onExpand}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-[#fca311] hover:bg-[#fca311]/10 transition-all cursor-pointer"
              title={isExpanded ? 'Collapse' : 'Expand widget to full width'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="p-3 w-full" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          {activeChartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 12, right: 15, left: -20, bottom: 0 }}>
              <defs>
                {series.map(s => (
                  <linearGradient key={s.key} id={`mineGrad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={isDark ? 0.45 : 0.3} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? '#14213d' : '#e2e8f0'}
                vertical={false}
              />

              <XAxis
                dataKey="timeLabel"
                tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#64748b', fontFamily: 'monospace', fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: isDark ? '#14213d' : '#cbd5e1' }}
                minTickGap={25}
              />

              <YAxis
                tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#64748b', fontFamily: 'monospace', fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: isDark ? '#14213d' : '#cbd5e1' }}
                domain={['auto', 'auto']}
              />

              <Tooltip content={<MineChartTooltip unit={unit} isDark={isDark} />} />

              {/* DGMS Threshold Reference Lines */}
              {warningThreshold !== undefined && (
                <ReferenceLine
                  y={warningThreshold}
                  stroke={isDark ? '#fca311' : '#d97706'}
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                  label={{
                    value: `Warn: ${warningThreshold}`,
                    position: 'insideTopRight',
                    fill: isDark ? '#fca311' : '#d97706',
                    fontSize: 8,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  }}
                />
              )}

              {criticalThreshold !== undefined && (
                <ReferenceLine
                  y={criticalThreshold}
                  stroke={isDark ? '#ef4444' : '#dc2626'}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Danger: ${criticalThreshold}`,
                    position: 'insideTopRight',
                    fill: isDark ? '#ef4444' : '#dc2626',
                    fontSize: 8,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  }}
                />
              )}

              {series.map(s =>
                visibleSeries[s.key] !== false ? (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#mineGrad-${s.key})`}
                    dot={false}
                    activeDot={{ r: 4, stroke: isDark ? '#ffffff' : '#0f172a', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                ) : null
              )}
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 12, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? '#14213d' : '#e2e8f0'}
                vertical={false}
              />

              <XAxis
                dataKey="timeLabel"
                tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#64748b', fontFamily: 'monospace', fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: isDark ? '#14213d' : '#cbd5e1' }}
                minTickGap={25}
              />

              <YAxis
                tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#64748b', fontFamily: 'monospace', fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: isDark ? '#14213d' : '#cbd5e1' }}
                domain={['auto', 'auto']}
              />

              <Tooltip content={<MineChartTooltip unit={unit} isDark={isDark} />} />

              {warningThreshold !== undefined && (
                <ReferenceLine
                  y={warningThreshold}
                  stroke={isDark ? '#fca311' : '#d97706'}
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                  label={{
                    value: `Warn: ${warningThreshold}`,
                    position: 'insideTopRight',
                    fill: isDark ? '#fca311' : '#d97706',
                    fontSize: 8,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  }}
                />
              )}

              {criticalThreshold !== undefined && (
                <ReferenceLine
                  y={criticalThreshold}
                  stroke={isDark ? '#ef4444' : '#dc2626'}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Danger: ${criticalThreshold}`,
                    position: 'insideTopRight',
                    fill: isDark ? '#ef4444' : '#dc2626',
                    fontSize: 8,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  }}
                />
              )}

              {series.map(s =>
                visibleSeries[s.key] !== false ? (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, stroke: isDark ? '#ffffff' : '#0f172a', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                ) : null
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Series Telemetry Legend Table */}
      <div
        className={`border-t rounded-b-2xl px-3.5 py-2.5 text-[11px] font-mono overflow-x-auto ${
          isDark
            ? 'border-[#14213d]/80 bg-[#070a12]/90'
            : 'border-slate-200/90 bg-slate-50/90'
        }`}
      >
        <table className="w-full text-left">
          <thead>
            <tr
              className={`border-b text-[9px] uppercase tracking-wider ${
                isDark
                  ? 'text-slate-400 border-[#14213d]'
                  : 'text-slate-500 border-slate-200'
              }`}
            >
              <th className="pb-1 font-semibold">Mesh Node Series</th>
              <th className="pb-1 font-semibold text-right">Last</th>
              <th className="pb-1 font-semibold text-right">Min</th>
              <th className="pb-1 font-semibold text-right">Max</th>
              <th className="pb-1 font-semibold text-right">Mean (&mu;)</th>
              <th className="pb-1 font-semibold text-right">DGMS Status</th>
            </tr>
          </thead>
          <tbody
            className={`divide-y ${
              isDark
                ? 'divide-[#14213d]/50 text-slate-300'
                : 'divide-slate-200/80 text-slate-700'
            }`}
          >
            {seriesMetrics.map(item => {
              const isChecked = visibleSeries[item.key] !== false;
              const isOpPp = item.name.includes('NODE_OP') || item.name.includes('NODE_PP');
              return (
                <tr
                  key={item.key}
                  className={`transition-colors ${
                    isDark ? 'hover:bg-[#14213d]/40' : 'hover:bg-slate-200/60'
                  } ${!isChecked ? 'opacity-40' : ''}`}
                >
                  <td className="py-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSeries(item.key)}
                      className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-black/60 text-[#fca311] focus:ring-0 cursor-pointer h-3 w-3"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span
                      className={`font-semibold truncate max-w-[150px] ${
                        isOpPp
                          ? 'text-amber-700 dark:text-[#fca311] font-black'
                          : isDark
                          ? 'text-slate-200'
                          : 'text-slate-800'
                      }`}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    {isOpPp && (
                      <span className="text-[8px] px-1 py-0.2 rounded font-black border bg-amber-100 dark:bg-[#fca311]/20 text-amber-800 dark:text-[#fca311] border-amber-300 dark:border-[#fca311]/30">
                        HW
                      </span>
                    )}
                  </td>
                  <td className="py-1 text-right font-bold text-slate-900 dark:text-white">
                    {item.last} {item.unit || unit}
                  </td>
                  <td className="py-1 text-right text-slate-500 dark:text-slate-400 font-medium">{item.min}</td>
                  <td className="py-1 text-right text-slate-500 dark:text-slate-400 font-medium">{item.max}</td>
                  <td className="py-1 text-right text-slate-500 dark:text-slate-400 font-medium">{item.mean}</td>
                  <td className="py-1 text-right">
                    <span
                      className={`px-1.5 py-0.5 text-[8px] font-black rounded border uppercase ${
                        item.status === 'CRITICAL'
                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30'
                          : item.status === 'WARNING'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-[#fca311] dark:border-amber-500/30'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Custom Glassmorphic Tooltip adapting to light and dark
function MineChartTooltip({ active, payload, label, unit, isDark = true }: any) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className={`z-50 min-w-[220px] p-3 rounded-2xl text-xs font-mono shadow-2xl backdrop-blur-xl pointer-events-none border transition-all ${
        isDark
          ? 'bg-[#090d16]/95 text-white border-[#fca311]/40 shadow-black/80'
          : 'bg-white/95 text-slate-900 border-slate-200/90 shadow-slate-300/60'
      }`}
    >
      <div
        className={`pb-1.5 border-b text-[10px] flex items-center justify-between ${
          isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
        }`}
      >
        <span className="font-semibold">{label}</span>
        <span className="text-amber-700 dark:text-[#fca311] font-black">MINE MESH Real-Time</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {payload.map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 text-[11px]">
            <div
              className={`flex items-center gap-1.5 ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="truncate max-w-[130px] font-medium">{item.name}:</span>
            </div>
            <span className="font-black text-slate-900 dark:text-white">
              {typeof item.value === 'number' ? item.value.toFixed(2) : item.value} {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
