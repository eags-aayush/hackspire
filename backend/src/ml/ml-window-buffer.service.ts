import { Injectable, Logger } from '@nestjs/common';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import { ML_EXPECTED_CHANNELS, ML_WINDOW_LENGTH } from './ml.interface.js';

@Injectable()
export class MlWindowBufferService {
  private readonly logger = new Logger(MlWindowBufferService.name);

  // nodeId -> array of 9-number vectors (sliding window)
  private readonly buffers = new Map<string, number[][]>();

  // nodeId -> current latest state of all 9 channels
  private readonly nodeChannelStates = new Map<string, Map<string, number>>();

  // nodeId -> last sequence number pushed to buffer (coalesces multi-channel readings per sequence)
  private readonly lastPushedSeq = new Map<string, number>();

  // nodeId -> zoneId
  private readonly nodeZones = new Map<string, string>();

  /**
   * Default baseline values used when a channel has not yet transmitted.
   * Derived from quiet operating conditions calibrated to the ESP32 node.
   */
  private readonly channelBaselines: Record<string, number> = {
    tilt_x_deg: 0.0,
    tilt_y_deg: 0.0,
    vibration_amplitude_g: 0.025,
    vibration_freq_hz: 5.0,
    crack_displacement_mm: 280.0,
    water_level_cm: 236.0,
    gas_ppm: 650.0,
    temperature_c: 25.0,
    humidity_pct: 65.0,
  };

  /**
   * Maps incoming sensor reading to one of the 9 ML channels.
   */
  private normalizeChannelName(sensorType: string): string | null {
    const s = sensorType.toLowerCase();

    if (s === 'tilt_x_deg' || s === 'tilt_x') return 'tilt_x_deg';
    if (s === 'tilt_y_deg' || s === 'tilt_y') return 'tilt_y_deg';
    if (s === 'tilt') return 'tilt_x_deg'; // primary tilt axis

    if (s === 'vibration_amplitude_g' || s === 'vibration_amplitude') return 'vibration_amplitude_g';
    if (s === 'vibration') return 'vibration_amplitude_g';

    if (s === 'vibration_freq_hz' || s === 'vibration_freq') return 'vibration_freq_hz';

    if (
      s === 'crack_displacement_mm' ||
      s === 'crack_displacement' ||
      s === 'potentiometer' ||
      s === 'pot' ||
      s === 'pot_raw' ||
      s === 'crack'
    ) {
      return 'crack_displacement_mm';
    }
    if (s === 'displacement' || s === 'distance' || s === 'dist_cm') {
      return 'crack_displacement_mm';
    }

    if (s === 'water_level_cm' || s === 'water_level' || s === 'water' || s === 'water_raw') return 'water_level_cm';
    if (s === 'gas_ppm' || s === 'gas' || s === 'mq6' || s === 'mq6_raw') return 'gas_ppm';

    if (s === 'temperature_c' || s === 'temperature' || s === 'temp') return 'temperature_c';
    if (s === 'humidity_pct' || s === 'humidity' || s === 'hum') return 'humidity_pct';

    return null;
  }

  /**
   * Ingests a validated sensor reading into the rolling buffer.
   * Returns a complete (32, 9) window if the buffer is full, or null if still filling.
   *
   * Windowing rationale (ML_WORKFLOW.md §10.2):
   * Overlapping slide (stride = 1) is used so every new incoming reading
   * immediately triggers an inference pass once 32 readings have accumulated.
   * This guarantees minimal detection delay for rapid structural shifts.
   */
  addReading(
    reading: ValidatedSensorReading,
    allowWarmup = false,
  ): {
    nodeId: string;
    zoneId: string;
    window: number[][];
  } | null {
    const { nodeId, zoneId, sensorType, value, sequenceNumber } = reading;
    this.nodeZones.set(nodeId, zoneId);

    const channelName = this.normalizeChannelName(sensorType);
    if (!channelName) {
      // Not an ML-relevant channel
      return null;
    }

    // 1. Update node state for this channel
    if (!this.nodeChannelStates.has(nodeId)) {
      this.nodeChannelStates.set(nodeId, new Map());
    }
    const channelMap = this.nodeChannelStates.get(nodeId)!;
    channelMap.set(channelName, value);

    // If tilt was provided as a scalar, assign a slight proportional component to tilt_y if not already set
    if (sensorType === 'tilt' && !channelMap.has('tilt_y_deg')) {
      channelMap.set('tilt_y_deg', Number((value * 0.1).toFixed(3)));
    }

    // 2. Coalesce readings for the same sequenceNumber
    const lastSeq = this.lastPushedSeq.get(nodeId);
    let buffer = this.buffers.get(nodeId);
    if (!buffer) {
      buffer = [];
      this.buffers.set(nodeId, buffer);
    }

    // Build the 9-element vector strictly in expected order
    const currentVector = ML_EXPECTED_CHANNELS.map((ch) => {
      const val = channelMap.get(ch);
      return typeof val === 'number' && !isNaN(val) ? val : this.channelBaselines[ch];
    });

    if (lastSeq === sequenceNumber && buffer.length > 0) {
      // Update the latest vector in-place with the latest channel value for this packet
      buffer[buffer.length - 1] = currentVector;
    } else {
      // New sequence packet -> push new timestep vector
      this.lastPushedSeq.set(nodeId, sequenceNumber);
      buffer.push(currentVector);

      // Keep strictly window_len = 32 elements (overlapping slide)
      if (buffer.length > ML_WINDOW_LENGTH) {
        buffer.shift();
      }
    }

    // 3. Return full 32x9 window if buffer is ready or if warmup is enabled
    if (buffer.length >= ML_WINDOW_LENGTH) {
      const windowCopy = buffer.slice(-ML_WINDOW_LENGTH).map((row) => [...row]);
      return {
        nodeId,
        zoneId,
        window: windowCopy,
      };
    }

    if (allowWarmup && buffer.length > 0) {
      const paddingCount = ML_WINDOW_LENGTH - buffer.length;
      const seedVector = buffer[0];
      const padRows = Array.from({ length: paddingCount }, () => [...seedVector]);
      const windowCopy = [...padRows, ...buffer.map((row) => [...row])];
      return {
        nodeId,
        zoneId,
        window: windowCopy,
      };
    }

    return null;
  }

  /**
   * Returns current buffer fill count for telemetry diagnostics
   */
  getBufferCount(nodeId: string): number {
    return this.buffers.get(nodeId)?.length ?? 0;
  }

  /**
   * Resets node buffer (e.g. when node goes offline)
   */
  clearNode(nodeId: string): void {
    this.buffers.delete(nodeId);
    this.nodeChannelStates.delete(nodeId);
    this.lastPushedSeq.delete(nodeId);
    this.nodeZones.delete(nodeId);
  }
}
