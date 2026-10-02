"use client";

import React, { useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { SENSOR_CONFIGS } from '@/lib/constants';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { ValidatedSensorReading } from '@/types/sensor';
import { BarChart3, AlertTriangle, ShieldCheck, Radio } from 'lucide-react';

interface NodeFleetComparisonChartProps {
  readings: Record<string, Record<string, Record<string, ValidatedSensorReading>>>;
  dynamicNodes?: string[];
  selectedSensor: string;
  onSelectNode?: (nodeId: string) => void;
}

export function NodeFleetComparisonChart({
  readings,
  dynamicNodes = [],
  selectedSensor,
  onSelectNode,
}: NodeFleetComparisonChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const sensorMeta = useMemo(() => {
    return SENSOR_CONFIGS[selectedSensor] || SENSOR_CONFIGS.tilt;
  }, [selectedSensor]);

  const isInvertedRisk = selectedSensor === 'displacement' || selectedSensor === 'distance';

  // Extract only real telemetry readings across all discovered nodes
  const chartData = useMemo(() => {
    const nodeMap: Record<string, { nodeId: string; value: number; zoneId: string; isReal: boolean }> = {};

    // Discover all nodes actively present in readings
    Object.entries(readings).forEach(([zoneId, zoneNodes]) => {
      Object.entries(zoneNodes).forEach(([nodeId, sensorMap]) => {
        const reading = sensorMap[selectedSensor];
        if (reading) {
          nodeMap[nodeId] = {
            nodeId,
            value: Number(reading.value.toFixed(2)),
            zoneId,
            isReal: true,
          };
        } else if (!nodeMap[nodeId]) {
          // Node exists but hasn't reported this specific sensor yet
          nodeMap[nodeId] = {
            nodeId,
            value: 0,
            zoneId,
            isReal: false,
          };
        }
      });
    });

    // Also include any dynamicNodes that might be known from statuses
    dynamicNodes.forEach(nodeId => {
      if (!nodeMap[nodeId]) {
        nodeMap[nodeId] = {
          nodeId,
          value: 0,
          zoneId: 'MESH',
          isReal: false,
        };
      }
    });

    return Object.values(nodeMap).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  }, [readings, dynamicNodes, selectedSensor]);

  const getBarColor = (val: number, isReal: boolean) => {
    if (!isReal) return '#475569'; // Slate for nodes with no data
    if (isInvertedRisk) {
      if (val <= sensorMeta.criticalThreshold) return '#ef4444'; // Danger
      if (val <= sensorMeta.warningThreshold) return '#fca311'; // Warning
      return '#10b981'; // Safe
    }
    if (val >= sensorMeta.criticalThreshold) return '#ef4444'; // Danger
    if (val >= sensorMeta.warningThreshold) return '#fca311'; // Warning
    return '#06b6d4'; // Normal
  };

  return (
    <Card className="p-5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] space-y-4 shadow-sm font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#000000] dark:text-white flex items-center gap-2">
              <span>Real-Time Fleet Distribution: {sensorMeta.label}</span>
              <Badge variant="info" className="text-[10px]">
                {sensorMeta.defaultUnit}
              </Badge>
            </h3>
            <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-0.5">
              Live reading comparison across {chartData.length} active hardware mesh nodes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-500">
            <ShieldCheck className="w-3.5 h-3.5" /> Normal
          </span>
          <span className="flex items-center gap-1.5 text-amber-500">
            <AlertTriangle className="w-3.5 h-3.5" /> Warning
          </span>
          <span className="flex items-center gap-1.5 text-rose-500 font-bold">
            <AlertTriangle className="w-3.5 h-3.5" /> Critical
          </span>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-black/20">
          <Radio className="w-6 h-6 mx-auto mb-2 text-slate-400 animate-pulse" />
          <p className="font-bold text-slate-800 dark:text-slate-200">Awaiting hardware mesh node telemetry...</p>
          <p className="text-[11px] text-slate-500 mt-1">Connect nodes or click &apos;1-Click Sim&apos; to begin real-time data streaming</p>
        </div>
      ) : (
        <div className="h-[280px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? '#14213d' : '#e2e8f0'}
                vertical={false}
              />
              <XAxis
                dataKey="nodeId"
                tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const d = payload[0].payload;
                  const color = getBarColor(d.value, d.isReal);
                  return (
                    <div
                      className={`p-3 rounded-2xl text-xs font-mono shadow-2xl backdrop-blur-xl border ${
                        isDark
                          ? 'bg-[#090d16]/95 text-white border-slate-700 shadow-black/80'
                          : 'bg-white/95 text-slate-900 border-slate-200/90 shadow-slate-300/60'
                      }`}
                    >
                      <div className="font-bold text-amber-700 dark:text-[#fca311] flex items-center justify-between gap-4">
                        <span>{d.nodeId}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{d.zoneId}</span>
                      </div>
                      <div className="mt-1.5 text-sm font-black flex items-center gap-2 text-slate-900 dark:text-white">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span>
                          {d.isReal ? `${d.value} ${sensorMeta.defaultUnit}` : 'No recent reading'}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />

              {sensorMeta.warningThreshold !== undefined && (
                <ReferenceLine
                  y={sensorMeta.warningThreshold}
                  stroke={isDark ? '#fca311' : '#d97706'}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Warn: ${sensorMeta.warningThreshold}`,
                    position: 'insideTopRight',
                    fill: isDark ? '#fca311' : '#d97706',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
              )}

              {sensorMeta.criticalThreshold !== undefined && (
                <ReferenceLine
                  y={sensorMeta.criticalThreshold}
                  stroke={isDark ? '#ef4444' : '#dc2626'}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Crit: ${sensorMeta.criticalThreshold}`,
                    position: 'insideTopRight',
                    fill: isDark ? '#ef4444' : '#dc2626',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
              )}

              <Bar
                dataKey="value"
                name={sensorMeta.label}
                onClick={(entry: any) => {
                  const targetId = entry?.nodeId || entry?.payload?.nodeId;
                  if (onSelectNode && targetId) onSelectNode(targetId);
                }}
              >
                {chartData.map(entry => (
                  <Cell key={entry.nodeId} fill={getBarColor(entry.value, entry.isReal)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
