import { describe, it, expect } from 'vitest';
import {
  encodeSensorReadingBatch,
  decodeSensorReadingBatch,
  encodeNodeStatusBatch,
  decodeNodeStatusBatch,
  encodeZoneSnapshot,
  decodeZoneSnapshot,
} from './telemetry.proto.js';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import type { NodeStatusState } from '../ingestion/node-status.interface.js';

describe('Protobuf Telemetry Codec', () => {
  const mockReadings: ValidatedSensorReading[] = [
    {
      nodeId: 'NODE_01',
      zoneId: 'ZONE_ALPHA',
      sensorType: 'tilt',
      value: 14.85,
      unit: 'degrees',
      timestamp: '2026-09-09T00:00:00.000Z',
      sequenceNumber: 1042,
      receivedAt: '2026-09-09T00:00:00.050Z',
    },
    {
      nodeId: 'NODE_02',
      zoneId: 'ZONE_ALPHA',
      sensorType: 'vibration',
      value: 2.73,
      unit: 'mm/s',
      timestamp: '2026-09-09T00:00:00.000Z',
      sequenceNumber: 1043,
      receivedAt: '2026-09-09T00:00:00.051Z',
    },
  ];

  const mockStatuses: NodeStatusState[] = [
    {
      nodeId: 'NODE_01',
      zoneId: 'ZONE_ALPHA',
      status: 'online',
      lastSeenAt: '2026-09-09T00:00:00.000Z',
      lastSequenceNumber: 1042,
      gapCount: 0,
    },
    {
      nodeId: 'NODE_02',
      zoneId: 'ZONE_ALPHA',
      status: 'stale',
      lastSeenAt: '2026-09-08T23:55:00.000Z',
      lastSequenceNumber: 990,
      gapCount: 3,
    },
  ];

  it('should encode and decode sensor readings batch with 100% data fidelity', () => {
    const encoded = encodeSensorReadingBatch('ZONE_ALPHA', mockReadings);
    expect(Buffer.isBuffer(encoded)).toBe(true);
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = decodeSensorReadingBatch(encoded);
    expect(decoded.zoneId).toBe('ZONE_ALPHA');
    expect(decoded.readings).toHaveLength(2);

    expect(decoded.readings[0]).toEqual({
      nodeId: 'NODE_01',
      zoneId: 'ZONE_ALPHA',
      sensorType: 'tilt',
      value: 14.85,
      unit: 'degrees',
      timestamp: '2026-09-09T00:00:00.000Z',
      sequenceNumber: 1042,
      receivedAt: '2026-09-09T00:00:00.050Z',
    });

    expect(decoded.readings[1].value).toBe(2.73);
  });

  it('should achieve significant bandwidth savings compared to JSON', () => {
    const encoded = encodeSensorReadingBatch('ZONE_ALPHA', mockReadings);
    const jsonBytes = Buffer.byteLength(JSON.stringify(mockReadings), 'utf8');

    expect(encoded.length).toBeLessThan(jsonBytes);
    const savingsPercent = ((1 - encoded.length / jsonBytes) * 100);
    expect(savingsPercent).toBeGreaterThan(30);
  });

  it('should encode and decode node statuses batch correctly', () => {
    const encoded = encodeNodeStatusBatch('ZONE_ALPHA', mockStatuses);
    const decoded = decodeNodeStatusBatch(encoded);

    expect(decoded.zoneId).toBe('ZONE_ALPHA');
    expect(decoded.statuses).toHaveLength(2);
    expect(decoded.statuses[0].nodeId).toBe('NODE_01');
    expect(decoded.statuses[0].status).toBe('online');
    expect(decoded.statuses[1].gapCount).toBe(3);
  });

  it('should encode and decode full zone snapshot correctly', () => {
    const encoded = encodeZoneSnapshot('ZONE_ALPHA', {
      readings: mockReadings,
      statuses: mockStatuses,
    });
    const decoded = decodeZoneSnapshot(encoded);

    expect(decoded.zoneId).toBe('ZONE_ALPHA');
    expect(decoded.readings).toHaveLength(2);
    expect(decoded.statuses).toHaveLength(2);
    expect(decoded.readings[0].sensorType).toBe('tilt');
    expect(decoded.statuses[1].status).toBe('stale');
  });
});
