export interface RawNodeStatus {
  readonly nodeId: string;
  readonly zoneId: string;
  readonly status: 'online' | 'offline' | 'stale';
}

export interface ValidatedNodeStatus extends RawNodeStatus {
  readonly receivedAt: string;
}

export interface NodeStatusState {
  nodeId: string;
  zoneId: string;
  status: 'online' | 'offline' | 'stale';
  lastSeenAt: string;
  lastSequenceNumber?: number;
  gapCount: number;
}
