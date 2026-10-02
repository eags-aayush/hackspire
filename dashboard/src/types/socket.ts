import { ValidatedSensorReading } from './sensor';
import { NodeStatusState } from './node';
import { ShadowMlPrediction } from './ml';

/**
 * WebSocket contract definitions matching Design&Architecture.md §6 and backend/realtime.gateway.ts
 */

export interface SnapshotPayload {
  readings: ValidatedSensorReading[];
  statuses: NodeStatusState[];
  mlPredictions?: ShadowMlPrediction[];
}

export interface JoinZonePayload {
  zoneId: string;
}

export interface SystemLatencyMetrics {
  avgLatency: number;
  maxLatency: number;
  count: number;
  totalLatency: number;
  lastReadingAt?: string;
  packetsPerSec: number;
  protoBytesReceived?: number;
  lastPacketBytes?: number;
  lastJsonBytesEquivalent?: number;
  estimatedBandwidthSavedPercent?: number;
  transportFormat?: 'Protobuf (Binary)' | 'JSON (Text)';
}
