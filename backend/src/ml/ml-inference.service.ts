import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import { MlWindowBufferService } from './ml-window-buffer.service.js';
import {
  type InferenceServiceResponse,
  type ShadowMlPrediction,
  ML_STRIDE,
  ML_WINDOW_LENGTH,
} from './ml.interface.js';

interface PendingPrediction {
  timer: NodeJS.Timeout;
  sequenceNumber: number;
  nodeId: string;
  zoneId: string;
  window: number[][];
}

@Injectable()
export class MlInferenceService implements OnModuleDestroy {
  private readonly logger = new Logger(MlInferenceService.name);

  private readonly inferenceUrl: string;
  private readonly requestTimeoutMs = 2500; // Explicit 2.5s network timeout
  private isServiceAlive = true;
  private lastFailureTime = 0;
  private readonly failureCooldownMs = 5000; // 5s backoff if service is unreachable
  private isCalling = false; // Prevent concurrent requests piling up per node

  // Step 0: Packet-level debouncing to coalesce intra-packet channel callbacks (prevents 11x overfire)
  private readonly pendingPredictions = new Map<string, PendingPrediction>();
  private readonly packetDebounceMs = 25;

  // nodeId -> latest ShadowMlPrediction
  private readonly latestPredictions = new Map<string, ShadowMlPrediction>();

  private readonly allowWarmup: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly windowBuffer: MlWindowBufferService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const defaultUrl =
      process.env.NODE_ENV === 'production' || process.env.IN_DOCKER === 'true'
        ? 'http://host.docker.internal:8000/predict'
        : 'http://127.0.0.1:8000/predict';

    this.inferenceUrl =
      this.config.get<string>('ML_INFERENCE_URL') ||
      process.env.ML_INFERENCE_URL ||
      defaultUrl;

    this.allowWarmup =
      this.config.get<string>('ML_ALLOW_WARMUP') === 'true' ||
      this.config.get<boolean>('ML_ALLOW_WARMUP') === true ||
      process.env.ML_ALLOW_WARMUP === 'true';

    this.logger.log(`MlInferenceService initialized. Target URL: ${this.inferenceUrl}`);
  }

  /**
   * Called by processing pipeline whenever a deduplicated sensor reading is validated.
   * Feeds the reading into the node's rolling window buffer.
   * Coalesces multi-channel readings per sequence packet with a 25ms debounce so inference
   * fires exactly once per completed packet rather than per channel callback (11x overfire fix).
   *
   * CRITICAL GUARANTEE: This method NEVER throws and NEVER blocks ingestion.
   */
  async handleSensorReading(reading: ValidatedSensorReading): Promise<void> {
    try {
      const windowPayload = this.windowBuffer.addReading(reading, this.allowWarmup);
      if (!windowPayload) {
        return;
      }

      // Check failure cooldown circuit breaker
      const now = Date.now();
      if (!this.isServiceAlive && now - this.lastFailureTime < this.failureCooldownMs) {
        // ML service is known to be down, skip call to preserve ingestion speed
        return;
      }

      const { nodeId, zoneId, window } = windowPayload;
      const sequenceNumber = reading.sequenceNumber;

      // Check if there is an existing pending prediction for this node
      const existing = this.pendingPredictions.get(nodeId);
      if (existing) {
        if (existing.sequenceNumber === sequenceNumber) {
          // Same sequence packet: update window with latest channel data and debounce
          clearTimeout(existing.timer);
          existing.window = window;
          existing.timer = setTimeout(() => {
            this.dispatchPendingPrediction(nodeId);
          }, this.packetDebounceMs);
          return;
        } else {
          // New sequence packet arrived! Flush the previous sequence immediately
          clearTimeout(existing.timer);
          this.pendingPredictions.delete(nodeId);
          this.executePrediction(existing.nodeId, existing.zoneId, existing.window).catch((err) => {
            this.logger.warn(`[ML-Shadow] Background prediction error: ${err.message}`);
          });
        }
      }

      // Schedule new debounce timer for this packet
      const timer = setTimeout(() => {
        this.dispatchPendingPrediction(nodeId);
      }, this.packetDebounceMs);

      this.pendingPredictions.set(nodeId, {
        timer,
        sequenceNumber,
        nodeId,
        zoneId,
        window,
      });
    } catch (err: unknown) {
      this.logger.error(
        `[ML-Shadow] Unexpected error in window buffer handling: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private dispatchPendingPrediction(nodeId: string): void {
    const pending = this.pendingPredictions.get(nodeId);
    if (!pending) return;
    this.pendingPredictions.delete(nodeId);

    this.executePrediction(pending.nodeId, pending.zoneId, pending.window).catch((err) => {
      this.logger.warn(`[ML-Shadow] Background prediction error: ${err.message}`);
    });
  }

  /**
   * Calls POST /predict with timeout, latency tracking, retry, and shadow-mode enforcement.
   */
  private async executePrediction(
    nodeId: string,
    zoneId: string,
    window: number[][],
  ): Promise<void> {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    const payload = {
      window,
      reference_id: `node-${nodeId}-${Date.now()}`,
    };

    try {
      const response = await fetch(this.inferenceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as InferenceServiceResponse;
      const endTime = performance.now();
      const inferenceLatencyMs = Math.round((endTime - startTime) * 10) / 10;

      this.isServiceAlive = true;

      const predictionId = randomUUID();

      const prediction: ShadowMlPrediction = {
        predictionId,
        nodeId,
        zoneId,
        timestamp: new Date().toISOString(),
        anomaly_class: data.anomaly_class,
        class_probs: data.class_probs,
        severity: Math.round(data.severity * 1000) / 1000,
        alert_level: data.alert_level,
        model_version: data.model_version,
        inferenceLatencyMs,
        windowLen: ML_WINDOW_LENGTH,
        stride: ML_STRIDE,
        isShadowMode: true, // STRICT SHADOW MODE
        inputWindow: window,
      };

      this.latestPredictions.set(nodeId, prediction);

      this.logger.log(
        `[ML-Shadow] Node ${nodeId} | Pred: ${prediction.anomaly_class} (${(prediction.class_probs[prediction.anomaly_class] * 100).toFixed(1)}%) | Sev: ${prediction.severity} | Alert: ${prediction.alert_level} | Latency: ${inferenceLatencyMs}ms (Shadow Mode)`,
      );

      // Emit shadow prediction event for RealtimeService / Dashboard
      // NOTE: This does NOT emit 'alert.triggered' or contact AlertsService.
      this.eventEmitter.emit('ml.prediction.generated', prediction);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const errMsg = isAbort
        ? `Request timed out after ${this.requestTimeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err);

      this.isServiceAlive = false;
      this.lastFailureTime = Date.now();

      this.logger.warn(
        `[ML-Shadow] Inference service unavailable: ${errMsg}. Ingestion path continues unaffected.`,
      );
    }
  }

  getLatestPrediction(nodeId: string): ShadowMlPrediction | undefined {
    return this.latestPredictions.get(nodeId);
  }

  getAllLatestPredictions(): ShadowMlPrediction[] {
    return Array.from(this.latestPredictions.values());
  }

  getLatestPredictionForZone(zoneId: string): ShadowMlPrediction[] {
    return Array.from(this.latestPredictions.values()).filter(
      (p) => p.zoneId === zoneId,
    );
  }

  onNodeOffline(nodeId: string): void {
    const pending = this.pendingPredictions.get(nodeId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingPredictions.delete(nodeId);
    }
    // Retain windowBuffer and latestPredictions so alternating node intervals
    // in multi-node setups do not wipe historical feature contexts.
  }

  onModuleDestroy(): void {
    for (const pending of this.pendingPredictions.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingPredictions.clear();
  }
}
