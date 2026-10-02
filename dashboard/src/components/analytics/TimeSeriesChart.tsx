"use client";

import React, { useState, useMemo, useRef } from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { SENSOR_CONFIGS } from '@/lib/constants';
import {
  TrendingUp,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Layers,
  Info,
  Maximize2,
} from 'lucide-react';

export interface TimeSeriesDataPoint {
  id: string;
  timestamp: string;
  timeLabel: string;
  value: number;
  nodeId: string;
  sequenceNumber?: number;
  // Normalized 0-100 values for multi-sensor overlay
  tiltNorm?: number;
  vibrationNorm?: number;
  displacementNorm?: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  selectedSensor: string;
  selectedNode: string;
  timeRange: string;
  isPaused: boolean;
  onTogglePause: () => void;
  onClearData: () => void;
}

export function TimeSeriesChart({
  data,
  selectedSensor,
  selectedNode,
  timeRange,
  isPaused,
  onTogglePause,
  onClearData,
}: TimeSeriesChartProps) {
  const [showMultiOverlay, setShowMultiOverlay] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const sensorMeta = SENSOR_CONFIGS[selectedSensor] || SENSOR_CONFIGS.tilt;

  // Compute summary statistics
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

    const values = data.map(d => d.value);
    const current = values[values.length - 1] ?? 0;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Rate of change over last 5 points
    let rateOfChange = 0;
    if (values.length >= 2) {
      const prev = values[Math.max(0, values.length - 5)];
      rateOfChange = Number((current - prev).toFixed(2));
    }

    const headroom =
      sensorMeta.criticalThreshold > 0
        ? Math.max(
            0,
            Math.round(
              ((sensorMeta.criticalThreshold - current) /
                sensorMeta.criticalThreshold) *
                100
            )
          )
        : 100;

    return {
      current,
      min,
      max,
      avg: Number(avg.toFixed(2)),
      stdDev: Number(stdDev.toFixed(2)),
      rateOfChange,
      headroomPct: headroom,
    };
  }, [data, sensorMeta]);

  // Coordinate mapping for SVG
  const chartWidth = 900;
  const chartHeight = 280;
  const padding = { top: 25, right: 80, bottom: 35, left: 55 };

  const usableWidth = chartWidth - padding.left - padding.right;
  const usableHeight = chartHeight - padding.top - padding.bottom;

  // Dynamic Y-axis scale based on data & thresholds
  const { minY, maxY, points, pathString, overlayPaths } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        minY: 0,
        maxY: sensorMeta.criticalThreshold * 1.2,
        points: [],
        pathString: '',
        overlayPaths: { tilt: '', vibration: '', displacement: '' },
      };
    }

    const rawValues = data.map(d => d.value);
    let effectiveMin = Math.min(0, ...rawValues);
    let effectiveMax = Math.max(
      sensorMeta.criticalThreshold * 1.15,
      ...rawValues
    );

    if (effectiveMax === effectiveMin) effectiveMax += 1;
    // Add 10% breathing room
    const range = effectiveMax - effectiveMin;
    effectiveMax += range * 0.1;

    const computedPoints = data.map((d, i) => {
      const x =
        padding.left +
        (i / Math.max(1, data.length - 1)) * usableWidth;
      const y =
        padding.top +
        usableHeight -
        ((d.value - effectiveMin) / (effectiveMax - effectiveMin)) * usableHeight;
      return { x, y, data: d, index: i };
    });

    // Build smooth SVG path
    let pStr = '';
    if (computedPoints.length > 0) {
      pStr = `M ${computedPoints[0].x} ${computedPoints[0].y}`;
      for (let i = 1; i < computedPoints.length; i++) {
        const prev = computedPoints[i - 1];
        const curr = computedPoints[i];
        const midX = (prev.x + curr.x) / 2;
        pStr += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
      }
    }

    // Build overlay paths for multi-sensor normalized view (0 to 100%)
    const overlay: { tilt: string; vibration: string; displacement: string } = {
      tilt: '',
      vibration: '',
      displacement: '',
    };

    if (showMultiOverlay && data.length > 0) {
      ['tilt', 'vibration', 'displacement'].forEach(channel => {
        const key = `${channel}Norm` as keyof TimeSeriesDataPoint;
        let cPath = '';
        data.forEach((d, i) => {
          const x =
            padding.left +
            (i / Math.max(1, data.length - 1)) * usableWidth;
          const normVal = typeof d[key] === 'number' ? (d[key] as number) : 0;
          const y =
            padding.top +
            usableHeight -
            (normVal / 100) * usableHeight;
          if (i === 0) cPath = `M ${x} ${y}`;
          else {
            const prevX =
              padding.left +
              ((i - 1) / Math.max(1, data.length - 1)) * usableWidth;
            const prevNorm =
              typeof data[i - 1][key] === 'number'
                ? (data[i - 1][key] as number)
                : 0;
            const prevY =
              padding.top +
              usableHeight -
              (prevNorm / 100) * usableHeight;
            const midX = (prevX + x) / 2;
            cPath += ` C ${midX} ${prevY}, ${midX} ${y}, ${x} ${y}`;
          }
        });
        overlay[channel as keyof typeof overlay] = cPath;
      });
    }

    return {
      minY: effectiveMin,
      maxY: effectiveMax,
      points: computedPoints,
      pathString: pStr,
      overlayPaths: overlay,
    };
  }, [
    data,
    sensorMeta,
    usableWidth,
    usableHeight,
    padding.left,
    padding.top,
    showMultiOverlay,
  ]);

  // Threshold Y positions in SVG
  const warningY =
    padding.top +
    usableHeight -
    ((sensorMeta.warningThreshold - minY) / (maxY - minY)) * usableHeight;

  const criticalY =
    padding.top +
    usableHeight -
    ((sensorMeta.criticalThreshold - minY) / (maxY - minY)) * usableHeight;

  // Handle mouse move over SVG for crosshair tooltips
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaleX = chartWidth / rect.width;
    const mouseSvgX = clientX * scaleX;

    // Find closest point
    let closestIdx = 0;
    let minDiff = Infinity;
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - mouseSvgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setHoverIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const hoveredPoint =
    hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  return (
    <Card className="p-5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] space-y-4">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[#000000] dark:text-white tracking-wide font-mono flex items-center gap-2">
              <span>{sensorMeta.label} Dynamic Waveform</span>
              <Badge variant="info" className="text-[10px] font-mono">
                {sensorMeta.defaultUnit}
              </Badge>
            </h3>
            {isPaused && (
              <Badge variant="warning" className="text-[10px] font-mono animate-pulse">
                PAUSED
              </Badge>
            )}
          </div>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-0.5 font-medium">
            Node: <span className="font-bold text-[#000000] dark:text-white font-mono">{selectedNode}</span> • Time Window: <span className="font-mono">{timeRange}</span> • {data.length} telemetry points
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Multi-Channel Overlay Toggle */}
          <button
            onClick={() => setShowMultiOverlay(!showMultiOverlay)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
              showMultiOverlay
                ? 'bg-[#14213d] text-[#fca311] border-[#fca311] dark:bg-[#fca311] dark:text-[#000000]'
                : 'bg-[#f4f5f7] dark:bg-[#000000]/60 text-[#5c677d] dark:text-[#94a3b8] border-[#e5e5e5] dark:border-[#14213d] hover:text-[#000000] dark:hover:text-white'
            }`}
            title="Overlay Normalized Tilt, Vibration & Displacement"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overlay Matrix</span>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
              isPaused
                ? 'bg-amber-500/10 text-amber-600 dark:text-[#fca311] border-amber-500/30'
                : 'bg-[#f4f5f7] dark:bg-[#000000]/60 text-[#14213d] dark:text-[#e5e5e5] border-[#e5e5e5] dark:border-[#14213d] hover:bg-[#e5e5e5]'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Reset Buffer */}
          <button
            onClick={onClearData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 hover:bg-[#e5e5e5] dark:hover:bg-[#14213d] text-[#5c677d] dark:text-[#94a3b8] hover:text-red-500 dark:hover:text-red-400 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono transition-all"
            title="Clear rolling buffer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Summary Statistics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-2.5 p-3 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/50 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono min-w-0">
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
              stats.max >= sensorMeta.criticalThreshold
                ? 'text-red-600 dark:text-red-400'
                : stats.max >= sensorMeta.warningThreshold
                ? 'text-amber-700 dark:text-[#fca311]'
                : 'text-[#14213d] dark:text-[#e5e5e5]'
            }`}
          >
            {stats.max.toFixed(2)}
          </div>
        </div>
        <div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] uppercase">Baseline Min</span>
          <div className="font-semibold text-sm text-[#14213d] dark:text-[#e5e5e5] mt-0.5">
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
              stats.rateOfChange > 0.3
                ? 'text-amber-700 dark:text-[#fca311]'
                : stats.rateOfChange < -0.3
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-[#5c677d] dark:text-[#94a3b8]'
            }`}
          >
            <span>
              {stats.rateOfChange > 0 ? `+${stats.rateOfChange}` : stats.rateOfChange}
            </span>
          </div>
        </div>
        <div>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] uppercase">Headroom</span>
          <div className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
            {stats.headroomPct}%
          </div>
        </div>
      </div>

      {/* SVG Time-Series Canvas */}
      <div className="relative w-full rounded-2xl bg-[#f4f5f7]/70 dark:bg-[#000000]/70 border border-[#e5e5e5] dark:border-[#14213d] p-2 overflow-hidden select-none">
        {showMultiOverlay && (
          <div className="absolute top-3 left-4 z-10 flex items-center gap-3 bg-white/90 dark:bg-[#14213d]/90 px-3 py-1.5 rounded-xl border border-[#e5e5e5] dark:border-[#14213d] text-[10px] font-mono shadow-sm">
            <span className="flex items-center gap-1 text-[#fca311] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#fca311]" /> Tilt %
            </span>
            <span className="flex items-center gap-1 text-cyan-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-cyan-400" /> Vibration %
            </span>
            <span className="flex items-center gap-1 text-purple-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-purple-400" /> Disp. %
            </span>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto cursor-crosshair overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Gradient under main waveform */}
            <linearGradient id="mainAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fca311" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#fca311" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="criticalGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((factor, i) => {
            const y = padding.top + usableHeight * factor;
            return (
              <line
                key={`grid-h-${i}`}
                x1={padding.left}
                y1={y}
                x2={padding.left + usableWidth}
                y2={y}
                stroke="currentColor"
                className="text-[#e5e5e5] dark:text-[#14213d]"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            );
          })}

          {/* Warning Threshold Line */}
          {warningY >= padding.top && warningY <= padding.top + usableHeight && (
            <g>
              <line
                x1={padding.left}
                y1={warningY}
                x2={padding.left + usableWidth}
                y2={warningY}
                stroke="#fca311"
                strokeDasharray="6 4"
                strokeWidth="1.5"
                opacity="0.85"
              />
              <text
                x={padding.left + usableWidth + 6}
                y={warningY + 3}
                fill="#fca311"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                Warn: {sensorMeta.warningThreshold}
              </text>
            </g>
          )}

          {/* Critical Threshold Line */}
          {criticalY >= padding.top && criticalY <= padding.top + usableHeight && (
            <g>
              <line
                x1={padding.left}
                y1={criticalY}
                x2={padding.left + usableWidth}
                y2={criticalY}
                stroke="#ef4444"
                strokeDasharray="6 4"
                strokeWidth="1.5"
                opacity="0.9"
              />
              <text
                x={padding.left + usableWidth + 6}
                y={criticalY + 3}
                fill="#ef4444"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                Crit: {sensorMeta.criticalThreshold}
              </text>
            </g>
          )}

          {/* Multi-Sensor Overlays (Normalized) */}
          {showMultiOverlay && (
            <>
              {overlayPaths.tilt && (
                <path
                  d={overlayPaths.tilt}
                  fill="none"
                  stroke="#fca311"
                  strokeWidth="2"
                  opacity="0.9"
                />
              )}
              {overlayPaths.vibration && (
                <path
                  d={overlayPaths.vibration}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  opacity="0.85"
                />
              )}
              {overlayPaths.displacement && (
                <path
                  d={overlayPaths.displacement}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="2"
                  opacity="0.85"
                />
              )}
            </>
          )}

          {/* Primary Waveform Curve */}
          {!showMultiOverlay && pathString && (
            <>
              {/* Closed area gradient */}
              <path
                d={`${pathString} L ${padding.left + usableWidth} ${
                  padding.top + usableHeight
                } L ${padding.left} ${padding.top + usableHeight} Z`}
                fill="url(#mainAreaGradient)"
              />
              <path
                d={pathString}
                fill="none"
                stroke="#fca311"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Hover crosshair & point indicator */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={padding.top}
                x2={hoveredPoint.x}
                y2={padding.top + usableHeight}
                stroke="#fca311"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1={padding.left}
                y1={hoveredPoint.y}
                x2={padding.left + usableWidth}
                y2={hoveredPoint.y}
                stroke="#fca311"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="5"
                fill="#fca311"
                stroke="#ffffff"
                strokeWidth="2"
                className="animate-pulse"
              />
            </g>
          )}

          {/* Y Axis Labels */}
          <text
            x={padding.left - 10}
            y={padding.top + 5}
            textAnchor="end"
            fontSize="10"
            fontFamily="monospace"
            className="fill-[#5c677d] dark:fill-[#94a3b8]"
          >
            {maxY.toFixed(1)}
          </text>
          <text
            x={padding.left - 10}
            y={padding.top + usableHeight / 2 + 3}
            textAnchor="end"
            fontSize="10"
            fontFamily="monospace"
            className="fill-[#5c677d] dark:fill-[#94a3b8]"
          >
            {((maxY + minY) / 2).toFixed(1)}
          </text>
          <text
            x={padding.left - 10}
            y={padding.top + usableHeight}
            textAnchor="end"
            fontSize="10"
            fontFamily="monospace"
            className="fill-[#5c677d] dark:fill-[#94a3b8]"
          >
            {minY.toFixed(1)}
          </text>

          {/* X Axis Range Labels */}
          <text
            x={padding.left}
            y={chartHeight - 10}
            textAnchor="start"
            fontSize="10"
            fontFamily="monospace"
            className="fill-[#5c677d] dark:fill-[#94a3b8]"
          >
            {data[0]?.timeLabel || `-${timeRange}`}
          </text>
          <text
            x={padding.left + usableWidth / 2}
            y={chartHeight - 10}
            textAnchor="middle"
            fontSize="10"
            fontFamily="monospace"
            className="fill-[#5c677d] dark:fill-[#94a3b8]"
          >
            Midpoint
          </text>
          <text
            x={padding.left + usableWidth}
            y={chartHeight - 10}
            textAnchor="end"
            fontSize="10"
            fontFamily="monospace"
            className="fill-[#5c677d] dark:fill-[#94a3b8]"
          >
            {data[data.length - 1]?.timeLabel || 'Live (Current)'}
          </text>
        </svg>

        {/* Hover Tooltip Overlay Box */}
        {hoveredPoint && (
          <div
            className="absolute z-30 pointer-events-none p-2.5 rounded-xl bg-black/90 text-white text-xs font-mono shadow-xl border border-[#fca311]/50 backdrop-blur-md transition-all"
            style={{
              left: Math.min(
                Math.max(10, (hoveredPoint.x / chartWidth) * 100 - 10),
                75
              ) + '%',
              top: '15px',
            }}
          >
            <div className="font-bold text-[#fca311] flex items-center justify-between gap-4">
              <span>{hoveredPoint.data.nodeId}</span>
              <span className="text-[10px] text-[#94a3b8]">
                {hoveredPoint.data.timeLabel}
              </span>
            </div>
            <div className="mt-1 text-sm font-black">
              {hoveredPoint.data.value.toFixed(2)} {sensorMeta.defaultUnit}
            </div>
            {hoveredPoint.data.sequenceNumber !== undefined && (
              <div className="text-[10px] text-[#94a3b8] mt-0.5">
                Seq: #{hoveredPoint.data.sequenceNumber}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
