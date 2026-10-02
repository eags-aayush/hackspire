import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IngestionService } from './ingestion.service.js';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { ValidatedSensorReading } from './sensor-reading.interface.js';
import type { ValidatedNodeStatus } from './node-status.interface.js';

describe('IngestionService - LoRa Binary Packet Ingestion', () => {
  let service: IngestionService;
  let emittedEvents: Array<{ event: string; data: unknown }>;

  beforeEach(() => {
    emittedEvents = [];

    const mockConfig = {
      get: vi.fn().mockReturnValue('mqtt://localhost:1883'),
    } as unknown as ConfigService;

    const mockEventEmitter = {
      emit: vi.fn((event: string, data: unknown) => {
        emittedEvents.push({ event, data });
      }),
    } as unknown as EventEmitter2;

    service = new IngestionService(mockConfig, mockEventEmitter);
  });

  const buildBasePayload = (nodeId = 'NODE_01', seq = 101): Buffer => {
    const buf = Buffer.alloc(48);
    // 0..7: nodeId (char[8])
    buf.write(nodeId.padEnd(8, '\0').slice(0, 8), 0, 8, 'utf8');
    // 8..11: packetSeq (uint32 LE)
    buf.writeUInt32LE(seq, 8);
    // 12..15: temp (float LE)
    buf.writeFloatLE(24.5, 12);
    // 16..19: hum (float LE)
    buf.writeFloatLE(68.2, 16);
    // 20..31: ax, ay, az (float LE)
    buf.writeFloatLE(0.1, 20);
    buf.writeFloatLE(0.2, 24);
    buf.writeFloatLE(0.98, 28);
    // 32..43: gx, gy, gz (float LE)
    buf.writeFloatLE(1.5, 32);
    buf.writeFloatLE(2.5, 36);
    buf.writeFloatLE(3.5, 40);
    // 44..47: dist_cm (float LE)
    buf.writeFloatLE(15.4, 44);
    return buf;
  };

  it('should correctly parse 54-byte LoRa binary packet', () => {
    const base = buildBasePayload('NODE_01', 101);
    const payload = Buffer.alloc(54);
    base.copy(payload, 0, 0, 48);
    // 48..49: mq6_raw (int16 LE)
    payload.writeInt16LE(450, 48);
    // 50..51: water_raw (int16 LE)
    payload.writeInt16LE(120, 50);
    // 52..53: pot_raw (int16 LE)
    payload.writeInt16LE(88, 52);

    // Call private handleIncomingMessage via any
    (service as any).handleMessage('sensors/lora/binary', payload);

    const statusEvents = emittedEvents.filter((e) => e.event === 'node.status.received');
    expect(statusEvents.length).toBeGreaterThan(0);
    expect((statusEvents[0].data as ValidatedNodeStatus).status).toBe('online');
    expect((statusEvents[0].data as ValidatedNodeStatus).nodeId).toBe('NODE_01');

    const readingEvents = emittedEvents.filter((e) => e.event === 'sensor.reading.received');
    const readings = readingEvents.map((e) => e.data as ValidatedSensorReading);

    const gasReading = readings.find((r) => r.sensorType === 'gas');
    expect(gasReading?.value).toBe(450);

    const waterReading = readings.find((r) => r.sensorType === 'water');
    expect(waterReading?.value).toBe(120);

    const crackReading = readings.find((r) => r.sensorType === 'crack');
    expect(crackReading?.value).toBe(88);

    const tempReading = readings.find((r) => r.sensorType === 'temperature');
    expect(tempReading?.value).toBe(24.5);
  });

  it('should correctly parse 60-byte LoRa packet with 16-bit ADC and ESP-NOW MAC', () => {
    const base = buildBasePayload('NODE_02', 202);
    const payload = Buffer.alloc(60);
    base.copy(payload, 0, 0, 48);
    // 48..49: mq6_raw (int16 LE)
    payload.writeInt16LE(1250, 48);
    // 50..51: water_raw (int16 LE)
    payload.writeInt16LE(630, 50);
    // 52..53: pot_raw (int16 LE)
    payload.writeInt16LE(240, 52);
    // 54..59: espnow_mac (6 bytes)
    Buffer.from([0x24, 0x0a, 0xc4, 0x11, 0x22, 0x33]).copy(payload, 54);

    (service as any).handleMessage('sensors/lora/binary', payload);

    const statusEvents = emittedEvents.filter((e) => e.event === 'node.status.received');
    expect(statusEvents.length).toBeGreaterThan(0);
    expect((statusEvents[0].data as ValidatedNodeStatus).nodeId).toBe('NODE_02');

    const readings = emittedEvents
      .filter((e) => e.event === 'sensor.reading.received')
      .map((e) => e.data as ValidatedSensorReading);

    const gasReading = readings.find((r) => r.sensorType === 'gas');
    expect(gasReading?.value).toBe(1250);

    const waterReading = readings.find((r) => r.sensorType === 'water');
    expect(waterReading?.value).toBe(630);

    const crackReading = readings.find((r) => r.sensorType === 'crack');
    expect(crackReading?.value).toBe(240);

    const beaconReading = readings.find((r) => r.sensorType === 'miner_proximity');
    expect(beaconReading?.value).toBe(1);
  });

  it('should correctly parse 60-byte LoRa packet with 16-bit ADC + RSSI/SNR metadata', () => {
    const base = buildBasePayload('NODE_03', 303);
    const payload = Buffer.alloc(60);
    base.copy(payload, 0, 0, 48);
    // 48..49: mq6_raw (int16 LE)
    payload.writeInt16LE(512, 48);
    // 50..51: water_raw (int16 LE)
    payload.writeInt16LE(300, 50);
    // 52..53: pot_raw (int16 LE)
    payload.writeInt16LE(75, 52);
    // 54..55: rssi (int16 LE)
    payload.writeInt16LE(-72, 54);
    // 56..59: snr (float LE)
    payload.writeFloatLE(9.5, 56);

    (service as any).handleMessage('sensors/lora/binary', payload);

    const readings = emittedEvents
      .filter((e) => e.event === 'sensor.reading.received')
      .map((e) => e.data as ValidatedSensorReading);

    const gasReading = readings.find((r) => r.sensorType === 'gas');
    expect(gasReading?.value).toBe(512);

    const waterReading = readings.find((r) => r.sensorType === 'water');
    expect(waterReading?.value).toBe(300);

    const crackReading = readings.find((r) => r.sensorType === 'crack');
    expect(crackReading?.value).toBe(75);

    const rssiReading = readings.find((r) => r.sensorType === 'rssi');
    expect(rssiReading?.value).toBe(-72);
    expect(rssiReading?.unit).toBe('dBm');

    const snrReading = readings.find((r) => r.sensorType === 'snr');
    expect(snrReading?.value).toBe(9.5);
    expect(snrReading?.unit).toBe('dB');
  });

  it('should reject binary payload shorter than 54 bytes', () => {
    const shortPayload = Buffer.alloc(30);
    (service as any).handleMessage('sensors/lora/binary', shortPayload);

    expect(emittedEvents.length).toBe(0);
  });

  it('should track multiple nodes running in the same zone concurrently', () => {
    const payloadNode1 = Buffer.alloc(54);
    buildBasePayload('NODE_01', 1).copy(payloadNode1, 0, 0, 48);
    (service as any).handleMessage('sensors/lora/binary', payloadNode1);

    const payloadNode2 = Buffer.alloc(60);
    buildBasePayload('NODE_02', 1).copy(payloadNode2, 0, 0, 48);
    (service as any).handleMessage('sensors/lora/binary', payloadNode2);

    const gwStatus = service.getGatewayStatus();
    expect(gwStatus.activeNodes).toContain('NODE_01');
    expect(gwStatus.activeNodes).toContain('NODE_02');
    expect(gwStatus.totalLoraPackets).toBe(2);
    expect(gwStatus.status).toBe('online');
  });
});
