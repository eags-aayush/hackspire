"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRealtime } from '@/hooks/useRealtime';
import { StrataCrossSection } from '@/components/digital-twin/StrataCrossSection';
import { DigitalTwinHud } from '@/components/digital-twin/DigitalTwinHud';
import {
  Globe2,
  Cpu,
  Layers,
  Sparkles,
  Radio,
  Play,
  Pause,
  AlertTriangle,
  RefreshCw,
  Compass,
} from 'lucide-react';

// Dynamic import of Leaflet map with SSR disabled to ensure zero hydration mismatch
const DigitalTwinMap = dynamic(
  () => import('@/components/digital-twin/DigitalTwinMap').then(mod => mod.DigitalTwinMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[620px] rounded-2xl bg-[#0a1120] border border-[#14213d] flex flex-col items-center justify-center text-slate-400 space-y-3 animate-pulse">
        <Globe2 className="w-10 h-10 text-[#fca311] animate-spin" />
        <div className="text-sm font-semibold text-white">Loading Digital Twin GIS Engine...</div>
        <div className="text-xs font-mono text-slate-500">
          Initializing OpenStreetMap, Leaflet.js & Strata Vector Layers
        </div>
      </div>
    ),
  }
);

export default function DigitalTwinPage() {
  const {
    readings,
    nodeStatuses,
    mlPredictions,
    metrics,
    stats,
    isSimulationActive,
    toggleSimulation,
    triggerDemoMlEvent,
  } = useRealtime();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('NODE_03');
  const [timeTravelOffsetHours, setTimeTravelOffsetHours] = useState<number>(0);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header with System Status Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#14213d]/10 dark:bg-[#14213d] border border-[#14213d]/30 dark:border-[#fca311]/40 text-[#14213d] dark:text-[#fca311]">
              <Globe2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-black text-[#000000] dark:text-white tracking-wide">
                Digital Twin GIS Model
              </h1>
              <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-0.5 font-medium">
                Geospatial Leaflet & OpenStreetMap twin synchronized with real-time multi-modal geotechnical IoT telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Simulator Status */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Simulate Anomaly Button */}
          <button
            onClick={() => triggerDemoMlEvent('NODE_03', 'subsidence_risk')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span>Simulate N3 Subsidence Event</span>
          </button>

          {/* Simulator Stream Toggle */}
          <button
            onClick={toggleSimulation}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm ${
              isSimulationActive
                ? 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] border-[#14213d] dark:border-[#fca311]'
                : 'bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/60 dark:hover:bg-[#14213d] text-[#14213d] dark:text-[#e5e5e5] border-[#e5e5e5] dark:border-[#14213d]'
            }`}
          >
            {isSimulationActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimulationActive ? 'Live Simulator Running' : 'Start Telemetry Stream'}</span>
          </button>

          {/* Status Metric Pill */}
          <div className="flex items-center gap-2 text-xs font-mono text-[#14213d] dark:text-[#e5e5e5] bg-[#f4f5f7] dark:bg-[#14213d]/70 px-3.5 py-2 rounded-xl border border-[#e5e5e5] dark:border-[#14213d] shadow-sm">
            <span className="text-[#5c677d] dark:text-[#94a3b8]">Twin Health:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              100% Synced
            </span>
          </div>
        </div>
      </div>

      {/* 1. Leaflet & OpenStreetMap Interactive GIS Digital Twin */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#fca311]" />
            Spatial Mine Surface & Telemetry Mesh Map
          </span>
          <span className="text-[11px] font-mono text-[#fca311]">
            OpenStreetMap &bull; Leaflet.js &bull; EPSG:4326
          </span>
        </div>

        <DigitalTwinMap
          selectedNodeId={selectedNodeId}
          onSelectNode={nodeId => setSelectedNodeId(nodeId)}
          readings={readings}
          nodeStatuses={nodeStatuses}
          mlPredictions={mlPredictions}
          timeTravelOffsetHours={timeTravelOffsetHours}
        />
      </div>

      {/* 2. Subsurface Geotechnical Strata & Subsidence Trough Cross-Section */}
      <StrataCrossSection
        selectedNodeId={selectedNodeId}
        onSelectNode={nodeId => setSelectedNodeId(nodeId)}
        readings={readings}
        nodeStatuses={nodeStatuses}
        timeTravelOffsetHours={timeTravelOffsetHours}
      />

      {/* 3. Operations HUD & Predictive Time-Travel Slider */}
      <DigitalTwinHud
        selectedNodeId={selectedNodeId}
        onSelectNode={nodeId => setSelectedNodeId(nodeId)}
        readings={readings}
        nodeStatuses={nodeStatuses}
        metrics={metrics}
        timeTravelOffsetHours={timeTravelOffsetHours}
        onTimeTravelChange={offset => setTimeTravelOffsetHours(offset)}
      />
    </div>
  );
}
