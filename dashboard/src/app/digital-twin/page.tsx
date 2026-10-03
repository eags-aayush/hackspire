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
    isSerialConnected,
    livePortData,
    isSimulationActive,
    toggleSimulation,
    triggerDemoMlEvent,
  } = useRealtime();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('NODE_03');
  const [timeTravelOffsetHours, setTimeTravelOffsetHours] = useState<number>(0);

  return (
    <div className="space-y-6 pb-12 font-serif">
      {/* Page Header with System Status Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b-2 border-[#003366]/20 dark:border-[#c9a227]/30">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#003366] border-2 border-[#c9a227] flex items-center justify-center text-white text-xl font-bold shadow-md">
              ★
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-[#003366] dark:text-white tracking-wide">
                India Coal Mining GIS Atlas & Digital Twin
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Department of Mining Safety &mdash; High-Resolution Satellite GIS & Subsurface Strata Telemetry Mesh
              </p>
            </div>
          </div>
        </div>

        {/* Live Statutory Status Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-2 text-xs text-[#003366] dark:text-white bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-[#c9c9c9] dark:border-slate-700 shadow-sm">
            <span className="text-slate-500 dark:text-slate-400">DGMS Portal Link:</span>
            {isSerialConnected ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                SERIAL PORT LIVE ({livePortData?.nodeId || 'COM'})
              </span>
            ) : stats.onlineNodes > 0 ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                CLOUD MESH ({stats.onlineNodes} NODES)
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                OFFLINE (AWAITING PORT)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* National GIS Atlas Quick Metric Banner Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#1e293b]/70 border border-[#c9c9c9] dark:border-[#334155] border-l-4 border-l-[#003366] dark:border-l-[#c9a227] shadow-sm">
          <div className="text-2xl font-bold text-[#003366] dark:text-[#c9a227] leading-none">64+</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">National Registered Mines</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#1e293b]/70 border border-[#c9c9c9] dark:border-[#334155] border-l-4 border-l-[#003366] dark:border-l-[#c9a227] shadow-sm">
          <div className="text-2xl font-bold text-[#003366] dark:text-[#c9a227] leading-none">8 States</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">Major Mining States & UTs</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#1e293b]/70 border border-[#c9c9c9] dark:border-[#334155] border-l-4 border-l-[#003366] dark:border-l-[#c9a227] shadow-sm">
          <div className="text-2xl font-bold text-[#003366] dark:text-[#c9a227] leading-none">16 Basins</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">Gondwana & Lignite Coalfields</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#1e293b]/70 border border-[#c9c9c9] dark:border-[#334155] border-l-4 border-l-[#003366] dark:border-l-[#c9a227] shadow-sm">
          <div className={`text-2xl font-bold leading-none ${isSerialConnected || stats.onlineNodes > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>
            {isSerialConnected ? '1 Live Port' : stats.onlineNodes > 0 ? `${stats.onlineNodes} Beacons` : '--'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">
            {isSerialConnected ? 'Active USB Serial Hardware Stream' : stats.onlineNodes > 0 ? `Jharia LoRa Mesh Nodes (${stats.onlineNodes}/${stats.totalNodes})` : 'Awaiting Port Connection'}
          </div>
        </div>
      </div>

      {/* 1. Leaflet & OpenStreetMap Interactive GIS Digital Twin */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#003366] dark:text-[#c9a227] px-1">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#c9a227]" />
            National Satellite GIS & Spatial Mine Surface Telemetry Map
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Esri World Imagery &bull; OpenStreetMap &bull; Leaflet.js &bull; EPSG:4326
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
