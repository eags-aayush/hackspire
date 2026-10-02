"use client";

import React, { useMemo } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { NodeTable } from '@/components/nodes/NodeTable';
import { MetricCard } from '@/components/common/MetricCard';
import { Card } from '@/components/common/Card';
import { Cpu, AlertTriangle, WifiOff, Info, CheckCircle2 } from 'lucide-react';

export default function NodesPage() {
  const { nodeStatuses, readings, stats } = useRealtime();

  // Consolidate node list
  const allNodes = useMemo(() => {
    const list: {
      zoneId: string;
      nodeId: string;
      status?: (typeof nodeStatuses)[string][string];
      sensorCount: number;
    }[] = [];

    const processed = new Set<string>();

    // From nodeStatuses
    Object.entries(nodeStatuses).forEach(([zoneId, nodes]) => {
      Object.entries(nodes).forEach(([nodeId, status]) => {
        processed.add(`${zoneId}:${nodeId}`);
        const sensorCount = Object.keys(readings[zoneId]?.[nodeId] || {}).length;
        list.push({ zoneId, nodeId, status, sensorCount });
      });
    });

    // In case there are readings without status yet
    Object.entries(readings).forEach(([zoneId, nodes]) => {
      Object.entries(nodes).forEach(([nodeId, sensors]) => {
        const key = `${zoneId}:${nodeId}`;
        if (!processed.has(key)) {
          list.push({
            zoneId,
            nodeId,
            status: undefined,
            sensorCount: Object.keys(sensors).length,
          });
        }
      });
    });

    return list.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  }, [nodeStatuses, readings]);

  const onlineRatio =
    stats.totalNodes > 0 ? Math.round((stats.onlineNodes / stats.totalNodes) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#000000] dark:text-white tracking-wide flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-[#fca311]" />
            Node Fleet Management &amp; Packet Loss Audit
          </h1>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-1 font-medium">
            Tracking individual IoT mesh node health, sequence continuity, and Last Will and Testament disconnects
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#14213d]/70 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono text-[#14213d] dark:text-[#e5e5e5] shadow-sm">
          Total Mesh Nodes: <span className="text-[#14213d] dark:text-[#fca311] font-bold">{stats.totalNodes}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Online Fleet Ratio"
          value={`${onlineRatio}%`}
          subtext={`${stats.onlineNodes} of ${stats.totalNodes} nodes active`}
          icon={CheckCircle2}
          variant="emerald"
          status="LWT Heartbeat Validated"
        />

        <MetricCard
          title="Offline Nodes"
          value={stats.offlineNodes}
          subtext="LWT triggered or silent"
          icon={WifiOff}
          variant={stats.offlineNodes > 0 ? 'red' : 'emerald'}
          status={stats.offlineNodes === 0 ? 'All Nodes Connected' : 'Attention Required'}
        />

        <MetricCard
          title="Total Packet Gaps"
          value={stats.totalGaps}
          subtext="Sequence gaps inferred as loss"
          icon={AlertTriangle}
          variant={stats.totalGaps > 0 ? 'amber' : 'emerald'}
          status="Rules.md §3 Compliant"
        />

        <MetricCard
          title="Active Telemetry Sensors"
          value={stats.activeSensorsCount}
          subtext="Metrics across all zones"
          icon={Cpu}
          variant="blue"
          status="Tilt, Vibe, Crack, Gas, Water"
        />
      </div>

      {/* Safety Critical Architecture Callout */}
      <Card className="p-4 bg-white/95 dark:bg-[#14213d]/35 border-[#e5e5e5] dark:border-[#14213d] text-xs text-[#14213d] dark:text-[#e5e5e5] space-y-2">
        <div className="flex items-center gap-2 text-[#14213d] dark:text-[#fca311] font-bold">
          <Info className="w-4 h-4" />
          <span>Why Sequence Gap Auditing is Safety-Critical (Design &amp; Architecture §5)</span>
        </div>
        <p className="text-[#5c677d] dark:text-[#94a3b8] text-[11px] leading-relaxed">
          In an underground or surface mining environment, sensor packet loss is not mere noise—it often signals
          strata collapse, antenna shearing, or power line breakage. Our backend tracks monotonic sequence numbers
          per node. If sequence jumps forward modestly, missed packets increment the canonical <code className="text-[#14213d] dark:text-[#fca311] font-bold">gapCount</code>.
          Massive forward jumps (&gt;10,000) or backward resets are recognized as hardware reboot events rather than packet loss.
        </p>
      </Card>

      {/* Master Node Inventory Table */}
      <Card className="p-0 overflow-hidden bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d]">
        <div className="p-4 border-b border-[#e5e5e5] dark:border-[#14213d] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#000000] dark:text-white tracking-wide">
            Registered Node Directory
          </h3>
          <span className="text-xs font-mono text-[#5c677d] dark:text-[#94a3b8]">
            {allNodes.length} nodes cataloged
          </span>
        </div>
        <NodeTable nodes={allNodes} />
      </Card>
    </div>
  );
}
