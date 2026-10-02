import protobuf from 'protobufjs';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import type { NodeStatusState } from '../ingestion/node-status.interface.js';

export const TELEMETRY_PROTO_DEF = `
syntax = "proto3";

package telemetry;

message SensorReading {
  string nodeId = 1;
  string zoneId = 2;
  string sensorType = 3;
  double value = 4;
  string unit = 5;
  string timestamp = 6;
  uint32 sequenceNumber = 7;
  string receivedAt = 8;
}

message SensorReadingBatch {
  string zoneId = 1;
  repeated SensorReading readings = 2;
}

message NodeStatusRecord {
  string nodeId = 1;
  string zoneId = 2;
  string status = 3;
  string lastSeenAt = 4;
  uint32 lastSequenceNumber = 5;
  uint32 gapCount = 6;
}

message NodeStatusBatch {
  string zoneId = 1;
  repeated NodeStatusRecord statuses = 2;
}

message ZoneSnapshot {
  string zoneId = 1;
  repeated SensorReading readings = 2;
  repeated NodeStatusRecord statuses = 3;
}
`;

const root = protobuf.parse(TELEMETRY_PROTO_DEF).root;

export const SensorReadingType = root.lookupType('telemetry.SensorReading');
export const SensorReadingBatchType = root.lookupType('telemetry.SensorReadingBatch');
export const NodeStatusRecordType = root.lookupType('telemetry.NodeStatusRecord');
export const NodeStatusBatchType = root.lookupType('telemetry.NodeStatusBatch');
export const ZoneSnapshotType = root.lookupType('telemetry.ZoneSnapshot');

export function encodeSensorReadingBatch(zoneId: string, readings: ValidatedSensorReading[]): Buffer {
  const payload = {
    zoneId,
    readings: readings.map((r) => ({
      nodeId: r.nodeId,
      zoneId: r.zoneId,
      sensorType: r.sensorType,
      value: r.value,
      unit: r.unit,
      timestamp: r.timestamp,
      sequenceNumber: r.sequenceNumber,
      receivedAt: r.receivedAt,
    })),
  };
  const msg = SensorReadingBatchType.create(payload);
  return Buffer.from(SensorReadingBatchType.encode(msg).finish());
}

export function decodeSensorReadingBatch(buffer: Uint8Array): {
  zoneId: string;
  readings: ValidatedSensorReading[];
} {
  const decoded = SensorReadingBatchType.decode(buffer);
  const obj = SensorReadingBatchType.toObject(decoded, {
    defaults: true,
    longs: Number,
  }) as {
    zoneId: string;
    readings: ValidatedSensorReading[];
  };
  return obj;
}

export function encodeNodeStatusBatch(zoneId: string, statuses: NodeStatusState[]): Buffer {
  const payload = {
    zoneId,
    statuses: statuses.map((st) => ({
      nodeId: st.nodeId,
      zoneId: st.zoneId,
      status: st.status,
      lastSeenAt: st.lastSeenAt,
      lastSequenceNumber: st.lastSequenceNumber ?? 0,
      gapCount: st.gapCount,
    })),
  };
  const msg = NodeStatusBatchType.create(payload);
  return Buffer.from(NodeStatusBatchType.encode(msg).finish());
}

export function decodeNodeStatusBatch(buffer: Uint8Array): {
  zoneId: string;
  statuses: NodeStatusState[];
} {
  const decoded = NodeStatusBatchType.decode(buffer);
  const obj = NodeStatusBatchType.toObject(decoded, {
    defaults: true,
    longs: Number,
  }) as {
    zoneId: string;
    statuses: Array<{
      nodeId: string;
      zoneId: string;
      status: 'online' | 'offline' | 'stale';
      lastSeenAt: string;
      lastSequenceNumber?: number;
      gapCount: number;
    }>;
  };
  return obj;
}

export function encodeZoneSnapshot(
  zoneId: string,
  snapshot: { readings: ValidatedSensorReading[]; statuses: NodeStatusState[] },
): Buffer {
  const payload = {
    zoneId,
    readings: snapshot.readings.map((r) => ({
      nodeId: r.nodeId,
      zoneId: r.zoneId,
      sensorType: r.sensorType,
      value: r.value,
      unit: r.unit,
      timestamp: r.timestamp,
      sequenceNumber: r.sequenceNumber,
      receivedAt: r.receivedAt,
    })),
    statuses: snapshot.statuses.map((st) => ({
      nodeId: st.nodeId,
      zoneId: st.zoneId,
      status: st.status,
      lastSeenAt: st.lastSeenAt,
      lastSequenceNumber: st.lastSequenceNumber ?? 0,
      gapCount: st.gapCount,
    })),
  };
  const msg = ZoneSnapshotType.create(payload);
  return Buffer.from(ZoneSnapshotType.encode(msg).finish());
}

export function decodeZoneSnapshot(buffer: Uint8Array): {
  zoneId: string;
  readings: ValidatedSensorReading[];
  statuses: NodeStatusState[];
} {
  const decoded = ZoneSnapshotType.decode(buffer);
  const obj = ZoneSnapshotType.toObject(decoded, {
    defaults: true,
    longs: Number,
  }) as {
    zoneId: string;
    readings: ValidatedSensorReading[];
    statuses: NodeStatusState[];
  };
  return obj;
}
