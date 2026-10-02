"use client";

import React, { useState } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { useZoneFilter } from '@/hooks/useZoneFilter';
import { LatencyTracker } from '@/components/monitoring/LatencyTracker';
import { MonitoringControls } from '@/components/monitoring/MonitoringControls';
import { GlobalZoneAverages } from '@/components/monitoring/GlobalZoneAverages';
import { ZoneContainer } from '@/components/monitoring/ZoneContainer';
import { EmptyState } from '@/components/common/EmptyState';
import { HardwareOnboardingWizard } from '@/components/common/HardwareOnboardingWizard';
import { Activity, Cpu, FileText } from 'lucide-react';
import { ReportModal } from '@/components/common/ReportModal';
import { SosEmergencyBanner } from '@/components/alerts/SosEmergencyBanner';
import { buildMonitoringReport, ExecutiveReportData } from '@/lib/reportGenerator';

export default function MonitoringPage() {
  const { readings, nodeStatuses, mlPredictions, stats, metrics, alerts, edgeActuatorStates, dispatchEdgeAlert } = useRealtime();
  const [showHardwareGuide, setShowHardwareGuide] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState<ExecutiveReportData | null>(null);

  const handleGenerateReport = () => {
    const report = buildMonitoringReport({
      readings,
      nodeStatuses,
      mlPredictions,
      stats,
      metrics,
      activeZones,
    });
    setReportData(report);
    setIsReportOpen(true);
  };
  const {
    selectedZone,
    setSelectedZone,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    onlyOpPp,
    setOnlyOpPp,
    toggleOnlyOpPp,
    filteredZones,
    filteredStats,
    activeZones,
  } = useZoneFilter();

  const hasData = Object.keys(readings).length > 0 || Object.keys(nodeStatuses).length > 0;
  const zoneEntries = Object.entries(filteredZones);
  const displayStats = onlyOpPp && filteredStats.totalNodes > 0 ? filteredStats : stats;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#000000] dark:text-white tracking-wide flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-[#fca311]" />
            Live Realtime Mine Monitoring Room
          </h1>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-1 font-medium">
            Real-time multi-modal telemetry per zone, per node, and per sensor with sub-500ms latency validation
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setShowHardwareGuide(!showHardwareGuide)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm ${
              showHardwareGuide || stats.totalNodes === 0
                ? 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] border-[#14213d] dark:border-[#fca311]'
                : 'bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/60 dark:hover:bg-[#14213d] text-[#14213d] dark:text-[#e5e5e5] border-[#e5e5e5] dark:border-[#14213d]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{showHardwareGuide ? 'Hide Hardware Setup' : 'Connect Nodes & Demo'}</span>
          </button>

          {/* Shift Report Button */}
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 text-xs font-mono font-bold tracking-wide transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Generate Shift Operations & Telemetry Geotechnical Report"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Shift Report</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-[#14213d] dark:text-[#e5e5e5] bg-[#f4f5f7] dark:bg-[#14213d]/70 px-3.5 py-2 rounded-xl border border-[#e5e5e5] dark:border-[#14213d] shadow-sm">
            <span className="text-[#5c677d] dark:text-[#94a3b8]">Zones:</span>
            <span className="text-[#14213d] dark:text-[#fca311] font-bold">{displayStats.totalZones}</span>
            <span className="text-[#d4d4d4] dark:text-[#14213d]">|</span>
            <span className="text-[#5c677d] dark:text-[#94a3b8]">Online:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{displayStats.onlineNodes}</span>
            <span className="text-[#5c677d] dark:text-[#94a3b8]">/</span>
            <span className="text-[#5c677d] dark:text-[#94a3b8]">{displayStats.totalNodes}</span>
            {onlyOpPp && (
              <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-[#000000] dark:text-[#fca311] bg-[#fca311] dark:bg-[#fca311]/20 px-1.5 py-0.5 rounded border border-[#fca311]/40">
                OP &amp; PP
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Latency Tracker Metric Component */}
      <LatencyTracker />

      {/* Optional Hardware Configuration Card when toggled on live stream */}
      {showHardwareGuide && hasData && stats.totalNodes > 0 && (
        <HardwareOnboardingWizard compact={true} />
      )}

      {/* Search & Filter Controls */}
      <MonitoringControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        selectedZone={selectedZone}
        onSelectZone={setSelectedZone}
        activeZones={activeZones}
        onlyOpPp={onlyOpPp}
        onToggleOnlyOpPp={toggleOnlyOpPp}
      />

      {/* Filter Status Alert Banner */}
      {onlyOpPp && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-500/10 dark:bg-[#fca311]/10 border border-amber-500/30 dark:border-[#fca311]/30 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#fca311] shrink-0" />
            <span className="text-[#14213d] dark:text-[#e5e5e5]">
              <strong className="text-amber-700 dark:text-[#fca311]">Hardware Filter Active:</strong> Only showing actual nodes <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-black/40 font-mono font-bold text-[#fca311]">NODE_OP</code> and <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-black/40 font-mono font-bold text-[#fca311]">NODE_PP</code>. Broken / simulated nodes are hidden.
            </span>
          </div>
          <button
            onClick={() => setOnlyOpPp(false)}
            className="text-[11px] font-bold text-amber-700 dark:text-[#fca311] hover:underline self-start sm:self-auto cursor-pointer"
          >
            Show All Nodes
          </button>
        </div>
      )}

      {/* Real-Time All Active Zones Fleet Telemetry Averages */}
      {hasData && stats.totalNodes > 0 && (
        <GlobalZoneAverages
          readings={readings}
          nodeStatuses={nodeStatuses}
          activeZones={activeZones}
          onlyOpPp={onlyOpPp}
        />
      )}

      {/* SOS Emergency Anomaly Banner */}
      <SosEmergencyBanner
        alerts={alerts}
        mlPredictions={mlPredictions}
        edgeActuatorStates={edgeActuatorStates}
        onDispatch={dispatchEdgeAlert}
      />

      {/* Zones & Nodes Telemetry Grid */}
      <div className="space-y-6">
        {!hasData || stats.totalNodes === 0 ? (
          <div className="space-y-6">
            <HardwareOnboardingWizard compact={false} />
            <EmptyState
              title="Awaiting Real-Time Hardware Mesh Telemetry"
              message="No physical or simulated sensor nodes are currently broadcasting. Use the configuration center above to launch the 1-Click Browser Demo, run the local MQTT simulator CLI, or connect your physical ESP32 mesh nodes."
            />
          </div>
        ) : zoneEntries.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/80 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d] text-xs text-[#5c677d] dark:text-[#94a3b8] space-y-3">
            <p>
              {onlyOpPp
                ? 'No telemetry received yet for NODE_OP or NODE_PP. Waiting for hardware packets on mesh...'
                : `No nodes or zones match your current filter criteria: "${searchQuery || statusFilter}".`}
            </p>
            {onlyOpPp && (
              <button
                onClick={() => setOnlyOpPp(false)}
                className="px-3.5 py-2 rounded-xl bg-[#14213d] dark:bg-[#fca311] text-white dark:text-[#000000] font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm inline-block"
              >
                Show All Nodes (Turn Off Filter)
              </button>
            )}
          </div>
        ) : (
          zoneEntries.map(([zoneId, nodeIds]) => (
            <ZoneContainer
              key={zoneId}
              zoneId={zoneId}
              nodeIds={nodeIds}
              readings={readings[zoneId] || {}}
              statuses={nodeStatuses[zoneId] || {}}
              mlPredictions={mlPredictions[zoneId] || {}}
              edgeActuatorStates={edgeActuatorStates}
              onDispatchEdgeAlert={dispatchEdgeAlert}
            />
          ))
        )}
      </div>

      {/* Boardroom Shift Operations Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        report={reportData}
      />
    </div>
  );
}
