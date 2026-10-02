/**
 * ML Prediction interface for Shadow Mode — Phase 3
 *
 * Rules:
 * - Must be strictly isolated from sensor readings.
 * - Displays as informational only.
 * - Must NOT trigger alarm sirens or hardware-threshold alert streams.
 */
export interface ShadowMlPrediction {
  readonly predictionId?: string;
  readonly nodeId: string;
  readonly zoneId: string;
  readonly timestamp: string;
  readonly anomaly_class: 'normal' | 'equipment_noise' | 'subsidence_risk' | string;
  readonly class_probs: Record<string, number>;
  readonly severity: number;
  readonly alert_level: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | string;
  readonly model_version: string;
  readonly inferenceLatencyMs: number;
  readonly windowLen: number;
  readonly stride: number;
  readonly isShadowMode: true;
  readonly confirmedLabel?: string | null;
}
