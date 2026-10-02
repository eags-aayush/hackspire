import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MlPredictionStoreService } from './ml-prediction-store.service.js';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ShadowMlPrediction } from './ml.interface.js';

describe('MlPredictionStoreService', () => {
  let service: MlPredictionStoreService;
  let testDbPath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-store-test-'));
    testDbPath = path.join(tempDir, 'test_predictions.db');

    const configService = new ConfigService({
      ML_LOG_STORE_PATH: testDbPath,
    });

    service = new MlPredictionStoreService(configService);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('initializes database and creates prediction_logs table', () => {
    expect(fs.existsSync(testDbPath)).toBe(true);
    expect(service.countPredictions()).toBe(0);
  });

  it('persists a prediction and round-trips 32x9 input window array correctly', () => {
    const sampleWindow = Array.from({ length: 32 }, (_, t) =>
      Array.from({ length: 9 }, (_, c) => Number((t * 0.1 + c * 0.05).toFixed(3))),
    );

    const prediction: ShadowMlPrediction = {
      predictionId: 'test-pred-001',
      nodeId: 'NODE_01',
      zoneId: 'ZONE_1',
      timestamp: '2026-09-11T20:00:00.000Z',
      anomaly_class: 'subsidence_risk',
      class_probs: { normal: 0.05, equipment_noise: 0.1, subsidence_risk: 0.85 },
      severity: 0.75,
      alert_level: 'ORANGE',
      model_version: 'v0.1.0-baseline',
      inferenceLatencyMs: 42.5,
      windowLen: 32,
      stride: 1,
      isShadowMode: true,
      inputWindow: sampleWindow,
    };

    service.handlePredictionGenerated(prediction);

    // Force flush
    const records = service.getPredictions({ nodeId: 'NODE_01' });
    expect(records.length).toBe(1);

    const rec = records[0];
    expect(rec.prediction_id).toBe('test-pred-001');
    expect(rec.node_id).toBe('NODE_01');
    expect(rec.predicted_class).toBe('subsidence_risk');
    expect(rec.severity).toBe(0.75);
    expect(rec.alert_level).toBe('ORANGE');
    expect(rec.confirmed_label).toBeNull();

    // Verify 32x9 input window round-trip
    const parsedWindow = JSON.parse(rec.input_window);
    expect(Array.isArray(parsedWindow)).toBe(true);
    expect(parsedWindow.length).toBe(32);
    expect(parsedWindow[0].length).toBe(9);
    expect(parsedWindow[31].length).toBe(9);
    expect(parsedWindow[0][0]).toBe(sampleWindow[0][0]);
    expect(parsedWindow[31][8]).toBe(sampleWindow[31][8]);
  });

  it('allows attaching operator confirmed ground-truth label', () => {
    const prediction: ShadowMlPrediction = {
      predictionId: 'test-pred-002',
      nodeId: 'NODE_02',
      zoneId: 'ZONE_2',
      timestamp: '2026-09-11T20:05:00.000Z',
      anomaly_class: 'equipment_noise',
      class_probs: { normal: 0.1, equipment_noise: 0.8, subsidence_risk: 0.1 },
      severity: 0.25,
      alert_level: 'YELLOW',
      model_version: 'v0.1.0-baseline',
      inferenceLatencyMs: 38.0,
      windowLen: 32,
      stride: 1,
      isShadowMode: true,
      inputWindow: Array.from({ length: 32 }, () => new Array(9).fill(0.0)),
    };

    service.handlePredictionGenerated(prediction);
    const updated = service.setConfirmedLabel('test-pred-002', 'equipment_noise');
    expect(updated).toBe(true);

    const records = service.getPredictions({ nodeId: 'NODE_02' });
    expect(records[0].confirmed_label).toBe('equipment_noise');
  });

  it('reports correct aggregate statistics', () => {
    const pred1: ShadowMlPrediction = {
      predictionId: 'p1',
      nodeId: 'NODE_01',
      zoneId: 'ZONE_1',
      timestamp: '2026-09-11T20:10:00.000Z',
      anomaly_class: 'normal',
      class_probs: { normal: 0.9, equipment_noise: 0.05, subsidence_risk: 0.05 },
      severity: 0.02,
      alert_level: 'GREEN',
      model_version: 'v0.1.0-baseline',
      inferenceLatencyMs: 25.0,
      windowLen: 32,
      stride: 1,
      isShadowMode: true,
      inputWindow: [],
    };
    const pred2: ShadowMlPrediction = {
      predictionId: 'p2',
      nodeId: 'NODE_01',
      zoneId: 'ZONE_1',
      timestamp: '2026-09-11T20:11:00.000Z',
      anomaly_class: 'subsidence_risk',
      class_probs: { normal: 0.1, equipment_noise: 0.1, subsidence_risk: 0.8 },
      severity: 0.65,
      alert_level: 'ORANGE',
      model_version: 'v0.1.0-baseline',
      inferenceLatencyMs: 30.0,
      windowLen: 32,
      stride: 1,
      isShadowMode: true,
      inputWindow: [],
    };

    service.handlePredictionGenerated(pred1);
    service.handlePredictionGenerated(pred2);

    const stats = service.getStoreStats();
    expect(stats.totalPredictions).toBe(2);
    expect(stats.classes['normal']).toBe(1);
    expect(stats.classes['subsidence_risk']).toBe(1);
  });
});
