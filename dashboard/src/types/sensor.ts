/**
 * Canonical sensor reading interfaces matching Design&Architecture.md §3 and Rules.md §4.
 *
 * Field names: nodeId, zoneId, sensorType, value, unit, timestamp, sequenceNumber, receivedAt
 * Never rename these fields.
 */

export type SensorType = 
  | 'tilt'
  | 'vibration'
  | 'displacement'
  | 'crack'
  | 'gas'
  | 'water'
  | string;

export interface RawSensorReading {
  readonly nodeId: string;
  readonly zoneId: string;
  readonly sensorType: SensorType;
  readonly value: number;
  readonly unit: string;
  /** ISO 8601 timestamp originated at the sensor/simulator */
  readonly timestamp: string;
  /** Per-node, monotonically increasing sequence number */
  readonly sequenceNumber: number;
}

export interface ValidatedSensorReading extends RawSensorReading {
  /** ISO 8601 timestamp of when the backend received this message */
  readonly receivedAt?: string;
  /** Original unconditioned raw sensor reading prior to filtering/smoothing */
  readonly rawValue?: number;
}

export interface SensorMetadata {
  readonly label: string;
  readonly defaultUnit: string;
  readonly iconName: string;
  readonly normalRange: [number, number];
  readonly warningThreshold: number;
  readonly criticalThreshold: number;
  readonly description: string;
}
