import { Injectable, Logger } from '@nestjs/common';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';

@Injectable()
export class MovingAverageFilterService {
  private readonly logger = new Logger(MovingAverageFilterService.name);

  // Key: `${nodeId}:${sensorType}` -> array of raw values in sliding window
  private readonly windows = new Map<string, number[]>();

  // Default window size (N = 5 samples)
  private readonly DEFAULT_WINDOW_SIZE = 5;

  // Tailored window sizes per sensor physics
  private readonly channelWindowSizes: Record<string, number> = {
    // Physical orientation & vibration: 5-sample window completely eliminates MEMS I2C jitter at rest
    tilt: 5,
    tilt_x: 5,
    tilt_y: 5,
    tilt_x_deg: 5,
    tilt_y_deg: 5,
    vibration: 5,
    vibration_amplitude: 5,
    vibration_amplitude_g: 5,
    vibration_freq: 5,
    vibration_freq_hz: 5,

    // Ultrasonic & displacement: 5-sample window eliminates acoustic echo bounce jitter
    displacement: 5,
    distance: 5,

    // Analog ADC channels: 5-sample window cleans electrical ADC quantization noise
    crack: 5,
    crack_displacement: 5,
    crack_displacement_mm: 5,
    potentiometer: 5,
    pot: 5,
    gas: 5,
    gas_ppm: 5,
    water: 5,
    water_level: 5,
    water_level_cm: 5,

    // Environmental sensors: 3-sample window (DHT22 naturally slow-varying)
    temperature: 3,
    temperature_c: 3,
    humidity: 3,
    humidity_pct: 3,

    // RF & binary triggers: no window smoothing (instantaneous)
    miner_proximity: 1,
    rssi: 3,
    snr: 3,
  };

  /**
   * Returns window size for a given sensorType.
   */
  public getWindowSize(sensorType: string): number {
    const key = sensorType.toLowerCase();
    return this.channelWindowSizes[key] ?? this.DEFAULT_WINDOW_SIZE;
  }

  /**
   * Smooths an incoming sensor reading using a Moving Average sliding window.
   * Preserves original unconditioned input in `rawValue`.
   * Automatically rounds the smoothed average to clean physical precision.
   */
  public smooth(reading: ValidatedSensorReading): ValidatedSensorReading {
    const { nodeId, sensorType, value } = reading;

    // Handle invalid numerical input defensively
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      this.logger.warn(
        `[MovingAverageFilter] Received non-finite value for node=${nodeId} type=${sensorType}: ${value}`,
      );
      return {
        ...reading,
        rawValue: value,
      };
    }

    const maxWindowSize = this.getWindowSize(sensorType);

    // If channel is bypass (e.g. miner_proximity beacon), return reading as-is
    if (maxWindowSize <= 1) {
      return {
        ...reading,
        value,
        rawValue: value,
      };
    }

    const channelKey = `${nodeId}:${sensorType.toLowerCase()}`;
    let window = this.windows.get(channelKey);
    if (!window) {
      window = [];
      this.windows.set(channelKey, window);
    }

    // Push new raw reading into sliding window
    window.push(value);
    if (window.length > maxWindowSize) {
      window.shift();
    }

    // Compute Simple Moving Average (SMA)
    const sum = window.reduce((acc, curr) => acc + curr, 0);
    const avg = sum / window.length;

    // Round according to sensor physical precision for clean presentation
    const roundedValue = this.roundToPrecision(sensorType, avg, value);

    return {
      ...reading,
      value: roundedValue,
      rawValue: value,
    };
  }

  /**
   * Rounds smoothed value to meaningful physical decimal precision,
   * completely eliminating floating-point division noise (e.g. .3333333334).
   */
  public roundToPrecision(sensorType: string, smoothedVal: number, originalVal: number): number {
    const s = sensorType.toLowerCase();

    // Tilt angles: 2 decimals (e.g. 0.25°)
    if (s.startsWith('tilt')) {
      return Math.round(smoothedVal * 100) / 100;
    }

    // Vibration amplitude: 3 decimals (e.g. 1.002g)
    if (s.startsWith('vibration_amplitude') || s === 'vibration') {
      return Math.round(smoothedVal * 1000) / 1000;
    }

    // Vibration frequency: 1 decimal (e.g. 5.0 Hz)
    if (s.startsWith('vibration_freq')) {
      return Math.round(smoothedVal * 10) / 10;
    }

    // Ultrasonic distance & displacement: 1 decimal (e.g. 15.2 cm)
    if (s === 'displacement' || s === 'distance') {
      return Math.round(smoothedVal * 10) / 10;
    }

    // Environmental: 1 decimal (e.g. 24.5°C, 68.2%)
    if (s.startsWith('temp') || s.startsWith('hum')) {
      return Math.round(smoothedVal * 10) / 10;
    }

    // Raw ADC readings (MQ6 gas, water, potentiometer crack sensor):
    // If original reading was an integer ADC value (>= 10 and Number.isInteger), round to integer or 1 decimal
    if (
      s === 'gas' ||
      s === 'gas_ppm' ||
      s === 'water' ||
      s === 'water_level_cm' ||
      s === 'crack' ||
      s === 'pot' ||
      s === 'potentiometer' ||
      s === 'crack_displacement_mm'
    ) {
      if (Number.isInteger(originalVal)) {
        return Math.round(smoothedVal);
      }
      return Math.round(smoothedVal * 10) / 10;
    }

    // RF telemetry: 1 decimal
    if (s === 'rssi' || s === 'snr') {
      return Math.round(smoothedVal * 10) / 10;
    }

    // Default fallback: 2 decimals
    return Math.round(smoothedVal * 100) / 100;
  }

  /**
   * Returns current moving average for a channel, or null if no readings.
   */
  public getMovingAverage(nodeId: string, sensorType: string): number | null {
    const channelKey = `${nodeId}:${sensorType.toLowerCase()}`;
    const window = this.windows.get(channelKey);
    if (!window || window.length === 0) return null;
    const sum = window.reduce((acc, curr) => acc + curr, 0);
    return sum / window.length;
  }

  /**
   * Returns copy of current sliding window for diagnostics/testing.
   */
  public getWindow(nodeId: string, sensorType: string): number[] {
    const channelKey = `${nodeId}:${sensorType.toLowerCase()}`;
    const window = this.windows.get(channelKey);
    return window ? [...window] : [];
  }

  /**
   * Clears sliding window buffers for a specific node (e.g. on reboot or disconnect).
   */
  public resetNode(nodeId: string): void {
    const prefix = `${nodeId}:`;
    for (const key of Array.from(this.windows.keys())) {
      if (key.startsWith(prefix)) {
        this.windows.delete(key);
      }
    }
    this.logger.debug(`[MovingAverageFilter] Reset filter buffers for node ${nodeId}`);
  }

  /**
   * Clears all filter windows.
   */
  public resetAll(): void {
    this.windows.clear();
  }
}
