"use client";

import React, { useMemo } from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { RechartsCustomTooltip } from './RechartsCustomTooltip';
import { Maximize2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface MultiSeriesConfig {
  key: string;
  name: string;
  color: string;
  unit?: string;
  type?: 'area' | 'line';
}

interface SensorChartCardProps {
  title: string;
  sensorType: string;
  icon: React.ReactNode;
  unit: string;
  data: any[];
  // Single series or multi-series configuration
  dataKey?: string;
  series?: MultiSeriesConfig[];
  primaryColor?: string;
  gradientId: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  invertedRisk?: boolean; // True for distance (smaller is dangerous)
  onFocus?: () => void;
  height?: number;
}

export function SensorChartCard({
  title,
  sensorType,
  icon,
  unit,
  data,
  dataKey = 'value',
  series,
  primaryColor = '#fca311',
  gradientId,
  warningThreshold,
  criticalThreshold,
  invertedRisk = false,
  onFocus,
  height = 180,
}: SensorChartCardProps) {
  // Extract summary stats for the primary series
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return { current: 0, min: 0, max: 0, avg: 0, delta: 0, headroom: 100 };
    }

    const key = series ? series[0].key : dataKey;
    const values = data.map(d => (typeof d[key] === 'number' ? d[key] : 0)).filter(v => !isNaN(v));

    if (values.length === 0) {
      return { current: 0, min: 0, max: 0, avg: 0, delta: 0, headroom: 100 };
    }

    const current = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const prev = values.length >= 2 ? values[values.length - 2] : current;
    const delta = Number((current - prev).toFixed(2));

    let headroom = 100;
    if (criticalThreshold !== undefined && criticalThreshold > 0) {
      if (invertedRisk) {
        headroom = Math.max(0, Math.min(100, Math.round(((current - criticalThreshold) / (150 - criticalThreshold)) * 100)));
      } else {
        headroom = Math.max(0, Math.min(100, Math.round(((criticalThreshold - current) / criticalThreshold) * 100)));
      }
    }

    return {
      current,
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      avg: Number(avg.toFixed(2)),
      delta,
      headroom,
    };
  }, [data, dataKey, series, criticalThreshold, invertedRisk]);

  // Determine current status
  const status = useMemo(() => {
    if (warningThreshold === undefined || criticalThreshold === undefined) return 'SAFE';
    if (invertedRisk) {
      if (stats.current <= criticalThreshold) return 'CRITICAL';
      if (stats.current <= warningThreshold) return 'WARNING';
      return 'SAFE';
    }
    if (stats.current >= criticalThreshold) return 'CRITICAL';
    if (stats.current >= warningThreshold) return 'WARNING';
    return 'SAFE';
  }, [stats.current, warningThreshold, criticalThreshold, invertedRisk]);

  const badgeVariant = status === 'CRITICAL' ? 'danger' : status === 'WARNING' ? 'warning' : 'success';

  return (
    <Card className="p-4 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] flex flex-col justify-between hover:border-[#fca311]/40 transition-all shadow-sm group">
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-[#f4f5f7] dark:bg-black/50 border border-[#e5e5e5] dark:border-[#14213d] shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-[#000000] dark:text-white font-mono truncate">
                {title}
              </h4>
              <Badge variant={badgeVariant} className="text-[9px] px-1.5 py-0 font-mono uppercase">
                {status}
              </Badge>
            </div>
            <p className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono mt-0.5">
              Current: <strong className="text-[#000000] dark:text-white">{stats.current.toFixed(2)}</strong> {unit}
            </p>
          </div>
        </div>

        {/* Action button (Focus drilldown) */}
        {onFocus && (
          <button
            onClick={onFocus}
            className="p-1.5 rounded-lg text-[#5c677d] dark:text-[#94a3b8] hover:text-[#fca311] hover:bg-[#fca311]/10 border border-transparent hover:border-[#fca311]/20 transition-all cursor-pointer"
            title="Focus this chart in Deep-Dive Studio"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Chart Canvas Area */}
      <div className="w-full mt-3 relative" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
              </linearGradient>
              {series?.map((s, idx) => (
                <linearGradient key={s.key} id={`${gradientId}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/80" />

            <XAxis
              dataKey="timeLabel"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              interval="preserveStartEnd"
              minTickGap={25}
            />

            <YAxis
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              domain={['auto', 'auto']}
            />

            <Tooltip
              content={
                <RechartsCustomTooltip
                  sensorType={sensorType}
                  unit={unit}
                  warningThreshold={warningThreshold}
                  criticalThreshold={criticalThreshold}
                  invertedRisk={invertedRisk}
                />
              }
            />

            {/* Threshold Reference Lines */}
            {warningThreshold !== undefined && (
              <ReferenceLine
                y={warningThreshold}
                stroke="#fca311"
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{
                  value: `Warn: ${warningThreshold}`,
                  position: 'right',
                  fill: '#fca311',
                  fontSize: 8,
                }}
              />
            )}

            {criticalThreshold !== undefined && (
              <ReferenceLine
                y={criticalThreshold}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Crit: ${criticalThreshold}`,
                  position: 'right',
                  fill: '#ef4444',
                  fontSize: 8,
                }}
              />
            )}

            {/* Series Rendering */}
            {series && series.length > 0 ? (
              series.map((s, idx) =>
                s.type === 'line' ? (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                ) : (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#${gradientId}-${idx})`}
                    dot={false}
                    activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                )
              )
            ) : (
              <Area
                type="monotone"
                dataKey={dataKey}
                name={title}
                stroke={primaryColor}
                strokeWidth={2.2}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Mini Stats Footer Bar */}
      <div className="mt-2.5 pt-2.5 border-t border-[#e5e5e5]/80 dark:border-[#14213d]/80 grid grid-cols-4 gap-1 text-[10px] font-mono">
        <div>
          <span className="text-[#5c677d] dark:text-[#94a3b8] uppercase block text-[8px]">Peak</span>
          <span className="font-bold text-[#000000] dark:text-white truncate block">{stats.max}</span>
        </div>
        <div>
          <span className="text-[#5c677d] dark:text-[#94a3b8] uppercase block text-[8px]">Mean (&mu;)</span>
          <span className="font-medium text-[#14213d] dark:text-slate-300 truncate block">{stats.avg}</span>
        </div>
        <div>
          <span className="text-[#5c677d] dark:text-[#94a3b8] uppercase block text-[8px]">Trend</span>
          <span
            className={`font-semibold flex items-center gap-0.5 ${
              stats.delta > 0 ? 'text-amber-500' : stats.delta < 0 ? 'text-emerald-500' : 'text-slate-400'
            }`}
          >
            {stats.delta > 0 ? (
              <TrendingUp className="w-2.5 h-2.5" />
            ) : stats.delta < 0 ? (
              <TrendingDown className="w-2.5 h-2.5" />
            ) : (
              <Minus className="w-2.5 h-2.5" />
            )}
            {stats.delta > 0 ? `+${stats.delta}` : stats.delta}
          </span>
        </div>
        <div>
          <span className="text-[#5c677d] dark:text-[#94a3b8] uppercase block text-[8px]">Headroom</span>
          <span className="font-bold text-emerald-500 truncate block">{stats.headroom}%</span>
        </div>
      </div>
    </Card>
  );
}
