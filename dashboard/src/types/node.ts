/**
 * Canonical node status interfaces matching Design&Architecture.md §3 and Rules.md §4.
 *
 * Node status changes (online/offline/stale) are derived from LWT/status topics,
 * never from dashboard polling or guesswork.
 */

export type NodeStatusType = 'online' | 'offline' | 'stale';

export interface NodeStatusState {
  nodeId: string;
  zoneId: string;
  status: NodeStatusType;
  lastSeenAt: string;
  lastSequenceNumber?: number;
  gapCount: number;
}

export interface NodeTelemetrySummary {
  nodeId: string;
  zoneId: string;
  status: NodeStatusType;
  lastSeenAt: string;
  gapCount: number;
  lastSequenceNumber?: number;
  activeSensorsCount: number;
  hasCriticalAlert?: boolean;
}
