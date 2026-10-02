"use client";

import { useState, useMemo } from 'react';
import { useRealtime } from './useRealtime';

export type StatusFilterOption =
  | 'all'
  | 'online'
  | 'offline'
  | 'gaps'
  | 'ml_subsidence'
  | 'ml_noise'
  | 'ml_normal'
  | 'node_op_pp';

/**
 * Helper to identify whether a given nodeId corresponds to the actual hardware nodes NODE_OP or NODE_PP.
 * Handles uppercase, lowercase, hyphens, and index suffixes like NODE_OP_01.
 */
export function isOpPpNode(nodeId: string): boolean {
  if (!nodeId) return false;
  const normalized = nodeId.trim().toUpperCase().replace(/-/g, '_');
  return (
    normalized === 'NODE_OP' ||
    normalized === 'NODE_PP' ||
    normalized.startsWith('NODE_OP') ||
    normalized.startsWith('NODE_PP') ||
    normalized.includes('NODE_OP') ||
    normalized.includes('NODE_PP')
  );
}

export function useZoneFilter() {
  const { readings, nodeStatuses, mlPredictions, activeZones: realtimeActiveZones } = useRealtime();
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');

  // Filter for actual hardware nodes (NODE_OP & NODE_PP). Defaults to true as requested.
  const [onlyOpPp, setOnlyOpPpState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('monitoring_filter_op_pp');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const setOnlyOpPp = (val: boolean | ((prev: boolean) => boolean)) => {
    setOnlyOpPpState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (typeof window !== 'undefined') {
        localStorage.setItem('monitoring_filter_op_pp', String(next));
      }
      return next;
    });
  };

  const toggleOnlyOpPp = () => {
    setOnlyOpPp(prev => !prev);
  };

  // Stable list of all known zones across activeZones, readings, and nodeStatuses
  const allKnownZones = useMemo(() => {
    return Array.from(
      new Set([
        ...realtimeActiveZones,
        ...Object.keys(readings),
        ...Object.keys(nodeStatuses),
        ...Object.keys(mlPredictions || {}),
      ])
    )
      .filter(Boolean)
      .sort();
  }, [realtimeActiveZones, readings, nodeStatuses, mlPredictions]);

  const isFilterActive = onlyOpPp || statusFilter === 'node_op_pp';

  const filteredZones = useMemo(() => {
    const result: Record<string, string[]> = {};

    allKnownZones.forEach(zoneId => {
      if (selectedZone !== 'all' && selectedZone !== zoneId) return;

      const nodesInZone = new Set<string>([
        ...Object.keys(readings[zoneId] || {}),
        ...Object.keys(nodeStatuses[zoneId] || {}),
        ...Object.keys(mlPredictions?.[zoneId] || {}),
      ]);

      const matchingNodes = Array.from(nodesInZone).filter(nodeId => {
        // Hardware Filter (NODE_OP & NODE_PP)
        if (isFilterActive && !isOpPpNode(nodeId)) {
          return false;
        }

        // Query search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesQuery =
            nodeId.toLowerCase().includes(q) || zoneId.toLowerCase().includes(q);
          if (!matchesQuery) return false;
        }

        // Status & ML filter
        const status = nodeStatuses[zoneId]?.[nodeId];
        const isOnline = status?.status === 'online';
        const hasGaps = (status?.gapCount || 0) > 0;
        const ml = mlPredictions?.[zoneId]?.[nodeId];

        if (statusFilter === 'online' && !isOnline) return false;
        if (statusFilter === 'offline' && isOnline) return false;
        if (statusFilter === 'gaps' && !hasGaps) return false;
        if (statusFilter === 'ml_subsidence') {
          const isSubsidence =
            ml?.anomaly_class === 'subsidence_risk' ||
            ml?.alert_level === 'RED' ||
            ml?.alert_level === 'ORANGE';
          if (!isSubsidence) return false;
        }
        if (statusFilter === 'ml_noise') {
          if (ml?.anomaly_class !== 'equipment_noise') return false;
        }
        if (statusFilter === 'ml_normal') {
          if (ml?.anomaly_class !== 'normal') return false;
        }

        return true;
      });

      if (matchingNodes.length > 0 || (selectedZone === zoneId && !searchQuery && !isFilterActive)) {
        result[zoneId] = matchingNodes.sort();
      }
    });

    return result;
  }, [
    readings,
    nodeStatuses,
    mlPredictions,
    allKnownZones,
    selectedZone,
    searchQuery,
    statusFilter,
    isFilterActive,
  ]);

  // Compute fleet statistics strictly for the filtered nodes
  const filteredStats = useMemo(() => {
    let totalNodes = 0;
    let onlineNodes = 0;
    let offlineNodes = 0;
    let totalGaps = 0;

    Object.entries(filteredZones).forEach(([zoneId, nodeIds]) => {
      nodeIds.forEach(nodeId => {
        totalNodes++;
        const st = nodeStatuses[zoneId]?.[nodeId];
        if (st?.status === 'online') {
          onlineNodes++;
        } else {
          offlineNodes++;
        }
        totalGaps += st?.gapCount || 0;
      });
    });

    return {
      totalZones: Object.keys(filteredZones).length,
      totalNodes,
      onlineNodes,
      offlineNodes,
      totalGaps,
    };
  }, [filteredZones, nodeStatuses]);

  return {
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
    activeZones: allKnownZones,
  };
}
