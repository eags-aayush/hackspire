"use client";

import React, { useState, useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { MineMetricChartCard, MineSeriesConfig } from './MineMetricChartCard';
import { isOpPpNode } from '@/hooks/useZoneFilter';
import {
  LayoutGrid,
  Columns2,
  Maximize2,
  RefreshCw,
  Cpu,
  Radio,
  SlidersHorizontal,
  Compass,
  Activity,
  MoveVertical,
  Droplets,
  Flame,
  Thermometer,
  Zap,
} from 'lucide-react';

export interface MineTelemetryPoint {
  id: string;
  timestamp: string;
  timeLabel: string;
  sequenceNumber?: number;
  [key: string]: any;
}

interface MineMetricsDashboardProps {
  data: MineTelemetryPoint[];
  dynamicNodes: string[];
  selectedZone: string;
  timeRange: string;
  onTimeRangeChange: (r: string) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onClearBuffer: () => void;
  onlyOpPp: boolean;
  onToggleOnlyOpPp: () => void;
}

export function MineMetricsDashboard({
  data,
  dynamicNodes = [],
  selectedZone,
  timeRange,
  onTimeRangeChange,
  isPaused,
  onTogglePause,
  onClearBuffer,
  onlyOpPp,
  onToggleOnlyOpPp,
}: MineMetricsDashboardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [layoutMode, setLayoutMode] = useState<'2col' | '3col' | 'focus'>('2col');
  const [focusedMetric, setFocusedMetric] = useState<string | null>(null);
  const [selectedFilterNode, setSelectedFilterNode] = useState<string>('ALL');
  const [selectedMetricQuery, setSelectedMetricQuery] = useState<string>('ALL');

  // Vibrant MINE MESH series color palette
  const MINE_COLORS = [
    '#fca311', // Golden Amber (Brand primary)
    '#06b6d4', // Cyan (Pitch/Roll)
    '#10b981', // Emerald (Safe/Normal)
    '#ef4444', // Crimson (Danger/Critical)
    '#a855f7', // Purple (Distance/Acoustic)
    '#3b82f6', // Cobalt Blue
    '#ec4899', // Pink (Crack)
    '#eab308', // Yellow (Vibration)
  ];

  // Active filtered nodes list based on OP/PP hardware toggle
  const activeNodes = useMemo(() => {
    let nodes = dynamicNodes.length > 0 ? dynamicNodes : ['NODE_OP', 'NODE_PP'];
    if (onlyOpPp) {
      nodes = nodes.filter(isOpPpNode);
      if (nodes.length === 0) nodes = ['NODE_OP', 'NODE_PP'];
    }
    return nodes;
  }, [dynamicNodes, onlyOpPp]);

  // Ensure NODE_OP and NODE_PP always appear first in chart legends and multi-series plots
  const prioritizedNodes = useMemo(() => {
    return [...activeNodes].sort((a, b) => {
      const aOp = isOpPpNode(a) ? 1 : 0;
      const bOp = isOpPpNode(b) ? 1 : 0;
      if (aOp !== bOp) return bOp - aOp;
      return a.localeCompare(b);
    });
  }, [activeNodes]);

  // Generate series config for single-channel metrics
  const getNodeSeries = (channelPrefix: string, unit: string): MineSeriesConfig[] => {
    return prioritizedNodes
      .filter(n => selectedFilterNode === 'ALL' || selectedFilterNode === n)
      .map((node, idx) => ({
        key: `${channelPrefix}_${node}`,
        name: `${node} ${node === 'NODE_OP' ? '(Op Sensor)' : node === 'NODE_PP' ? '(Pp Sensor)' : ''}`,
        color:
          node === 'NODE_OP'
            ? '#fca311'
            : node === 'NODE_PP'
            ? '#06b6d4'
            : MINE_COLORS[idx % MINE_COLORS.length],
        unit,
        type: 'line',
      }));
  };

  // Generate dual-axis Gyroscope series (Pitch X & Roll Y)
  const getGyroSeries = (): MineSeriesConfig[] => {
    const series: MineSeriesConfig[] = [];
    const targetNodes = selectedFilterNode === 'ALL' ? prioritizedNodes.slice(0, 4) : [selectedFilterNode];

    targetNodes.forEach((node, idx) => {
      series.push(
        {
          key: `pitch_${node}`,
          name: `${node} Pitch (X)`,
          color: node === 'NODE_OP' ? '#06b6d4' : MINE_COLORS[(idx * 2) % MINE_COLORS.length],
          unit: '°',
          type: 'line',
        },
        {
          key: `roll_${node}`,
          name: `${node} Roll (Y)`,
          color: node === 'NODE_OP' ? '#fca311' : MINE_COLORS[(idx * 2 + 1) % MINE_COLORS.length],
          unit: '°',
          type: 'line',
        }
      );
    });
    return series;
  };

  // Generate DHT22 Microclimate series (Humidity & Temperature)
  const getClimateSeries = (): MineSeriesConfig[] => {
    const series: MineSeriesConfig[] = [];
    const targetNodes = selectedFilterNode === 'ALL' ? prioritizedNodes.slice(0, 4) : [selectedFilterNode];

    targetNodes.forEach((node, idx) => {
      series.push(
        {
          key: `humidity_${node}`,
          name: `${node} Humidity`,
          color: '#10b981',
          unit: '%',
          type: 'line',
        },
        {
          key: `temp_${node}`,
          name: `${node} Temp`,
          color: '#f43f5e',
          unit: '°C',
          type: 'line',
        }
      );
    });
    return series;
  };

  return (
    <div className="space-y-4 font-sans">
      {/* MINE MESH Control Bar */}
      <div
        className={`rounded-2xl border p-4 shadow-md backdrop-blur-xl font-mono text-xs transition-colors duration-200 ${
          isDark
            ? 'border-[#14213d] bg-[#090d16]/90 shadow-black/40 text-slate-100'
            : 'border-slate-200/90 bg-white/95 shadow-slate-200/50 text-slate-900'
        }`}
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
          {/* Query Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Resource Identifier */}
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="font-bold text-amber-700 dark:text-[#fca311]">Resource:</span>
              <span
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                  isDark
                    ? 'bg-black/60 border-[#14213d] text-slate-200'
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                mine.mesh/strata/sensor
              </span>
            </div>

            {/* Hardware Node Filter Toggle (NODE_OP & NODE_PP) */}
            <button
              onClick={onToggleOnlyOpPp}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer shadow-sm ${
                onlyOpPp
                  ? 'bg-[#fca311] text-[#000000] border-[#fca311] ring-2 ring-[#fca311]/40'
                  : isDark
                  ? 'bg-black/60 text-slate-400 border-[#14213d] hover:text-white'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:text-black hover:bg-slate-200/70'
              }`}
              title="Toggle to display physical hardware nodes (NODE_OP & NODE_PP) only"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{onlyOpPp ? 'NODE_OP & NODE_PP Only' : 'All Fleet Nodes'}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                  onlyOpPp
                    ? 'bg-black text-[#fca311]'
                    : isDark
                    ? 'bg-[#14213d] text-slate-300'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {activeNodes.length}
              </span>
            </button>

            {/* Metric Query Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Metric:</span>
              <select
                value={selectedMetricQuery}
                onChange={e => setSelectedMetricQuery(e.target.value)}
                className={`rounded-xl px-3 py-1.5 text-xs cursor-pointer focus:outline-none focus:border-[#fca311] border font-medium ${
                  isDark
                    ? 'bg-black/80 border-[#14213d] text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900 shadow-sm'
                }`}
              >
                <option value="ALL">All Metrics (Active Mesh Channels)</option>
                <option value="tilt">mine.mesh/tilt/biaxial (°)</option>
                <option value="gyro">mine.mesh/inertial/gyro_deviation (°)</option>
                <option value="distance">mine.mesh/strata/roof_distance (cm)</option>
                <option value="water">mine.mesh/hydrology/water_inflow (m)</option>
                <option value="gas">mine.mesh/atmosphere/mq6_gas (ppm)</option>
                <option value="climate">mine.mesh/climate/humidity_and_temp</option>
                <option value="vibration">mine.mesh/seismic/vibration (g)</option>
              </select>
            </div>

            {/* Filter by Node */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Node:</span>
              <select
                value={selectedFilterNode}
                onChange={e => setSelectedFilterNode(e.target.value)}
                className={`rounded-xl px-3 py-1.5 text-xs cursor-pointer focus:outline-none focus:border-[#fca311] border font-medium ${
                  isDark
                    ? 'bg-black/80 border-[#14213d] text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900 shadow-sm'
                }`}
              >
                <option value="ALL">ALL ({activeNodes.length} Nodes Plotted)</option>
                {activeNodes.map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Time & Layout Controls */}
          <div className="flex items-center gap-2 flex-wrap self-start xl:self-auto">
            {/* Time Window Buttons */}
            <div
              className={`flex p-0.5 rounded-xl border ${
                isDark ? 'bg-black/60 border-[#14213d]' : 'bg-slate-100 border-slate-200'
              }`}
            >
              {['1m', '5m', '15m', '1h', '24h'].map(w => (
                <button
                  key={w}
                  onClick={() => onTimeRangeChange(w)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                    timeRange === w
                      ? 'bg-[#fca311] text-[#000000] font-black shadow-sm'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>

            {/* Pause / Resume Live Streaming */}
            <button
              onClick={onTogglePause}
              className={`px-3 py-1.5 rounded-xl text-xs border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isPaused
                  ? 'bg-amber-500/10 text-amber-800 dark:text-[#fca311] border-amber-500/30'
                  : isDark
                  ? 'bg-black/60 text-white border-[#14213d] hover:border-[#fca311]/50'
                  : 'bg-white text-slate-900 border-slate-200 hover:border-slate-400 shadow-sm'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`} />
              <span>{isPaused ? 'Paused' : 'Real-Time'}</span>
            </button>

            {/* Clear Data */}
            <button
              onClick={onClearBuffer}
              className={`px-2.5 py-1.5 rounded-xl text-xs border transition-all cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-red-400 bg-black/60 border-[#14213d] hover:border-red-500/40'
                  : 'text-slate-500 hover:text-red-600 bg-white border-slate-200 hover:border-red-300 shadow-sm'
              }`}
              title="Clear telemetry buffer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Grid Layout Switcher */}
            <div
              className={`flex p-0.5 rounded-xl border ${
                isDark ? 'bg-black/60 border-[#14213d]' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <button
                onClick={() => {
                  setLayoutMode('2col');
                  setFocusedMetric(null);
                }}
                className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                  layoutMode === '2col'
                    ? isDark
                      ? 'bg-[#14213d] text-[#fca311]'
                      : 'bg-white text-[#fca311] shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="2-Column Dashboard Grid"
              >
                <Columns2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setLayoutMode('3col');
                  setFocusedMetric(null);
                }}
                className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                  layoutMode === '3col'
                    ? isDark
                      ? 'bg-[#14213d] text-[#fca311]'
                      : 'bg-white text-[#fca311] shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="3-Column Compact Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of MINE MESH Metric Chart Cards */}
      <div
        className={`grid gap-4 ${
          focusedMetric
            ? 'grid-cols-1'
            : layoutMode === '3col'
            ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            : 'grid-cols-1 lg:grid-cols-2'
        }`}
      >
        {/* 1. Ground Tilt Angle */}
        {(selectedMetricQuery === 'ALL' || selectedMetricQuery === 'tilt') &&
          (!focusedMetric || focusedMetric === 'tilt') && (
            <MineMetricChartCard
              metricId="mine.mesh/tilt/biaxial"
              title="Biaxial Strata Tilt Waveform"
              unit="°"
              data={data}
              series={getNodeSeries('tilt', '°')}
              warningThreshold={2.0}
              criticalThreshold={3.5}
              height={focusedMetric ? 380 : 220}
              isExpanded={focusedMetric === 'tilt'}
              onExpand={() => setFocusedMetric(focusedMetric === 'tilt' ? null : 'tilt')}
            />
          )}

        {/* 2. Gyroscope Angular Deviation (Pitch & Roll) */}
        {(selectedMetricQuery === 'ALL' || selectedMetricQuery === 'gyro') &&
          (!focusedMetric || focusedMetric === 'gyro') && (
            <MineMetricChartCard
              metricId="mine.mesh/inertial/gyro_deviation"
              title="Gyroscope Dual-Axis (Pitch X & Roll Y)"
              unit="°"
              data={data}
              series={getGyroSeries()}
              warningThreshold={2.0}
              criticalThreshold={3.5}
              height={focusedMetric ? 380 : 220}
              isExpanded={focusedMetric === 'gyro'}
              onExpand={() => setFocusedMetric(focusedMetric === 'gyro' ? null : 'gyro')}
            />
          )}

        {/* 3. Ultrasonic Distance & Roof Sag */}
        {(selectedMetricQuery === 'ALL' || selectedMetricQuery === 'distance') &&
          (!focusedMetric || focusedMetric === 'distance') && (
            <MineMetricChartCard
              metricId="mine.mesh/strata/roof_distance"
              title="Ultrasonic Roof Proximity (Convergence)"
              unit="cm"
              data={data}
              series={getNodeSeries('dist', 'cm')}
              warningThreshold={15.0}
              criticalThreshold={10.0}
              invertedRisk={true}
              height={focusedMetric ? 380 : 220}
              isExpanded={focusedMetric === 'distance'}
              onExpand={() => setFocusedMetric(focusedMetric === 'distance' ? null : 'distance')}
            />
          )}

        {/* 4. Hydrological Water Level / Inflow */}
        {(selectedMetricQuery === 'ALL' || selectedMetricQuery === 'water') &&
          (!focusedMetric || focusedMetric === 'water') && (
            <MineMetricChartCard
              metricId="mine.mesh/hydrology/water_inflow"
              title="Hydrological Water Table & Inflow Sump"
              unit="m"
              data={data}
              series={getNodeSeries('water', 'm')}
              warningThreshold={1.0}
              criticalThreshold={2.0}
              height={focusedMetric ? 380 : 220}
              isExpanded={focusedMetric === 'water'}
              onExpand={() => setFocusedMetric(focusedMetric === 'water' ? null : 'water')}
            />
          )}

        {/* 5. MQ-6 Combustible & Toxic Gas */}
        {(selectedMetricQuery === 'ALL' || selectedMetricQuery === 'gas') &&
          (!focusedMetric || focusedMetric === 'gas') && (
            <MineMetricChartCard
              metricId="mine.mesh/atmosphere/mq6_gas"
              title="MQ-6 Atmospheric Methane & Toxic Gas"
              unit="ppm"
              data={data}
              series={getNodeSeries('gas', 'ppm')}
              warningThreshold={25}
              criticalThreshold={45}
              height={focusedMetric ? 380 : 220}
              isExpanded={focusedMetric === 'gas'}
              onExpand={() => setFocusedMetric(focusedMetric === 'gas' ? null : 'gas')}
            />
          )}

        {/* 6. DHT22 Environmental Microclimate (Humidity & Temp) */}
        {(selectedMetricQuery === 'ALL' || selectedMetricQuery === 'climate') &&
          (!focusedMetric || focusedMetric === 'climate') && (
            <MineMetricChartCard
              metricId="mine.mesh/climate/humidity_and_temp"
              title="DHT22 Environmental Humidity & Strata Temp"
              unit="%"
              data={data}
              series={getClimateSeries()}
              warningThreshold={70}
              criticalThreshold={85}
              height={focusedMetric ? 380 : 220}
              isExpanded={focusedMetric === 'climate'}
              onExpand={() => setFocusedMetric(focusedMetric === 'climate' ? null : 'climate')}
            />
          )}

        {/* 7. Seismic Ground Vibration Acceleration */}
        {(selectedMetricQuery === 'ALL' || selectedMetricQuery === 'vibration') &&
          (!focusedMetric || focusedMetric === 'vibration') && (
            <MineMetricChartCard
              metricId="mine.mesh/seismic/vibration_amplitude"
              title="Seismic Ground Peak Acceleration"
              unit="g"
              data={data}
              series={getNodeSeries('vibe', 'g')}
              warningThreshold={2.0}
              criticalThreshold={3.5}
              height={focusedMetric ? 380 : 220}
              isExpanded={focusedMetric === 'vibration'}
              onExpand={() => setFocusedMetric(focusedMetric === 'vibration' ? null : 'vibration')}
            />
          )}
      </div>
    </div>
  );
}
