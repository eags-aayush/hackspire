import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ShadowMlPrediction } from './ml.interface.js';

export interface PredictionRecord {
  prediction_id: string;
  node_id: string;
  zone_id: string;
  timestamp: string;
  input_window: string;
  class_probs: string;
  predicted_class: string;
  severity: number;
  alert_level: string;
  model_version: string;
  inference_latency_ms: number;
  confirmed_label: string | null;
  created_at: string;
}

export interface QueryPredictionsOptions {
  nodeId?: string;
  zoneId?: string;
  startDate?: string;
  endDate?: string;
  predictedClass?: string;
  confirmedOnly?: boolean;
  limit?: number;
  offset?: number;
  includeWindow?: boolean;
}

@Injectable()
export class MlPredictionStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MlPredictionStoreService.name);
  private db: DatabaseSync | null = null;
  private dbPath: string;

  // Non-blocking in-memory queue to decouple SQLite disk writes from ingestion/dashboard latency
  private readonly writeQueue: ShadowMlPrediction[] = [];
  private isFlushing = false;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {
    const configuredPath =
      this.config.get<string>('ML_LOG_STORE_PATH') ||
      process.env.ML_LOG_STORE_PATH ||
      path.join(process.cwd(), 'data', 'predictions.db');

    this.dbPath = path.resolve(configuredPath);
  }

  onModuleInit(): void {
    this.initDatabase();

    // Periodic flush timer to ensure any remaining buffered records are persisted
    this.flushTimer = setInterval(() => {
      this.drainQueue();
    }, 200);
  }

  onModuleDestroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Drain remaining records synchronously before shutdown
    this.drainQueueSync();

    if (this.db) {
      try {
        this.db.close();
        this.logger.log('[MlPredictionStore] SQLite database connection closed cleanly.');
      } catch (err: unknown) {
        this.logger.warn(`[MlPredictionStore] Error closing database: ${err instanceof Error ? err.message : String(err)}`);
      }
      this.db = null;
    }
  }

  private initDatabase(): void {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new DatabaseSync(this.dbPath);

      // WAL mode for high-throughput concurrent reads and non-blocking writes
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');

      // Create primary prediction store table matching ML_WORKFLOW.md §10.4
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS prediction_logs (
          prediction_id TEXT PRIMARY KEY,
          node_id TEXT NOT NULL,
          zone_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          input_window TEXT NOT NULL,
          class_probs TEXT NOT NULL,
          predicted_class TEXT NOT NULL,
          severity REAL NOT NULL,
          alert_level TEXT NOT NULL,
          model_version TEXT NOT NULL,
          inference_latency_ms REAL NOT NULL,
          confirmed_label TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_predictions_node_time ON prediction_logs(node_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON prediction_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_predictions_class ON prediction_logs(predicted_class);
      `);

      this.logger.log(`[MlPredictionStore] Initialized SQLite store at ${this.dbPath} (WAL mode enabled)`);
    } catch (err: unknown) {
      this.logger.error(
        `[MlPredictionStore] Failed to initialize SQLite database at ${this.dbPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  /**
   * Asynchronous non-blocking write path hooked into ml.prediction.generated
   */
  @OnEvent('ml.prediction.generated', { async: true })
  handlePredictionGenerated(prediction: ShadowMlPrediction): void {
    try {
      this.writeQueue.push(prediction);
      // Trigger drain on next tick
      setImmediate(() => this.drainQueue());
    } catch (err: unknown) {
      this.logger.error(
        `[MlPredictionStore] Error queueing prediction: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private drainQueue(): void {
    if (this.isFlushing || this.writeQueue.length === 0 || !this.db) {
      return;
    }

    this.isFlushing = true;
    try {
      const batch = this.writeQueue.splice(0, this.writeQueue.length);
      this.insertBatch(batch);
    } catch (err: unknown) {
      this.logger.error(
        `[MlPredictionStore] Error draining write queue: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.isFlushing = false;
    }
  }

  private drainQueueSync(): void {
    if (this.writeQueue.length === 0 || !this.db) return;
    const batch = this.writeQueue.splice(0, this.writeQueue.length);
    this.insertBatch(batch);
  }

  private insertBatch(batch: ShadowMlPrediction[]): void {
    if (!this.db || batch.length === 0) return;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO prediction_logs (
          prediction_id,
          node_id,
          zone_id,
          timestamp,
          input_window,
          class_probs,
          predicted_class,
          severity,
          alert_level,
          model_version,
          inference_latency_ms,
          confirmed_label
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this.db.exec('BEGIN TRANSACTION;');

      for (const pred of batch) {
        const predictionId = pred.predictionId || `pred-${pred.nodeId}-${Date.now()}`;
        const inputWindowJson = pred.inputWindow ? JSON.stringify(pred.inputWindow) : '[]';
        const classProbsJson = JSON.stringify(pred.class_probs || {});

        stmt.run(
          predictionId,
          pred.nodeId,
          pred.zoneId,
          pred.timestamp,
          inputWindowJson,
          classProbsJson,
          pred.anomaly_class,
          pred.severity,
          pred.alert_level,
          pred.model_version,
          pred.inferenceLatencyMs,
          pred.confirmedLabel ?? null,
        );
      }

      this.db.exec('COMMIT;');
      this.logger.debug(`[MlPredictionStore] Persisted batch of ${batch.length} predictions to SQLite.`);
    } catch (err: unknown) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // ignore rollback errors
      }
      this.logger.error(
        `[MlPredictionStore] Failed to insert prediction batch: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Returns total prediction rows count
   */
  countPredictions(nodeId?: string): number {
    if (!this.db) return 0;
    try {
      if (nodeId) {
        const stmt = this.db.prepare('SELECT COUNT(*) as cnt FROM prediction_logs WHERE node_id = ?');
        const res = stmt.get(nodeId) as { cnt: number } | undefined;
        return res?.cnt ?? 0;
      }
      const stmt = this.db.prepare('SELECT COUNT(*) as cnt FROM prediction_logs');
      const res = stmt.get() as { cnt: number } | undefined;
      return res?.cnt ?? 0;
    } catch (err: unknown) {
      this.logger.error(`[MlPredictionStore] countPredictions failed: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
  }

  /**
   * Queries logged predictions with flexible filters for export and inspection
   */
  getPredictions(options: QueryPredictionsOptions = {}): PredictionRecord[] {
    if (!this.db) return [];
    this.drainQueue();

    try {
      const {
        nodeId,
        zoneId,
        startDate,
        endDate,
        predictedClass,
        confirmedOnly,
        limit = 1000,
        offset = 0,
        includeWindow = true,
      } = options;

      const whereClauses: string[] = [];
      const params: any[] = [];

      if (nodeId) {
        whereClauses.push('node_id = ?');
        params.push(nodeId);
      }
      if (zoneId) {
        whereClauses.push('zone_id = ?');
        params.push(zoneId);
      }
      if (startDate) {
        whereClauses.push('timestamp >= ?');
        params.push(startDate);
      }
      if (endDate) {
        whereClauses.push('timestamp <= ?');
        params.push(endDate);
      }
      if (predictedClass) {
        whereClauses.push('predicted_class = ?');
        params.push(predictedClass);
      }
      if (confirmedOnly) {
        whereClauses.push('confirmed_label IS NOT NULL');
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const windowCol = includeWindow ? 'input_window' : "'' as input_window";

      const query = `
        SELECT
          prediction_id,
          node_id,
          zone_id,
          timestamp,
          ${windowCol},
          class_probs,
          predicted_class,
          severity,
          alert_level,
          model_version,
          inference_latency_ms,
          confirmed_label,
          created_at
        FROM prediction_logs
        ${whereSql}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `;

      params.push(limit, offset);

      const stmt = this.db.prepare(query);
      return stmt.all(...params) as unknown as PredictionRecord[];
    } catch (err: unknown) {
      this.logger.error(`[MlPredictionStore] getPredictions failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /**
   * Sets operator ground-truth label for a prediction
   */
  setConfirmedLabel(predictionId: string, confirmedLabel: string): boolean {
    if (!this.db) return false;
    this.drainQueue();

    try {
      const stmt = this.db.prepare(`
        UPDATE prediction_logs
        SET confirmed_label = ?
        WHERE prediction_id = ?
      `);
      const info = stmt.run(confirmedLabel, predictionId);
      return (info as any)?.changes > 0;
    } catch (err: unknown) {
      this.logger.error(`[MlPredictionStore] setConfirmedLabel failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Summary telemetry metrics for dashboard and health diagnostics
   */
  getStoreStats(): {
    totalPredictions: number;
    classes: Record<string, number>;
    latestTimestamp: string | null;
    dbPath: string;
  } {
    if (!this.db) {
      return { totalPredictions: 0, classes: {}, latestTimestamp: null, dbPath: this.dbPath };
    }
    this.drainQueue();

    try {
      const countStmt = this.db.prepare('SELECT COUNT(*) as total, MAX(timestamp) as latest FROM prediction_logs');
      const countRow = countStmt.get() as { total: number; latest: string | null } | undefined;

      const classStmt = this.db.prepare(
        'SELECT predicted_class, COUNT(*) as cnt FROM prediction_logs GROUP BY predicted_class',
      );
      const classRows = (classStmt.all() || []) as Array<{ predicted_class: string; cnt: number }>;

      const classes: Record<string, number> = {};
      for (const row of classRows) {
        classes[row.predicted_class] = row.cnt;
      }

      return {
        totalPredictions: countRow?.total ?? 0,
        classes,
        latestTimestamp: countRow?.latest ?? null,
        dbPath: this.dbPath,
      };
    } catch (err: unknown) {
      this.logger.error(`[MlPredictionStore] getStoreStats failed: ${err instanceof Error ? err.message : String(err)}`);
      return { totalPredictions: 0, classes: {}, latestTimestamp: null, dbPath: this.dbPath };
    }
  }
}
