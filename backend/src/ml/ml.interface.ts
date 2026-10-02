/**
 * ML Inference & Windowing Type Definitions — Phase 3 (Shadow Mode)
 *
 * Grounded in ML_WORKFLOW.md §2, §5, §10
 */

/** The 9 ordered channels expected by the baseline CNN-LSTM model */
export const ML_EXPECTED_CHANNELS = [
  'tilt_x_deg',
  'tilt_y_deg',
  'vibration_amplitude_g',
  'vibration_freq_hz',
  'crack_displacement_mm',
  'water_level_cm',
  'gas_ppm',
  'temperature_c',
  'humidity_pct',
] as const;

export type MlChannelName = (typeof ML_EXPECTED_CHANNELS)[number];

export const ML_WINDOW_LENGTH = 32;
export const ML_STRIDE = 1; // Overlapping slide: every new reading after buffer is full triggers evaluation

/** Raw response returned by POST /predict on the inference service */
export interface InferenceServiceResponse {
  readonly anomaly_class: string;
  readonly class_probs: Record<string, number>;
  readonly severity: number;
  readonly alert_level: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | string;
  readonly model_version: string;
}

/**
 * Enriched ML prediction payload stored and broadcast to the dashboard in shadow mode.
 * Rules:
 * 1. Must be kept strictly separate from raw sensor telemetry.
 * 2. Must be labeled isShadowMode: true (informational only).
 * 3. Must NEVER trigger an automated emergency sirens or mine operator panic alerts.
 */
export interface ShadowMlPrediction {
  readonly predictionId?: string;
  readonly nodeId: string;
  readonly zoneId: string;
  readonly timestamp: string;
  readonly anomaly_class: string;
  readonly class_probs: Record<string, number>;
  readonly severity: number;
  readonly alert_level: string;
  readonly model_version: string;
  /** Round-trip inference latency in milliseconds */
  readonly inferenceLatencyMs: number;
  /** Window length evaluated */
  readonly windowLen: number;
  /** Stride used for window evaluation */
  readonly stride: number;
  /** Explicit shadow mode flag */
  readonly isShadowMode: true;
  /** Full (32, 9) input window array for persistent logging & retraining */
  readonly inputWindow?: number[][];
  /** Optional operator-confirmed ground truth label for retraining */
  readonly confirmedLabel?: string | null;
}
