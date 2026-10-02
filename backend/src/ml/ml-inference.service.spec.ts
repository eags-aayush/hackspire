import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MlInferenceService } from './ml-inference.service.js';
import { MlWindowBufferService } from './ml-window-buffer.service.js';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';

describe('MlInferenceService', () => {
  let inferenceService: MlInferenceService;
  let windowBuffer: MlWindowBufferService;
  let eventEmitter: EventEmitter2;

  beforeEach(() => {
    windowBuffer = new MlWindowBufferService();
    eventEmitter = new EventEmitter2();
    const config = new ConfigService({
      ML_INFERENCE_URL: 'http://127.0.0.1:8000/predict',
    });

    inferenceService = new MlInferenceService(config, windowBuffer, eventEmitter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeReading = (seq: number): ValidatedSensorReading => ({
    nodeId: 'NODE_01',
    zoneId: 'ZONE_1',
    sensorType: 'tilt_x_deg',
    value: 0.1,
    unit: 'deg',
    sequenceNumber: seq,
    timestamp: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  });

  it('should call fetch and emit ml.prediction.generated in shadow mode when window is full', async () => {
    const mockResponse = {
      anomaly_class: 'subsidence_risk',
      class_probs: { normal: 0.05, equipment_noise: 0.15, subsidence_risk: 0.8 },
      severity: 0.72,
      alert_level: 'ORANGE',
      model_version: 'test_v1',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const emittedEvents: any[] = [];
    eventEmitter.on('ml.prediction.generated', (payload) => {
      emittedEvents.push(payload);
    });

    // Fill buffer with 32 readings
    for (let i = 1; i <= 32; i++) {
      await inferenceService.handleSensorReading(makeReading(i));
    }

    // Wait microtask tick for async fetch to finish
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(emittedEvents.length).toBe(1);
    const pred = emittedEvents[0];
    expect(pred.nodeId).toBe('NODE_01');
    expect(pred.anomaly_class).toBe('subsidence_risk');
    expect(pred.severity).toBe(0.72);
    expect(pred.alert_level).toBe('ORANGE');
    expect(pred.isShadowMode).toBe(true);
    expect(pred.inferenceLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle network error gracefully without throwing or crashing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:8000'),
    );

    const emittedEvents: any[] = [];
    eventEmitter.on('ml.prediction.generated', (payload) => {
      emittedEvents.push(payload);
    });

    // Should complete cleanly without throwing
    for (let i = 1; i <= 32; i++) {
      await expect(
        inferenceService.handleSensorReading(makeReading(i)),
      ).resolves.not.toThrow();
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(emittedEvents.length).toBe(0);
  });

  it('should debounce intra-packet channels and trigger fetch exactly once per packet sequence (11x overfire fix)', async () => {
    const mockResponse = {
      anomaly_class: 'normal',
      class_probs: { normal: 0.95, equipment_noise: 0.03, subsidence_risk: 0.02 },
      severity: 0.05,
      alert_level: 'GREEN',
      model_version: 'test_v1',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    // Fill buffer with 31 packets (single channel each)
    for (let i = 1; i <= 31; i++) {
      await inferenceService.handleSensorReading(makeReading(i));
    }

    // Packet 32 arrives with 11 distinct channel callbacks
    const channels = [
      'tilt_x_deg',
      'tilt_y_deg',
      'vibration_amplitude_g',
      'vibration_freq_hz',
      'crack_displacement_mm',
      'water_level_cm',
      'gas_ppm',
      'temperature_c',
      'humidity_pct',
      'tilt',
      'vibration',
    ];

    for (const sensorType of channels) {
      await inferenceService.handleSensorReading({
        nodeId: 'NODE_01',
        zoneId: 'ZONE_1',
        sensorType,
        value: 1.23,
        unit: 'raw',
        sequenceNumber: 32,
        timestamp: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
      });
    }

    // Wait for 25ms packet debounce + execution
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Must have fired exactly 1 inference pass, NOT 11!
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should trigger inference on early packets when ML_ALLOW_WARMUP is true', async () => {
    const warmupConfig = new ConfigService({
      ML_INFERENCE_URL: 'http://127.0.0.1:8000/predict',
      ML_ALLOW_WARMUP: 'true',
    });
    const warmupService = new MlInferenceService(warmupConfig, windowBuffer, eventEmitter);

    const mockResponse = {
      anomaly_class: 'normal',
      class_probs: { normal: 0.98, equipment_noise: 0.01, subsidence_risk: 0.01 },
      severity: 0.02,
      alert_level: 'GREEN',
      model_version: 'test_v1',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    // Send only 1 packet
    await warmupService.handleSensorReading(makeReading(1));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
