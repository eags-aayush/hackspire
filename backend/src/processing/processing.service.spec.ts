import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcessingService } from './processing.service.js';
import { MovingAverageFilterService } from './moving-average-filter.service.js';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { MlInferenceService } from '../ml/ml-inference.service.js';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import type { ValidatedNodeStatus } from '../ingestion/node-status.interface.js';

describe('MovingAverageFilterService', () => {
  let filter: MovingAverageFilterService;

  beforeEach(() => {
    filter = new MovingAverageFilterService();
  });

  it('should immediately output first reading with zero lag (dynamic window sizing)', () => {
    const reading: ValidatedSensorReading = {
      nodeId: 'NODE_01',
      zoneId: 'zone-A',
      sensorType: 'tilt',
      value: 0.25,
      unit: 'degrees',
      timestamp: '2026-09-18T22:00:00.000Z',
      sequenceNumber: 1,
      receivedAt: '2026-09-18T22:00:00.010Z',
    };

    const smoothed = filter.smooth(reading);
    expect(smoothed.value).toBe(0.25);
    expect(smoothed.rawValue).toBe(0.25);
    expect(filter.getWindow('NODE_01', 'tilt')).toEqual([0.25]);
  });

  it('should smoothly filter fluctuating readings across sliding window', () => {
    // Noisy tilt readings fluctuating around 1.0 degree: 0.8, 1.2, 0.9, 1.1, 1.0
    const readings = [0.8, 1.2, 0.9, 1.1, 1.0];
    let lastSmoothed: ValidatedSensorReading | null = null;

    for (let i = 0; i < readings.length; i++) {
      lastSmoothed = filter.smooth({
        nodeId: 'NODE_01',
        zoneId: 'zone-A',
        sensorType: 'tilt',
        value: readings[i],
        unit: 'degrees',
        timestamp: `2026-09-18T22:00:0${i}.000Z`,
        sequenceNumber: i + 1,
        receivedAt: `2026-09-18T22:00:0${i}.010Z`,
      });
    }

    // Average of [0.8, 1.2, 0.9, 1.1, 1.0] = 5.0 / 5 = 1.0
    expect(lastSmoothed).not.toBeNull();
    expect(lastSmoothed!.value).toBe(1.0);
    expect(lastSmoothed!.rawValue).toBe(1.0);
    expect(filter.getWindow('NODE_01', 'tilt')).toEqual([0.8, 1.2, 0.9, 1.1, 1.0]);
  });

  it('should roll sliding window when exceeding capacity', () => {
    // Send 7 readings into a window of size 5
    const values = [1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 2.0];
    for (let i = 0; i < values.length; i++) {
      filter.smooth({
        nodeId: 'NODE_01',
        zoneId: 'zone-A',
        sensorType: 'tilt',
        value: values[i],
        unit: 'degrees',
        timestamp: `2026-09-18T22:00:0${i}.000Z`,
        sequenceNumber: i + 1,
        receivedAt: `2026-09-18T22:00:0${i}.010Z`,
      });
    }

    // Window should retain only last 5 elements: [1.0, 1.0, 1.0, 2.0, 2.0]
    expect(filter.getWindow('NODE_01', 'tilt')).toEqual([1.0, 1.0, 1.0, 2.0, 2.0]);
    // Average = 7.0 / 5 = 1.4
    expect(filter.getMovingAverage('NODE_01', 'tilt')).toBe(1.4);
  });

  it('should round values to sensor-appropriate physical decimal precision', () => {
    // Tilt: 2 decimals
    expect(filter.roundToPrecision('tilt', 0.25678, 0.26)).toBe(0.26);

    // Vibration: 3 decimals
    expect(filter.roundToPrecision('vibration', 1.00249, 1.002)).toBe(1.002);

    // Temperature & Humidity: 1 decimal
    expect(filter.roundToPrecision('temperature', 24.5333, 24.5)).toBe(24.5);
    expect(filter.roundToPrecision('humidity', 68.2777, 68.3)).toBe(68.3);

    // Distance: 1 decimal
    expect(filter.roundToPrecision('distance', 15.4222, 15.4)).toBe(15.4);

    // Gas ADC (integer): integer rounded
    expect(filter.roundToPrecision('gas', 512.4, 510)).toBe(512);
  });

  it('should bypass smoothing for instantaneous beacon events (miner_proximity)', () => {
    const reading: ValidatedSensorReading = {
      nodeId: 'NODE_01',
      zoneId: 'zone-A',
      sensorType: 'miner_proximity',
      value: 1,
      unit: 'beacon',
      timestamp: '2026-09-18T22:00:00.000Z',
      sequenceNumber: 1,
      receivedAt: '2026-09-18T22:00:00.010Z',
    };

    const smoothed = filter.smooth(reading);
    expect(smoothed.value).toBe(1);
    expect(filter.getWindow('NODE_01', 'miner_proximity')).toEqual([]);
  });

  it('should reset node buffer cleanly on demand', () => {
    filter.smooth({
      nodeId: 'NODE_01',
      zoneId: 'zone-A',
      sensorType: 'tilt',
      value: 1.5,
      unit: 'degrees',
      timestamp: '2026-09-18T22:00:00.000Z',
      sequenceNumber: 1,
      receivedAt: '2026-09-18T22:00:00.010Z',
    });

    expect(filter.getWindow('NODE_01', 'tilt')).toHaveLength(1);
    filter.resetNode('NODE_01');
    expect(filter.getWindow('NODE_01', 'tilt')).toHaveLength(0);
    expect(filter.getMovingAverage('NODE_01', 'tilt')).toBeNull();
  });
});

describe('ProcessingService Integration with MovingAverageFilter', () => {
  let service: ProcessingService;
  let filter: MovingAverageFilterService;
  let emittedEvents: Array<{ event: string; data: unknown }>;
  let mlHandledReadings: ValidatedSensorReading[];

  beforeEach(() => {
    emittedEvents = [];
    mlHandledReadings = [];

    const mockEventEmitter = {
      emit: vi.fn((event: string, data: unknown) => {
        emittedEvents.push({ event, data });
      }),
    } as unknown as EventEmitter2;

    const mockMlInference = {
      handleSensorReading: vi.fn((reading: ValidatedSensorReading) => {
        mlHandledReadings.push(reading);
      }),
      onNodeOffline: vi.fn(),
    } as unknown as MlInferenceService;

    filter = new MovingAverageFilterService();
    service = new ProcessingService(mockEventEmitter, mockMlInference, filter);
  });

  it('should emit smoothed sensor reading on sensor.reading.deduped and pass to ML', () => {
    const rawReading: ValidatedSensorReading = {
      nodeId: 'NODE_01',
      zoneId: 'zone-A',
      sensorType: 'tilt',
      value: 0.5,
      unit: 'degrees',
      timestamp: '2026-09-18T22:00:00.000Z',
      sequenceNumber: 1,
      receivedAt: '2026-09-18T22:00:00.010Z',
    };

    service.handleSensorReading(rawReading);

    // Deduped event emitted
    const dedupedEvent = emittedEvents.find((e) => e.event === 'sensor.reading.deduped');
    expect(dedupedEvent).toBeDefined();

    const emittedReading = dedupedEvent!.data as ValidatedSensorReading;
    expect(emittedReading.value).toBe(0.5);
    expect(emittedReading.rawValue).toBe(0.5);

    // ML received the reading
    expect(mlHandledReadings).toHaveLength(1);
    expect(mlHandledReadings[0].value).toBe(0.5);
    expect(mlHandledReadings[0].rawValue).toBe(0.5);
  });

  it('should drop duplicate sequence readings without filtering twice', () => {
    const reading: ValidatedSensorReading = {
      nodeId: 'NODE_01',
      zoneId: 'zone-A',
      sensorType: 'tilt',
      value: 1.0,
      unit: 'degrees',
      timestamp: '2026-09-18T22:00:00.000Z',
      sequenceNumber: 5,
      receivedAt: '2026-09-18T22:00:00.010Z',
    };

    service.handleSensorReading(reading);
    service.handleSensorReading(reading); // Duplicate

    const dedupedEvents = emittedEvents.filter((e) => e.event === 'sensor.reading.deduped');
    expect(dedupedEvents).toHaveLength(1);
    expect(filter.getWindow('NODE_01', 'tilt')).toHaveLength(1);
  });

  it('should reset filter when node reports offline status', () => {
    service.handleSensorReading({
      nodeId: 'NODE_01',
      zoneId: 'zone-A',
      sensorType: 'tilt',
      value: 1.0,
      unit: 'degrees',
      timestamp: '2026-09-18T22:00:00.000Z',
      sequenceNumber: 1,
      receivedAt: '2026-09-18T22:00:00.010Z',
    });

    expect(filter.getWindow('NODE_01', 'tilt')).toHaveLength(1);

    const offlineStatus: ValidatedNodeStatus = {
      nodeId: 'NODE_01',
      zoneId: 'zone-A',
      status: 'offline',
      receivedAt: '2026-09-18T22:01:00.000Z',
    };

    service.handleNodeStatus(offlineStatus);
    expect(filter.getWindow('NODE_01', 'tilt')).toHaveLength(0);
  });
});
