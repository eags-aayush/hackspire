import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');

export interface StorageAdapter {
  /**
   * Persists a single validated, deduped sensor reading.
   */
  saveReading(reading: ValidatedSensorReading): Promise<void>;

  /**
   * Returns the total number of readings stored.
   * Useful for Step 6 count verification.
   */
  getTotalReadingsCount(): Promise<number>;
}
