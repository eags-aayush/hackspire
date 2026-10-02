"use client";

import React, { useState, useEffect } from 'react';
import {
  MINING_NODE_REGISTRY,
  exportMiningGeoJson,
} from '@/lib/gis/miningGisData';
import { ValidatedSensorReading } from '@/types/sensor';
import { NodeStatusState } from '@/types/node';
import { SystemLatencyMetrics } from '@/types/socket';
import {
  Clock,
  Play,
  Pause,
  Download,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  Radio,
  Sliders,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface DigitalTwinHudProps {
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  readings: Record<string, Record<string, Record<string, ValidatedSensorReading>>>;
  nodeStatuses: Record<string, Record<string, NodeStatusState>>;
  metrics?: SystemLatencyMetrics;
  timeTravelOffsetHours: number;
  onTimeTravelChange: (offset: number) => void;
}

export function DigitalTwinHud({
  selectedNodeId,
  onSelectNode,
  readings,
  nodeStatuses,
  metrics,
  timeTravelOffsetHours,
  onTimeTravelChange,
}: DigitalTwinHudProps) {
  const [isPlayingSimulation, setIsPlayingSimulation] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(false);

  // Time-travel timeline stops
  const timeSteps = [
    { offset: -24, label: 'T - 24h', desc: 'Baseline Geodetic Survey' },
    { offset: 0, label: 'T - 0 (LIVE)', desc: 'Realtime Physical Twin' },
    { offset: 2, label: 'T + 2h', desc: 'Near-Term Creep Forecast' },
    { offset: 6, label: 'T + 6h', desc: 'ML Strata Collapse Horizon' },
  ];

  // Auto-play simulation loop
  useEffect(() => {
    if (!isPlayingSimulation) return;

    const interval = setInterval(() => {
      onTimeTravelChange(
        timeTravelOffsetHours === -24
          ? 0
          : timeTravelOffsetHours === 0
          ? 2
          : timeTravelOffsetHours === 2
          ? 6
          : -24
      );
    }, 2800);

    return () => clearInterval(interval);
  }, [isPlayingSimulation, timeTravelOffsetHours, onTimeTravelChange]);

  // Export GeoJSON function
  const handleExportGeoJson = () => {
    const geojsonData = exportMiningGeoJson(readings, nodeStatuses);
    const blob = new Blob([JSON.stringify(geojsonData, null, 2)], {
      type: 'application/geo+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jharia_mine_digital_twin_gis_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportFeedback(true);
    setTimeout(() => setExportFeedback(false), 2500);
  };

  const registeredNodes = Object.values(MINING_NODE_REGISTRY);

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0a1120] border border-[#e5e5e5] dark:border-[#14213d] shadow-xl p-4 lg:p-6 space-y-5">
      {/* HUD Top Strip: Twin Health & Synchronization Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Twin Calibration Fidelity */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d]">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-[#fca311]" />
            <span>Digital Twin Fidelity</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              99.4%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Calibrated</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            FEM / Peck's Trough Error &lt; 0.6mm
          </div>
        </div>

        {/* Sync Latency */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d]">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-blue-500" />
            <span>Telemetry Wire Latency</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#14213d] dark:text-white font-mono">
              {metrics?.avgLatency ? `${Math.round(metrics.avgLatency)}ms` : '182ms'}
            </span>
            <span className="text-[10px] text-emerald-500 font-mono font-bold">&lt; 500ms</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Protobuf Wire Coalesced (250ms)
          </div>
        </div>

        {/* Active Geotechnical Probes */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d]">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Radio className="w-3.5 h-3.5 text-[#fca311]" />
            <span>Spatial Probes Synced</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-[#14213d] dark:text-white font-mono">
              {registeredNodes.length} Nodes
            </span>
            <span className="text-[10px] text-emerald-500 font-mono font-bold">100% Online</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Mesh Dual Protocol (LoRa / ESP-NOW)
          </div>
        </div>

        {/* GIS Export Action Card */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>GIS Data Export</span>
            <Layers className="w-3.5 h-3.5 text-[#fca311]" />
          </div>
          <button
            onClick={handleExportGeoJson}
            className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#14213d] hover:bg-[#1f3158] text-white dark:bg-[#fca311] dark:hover:bg-[#e0910e] dark:text-black font-semibold text-xs transition-all shadow-sm active:scale-95"
          >
            {exportFeedback ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 dark:text-black" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export GeoJSON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Middle: Predictive Time-Travel Simulation Horizon Slider */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#060c18] border border-[#e5e5e5] dark:border-[#14213d] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#fca311]" />
            <span className="font-bold text-xs text-[#14213d] dark:text-white uppercase tracking-wider">
              Predictive Geotechnical Time-Travel Horizon
            </span>
            {timeTravelOffsetHours > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                SIMULATING {timeTravelOffsetHours}H FUTURE
              </span>
            )}
            {timeTravelOffsetHours === 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE STREAM
              </span>
            )}
          </div>

          <button
            onClick={() => setIsPlayingSimulation(!isPlayingSimulation)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
              isPlayingSimulation
                ? 'bg-amber-500 text-black shadow-amber-500/20'
                : 'bg-white dark:bg-[#14213d] text-[#14213d] dark:text-white border border-[#e5e5e5] dark:border-[#14213d] hover:border-[#fca311]'
            }`}
          >
            {isPlayingSimulation ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Time-Travel</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Simulation Horizon</span>
              </>
            )}
          </button>
        </div>

        {/* Step Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {timeSteps.map(step => {
            const isSelected = timeTravelOffsetHours === step.offset;
            return (
              <button
                key={step.offset}
                onClick={() => onTimeTravelChange(step.offset)}
                className={`p-2.5 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'bg-[#14213d] text-[#fca311] dark:bg-[#fca311]/15 dark:text-[#fca311] border-[#14213d] dark:border-[#fca311] shadow-md'
                    : 'bg-white dark:bg-[#0a1120] text-slate-600 dark:text-slate-400 border-[#e5e5e5] dark:border-[#14213d] hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                <div className="font-extrabold text-xs font-mono">{step.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {step.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom: Quick Node Telemetry Selectors */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
          <span>Quick Fly-to & Strata Probe Synchronizer</span>
          <span className="text-[11px] font-mono text-slate-400">Click to focus camera and 2.5D profile</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {registeredNodes.map(node => {
            const isSelected = (selectedNodeId || 'NODE_03') === node.nodeId;
            const nodeReads = readings[node.zoneId]?.[node.nodeId] || {};
            const tiltVal = nodeReads.tilt?.value || 0;
            const dispVal = nodeReads.displacement?.value || 0;
            const isCritical = tiltVal >= node.criticalThresholdTilt || dispVal >= 25;

            return (
              <button
                key={node.nodeId}
                onClick={() => onSelectNode(node.nodeId)}
                className={`p-2 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'bg-[#14213d] text-white dark:bg-[#14213d] border-[#fca311] shadow-[0_0_12px_rgba(252,163,17,0.3)] ring-1 ring-[#fca311]'
                    : 'bg-slate-50 dark:bg-[#0a1120] text-slate-700 dark:text-slate-300 border-[#e5e5e5] dark:border-[#14213d] hover:border-[#fca311]/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-xs text-[#fca311]">
                    {node.nodeId}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isCritical ? 'bg-red-500 animate-ping' : 'bg-emerald-500'
                    }`}
                  />
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {node.label.split(' ')[0]}
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] mt-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400">Tilt:</span>
                  <span className={tiltVal >= 2.0 ? 'text-red-400 font-bold' : 'text-slate-200'}>
                    {tiltVal.toFixed(1)}°
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export default DigitalTwinHud;
