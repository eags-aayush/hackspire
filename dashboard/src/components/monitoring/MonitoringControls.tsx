import React, { useState } from 'react';
import { StatusFilterOption } from '@/hooks/useZoneFilter';
import { useRealtime } from '@/hooks/useRealtime';
import {
  Search,
  Layers,
  CheckCircle,
  WifiOff,
  AlertTriangle,
  RotateCcw,
  Check,
  Sparkles,
  BrainCircuit,
  ShieldAlert,
  Cpu,
} from 'lucide-react';

interface MonitoringControlsProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: StatusFilterOption;
  onStatusFilterChange: (f: StatusFilterOption) => void;
  selectedZone: string;
  onSelectZone: (z: string) => void;
  activeZones: string[];
  onlyOpPp?: boolean;
  onToggleOnlyOpPp?: () => void;
}

export function MonitoringControls({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedZone,
  onSelectZone,
  activeZones,
  onlyOpPp,
  onToggleOnlyOpPp,
}: MonitoringControlsProps) {
  const { clearCache, isSimulationActive, toggleSimulation } = useRealtime();
  const [purgedRecently, setPurgedRecently] = useState(false);

  const handlePurge = () => {
    clearCache();
    setPurgedRecently(true);
    setTimeout(() => setPurgedRecently(false), 2000);
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-white/95 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d] shadow-sm">
      {/* Search Bar */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c677d] dark:text-[#94a3b8]" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Filter by node ID (e.g. NODE_OP, NODE_PP) or zone..."
          className="w-full pl-10 pr-4 py-2.5 bg-[#f4f5f7] dark:bg-[#000000]/70 border border-[#e5e5e5] dark:border-[#14213d] rounded-xl text-xs text-[#000000] dark:text-white placeholder-[#5c677d] dark:placeholder-[#94a3b8] focus:outline-none focus:border-[#fca311] transition-all"
        />
      </div>

      {/* Controls & Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Hardware Node Filter: NODE_OP & NODE_PP */}
        {onToggleOnlyOpPp && (
          <button
            type="button"
            onClick={onToggleOnlyOpPp}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 border shadow-sm cursor-pointer ${
              onlyOpPp
                ? 'bg-[#fca311] text-[#000000] border-[#fca311] shadow-[#fca311]/25 ring-2 ring-[#fca311]/40 font-black'
                : 'bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#000000]/70 dark:hover:bg-[#14213d] text-[#5c677d] dark:text-[#94a3b8] border-[#e5e5e5] dark:border-[#14213d]'
            }`}
            title={
              onlyOpPp
                ? 'Filtered to actual hardware nodes (NODE_OP & NODE_PP). Click to show all nodes.'
                : 'Filter to only show actual nodes (NODE_OP & NODE_PP)'
            }
          >
            <Cpu className={`w-3.5 h-3.5 ${onlyOpPp ? 'text-[#000000]' : 'text-[#fca311]'}`} />
            <span>{onlyOpPp ? 'NODE_OP & NODE_PP Only' : 'Filter OP / PP'}</span>
            <span
              className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded-md ${
                onlyOpPp
                  ? 'bg-black text-[#fca311]'
                  : 'bg-[#14213d]/10 dark:bg-[#14213d] text-[#5c677d] dark:text-[#94a3b8]'
              }`}
            >
              {onlyOpPp ? 'ON' : 'OFF'}
            </span>
          </button>
        )}

        {/* Zone Selector */}
        <div className="flex items-center gap-1.5 bg-[#f4f5f7] dark:bg-[#000000]/70 px-3 py-2 rounded-xl border border-[#e5e5e5] dark:border-[#14213d] text-xs">
          <Layers className="w-3.5 h-3.5 text-[#14213d] dark:text-[#fca311]" />
          <select
            value={selectedZone}
            onChange={e => onSelectZone(e.target.value)}
            className="bg-transparent text-[#14213d] dark:text-[#e5e5e5] text-xs font-mono font-semibold focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-white dark:bg-[#14213d] text-[#14213d] dark:text-white">
              All Zones ({activeZones.length})
            </option>
            {activeZones.map(z => (
              <option key={z} value={z} className="bg-white dark:bg-[#14213d] text-[#14213d] dark:text-white">
                Zone: {z}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-[#f4f5f7] dark:bg-[#000000]/70 p-1 rounded-xl border border-[#e5e5e5] dark:border-[#14213d] text-xs">
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] shadow-sm'
                : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onStatusFilterChange('online')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'online'
                ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Online
          </button>
          <button
            onClick={() => onStatusFilterChange('offline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'offline'
                ? 'bg-red-500/20 text-red-800 dark:text-red-300 border border-red-500/40 shadow-sm'
                : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            Offline
          </button>
          <button
            onClick={() => onStatusFilterChange('gaps')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'gaps'
                ? 'bg-[#fca311]/20 text-amber-800 dark:text-[#fca311] border border-[#fca311]/40 shadow-sm'
                : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-[#fca311]" />
            Gaps
          </button>
          <button
            onClick={() => onStatusFilterChange('ml_subsidence')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'ml_subsidence'
                ? 'bg-red-500/25 text-red-800 dark:text-red-200 border border-red-500/60 shadow-sm'
                : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            ML Risk
          </button>
          <button
            onClick={() => onStatusFilterChange(statusFilter === 'node_op_pp' ? 'all' : 'node_op_pp')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'node_op_pp'
                ? 'bg-[#fca311] text-[#000000] shadow-sm font-black'
                : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
            }`}
            title="Filter to NODE_OP and NODE_PP"
          >
            <Cpu className="w-3 h-3 text-[#fca311]" />
            OP/PP
          </button>
        </div>

        {/* Quick Purge & Simulation Controls */}
        <div className="flex items-center gap-2 pl-1 border-t lg:border-t-0 lg:border-l border-[#e5e5e5] dark:border-[#14213d] pt-2 lg:pt-0 lg:pl-3">
          <button
            onClick={toggleSimulation}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm ${
              isSimulationActive
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                : 'bg-[#14213d] hover:bg-[#1f3056] text-[#fca311] border border-[#fca311]/40'
            }`}
            title={isSimulationActive ? 'Stop active browser demo telemetry' : 'Launch 1-click browser demo telemetry'}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isSimulationActive ? 'Stop Demo' : 'Browser Demo'}</span>
          </button>

          <button
            onClick={handlePurge}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all hover:scale-105 active:scale-95 shadow-sm ${
              purgedRecently
                ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500'
                : 'bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#000000]/70 dark:hover:bg-[#14213d] text-[#14213d] dark:text-[#e5e5e5] border-[#e5e5e5] dark:border-[#14213d]'
            }`}
            title="Purge all cached sensor telemetry to strictly reflect live incoming stream"
          >
            {purgedRecently ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Purged!</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5 text-[#fca311]" />
                <span>Purge Cache</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
