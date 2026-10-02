"use client";

import React, { useState, useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { SENSOR_CONFIGS } from '@/lib/constants';
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
  Brush,
  Legend,
} from 'recharts';
import { RechartsCustomTooltip } from './RechartsCustomTooltip';
import {
  Pause,
  Play,
  RotateCcw,
  Layers,
  Download,
  Activity,
  Sliders,
  TrendingUp,
  TrendingDown,
  Compass,
  MoveVertical,
  Droplets,
  Flame,
  Thermometer,
  Zap,
} from 'lucide-react';

export interface FocusedChartPoint {
  id: string;
  timestamp: string;
  timeLabel: string;
  nodeId: string;
  sequenceNumber?: number;
  // Dynamic map allowing single value or multi-node comparison keys (e.g. value, NODE_01, NODE_02, etc.)
  value: number;
  [key: string]: any;
}

interface FocusedRechartsChartProps {
  data: FocusedChartPoint[];
  selectedSensor: string;
  selectedNode: string;
  timeRange: string;
  isPaused: boolean;
  onTogglePause: () => void;
  onClearData: () => void;
  onSelectSensor?: (sensor: string) => void;
  nodeList?: string[];
}

export function FocusedRechartsChart({
  data,
  selectedSensor,
  selectedNode,
  timeRange,
  isPaused,
  onTogglePause,
  onClearData,
  onSelectSensor,
  nodeList = ['NODE_01', 'NODE_02', 'NODE_03', 'NODE_04', 'NODE_05', 'NODE_06'],
}: FocusedRechartsChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [showMultiNodeOverlay, setShowMultiNodeOverlay] = useState(false);
  const [enableBrush, setEnableBrush] = useState(true);

  // Sensor metadata
  const sensorMeta = useMemo(() => {
    return SENSOR_CONFIGS[selectedSensor] || SENSOR_CONFIGS.tilt;
  }, [selectedSensor]);

  const isInvertedRisk = selectedSensor === 'displacement' || selectedSensor === 'distance';

  // Statistical calculations
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        current: 0,
        min: 0,
        max: 0,
        avg: 0,
        stdDev: 0,
        rateOfChange: 0,
        headroomPct: 100,
      };
    }

    const values = data.map(d => (typeof d.value === 'number' ? d.value : 0));
    const current = values[values.length - 1] ?? 0;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    let rateOfChange = 0;
    if (values.length >= 2) {
      const prev = values[Math.max(0, values.length - 5)];
      rateOfChange = Number((current - prev).toFixed(2));
    }

    let headroom = 100;
    if (sensorMeta.criticalThreshold > 0) {
      if (isInvertedRisk) {
        headroom = Math.max(0, Math.min(100, Math.round(((current - sensorMeta.criticalThreshold) / (150 - sensorMeta.criticalThreshold)) * 100)));
      } else {
        headroom = Math.max(0, Math.min(100, Math.round(((sensorMeta.criticalThreshold - current) / sensorMeta.criticalThreshold) * 100)));
      }
    }

    return {
      current,
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      avg: Number(avg.toFixed(2)),
      stdDev: Number(stdDev.toFixed(2)),
      rateOfChange,
      headroomPct: headroom,
    };
  }, [data, sensorMeta, isInvertedRisk]);

  // Color palette per node for multi-node overlay
  const nodeColors: Record<string, string> = {
    NODE_01: '#fca311',
    NODE_02: '#06b6d4',
    NODE_03: '#ef4444',
    NODE_04: '#10b981',
    NODE_05: '#a855f7',
    NODE_06: '#ec4899',
    NODE_OP: '#fca311',
    NODE_PP: '#06b6d4',
  };

  // Color gradient definition based on sensor type
  const themeColors = useMemo(() => {
    switch (selectedSensor) {
      case 'tilt':
      case 'tilt_x_deg':
      case 'tilt_y_deg':
        return { stroke: '#fca311', fill: '#fca311' };
      case 'distance':
      case 'displacement':
        return { stroke: '#a855f7', fill: '#a855f7' };
      case 'water':
      case 'water_level_cm':
        return { stroke: '#0284c7', fill: '#0284c7' };
      case 'gas':
      case 'gas_ppm':
        return { stroke: '#ef4444', fill: '#ef4444' };
      case 'humidity':
      case 'humidity_pct':
        return { stroke: '#10b981', fill: '#10b981' };
      case 'temperature':
      case 'temperature_c':
        return { stroke: '#f43f5e', fill: '#f43f5e' };
      case 'vibration':
        return { stroke: '#eab308', fill: '#eab308' };
      default:
        return { stroke: '#fca311', fill: '#fca311' };
    }
  }, [selectedSensor]);

  // Export CSV handler
  const handleExportCSV = () => {
    if (!data || data.length === 0) return;
    const headers = ['timestamp', 'timeLabel', 'nodeId', 'sequenceNumber', selectedSensor];
    const rows = data.map(d => [
      d.timestamp,
      `"${d.timeLabel}"`,
      d.nodeId,
      d.sequenceNumber || '',
      d.value,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `telemetry_${selectedSensor}_${selectedNode}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] space-y-4 shadow-sm">
      {/* Chart Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-[#000000] dark:text-white tracking-wide font-mono flex items-center gap-2">
              <span>{sensorMeta.label} Recharts Studio</span>
              <Badge variant="info" className="text-[10px] font-mono">
                {sensorMeta.defaultUnit}
              </Badge>
            </h3>
            {isPaused && (
              <Badge variant="warning" className="text-[10px] font-mono animate-pulse">
                STREAM PAUSED
              </Badge>
            )}
          </div>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-1 font-medium font-mono">
            Node: <span className="font-bold text-[#000000] dark:text-white">{selectedNode}</span> • Time Window: <span>{timeRange}</span> • {data.length} telemetry samples
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Multi-Node Overlay Toggle */}
          <button
            onClick={() => setShowMultiNodeOverlay(!showMultiNodeOverlay)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
              showMultiNodeOverlay
                ? 'bg-[#14213d] text-[#fca311] border-[#fca311] dark:bg-[#fca311] dark:text-[#000000]'
                : 'bg-[#f4f5f7] dark:bg-black/60 text-[#5c677d] dark:text-[#94a3b8] border-[#e5e5e5] dark:border-[#14213d] hover:text-[#000000] dark:hover:text-white'
            }`}
            title="Overlay all 6 nodes on this chart"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Fleet Overlay</span>
          </button>

          {/* Toggle Brush */}
          <button
            onClick={() => setEnableBrush(!enableBrush)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
              enableBrush
                ? 'bg-[#f4f5f7] dark:bg-black/60 text-[#000000] dark:text-white border-[#e5e5e5] dark:border-[#14213d]'
                : 'text-[#5c677d] dark:text-[#94a3b8] border-transparent'
            }`}
            title="Toggle time-scrubber brush"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Scrubber</span>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
              isPaused
                ? 'bg-amber-500/10 text-amber-600 dark:text-[#fca311] border-amber-500/30'
                : 'bg-[#f4f5f7] dark:bg-black/60 text-[#14213d] dark:text-[#e5e5e5] border-[#e5e5e5] dark:border-[#14213d] hover:bg-[#e5e5e5]'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Reset Buffer */}
          <button
            onClick={onClearData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-black/60 hover:bg-[#e5e5e5] dark:hover:bg-[#14213d] text-[#5c677d] dark:text-[#94a3b8] hover:text-red-500 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono transition-all cursor-pointer"
            title="Clear memory buffer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-black/60 hover:bg-[#e5e5e5] dark:hover:bg-[#14213d] text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono transition-all cursor-pointer"
            title="Export time-series to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Quick Channel Pills */}
      {onSelectSensor && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          <span className="text-[#5c677d] dark:text-[#94a3b8] text-[11px] shrink-0">Channel:</span>
          {[
            { id: 'tilt', label: 'Tilt Angle (°)', icon: Compass },
            { id: 'distance', label: 'Distance (cm)', icon: MoveVertical },
            { id: 'water', label: 'Water Table (m)', icon: Droplets },
            { id: 'gas', label: 'Gas (ppm)', icon: Flame },
            { id: 'humidity', label: 'Humidity (%)', icon: Thermometer },
            { id: 'temperature', label: 'Temperature (°C)', icon: Thermometer },
            { id: 'vibration', label: 'Vibration (g)', icon: Zap },
          ].map(ch => {
            const Icon = ch.icon;
            const isSelected = selectedSensor === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectSensor(ch.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] border-[#fca311] font-bold shadow-sm'
                    : 'bg-[#f4f5f7] dark:bg-black/40 text-[#5c677d] dark:text-[#94a3b8] border-[#e5e5e5] dark:border-[#14213d] hover:text-[#000000] dark:hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{ch.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Summary Statistics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 p-3 rounded-xl bg-[#f4f5f7] dark:bg-black/50 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono">
        <div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] uppercase">Current</span>
          <div className="font-bold text-sm text-[#000000] dark:text-white mt-0.5">
            {stats.current.toFixed(2)} {sensorMeta.defaultUnit}
          </div>
        </div>
        <div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] uppercase">Mean (&mu;)</span>
          <div className="font-semibold text-sm text-[#14213d] dark:text-[#e5e5e5] mt-0.5">
            {stats.avg.toFixed(2)}
          </div>
        </div>
        <div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] uppercase">Peak Max</span>
          <div
            className={`font-semibold text-sm mt-0.5 ${
              !isInvertedRisk && stats.max >= sensorMeta.criticalThreshold
                ? 'text-red-500 font-black'
                : 'text-[#14213d] dark:text-[#e5e5e5]'
            }`}
          >
            {stats.max.toFixed(2)}
          </div>
        </div>
        <div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] uppercase">Baseline Min</span>
          <div
            className={`font-semibold text-sm mt-0.5 ${
              isInvertedRisk && stats.min <= sensorMeta.criticalThreshold
                ? 'text-red-500 font-black'
                : 'text-[#14213d] dark:text-[#e5e5e5]'
            }`}
          >
            {stats.min.toFixed(2)}
          </div>
        </div>
        <div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] uppercase">Std Dev (&sigma;)</span>
          <div className="font-semibold text-sm text-[#14213d] dark:text-[#e5e5e5] mt-0.5">
            &plusmn;{stats.stdDev.toFixed(2)}
          </div>
        </div>
        <div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] uppercase">Rate of Change</span>
          <div
            className={`font-semibold text-sm mt-0.5 flex items-center gap-1 ${
              Math.abs(stats.rateOfChange) > 0.3 ? 'text-amber-500' : 'text-slate-400'
            }`}
          >
            {stats.rateOfChange > 0 ? (
              <TrendingUp className="w-3 h-3 text-amber-500" />
            ) : stats.rateOfChange < 0 ? (
              <TrendingDown className="w-3 h-3 text-emerald-500" />
            ) : null}
            <span>{stats.rateOfChange > 0 ? `+${stats.rateOfChange}` : stats.rateOfChange}</span>
          </div>
        </div>
        <div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] uppercase">Safety Margin</span>
          <div className="font-semibold text-sm text-emerald-500 mt-0.5">
            {stats.headroomPct}%
          </div>
        </div>
      </div>

      {/* Main High-Resolution Recharts Canvas */}
      <div className="relative w-full rounded-2xl bg-slate-50/70 dark:bg-black/70 border border-slate-200 dark:border-[#14213d] p-3 overflow-hidden select-none">
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: enableBrush ? 10 : 0 }}>
              <defs>
                <linearGradient id="focusedChartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={themeColors.fill} stopOpacity={isDark ? 0.45 : 0.3} />
                  <stop offset="95%" stopColor={themeColors.fill} stopOpacity={0.0} />
                </linearGradient>
                {nodeList.map((node, i) => (
                  <linearGradient key={node} id={`nodeGrad-${node}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={nodeColors[node] || '#fca311'} stopOpacity={isDark ? 0.35 : 0.25} />
                    <stop offset="95%" stopColor={nodeColors[node] || '#fca311'} stopOpacity={0.0} />
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
                tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
                minTickGap={30}
              />

              <YAxis
                tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
                domain={['auto', 'auto']}
              />

              <Tooltip
                content={
                  <RechartsCustomTooltip
                    sensorType={selectedSensor}
                    unit={sensorMeta.defaultUnit}
                    warningThreshold={sensorMeta.warningThreshold}
                    criticalThreshold={sensorMeta.criticalThreshold}
                    invertedRisk={isInvertedRisk}
                  />
                }
              />

              {showMultiNodeOverlay && <Legend verticalAlign="top" height={36} />}

              {/* DGMS Safety Reference Thresholds */}
              {sensorMeta.warningThreshold !== undefined && (
                <ReferenceLine
                  y={sensorMeta.warningThreshold}
                  stroke={isDark ? '#fca311' : '#d97706'}
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{
                    value: `DGMS Warn (${sensorMeta.warningThreshold}${sensorMeta.defaultUnit})`,
                    position: 'insideTopRight',
                    fill: isDark ? '#fca311' : '#d97706',
                    fontSize: 10,
                    fontWeight: 'bold',
                  }}
                />
              )}

              {sensorMeta.criticalThreshold !== undefined && (
                <ReferenceLine
                  y={sensorMeta.criticalThreshold}
                  stroke={isDark ? '#ef4444' : '#dc2626'}
                  strokeDasharray="5 5"
                  strokeWidth={1.8}
                  label={{
                    value: `CRITICAL DANGER (${sensorMeta.criticalThreshold}${sensorMeta.defaultUnit})`,
                    position: 'insideTopRight',
                    fill: isDark ? '#ef4444' : '#dc2626',
                    fontSize: 10,
                    fontWeight: 'bold',
                  }}
                />
              )}

              {/* Multi-Node Overlay or Primary Single Series */}
              {showMultiNodeOverlay ? (
                nodeList.map(node => (
                  <Line
                    key={node}
                    type="monotone"
                    dataKey={node}
                    name={node}
                    stroke={nodeColors[node] || '#fca311'}
                    strokeWidth={node === selectedNode ? 2.8 : 1.5}
                    dot={false}
                    activeDot={{ r: 5, stroke: isDark ? '#ffffff' : '#0f172a', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                ))
              ) : (
                <Area
                  type="monotone"
                  dataKey="value"
                  name={`${selectedNode} - ${sensorMeta.label}`}
                  stroke={themeColors.stroke}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#focusedChartGradient)"
                  dot={false}
                  activeDot={{ r: 5, stroke: isDark ? '#ffffff' : '#0f172a', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}

              {/* Interactive Brush for Zooming / Scrubbing */}
              {enableBrush && data.length > 5 && (
                <Brush
                  dataKey="timeLabel"
                  height={24}
                  stroke={isDark ? '#334155' : '#94a3b8'}
                  fill={isDark ? '#0a1120' : '#f8fafc'}
                  tickFormatter={() => ''}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
