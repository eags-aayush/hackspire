import React from 'react';
import { NodeStatusState } from '@/types/node';
import { Badge } from '../common/Badge';
import { formatRelativeTime } from '@/lib/utils';
import { Cpu, AlertTriangle, ShieldCheck } from 'lucide-react';

interface NodeTableProps {
  nodes: {
    zoneId: string;
    nodeId: string;
    status?: NodeStatusState;
    sensorCount: number;
  }[];
}

export function NodeTable({ nodes }: NodeTableProps) {
  if (nodes.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-[#5c677d] dark:text-[#94a3b8] italic">
        No nodes registered in the system yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-[#14213d] dark:text-[#e5e5e5]">
        <thead className="bg-[#f4f5f7] dark:bg-[#000000]/80 text-[10px] uppercase font-mono text-[#5c677d] dark:text-[#94a3b8] border-b border-[#e5e5e5] dark:border-[#14213d]">
          <tr>
            <th className="px-4 py-3.5">Node Identity</th>
            <th className="px-4 py-3.5">Zone</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5">Last Sequence</th>
            <th className="px-4 py-3.5">Packet Gaps</th>
            <th className="px-4 py-3.5">Active Sensors</th>
            <th className="px-4 py-3.5">Last Heartbeat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e5e5e5] dark:divide-[#14213d]/60 font-mono">
          {nodes.map(({ zoneId, nodeId, status, sensorCount }) => {
            const isOnline = status?.status === 'online';
            const isStale = status?.status === 'stale';
            const gapCount = status?.gapCount || 0;

            return (
              <tr
                key={`${zoneId}-${nodeId}`}
                className="hover:bg-[#f4f5f7]/80 dark:hover:bg-[#14213d]/40 transition-colors"
              >
                <td className="px-4 py-3 font-semibold text-[#000000] dark:text-white flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg border ${
                      isOnline
                        ? 'bg-[#14213d]/10 dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border-[#14213d]/20 dark:border-[#fca311]/40'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                  </div>
                  <span>{nodeId}</span>
                </td>
                <td className="px-4 py-3 font-bold text-[#14213d] dark:text-[#fca311]">{zoneId}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={isOnline ? 'success' : isStale ? 'warning' : 'danger'}
                    pulse={isOnline}
                    className="text-[10px]"
                  >
                    {status?.status || 'offline'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-[#14213d] dark:text-[#e5e5e5]">
                  {status?.lastSequenceNumber !== undefined
                    ? `#${status.lastSequenceNumber}`
                    : 'N/A'}
                </td>
                <td className="px-4 py-3">
                  {gapCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-[#fca311] font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      {gapCount} missed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <ShieldCheck className="w-3 h-3" /> 0 gaps
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#5c677d] dark:text-[#94a3b8]">
                  <span className="px-2 py-0.5 rounded-md bg-[#f4f5f7] dark:bg-[#000000]/70 border border-[#e5e5e5] dark:border-[#14213d] text-[#14213d] dark:text-[#e5e5e5] font-semibold">
                    {sensorCount} metrics
                  </span>
                </td>
                <td className="px-4 py-3 text-[#5c677d] dark:text-[#94a3b8]">
                  {status?.lastSeenAt ? formatRelativeTime(status.lastSeenAt) : 'Never'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
