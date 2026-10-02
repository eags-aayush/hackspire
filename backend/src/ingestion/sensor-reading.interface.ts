/**
 * Canonical sensor reading shape — Design&Architecture.md §3
 *
 * This is the raw payload as published by the simulator / gateway ESP32.
 * Field names are canonical and must not be renamed between layers
 * (Rules.md §4).
 */
export interface RawSensorReading {
  readonly nodeId: string;
  readonly zoneId: string;
  readonly sensorType: string;
  readonly value: number;
  readonly unit: string;
  /** ISO 8601 timestamp originated at the sensor/simulator — not receivedAt */
  readonly timestamp: string;
  /** Per-node, monotonically increasing sequence number */
  readonly sequenceNumber: number;
}

/**
 * Sensor reading after ingestion validation + receivedAt stamp.
 * This is what IngestionModule produces internally.
 */
export interface ValidatedSensorReading extends RawSensorReading {
  /** ISO 8601 timestamp of when the backend received this message */
  readonly receivedAt: string;
  /** Original unconditioned raw sensor reading prior to filtering/smoothing */
  readonly rawValue?: number;
}
