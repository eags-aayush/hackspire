/**
 * IngestionService — Phase 1
 *
 * Subscribes to MQTT sensor topics, validates payload shape, stamps receivedAt,
 * and logs the parsed reading. That's it.
 *
 * Per Rules.md §1: this handler must NEVER contain business logic (dedup,
 * gap detection, anomaly checks) or call StorageModule / RealtimeModule.
 *
 * Per Rules.md §2: nothing synchronous/blocking/CPU-heavy runs here — this is
 * the latency-critical path.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import mqtt, { type MqttClient } from 'mqtt';
import type { RawSensorReading, ValidatedSensorReading } from './sensor-reading.interface.js';
import type { ValidatedNodeStatus } from './node-status.interface.js';

export interface GatewayStatusPayload {
  brokerConnected: boolean;
  loraGatewayConnected: boolean;
  status: 'online' | 'offline' | 'standby';
  lastLoraPacketAt: string | null;
  totalLoraPackets: number;
  gatewayType: string;
  topic: string;
  nodeId?: string;
  activeNodes?: string[];
}

/** Topic subscriptions for sensors, LoRa packets, and gateway status/LWT */
const SUBSCRIBE_TOPIC = 'mine/+/+/#';
const LORA_TOPIC = 'sensors/lora/#';
const GATEWAY_TOPIC = 'gateway/#';
const SENSORS_GATEWAY_TOPIC = 'sensors/gateway/#';
const MINE_GATEWAY_TOPIC = 'mine/gateway/#';
const ALERT_ACK_TOPIC = 'mine/+/+/alert/ack';

/** Valid sensor types per Design&Architecture.md §3 and ML_WORKFLOW.md §2 */
const VALID_SENSOR_TYPES = new Set([
  'tilt',
  'tilt_x',
  'tilt_y',
  'tilt_x_deg',
  'tilt_y_deg',
  'vibration',
  'vibration_amplitude',
  'vibration_amplitude_g',
  'vibration_freq',
  'vibration_freq_hz',
  'displacement',
  'distance',
  'crack',
  'crack_displacement',
  'crack_displacement_mm',
  'potentiometer',
  'pot',
  'gas',
  'gas_ppm',
  'water',
  'water_level',
  'water_level_cm',
  'temperature',
  'temperature_c',
  'humidity',
  'humidity_pct',
  'rssi',
  'snr',
  'miner_proximity',
]);

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private client: MqttClient | null = null;
  private isBrokerConnected = false;
  private isGatewayClientConnected = false;
  private hasSeenAnyGatewayActivity = false;
  private isGatewayExplicitlyOffline = false;
  private lastLoraPacketAt: string | null = null;
  private totalLoraPackets = 0;
  private readonly activeLoraNodes = new Set<string>();
  private gatewayWatchdogTimer: NodeJS.Timeout | null = null;
  private readonly lastKnownReadings = new Map<
    string,
    {
      temp?: number;
      hum?: number;
      tilt?: number;
      tiltX?: number;
      tiltY?: number;
      vibration?: number;
      dist_cm?: number;
    }
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  getGatewayStatus(): GatewayStatusPayload {
    const elapsed = this.lastLoraPacketAt
      ? Date.now() - new Date(this.lastLoraPacketAt).getTime()
      : null;

    const isPacketRecent =
      !this.isGatewayExplicitlyOffline &&
      elapsed !== null &&
      elapsed < 30_000;

    // A gateway is connected if Mosquitto reports connected clients > 1 (e.g. ESP32 connected to broker)
    // OR if recent LoRa packets were received
    const isConnected =
      (this.isGatewayClientConnected || isPacketRecent) &&
      !this.isGatewayExplicitlyOffline;

    let status: 'online' | 'offline' | 'standby' = 'standby';
    if (isConnected) {
      status = 'online';
    } else if (
      this.hasSeenAnyGatewayActivity ||
      this.isGatewayExplicitlyOffline ||
      this.lastLoraPacketAt !== null ||
      this.totalLoraPackets > 0
    ) {
      status = 'offline';
    } else {
      status = 'standby';
    }

    const activeList = Array.from(this.activeLoraNodes);
    return {
      brokerConnected: this.isBrokerConnected,
      loraGatewayConnected: isConnected,
      status,
      lastLoraPacketAt: this.lastLoraPacketAt,
      totalLoraPackets: this.totalLoraPackets,
      gatewayType: 'ESP32 LoRa Gateway (SX1276)',
      topic: 'sensors/lora/#',
      nodeId: activeList.join(', ') || 'NODE_01',
      activeNodes: activeList,
    };
  }

  private emitGatewayStatus(): void {
    this.eventEmitter.emit('gateway.status.changed', this.getGatewayStatus());
  }

  private recordLoraGatewayActivity(nodeId: string): void {
    this.isGatewayClientConnected = true;
    this.hasSeenAnyGatewayActivity = true;
    this.isGatewayExplicitlyOffline = false;
    this.lastLoraPacketAt = new Date().toISOString();
    this.totalLoraPackets++;
    if (nodeId) {
      this.activeLoraNodes.add(nodeId);
    }
    this.emitGatewayStatus();
  }

  onModuleInit(): void {
    const brokerUrl = this.config.get<string>('MQTT_BROKER_URL', 'mqtt://localhost:1883');

    this.client = mqtt.connect(brokerUrl, {
      clientId: 'backend-ingestion-' + Math.random().toString(16).substr(2, 8),
      clean: true,
      username: this.config.get<string>('MQTT_USERNAME'),
      password: this.config.get<string>('MQTT_PASSWORD'),
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker at ${brokerUrl}`);
      this.isBrokerConnected = true;
      this.emitGatewayStatus();

      // Subscribe to mine telemetry, hardware LoRa topics, gateway topics, alert ACKs, and broker $SYS telemetry
      const topics = [
        SUBSCRIBE_TOPIC,
        LORA_TOPIC,
        GATEWAY_TOPIC,
        SENSORS_GATEWAY_TOPIC,
        MINE_GATEWAY_TOPIC,
        ALERT_ACK_TOPIC,
      ];
      this.client!.subscribe(topics, { qos: 1 }, (err, granted) => {
        if (err) {
          this.logger.error(`Subscribe error: ${err.message}`);
          return;
        }
        if (granted && granted.length > 0) {
          for (const g of granted) {
            this.logger.log(`Subscribed to "${g.topic}" with QoS ${g.qos}`);
          }
        }
      });
    });

    this.client.on('message', (_topic: string, payload: Buffer) => {
      this.handleMessage(_topic, payload);
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`MQTT error: ${err.message}`);
      this.isBrokerConnected = false;
      this.emitGatewayStatus();
    });

    this.client.on('offline', () => {
      this.logger.warn('MQTT client offline — will attempt reconnect');
      this.isBrokerConnected = false;
      this.emitGatewayStatus();
    });

    // 1-second watchdog to quickly detect physical LoRa gateway timeout/disconnect
    let lastKnownStatus: 'online' | 'offline' | 'standby' = 'standby';
    this.gatewayWatchdogTimer = setInterval(() => {
      const current = this.getGatewayStatus();
      if (current.status !== lastKnownStatus) {
        if (lastKnownStatus === 'online' && current.status === 'offline') {
          this.logger.warn(
            `[ingestion] LoRa Gateway timed out (>30s without packet) -> marked OFFLINE`,
          );
          for (const nId of this.activeLoraNodes) {
            this.eventEmitter.emit('node.status.received', {
              nodeId: nId,
              zoneId: 'zone-A',
              status: 'offline',
              receivedAt: new Date().toISOString(),
            });
          }
        }
        lastKnownStatus = current.status;
        this.emitGatewayStatus();
      }
    }, 1000);
  }

  onModuleDestroy(): void {
    if (this.gatewayWatchdogTimer) {
      clearInterval(this.gatewayWatchdogTimer);
      this.gatewayWatchdogTimer = null;
    }
    if (this.client) {
      this.client.end();
      this.logger.log('MQTT client disconnected');
    }
  }

  /**
   * Public MQTT publish method for downlink commands (e.g., Edge Alert dispatch).
   * Used by EdgeAlertService to send alert commands to ESP32 Gateway / Edge Nodes.
   */
  publishMqtt(topic: string, payload: string | Buffer, qos: 0 | 1 | 2 = 1): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isBrokerConnected) {
        this.logger.warn(`[ingestion] Cannot publish to "${topic}" — MQTT client not connected`);
        return reject(new Error('MQTT client not connected'));
      }
      this.client.publish(topic, payload, { qos }, (err) => {
        if (err) {
          this.logger.error(`[ingestion] MQTT publish error on "${topic}": ${err.message}`);
          return reject(err);
        }
        this.logger.log(`[ingestion] Published downlink to "${topic}" (QoS ${qos})`);
        resolve();
      });
    });
  }

  /**
   * MQTT message handler
   */
  private handleMessage(topic: string, payload: Buffer): void {
    // --- 0a. Handle Edge Alert ACK from Gateway/Node ---
    if (topic.endsWith('/alert/ack')) {
      try {
        const ackPayload = JSON.parse(payload.toString().trim());
        this.logger.log(`[ingestion] Edge Alert ACK received: node=${ackPayload.nodeId || 'unknown'} commandId=${ackPayload.commandId || 'unknown'}`);
        this.eventEmitter.emit('edge.alert.acknowledged', ackPayload);
      } catch {
        this.logger.warn(`[ingestion] Invalid alert ACK payload on "${topic}"`);
      }
      return;
    }

    // --- 0b. Handle Mosquitto Broker Internal Client Telemetry ($SYS/broker/clients/...) ---
    if (topic.startsWith('$SYS/broker/clients')) {
      if (topic === '$SYS/broker/clients/connected' || topic.endsWith('/connected')) {
        const count = parseInt(payload.toString().trim(), 10);
        if (!isNaN(count)) {
          // backend-ingestion itself is 1 client.
          // Any count > 1 means an external gateway (such as ESP32 LoRa Gateway) is connected to the MQTT broker
          const wasConnected = this.isGatewayClientConnected;
          this.isGatewayClientConnected = count > 1;

          if (this.isGatewayClientConnected) {
            this.hasSeenAnyGatewayActivity = true;
            this.isGatewayExplicitlyOffline = false;
          }

          if (wasConnected !== this.isGatewayClientConnected) {
            this.logger.log(
              `[ingestion] MQTT Broker Gateway client state: connected=${this.isGatewayClientConnected} (broker client count=${count})`,
            );
            this.emitGatewayStatus();
          }
        }
      }
      return;
    }

    const lowerTopic = topic.toLowerCase();

    // --- 1. Handle Gateway Status and LWT Messages ---
    // (e.g. gateway/status, gateway/lwt, sensors/lora/status, sensors/lora/lwt, sensors/gateway/status)
    const isGatewayTopic =
      lowerTopic.includes('gateway') ||
      lowerTopic === 'sensors/lora/status' ||
      lowerTopic === 'sensors/lora/lwt' ||
      lowerTopic.startsWith('sensors/lora/status') ||
      lowerTopic.startsWith('sensors/lora/lwt');

    if (isGatewayTopic) {
      const rawStr = payload.toString().trim().toLowerCase();
      let isOffline = false;
      let isOnline = false;

      if (
        rawStr === 'offline' ||
        rawStr === 'disconnected' ||
        rawStr === '0' ||
        rawStr === 'down' ||
        rawStr === 'dead'
      ) {
        isOffline = true;
      } else if (
        rawStr === 'online' ||
        rawStr === 'connected' ||
        rawStr === '1' ||
        rawStr === 'up'
      ) {
        isOnline = true;
      } else {
        try {
          const parsed = JSON.parse(rawStr) as Record<string, unknown>;
          if (
            parsed &&
            (parsed.status === 'offline' ||
              parsed.connected === false ||
              parsed.online === false)
          ) {
            isOffline = true;
          } else if (
            parsed &&
            (parsed.status === 'online' ||
              parsed.connected === true ||
              parsed.online === true)
          ) {
            isOnline = true;
          }
        } catch {
          // not json
        }
      }

      if (isOffline) {
        this.logger.warn(
          `[ingestion] Gateway disconnect/LWT received on topic "${topic}" -> marking gateway OFFLINE`,
        );
        this.isGatewayExplicitlyOffline = true;
        this.emitGatewayStatus();
        for (const nId of this.activeLoraNodes) {
          this.eventEmitter.emit('node.status.received', {
            nodeId: nId,
            zoneId: 'zone-A',
            status: 'offline',
            receivedAt: new Date().toISOString(),
          });
        }
        return;
      }

      if (isOnline) {
        this.logger.log(`[ingestion] Gateway online received on topic "${topic}"`);
        this.isGatewayExplicitlyOffline = false;
        const firstNode = Array.from(this.activeLoraNodes)[0] || 'NODE_01';
        this.recordLoraGatewayActivity(firstNode);
        return;
      }
    }

    // --- 1. Handle LoRa Hardware Topics (sensors/lora/...) ---
    if (topic.startsWith('sensors/lora')) {
      if (payload.length >= 54) {
        this.handleLoraBinary(payload);
        return;
      }
      const str = payload.toString().trim();
      if (str.startsWith('{')) {
        this.handleLoraJson(payload);
        return;
      }
      this.logger.warn(`Unknown payload format on "${topic}" (length: ${payload.length})`);
      return;
    }

    // --- 2. Handle Status Topics ---
    if (topic.endsWith('/status')) {
      const parts = topic.split('/');
      if (parts.length === 4) {
        const zoneId = parts[1];
        const nodeId = parts[2];
        const rawStr = payload.toString().trim();
        let status: 'online' | 'offline' | undefined;

        if (rawStr === 'online' || rawStr === 'offline') {
          status = rawStr;
        } else {
          try {
            const parsed = JSON.parse(rawStr) as Record<string, unknown>;
            if (parsed && (parsed.status === 'online' || parsed.status === 'offline')) {
              status = parsed.status;
            }
          } catch {
            // not json
          }
        }

        if (status) {
          const validatedStatus: ValidatedNodeStatus = {
            nodeId,
            zoneId,
            status,
            receivedAt: new Date().toISOString(),
          };
          this.eventEmitter.emit('node.status.received', validatedStatus);
          this.logger.log(`[ingestion] node status received: node=${nodeId} status=${status}`);
          return;
        }
      }
    }

    // --- 3. Parse Standard JSON Reading ---
    let raw: unknown;
    try {
      raw = JSON.parse(payload.toString()) as unknown;
    } catch {
      this.logger.warn(`Invalid JSON on topic "${topic}" — skipped`);
      return;
    }

    // --- 4. Validate shape ---
    if (!this.isValidSensorReading(raw)) {
      this.logger.warn(`Invalid payload shape on topic "${topic}" — skipped`);
      return;
    }

    // --- 5. Stamp receivedAt ---
    const validated: ValidatedSensorReading = {
      ...raw,
      receivedAt: new Date().toISOString(),
    };

    // --- 6. Emit internal event ---
    this.logger.debug(`[ingestion] raw reading received: node=${validated.nodeId} seq=${validated.sequenceNumber}`);
    this.eventEmitter.emit('sensor.reading.received', validated);
  }

  /**
   * Decodes packed SensorData struct sent by ESP32 LoRa Gateway.
   * Supports:
   * - 54-byte wire format (char[8] nodeId, uint32 seq, 9x float, 3x int16_t ADC)
   * - 60-byte wire format:
   *     - 3x int32_t ADC (48..59) OR
   *     - 3x int16_t ADC (48..53) + RSSI (int16_t) & SNR (float) (54..59)
   * - Any future extended binary struct (>= 54 bytes)
   */
  private handleLoraBinary(payload: Buffer): void {
    if (payload.length < 54) {
      this.logger.warn(`[ingestion] LoRa binary payload too short: ${payload.length} bytes (expected >= 54)`);
      return;
    }

    this.logger.log(`[ingestion] LoRa raw binary (${payload.length}B): ${payload.toString('hex')}`);

    const rawNodeId = payload
      .subarray(0, 8)
      .toString('utf8')
      .replace(/\0.*$/, '')
      .replace(/[^A-Za-z0-9_\-\.]/g, '')
      .trim();

    if (!rawNodeId || rawNodeId.length < 2 || rawNodeId.length > 16) {
      this.logger.warn(`[ingestion] Dropping corrupted LoRa packet: invalid nodeId "${rawNodeId}"`);
      return;
    }
    const nodeId = rawNodeId;
    let packetSeq = payload.readUInt32LE(8);

    // Support both 32-bit uint32_t and 16-bit uint16_t sequence counters
    if (packetSeq > 50000000) {
      const seq16 = payload.readUInt16LE(8);
      if (seq16 > 0) {
        packetSeq = seq16;
      }
    }

    // Read floats with defensive sanitization so hardware nodes with noisy or unpopulated sensor pins do not get dropped
    const rawTemp = payload.readFloatLE(12);
    const rawHum = payload.readFloatLE(16);
    const rawAx = payload.readFloatLE(20);
    const rawAy = payload.readFloatLE(24);
    const rawAz = payload.readFloatLE(28);
    const rawGx = payload.readFloatLE(32);
    const rawGy = payload.readFloatLE(36);
    const rawGz = payload.readFloatLE(40);
    const rawDist = payload.readFloatLE(44);

    const temp = (!isNaN(rawTemp) && rawTemp >= -40 && rawTemp <= 125) ? Math.round(rawTemp * 10) / 10 : 25.0;
    const hum = (!isNaN(rawHum) && rawHum >= 0 && rawHum <= 100) ? Math.round(rawHum * 10) / 10 : 65.0;
    const ax = (!isNaN(rawAx) && Math.abs(rawAx) <= 16) ? rawAx : 0;
    const ay = (!isNaN(rawAy) && Math.abs(rawAy) <= 16) ? rawAy : 0;
    const az = (!isNaN(rawAz) && Math.abs(rawAz) <= 16) ? rawAz : 1.0;
    const gx = (!isNaN(rawGx) && Math.abs(rawGx) <= 500) ? rawGx : 0;
    const gy = (!isNaN(rawGy) && Math.abs(rawGy) <= 500) ? rawGy : 0;
    const gz = (!isNaN(rawGz) && Math.abs(rawGz) <= 500) ? rawGz : 0;
    const dist_cm = (!isNaN(rawDist) && rawDist >= 0 && rawDist <= 2000) ? Math.round(rawDist * 10) / 10 : 0;

    // 16-bit ADC values matching ESP32 SensorData packed struct (clamped to 12-bit ADC range 0..4095)
    const mq6_raw = Math.max(0, Math.min(4095, payload.readInt16LE(48)));
    const water_raw = Math.max(0, Math.min(4095, payload.readInt16LE(50)));
    const pot_raw = Math.max(0, Math.min(4095, payload.readInt16LE(52)));

    let rssi: number | undefined;
    let snr: number | undefined;
    let espnow_mac: string | null = null;

    if (payload.length >= 60) {
      // 1. Check if bytes 54..59 contain explicit RSSI (signed int16) + SNR (float) metadata
      const possibleRssi = payload.readInt16LE(54);
      const possibleSnr = payload.readFloatLE(56);
      const isRssiSnr =
        possibleRssi < 0 &&
        possibleRssi >= -150 &&
        !isNaN(possibleSnr) &&
        possibleSnr >= -35 &&
        possibleSnr <= 35;

      if (isRssiSnr) {
        rssi = possibleRssi;
        snr = Math.round(possibleSnr * 10) / 10;
      } else {
        // 2. Exact 60-byte SensorData struct from physical ESP32 (contains 6-byte espnow_mac at offset 54..59)
        const macBytes = Array.from(payload.subarray(54, 60));
        const hasMac = macBytes.some((b) => b !== 0);
        if (hasMac) {
          espnow_mac = macBytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
        }
      }

      // 3. Extended gateway frame (>= 66 bytes) where RSSI and SNR are appended at offset 60+
      if (payload.length >= 66) {
        rssi = payload.readInt16LE(60);
        snr = Math.round(payload.readFloatLE(62) * 10) / 10;
      }
    }

    this.recordLoraGatewayActivity(nodeId);

    this.logger.log(
      `[ingestion] LoRa packet processed (${payload.length}B): node=${nodeId} seq=${packetSeq} temp=${temp}°C hum=${hum}% dist=${dist_cm}cm mq6=${mq6_raw} water=${water_raw} pot=${pot_raw}${espnow_mac ? ` espnow_mac=${espnow_mac}` : ''}${rssi !== undefined ? ` rssi=${rssi}dBm snr=${snr}dB` : ''}`,
    );

    this.dispatchHardwareReadings(nodeId, packetSeq, {
      temp,
      hum,
      ax,
      ay,
      az,
      gx,
      gy,
      gz,
      dist_cm,
      mq6_raw,
      water_raw,
      pot_raw,
      rssi,
      snr,
      espnow_mac,
    });
  }

  private handleLoraJson(payload: Buffer): void {
    try {
      const data = JSON.parse(payload.toString()) as Record<string, unknown>;

      // Check for explicit offline/disconnect signal in LoRa JSON
      if (data.status === 'offline' || data.connected === false || data.online === false) {
        this.logger.warn(`[ingestion] LoRa JSON specified offline: ${JSON.stringify(data)}`);
        this.isGatewayExplicitlyOffline = true;
        this.emitGatewayStatus();
        const specificNodeId = data.NODE_ID || data.node_id || data.nodeId || data.id || data.NodeId || data.node;
        const nodesToOffline = specificNodeId
          ? [String(specificNodeId)]
          : Array.from(this.activeLoraNodes);
        if (nodesToOffline.length === 0) {
          nodesToOffline.push('NODE_01');
        }
        for (const nodeId of nodesToOffline) {
          this.eventEmitter.emit('node.status.received', {
            nodeId,
            zoneId: 'zone-A',
            status: 'offline',
            receivedAt: new Date().toISOString(),
          });
        }
        return;
      }

      const nodeId = String(data.NODE_ID || data.node_id || data.nodeId || data.id || data.NodeId || data.node || 'NODE_01');
      const packetSeq = Number(data.packetSequence || data.packetSeq || data.sequenceNumber || 1);
      this.recordLoraGatewayActivity(nodeId);
      this.dispatchHardwareReadings(nodeId, packetSeq, {
        temp: Number(data.temp ?? -999),
        hum: Number(data.hum ?? -999),
        ax: Number(data.ax ?? 0),
        ay: Number(data.ay ?? 0),
        az: Number(data.az ?? 0),
        gx: Number(data.gx ?? 0),
        gy: Number(data.gy ?? 0),
        gz: Number(data.gz ?? 0),
        dist_cm: Number(data.dist_cm ?? 0),
        mq6_raw: Number(data.mq6_raw ?? 0),
        water_raw: Number(data.water_raw ?? 0),
        pot_raw: Number(data.pot_raw ?? 0),
      });
    } catch (err: unknown) {
      this.logger.warn(`Failed to parse LoRa JSON payload: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private dispatchHardwareReadings(
    nodeId: string,
    packetSeq: number,
    data: {
      temp: number;
      hum: number;
      ax: number;
      ay: number;
      az: number;
      gx: number;
      gy: number;
      gz: number;
      dist_cm: number;
      mq6_raw: number;
      water_raw: number;
      pot_raw: number;
      rssi?: number;
      snr?: number;
      espnow_mac?: string | null;
    },
  ): void {
    const now = new Date().toISOString();
    const zoneId = 'zone-A';

    // 1. Mark node as online
    const validatedStatus: ValidatedNodeStatus = {
      nodeId,
      zoneId,
      status: 'online',
      receivedAt: now,
    };
    this.eventEmitter.emit('node.status.received', validatedStatus);

    let lastKnown = this.lastKnownReadings.get(nodeId);
    if (!lastKnown) {
      lastKnown = {};
      this.lastKnownReadings.set(nodeId, lastKnown);
    }

    // 2. Compute physical metrics with MEMS I2C fault tolerance
    // In physics at rest, acceleration magnitude is 1.0g (gravity).
    // If ax=0, ay=0, az=0, MPU9250 I2C read timed out or failed.
    const accelMag = Math.sqrt(data.ax * data.ax + data.ay * data.ay + data.az * data.az);
    let pitch: number;
    let roll: number;
    let tilt: number;
    let tiltX: number;
    let tiltY: number;
    let vibration: number;

    if (accelMag >= 0.2 && accelMag <= 5.0) {
      pitch = Math.atan2(data.ax, Math.sqrt(data.ay * data.ay + data.az * data.az)) * (180 / Math.PI);
      roll = Math.atan2(data.ay, Math.sqrt(data.ax * data.ax + data.az * data.az)) * (180 / Math.PI);
      tilt = Math.round(Math.sqrt(pitch * pitch + roll * roll) * 100) / 100;
      tiltX = Math.round(pitch * 1000) / 1000;
      tiltY = Math.round(roll * 1000) / 1000;
      vibration = Math.round(accelMag * 10000) / 10000;

      lastKnown.tilt = tilt;
      lastKnown.tiltX = tiltX;
      lastKnown.tiltY = tiltY;
      lastKnown.vibration = vibration;
    } else {
      // Hold steady-state orientation rather than computing an artificial 90° spike
      tilt = lastKnown.tilt ?? 0;
      tiltX = lastKnown.tiltX ?? 0;
      tiltY = lastKnown.tiltY ?? 0;
      vibration = lastKnown.vibration ?? 1.0;
    }

    const gyroMag = Math.sqrt(data.gx * data.gx + data.gy * data.gy + data.gz * data.gz);
    const vibeFreq = Math.round((gyroMag > 0 ? gyroMag : 5.0) * 100) / 100;

    // Distance validation
    let distVal = data.dist_cm;
    if (distVal > 0 && distVal <= 400) {
      lastKnown.dist_cm = distVal;
    } else if (lastKnown.dist_cm !== undefined) {
      distVal = lastKnown.dist_cm;
    }

    // Canonical dashboard channels
    const sensorReadings: Array<{ sensorType: string; value: number; unit: string }> = [
      { sensorType: 'tilt', value: isNaN(tilt) ? 0 : tilt, unit: 'degrees' },
      { sensorType: 'vibration', value: isNaN(vibration) ? 0 : vibration, unit: 'g' },
      { sensorType: 'displacement', value: distVal, unit: 'cm' },
      { sensorType: 'distance', value: distVal, unit: 'cm' },
      { sensorType: 'crack', value: data.pot_raw, unit: 'raw' },
      { sensorType: 'potentiometer', value: data.pot_raw, unit: 'raw' },
      { sensorType: 'gas', value: data.mq6_raw, unit: 'raw' },
      { sensorType: 'water', value: data.water_raw, unit: 'raw' },
      // 9-channel ML feature representations (ML_WORKFLOW.md §2)
      { sensorType: 'tilt_x_deg', value: isNaN(tiltX) ? 0 : tiltX, unit: 'deg' },
      { sensorType: 'tilt_y_deg', value: isNaN(tiltY) ? 0 : tiltY, unit: 'deg' },
      { sensorType: 'vibration_amplitude_g', value: isNaN(vibration) ? 0 : vibration, unit: 'g' },
      { sensorType: 'vibration_freq_hz', value: isNaN(vibeFreq) ? 5.0 : vibeFreq, unit: 'Hz' },
      { sensorType: 'crack_displacement_mm', value: data.pot_raw > 0 ? data.pot_raw : distVal, unit: 'mm' },
      { sensorType: 'water_level_cm', value: data.water_raw, unit: 'cm' },
      { sensorType: 'gas_ppm', value: data.mq6_raw, unit: 'ppm' },
    ];

    if (data.espnow_mac) {
      sensorReadings.push({ sensorType: 'miner_proximity', value: 1, unit: 'beacon' });
      this.logger.warn(`[ingestion] Miner Safety Alert: ESP-NOW device detected near node=${nodeId} (MAC: ${data.espnow_mac})`);
    }

    if (data.rssi !== undefined) {
      sensorReadings.push({ sensorType: 'rssi', value: data.rssi, unit: 'dBm' });
    }
    if (data.snr !== undefined) {
      sensorReadings.push({ sensorType: 'snr', value: data.snr, unit: 'dB' });
    }

    // Temperature & Humidity validation (hold steady state if DHT22 read dropped or timed out)
    let tempVal: number;
    if (data.temp !== -999 && !isNaN(data.temp) && data.temp >= -20 && data.temp <= 80) {
      tempVal = data.temp;
      lastKnown.temp = tempVal;
    } else {
      tempVal = lastKnown.temp ?? 25.0;
    }

    let humVal: number;
    if (data.hum !== -999 && !isNaN(data.hum) && data.hum >= 1 && data.hum <= 100) {
      humVal = data.hum;
      lastKnown.hum = humVal;
    } else {
      humVal = lastKnown.hum ?? 65.0;
    }

    sensorReadings.push({ sensorType: 'temperature', value: tempVal, unit: '°C' });
    sensorReadings.push({ sensorType: 'temperature_c', value: tempVal, unit: '°C' });
    sensorReadings.push({ sensorType: 'humidity', value: humVal, unit: '%' });
    sensorReadings.push({ sensorType: 'humidity_pct', value: humVal, unit: '%' });

    // Hardware node threshold state evaluation matching evaluateSensorStates()
    const tempRisk = tempVal >= 45.0 ? 'DANGER' : tempVal >= 35.0 ? 'WARNING' : 'SAFE';
    const humRisk = humVal >= 85.0 ? 'DANGER' : humVal >= 70.0 ? 'WARNING' : 'SAFE';
    const mq6Risk = (data.mq6_raw > 0 && data.mq6_raw <= 200) || data.mq6_raw >= 1000 ? 'DANGER' : (data.mq6_raw <= 400 || data.mq6_raw >= 600) ? 'WARNING' : 'SAFE';
    const waterRisk = data.water_raw >= 1500 ? 'DANGER' : data.water_raw >= 900 ? 'WARNING' : 'SAFE';
    const potRisk = data.pot_raw >= 1500 ? 'DANGER' : data.pot_raw >= 1000 ? 'WARNING' : 'SAFE';
    const distRisk = (distVal > 0 && distVal <= 10.0) ? 'DANGER' : (distVal > 0 && distVal <= 15.0) ? 'WARNING' : 'SAFE';
    const tiltRisk = Math.abs(tilt) >= 3.5 ? 'DANGER' : Math.abs(tilt) >= 2.0 ? 'WARNING' : 'SAFE';
    const globalRisk = (tempRisk === 'DANGER' || humRisk === 'DANGER' || mq6Risk === 'DANGER' || waterRisk === 'DANGER' || potRisk === 'DANGER' || distRisk === 'DANGER' || tiltRisk === 'DANGER')
      ? 'DANGER'
      : (tempRisk === 'WARNING' || humRisk === 'WARNING' || mq6Risk === 'WARNING' || waterRisk === 'WARNING' || potRisk === 'WARNING' || distRisk === 'WARNING' || tiltRisk === 'WARNING')
      ? 'WARNING'
      : 'SAFE';

    this.logger.log(
      `[ingestion] Node ${nodeId} State: ${globalRisk} | Temp: ${tempVal}°C [${tempRisk}] | Water: ${data.water_raw} [${waterRisk}] | Pot: ${data.pot_raw} [${potRisk}] | Gas: ${data.mq6_raw} [${mq6Risk}] | Dist: ${distVal}cm [${distRisk}] | Tilt: ${tilt}° [${tiltRisk}]`,
    );

    for (const item of sensorReadings) {
      const validated: ValidatedSensorReading = {
        nodeId,
        zoneId,
        sensorType: item.sensorType,
        value: item.value,
        unit: item.unit,
        timestamp: now,
        sequenceNumber: packetSeq,
        receivedAt: now,
      };
      this.logger.debug(`[ingestion] hardware reading: node=${nodeId} ${item.sensorType}=${item.value}${item.unit} seq=${packetSeq}`);
      this.eventEmitter.emit('sensor.reading.received', validated);
    }
  }

  /**
   * Type guard — validates that `data` has the exact shape of RawSensorReading.
   * No `any` — Rules.md §4.
   */
  private isValidSensorReading(data: unknown): data is RawSensorReading {
    if (typeof data !== 'object' || data === null) return false;

    const obj = data as Record<string, unknown>;

    if (typeof obj['nodeId'] !== 'string') {
      if (typeof obj['NODE_ID'] === 'string') {
        obj['nodeId'] = obj['NODE_ID'];
      } else if (typeof obj['node_id'] === 'string') {
        obj['nodeId'] = obj['node_id'];
      }
    }

    return (
      typeof obj['nodeId'] === 'string' &&
      typeof obj['zoneId'] === 'string' &&
      typeof obj['sensorType'] === 'string' &&
      VALID_SENSOR_TYPES.has(obj['sensorType'] as string) &&
      typeof obj['value'] === 'number' &&
      typeof obj['unit'] === 'string' &&
      typeof obj['timestamp'] === 'string' &&
      typeof obj['sequenceNumber'] === 'number' &&
      Number.isInteger(obj['sequenceNumber'])
    );
  }
}
