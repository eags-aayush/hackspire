"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { SENSOR_CONFIGS } from '@/lib/constants';
import { ValidatedSensorReading } from '@/types/sensor';
import { AnalyticsKpiCards } from '@/components/analytics/AnalyticsKpiCards';
import { MineMetricsDashboard, MineTelemetryPoint } from '@/components/analytics/MineMetricsDashboard';
import { FocusedRechartsChart, FocusedChartPoint } from '@/components/analytics/FocusedRechartsChart';
import { NodeFleetComparisonChart } from '@/components/analytics/NodeFleetComparisonChart';
import { SimulationScenarioPanel } from '@/components/analytics/SimulationScenarioPanel';
import { MlValidationStudio } from '@/components/analytics/MlValidationStudio';
import { HistoricalQueryConsole } from '@/components/analytics/HistoricalQueryConsole';
import { isOpPpNode } from '@/hooks/useZoneFilter';
import {
  BarChart3,
  Sparkles,
  Play,
  Square,
  Activity,
  Layers,
  BrainCircuit,
  Database,
  Radio,
  FileText,
  LineChart as LineChartIcon,
  Cpu,
  Wifi,
  WifiOff,
  Sliders,
} from 'lucide-react';
import { ReportModal } from '@/components/common/ReportModal';
import { buildAnalyticsReport, ExecutiveReportData } from '@/lib/reportGenerator';

type AnalyticsTab =
  | 'observability'
  | 'deep_dive'
  | 'fleet_comparison'
  | 'simulation'
  | 'ml_validation'
  | 'query_contract';

export interface TelemetryFramePoint extends MineTelemetryPoint, FocusedChartPoint {
  [key: string]: any;
}

export default function AnalyticsPage() {
  const {
    readings,
    nodeStatuses,
    mlPredictions,
    metrics,
    gatewayStatus,
    stats,
    isSimulationActive,
    toggleSimulation,
    triggerDemoMlEvent,
    activeZones,
  } = useRealtime();

  // Active Workspace Tab
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('observability');

  // Hardware Filter State (NODE_OP & NODE_PP Only vs All Nodes)
  const [onlyOpPp, setOnlyOpPp] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('monitoring_filter_op_pp');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const toggleOnlyOpPp = useCallback(() => {
    setOnlyOpPp(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('monitoring_filter_op_pp', String(next));
      }
      return next;
    });
  }, []);

  // Dynamically discover all active mesh nodes from real-time backend state
  const allDiscoveredNodes = useMemo(() => {
    const set = new Set<string>();
    Object.values(nodeStatuses).forEach(zoneNodes => {
      Object.keys(zoneNodes).forEach(nodeId => set.add(nodeId));
    });
    Object.values(readings).forEach(zoneNodes => {
      Object.keys(zoneNodes).forEach(nodeId => set.add(nodeId));
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? list : ['NODE_OP', 'NODE_PP'];
  }, [nodeStatuses, readings]);

  // Filtered nodes based on OP/PP toggle
  const dynamicNodes = useMemo(() => {
    if (onlyOpPp) {
      const opPp = allDiscoveredNodes.filter(isOpPpNode);
      if (opPp.length > 0) return opPp;
    }
    return allDiscoveredNodes;
  }, [allDiscoveredNodes, onlyOpPp]);

  // Selected sensor and node
  const [selectedSensor, setSelectedSensor] = useState<string>('tilt');
  const [selectedNode, setSelectedNode] = useState<string>(() => {
    const op = allDiscoveredNodes.find(isOpPpNode);
    return op || allDiscoveredNodes[0] || 'NODE_OP';
  });
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<string>('1m');
  const [isBufferPaused, setIsBufferPaused] = useState<boolean>(false);

  // Sync selectedNode when dynamicNodes changes
  useEffect(() => {
    if (dynamicNodes.length > 0 && !dynamicNodes.includes(selectedNode)) {
      setSelectedNode(dynamicNodes[0]);
    }
  }, [dynamicNodes, selectedNode]);

  // Executive Report Modal State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState<ExecutiveReportData | null>(null);

  // Pure real-time multi-channel rolling time-series buffer
  const [timeSeriesBuffer, setTimeSeriesBuffer] = useState<TelemetryFramePoint[]>([]);
  const isPausedRef = useRef(isBufferPaused);
  isPausedRef.current = isBufferPaused;

  const handleGenerateReport = () => {
    const report = buildAnalyticsReport({
      readings,
      mlPredictions,
      metrics,
      stats,
      selectedSensor,
      selectedNode,
      timeRange,
      bufferCount: timeSeriesBuffer.length,
    });
    setReportData(report);
    setIsReportOpen(true);
  };

  // Helper to extract a comprehensive data frame from current readings
  const buildFrameFromReadings = useCallback((): TelemetryFramePoint | null => {
    let hasAnyData = false;
    const nodeMetricMap: Record<string, any> = {};

    // Collect all real sensor readings across all nodes
    for (const zoneNodes of Object.values(readings)) {
      for (const [nId, sensorMap] of Object.entries(zoneNodes)) {
        hasAnyData = true;

        const tiltVal = sensorMap.tilt?.value ?? null;
        const pitchVal = sensorMap.tilt_x_deg?.value ?? sensorMap.pitch?.value ?? sensorMap.tilt_x?.value ?? null;
        const rollVal = sensorMap.tilt_y_deg?.value ?? sensorMap.roll?.value ?? sensorMap.tilt_y?.value ?? null;
        const distVal = sensorMap.distance?.value ?? sensorMap.displacement?.value ?? sensorMap.dist_cm?.value ?? null;
        const waterVal = sensorMap.water?.value ?? sensorMap.water_level_cm?.value ?? sensorMap.water_level?.value ?? null;
        const gasVal = sensorMap.gas?.value ?? sensorMap.gas_ppm?.value ?? sensorMap.mq6_raw?.value ?? null;
        const humVal = sensorMap.humidity?.value ?? sensorMap.humidity_pct?.value ?? null;
        const tempVal = sensorMap.temperature?.value ?? sensorMap.temperature_c?.value ?? null;
        const vibeVal = sensorMap.vibration?.value ?? sensorMap.vibration_amplitude_g?.value ?? null;
        const dispVal = sensorMap.displacement?.value ?? sensorMap.distance?.value ?? null;
        const crackVal = sensorMap.crack?.value ?? sensorMap.crack_displacement_mm?.value ?? sensorMap.potentiometer?.value ?? null;

        nodeMetricMap[`tilt_${nId}`] = tiltVal;
        nodeMetricMap[`pitch_${nId}`] = pitchVal;
        nodeMetricMap[`roll_${nId}`] = rollVal;
        nodeMetricMap[`dist_${nId}`] = distVal;
        nodeMetricMap[`water_${nId}`] = waterVal;
        nodeMetricMap[`gas_${nId}`] = gasVal;
        nodeMetricMap[`humidity_${nId}`] = humVal;
        nodeMetricMap[`temp_${nId}`] = tempVal;
        nodeMetricMap[`vibe_${nId}`] = vibeVal;
        nodeMetricMap[`disp_${nId}`] = dispVal;
        nodeMetricMap[`crack_${nId}`] = crackVal;

        if (sensorMap[selectedSensor]) {
          nodeMetricMap[nId] = sensorMap[selectedSensor].value;
        }
      }
    }

    if (!hasAnyData) return null;

    // Find readings for selectedNode (or first available node)
    let selectedReadings: Record<string, ValidatedSensorReading> | null = null;
    let activeSeq = 0;
    let latestTs = new Date().toISOString();

    for (const zoneNodes of Object.values(readings)) {
      if (zoneNodes[selectedNode]) {
        selectedReadings = zoneNodes[selectedNode];
        const first = Object.values(selectedReadings)[0];
        if (first) {
          activeSeq = first.sequenceNumber || activeSeq;
          latestTs = first.timestamp || latestTs;
        }
        break;
      }
    }

    const t = new Date(latestTs);
    const timeLabel = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const primaryTilt = selectedReadings?.tilt?.value ?? nodeMetricMap[`tilt_${selectedNode}`] ?? 0;
    const primaryPitch = selectedReadings?.tilt_x_deg?.value ?? nodeMetricMap[`pitch_${selectedNode}`] ?? 0;
    const primaryRoll = selectedReadings?.tilt_y_deg?.value ?? nodeMetricMap[`roll_${selectedNode}`] ?? 0;
    const primaryDist = selectedReadings?.distance?.value ?? selectedReadings?.displacement?.value ?? nodeMetricMap[`dist_${selectedNode}`] ?? 0;
    const primaryDisp = selectedReadings?.displacement?.value ?? nodeMetricMap[`disp_${selectedNode}`] ?? 0;
    const primaryWater = selectedReadings?.water?.value ?? nodeMetricMap[`water_${selectedNode}`] ?? 0;
    const primaryGas = selectedReadings?.gas?.value ?? nodeMetricMap[`gas_${selectedNode}`] ?? 0;
    const primaryHum = selectedReadings?.humidity?.value ?? nodeMetricMap[`humidity_${selectedNode}`] ?? 0;
    const primaryTemp = selectedReadings?.temperature?.value ?? nodeMetricMap[`temp_${selectedNode}`] ?? 0;
    const primaryVibe = selectedReadings?.vibration?.value ?? nodeMetricMap[`vibe_${selectedNode}`] ?? 0;
    const primaryCrack = selectedReadings?.crack?.value ?? 0;

    let activeVal = primaryTilt;
    if (selectedSensor === 'tilt') activeVal = primaryTilt;
    else if (selectedSensor === 'tilt_x_deg') activeVal = primaryPitch;
    else if (selectedSensor === 'tilt_y_deg') activeVal = primaryRoll;
    else if (selectedSensor === 'distance') activeVal = primaryDist;
    else if (selectedSensor === 'displacement') activeVal = primaryDisp;
    else if (selectedSensor === 'water') activeVal = primaryWater;
    else if (selectedSensor === 'gas') activeVal = primaryGas;
    else if (selectedSensor === 'humidity') activeVal = primaryHum;
    else if (selectedSensor === 'temperature') activeVal = primaryTemp;
    else if (selectedSensor === 'vibration') activeVal = primaryVibe;

    return {
      id: `frame-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: latestTs,
      timeLabel,
      nodeId: selectedNode,
      sequenceNumber: activeSeq,
      value: activeVal,
      tilt: primaryTilt,
      tilt_x_deg: primaryPitch,
      tilt_y_deg: primaryRoll,
      distance: primaryDist,
      displacement: primaryDisp,
      water: primaryWater,
      gas: primaryGas,
      humidity: primaryHum,
      temperature: primaryTemp,
      vibration: primaryVibe,
      crack: primaryCrack,
      ...nodeMetricMap,
    };
  }, [readings, selectedNode, selectedSensor]);

  // Initial buffer hydration on mount so charts immediately display baseline waveforms
  useEffect(() => {
    if (timeSeriesBuffer.length === 0) {
      const baseFrame = buildFrameFromReadings();
      if (baseFrame) {
        const now = Date.now();
        const initialPoints: TelemetryFramePoint[] = [];
        for (let i = 14; i >= 0; i--) {
          const pointTime = new Date(now - i * 2000);
          const timeLabel = pointTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          initialPoints.push({
            ...baseFrame,
            id: `init-frame-${pointTime.getTime()}-${i}`,
            timestamp: pointTime.toISOString(),
            timeLabel,
            sequenceNumber: Math.max(1, (baseFrame.sequenceNumber || 1) - i),
          });
        }
        setTimeSeriesBuffer(initialPoints);
      }
    }
  }, [buildFrameFromReadings, timeSeriesBuffer.length]);

  // Stream live incoming telemetry frames as readings state updates
  useEffect(() => {
    if (isPausedRef.current) return;

    const frame = buildFrameFromReadings();
    if (!frame) return;

    setTimeSeriesBuffer(prev => {
      const last = prev[prev.length - 1];
      // Avoid identical redundant tick duplicates
      if (
        last &&
        last.timestamp === frame.timestamp &&
        last.sequenceNumber === frame.sequenceNumber &&
        last.value === frame.value
      ) {
        return prev;
      }

      // Retain last 60 real-time frames for smooth performance
      return [...prev.slice(-59), frame];
    });
  }, [readings, buildFrameFromReadings]);

  const handleClearBuffer = useCallback(() => {
    setTimeSeriesBuffer([]);
  }, []);

  const handleTogglePause = useCallback(() => {
    setIsBufferPaused(prev => !prev);
  }, []);

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#14213d]">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#fca311]/15 text-amber-700 dark:text-[#fca311] border border-[#fca311]/30 shadow-md shadow-[#fca311]/10">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-wide font-mono">
                  MINE MESH™ Telemetry &amp; Strata Observability Studio
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-[#fca311]/20 text-amber-800 dark:text-[#fca311] border border-[#fca311]/40 shadow-sm">
                  DGMS MESH v2.4
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-[#94a3b8] mt-1 font-mono">
                Real-time geotechnical sensor waveforms (Tilt, Gyro, Distance, Water, Gas, Humidity) streaming directly from hardware nodes
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Badges & Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
          {/* Live Status Beacon */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#090d16] border border-slate-200 dark:border-[#14213d] text-xs font-mono shadow-sm">
            {stats.onlineNodes > 0 || isSimulationActive ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            )}
            <span className="text-slate-500 dark:text-[#94a3b8]">Mesh Link:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {isSimulationActive
                ? 'Simulation Engine Active'
                : stats.onlineNodes > 0
                ? `${stats.onlineNodes} Hardware Nodes Online`
                : 'Awaiting Hardware Packets'}
            </span>
          </div>

          {/* Quick Simulation Toggle */}
          <button
            onClick={toggleSimulation}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-black tracking-wide transition-all shadow-md cursor-pointer active:scale-95 ${
              isSimulationActive
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/30'
                : 'bg-[#fca311] hover:bg-[#ffb733] text-[#000000] shadow-[#fca311]/25'
            }`}
          >
            {isSimulationActive ? (
              <>
                <Square className="w-3.5 h-3.5" /> Stop Sim
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> 1-Click Sim
              </>
            )}
          </button>

          {/* Executive PDF Report Button */}
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-white dark:border-slate-700 text-xs font-mono font-bold tracking-wide transition-all shadow-sm cursor-pointer active:scale-95"
            title="Generate Boardroom & DGMS Geotechnical Executive Report"
          >
            <FileText className="w-3.5 h-3.5 text-amber-700 dark:text-[#fca311]" />
            <span>Executive Report</span>
          </button>
        </div>
      </div>

      {/* Real-Time Multi-Sensor KPI Ribbon */}
      <AnalyticsKpiCards
        readings={readings}
        mlPredictions={mlPredictions}
        metrics={metrics}
        gatewayStatus={gatewayStatus}
        stats={stats}
        isSimulationActive={isSimulationActive}
      />

      {/* Global Filter Toolbar with Dynamic Hardware Nodes */}
      <Card className="p-3.5 bg-white/95 dark:bg-[#090d16]/95 border-slate-200/90 dark:border-[#14213d] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm dark:shadow-md min-w-0 font-mono text-xs backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Hardware Filter Toggle (NODE_OP & NODE_PP) */}
          <button
            onClick={toggleOnlyOpPp}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer shadow-sm ${
              onlyOpPp
                ? 'bg-[#fca311] text-[#000000] border-[#fca311] ring-2 ring-[#fca311]/40'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:text-black dark:bg-black/60 dark:text-slate-400 dark:border-[#14213d] dark:hover:text-white'
            }`}
            title="Toggle to display physical hardware nodes (NODE_OP & NODE_PP) only"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{onlyOpPp ? 'NODE_OP & NODE_PP Only' : 'All Fleet Nodes'}</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                onlyOpPp
                  ? 'bg-black text-[#fca311]'
                  : 'bg-slate-200 text-slate-700 dark:bg-[#14213d] dark:text-slate-300'
              }`}
            >
              {dynamicNodes.length}
            </span>
          </button>

          {/* Dynamic Node Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-bold">Focus Node:</span>
            <select
              value={selectedNode}
              onChange={e => setSelectedNode(e.target.value)}
              className="bg-slate-50 dark:bg-black/80 border border-slate-200 dark:border-[#14213d] text-slate-900 dark:text-white rounded-xl px-3 py-1.5 font-bold cursor-pointer text-xs focus:outline-none focus:border-[#fca311] shadow-sm"
            >
              {dynamicNodes.map(n => (
                <option key={n} value={n}>
                  {n} {n === 'NODE_OP' ? '(Op Sensor)' : n === 'NODE_PP' ? '(Pp Sensor)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Sensor Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-bold">Primary Channel:</span>
            <select
              value={selectedSensor}
              onChange={e => setSelectedSensor(e.target.value)}
              className="bg-slate-50 dark:bg-black/80 border border-slate-200 dark:border-[#14213d] text-slate-900 dark:text-white rounded-xl px-3 py-1.5 font-bold cursor-pointer text-xs focus:outline-none focus:border-[#fca311] shadow-sm"
            >
              <option value="tilt">Tilt Angle (°)</option>
              <option value="tilt_x_deg">Gyro Pitch X (°)</option>
              <option value="tilt_y_deg">Gyro Roll Y (°)</option>
              <option value="distance">Roof Distance (cm)</option>
              <option value="water">Water Table (m)</option>
              <option value="gas">MQ-6 Gas (ppm)</option>
              <option value="humidity">Humidity (%)</option>
              <option value="temperature">Temperature (°C)</option>
              <option value="vibration">Seismic Vibration (g)</option>
            </select>
          </div>

          {/* Real-time telemetry counter */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                timeSeriesBuffer.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>
              {timeSeriesBuffer.length > 0
                ? `${timeSeriesBuffer.length} Real-Time frames`
                : 'Listening for packets...'}
            </span>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-black/60 p-1 rounded-xl border border-slate-200 dark:border-[#14213d] text-xs overflow-x-auto">
          {/* 1. MINE MESH Observability Studio */}
          <button
            onClick={() => setActiveTab('observability')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'observability'
                ? 'bg-white dark:bg-[#fca311] text-slate-900 dark:text-[#000000] font-black shadow-sm border border-slate-200/80 dark:border-transparent'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            <span>Strata Observability</span>
          </button>

          {/* 2. Deep-Dive Recharts Studio */}
          <button
            onClick={() => setActiveTab('deep_dive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'deep_dive'
                ? 'bg-white dark:bg-[#fca311] text-slate-900 dark:text-[#000000] font-black shadow-sm border border-slate-200/80 dark:border-transparent'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Deep-Dive Studio</span>
          </button>

          {/* 3. Fleet Cross-Comparison */}
          <button
            onClick={() => setActiveTab('fleet_comparison')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'fleet_comparison'
                ? 'bg-white dark:bg-[#fca311] text-slate-900 dark:text-[#000000] font-black shadow-sm border border-slate-200/80 dark:border-transparent'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Fleet Distribution</span>
          </button>

          {/* 4. Simulation Scenarios */}
          <button
            onClick={() => setActiveTab('simulation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'simulation'
                ? 'bg-white dark:bg-[#fca311] text-slate-900 dark:text-[#000000] font-black shadow-sm border border-slate-200/80 dark:border-transparent'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sim Scenarios</span>
          </button>

          {/* 5. AI Inference & Drift */}
          <button
            onClick={() => setActiveTab('ml_validation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ml_validation'
                ? 'bg-white dark:bg-[#fca311] text-slate-900 dark:text-[#000000] font-black shadow-sm border border-slate-200/80 dark:border-transparent'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>AI Inference</span>
          </button>

          {/* 6. §8 Storage Query */}
          <button
            onClick={() => setActiveTab('query_contract')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'query_contract'
                ? 'bg-white dark:bg-[#fca311] text-slate-900 dark:text-[#000000] font-black shadow-sm border border-slate-200/80 dark:border-transparent'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>§8 Storage</span>
          </button>
        </div>
      </Card>

      {/* Main Tab Views */}
      {/* 1. MINE MESH Strata Observability Studio */}
      {activeTab === 'observability' && (
        <MineMetricsDashboard
          data={timeSeriesBuffer}
          dynamicNodes={dynamicNodes}
          selectedZone={selectedZone}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          isPaused={isBufferPaused}
          onTogglePause={handleTogglePause}
          onClearBuffer={handleClearBuffer}
          onlyOpPp={onlyOpPp}
          onToggleOnlyOpPp={toggleOnlyOpPp}
        />
      )}

      {/* 2. Deep-Dive Recharts Studio */}
      {activeTab === 'deep_dive' && (
        <FocusedRechartsChart
          data={timeSeriesBuffer}
          selectedSensor={selectedSensor}
          selectedNode={selectedNode}
          nodeList={dynamicNodes}
          timeRange={timeRange}
          isPaused={isBufferPaused}
          onTogglePause={handleTogglePause}
          onClearData={handleClearBuffer}
          onSelectSensor={setSelectedSensor}
        />
      )}

      {/* 3. Fleet Cross-Node Bar Comparison */}
      {activeTab === 'fleet_comparison' && (
        <NodeFleetComparisonChart
          readings={readings}
          dynamicNodes={dynamicNodes}
          selectedSensor={selectedSensor}
          onSelectNode={setSelectedNode}
        />
      )}

      {/* 4. Simulation Scenarios */}
      {activeTab === 'simulation' && (
        <SimulationScenarioPanel
          isSimulationActive={isSimulationActive}
          onToggleSimulation={toggleSimulation}
          onTriggerMlEvent={triggerDemoMlEvent}
        />
      )}

      {/* 5. AI Inference Validation */}
      {activeTab === 'ml_validation' && (
        <MlValidationStudio liveMlPredictions={mlPredictions} />
      )}

      {/* 6. §8 Storage Query Console */}
      {activeTab === 'query_contract' && <HistoricalQueryConsole />}

      {/* Boardroom Executive Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        report={reportData}
      />
    </div>
  );
}
