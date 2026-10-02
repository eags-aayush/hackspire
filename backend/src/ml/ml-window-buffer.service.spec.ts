import { describe, it, expect, beforeEach } from 'vitest';
import { MlWindowBufferService } from './ml-window-buffer.service.js';
import { ML_EXPECTED_CHANNELS, ML_WINDOW_LENGTH } from './ml.interface.js';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';

describe('MlWindowBufferService', () => {
  let service: MlWindowBufferService;

  beforeEach(() => {
    service = new MlWindowBufferService();
  });

  const makeReading = (
    seq: number,
    sensorType = 'tilt_x_deg',
    value = 0.5,
    nodeId = 'NODE_01',
    zoneId = 'ZONE_1',
  ): ValidatedSensorReading => ({
    nodeId,
    zoneId,
    sensorType,
    value,
    unit: 'deg',
    sequenceNumber: seq,
    timestamp: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  });

  it('should fill buffer until window_len=32 before returning a window', () => {
    // Feed 31 readings
    for (let i = 1; i < 32; i++) {
      const res = service.addReading(makeReading(i, 'tilt_x_deg', i * 0.01));
      expect(res).toBeNull();
      expect(service.getBufferCount('NODE_01')).toBe(i);
    }

    // 32nd reading should trigger window completion
    const res = service.addReading(makeReading(32, 'tilt_x_deg', 0.32));
    expect(res).not.toBeNull();
    expect(res?.nodeId).toBe('NODE_01');
    expect(res?.zoneId).toBe('ZONE_1');
    expect(res?.window.length).toBe(ML_WINDOW_LENGTH);
    expect(res?.window[0].length).toBe(9);
  });

  it('should align channels strictly in ML_EXPECTED_CHANNELS order with fallbacks', () => {
    // Feed 32 readings with specific channels
    for (let i = 1; i <= 32; i++) {
      service.addReading(makeReading(i, 'tilt', 1.5));
      service.addReading(makeReading(i, 'vibration', 0.05));
      service.addReading(makeReading(i, 'gas', 85.0));
    }

    const res = service.addReading(makeReading(33, 'tilt', 1.6));
    expect(res).not.toBeNull();
    const latestRow = res!.window[31];

    // index 0: tilt_x_deg (mapped from 'tilt') -> 1.6
    expect(latestRow[0]).toBe(1.6);
    // index 2: vibration_amplitude_g (mapped from 'vibration') -> 0.05
    expect(latestRow[2]).toBe(0.05);
    // index 6: gas_ppm (mapped from 'gas') -> 85.0
    expect(latestRow[6]).toBe(85.0);
    // unprovided channels fallback to baseline
    expect(latestRow[3]).toBe(5.0); // vibration_freq_hz
    expect(latestRow[7]).toBe(25.0); // temperature_c
    expect(latestRow[8]).toBe(65.0); // humidity_pct
  });

  it('should slide forward with stride=1 after window is full', () => {
    for (let i = 1; i <= 32; i++) {
      service.addReading(makeReading(i, 'tilt_x_deg', i * 0.1));
    }

    // Reading 33: should slide and produce window with reading 33 at the end
    const res33 = service.addReading(makeReading(33, 'tilt_x_deg', 3.3));
    expect(res33).not.toBeNull();
    expect(res33!.window.length).toBe(32);
    expect(res33!.window[31][0]).toBe(3.3);
    // First element in window should now be reading #2 (0.2)
    expect(res33!.window[0][0]).toBe(0.2);
  });

  it('should isolate buffers per node', () => {
    for (let i = 1; i <= 32; i++) {
      service.addReading(makeReading(i, 'tilt_x_deg', 1.0, 'NODE_A'));
    }
    for (let i = 1; i <= 10; i++) {
      service.addReading(makeReading(i, 'tilt_x_deg', 2.0, 'NODE_B'));
    }

    expect(service.getBufferCount('NODE_A')).toBe(32);
    expect(service.getBufferCount('NODE_B')).toBe(10);
  });

  it('should immediately return seed-padded 32x9 window when allowWarmup=true', () => {
    const res = service.addReading(makeReading(1, 'tilt_x_deg', 0.85, 'NODE_NEW'), true);
    expect(res).not.toBeNull();
    expect(res?.nodeId).toBe('NODE_NEW');
    expect(res?.window.length).toBe(32);
    expect(res?.window[0].length).toBe(9);
    // All rows should be padded with the seed vector
    expect(res?.window[0][0]).toBe(0.85);
    expect(res?.window[31][0]).toBe(0.85);
  });
});
