import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { io, Socket } from 'socket.io-client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { decodeSensorReadingBatch, decodeZoneSnapshot, decodeNodeStatusBatch } from '../src/realtime/telemetry.proto.js';
import type { ValidatedSensorReading } from '../src/ingestion/sensor-reading.interface.js';
import type { NodeStatusState } from '../src/ingestion/node-status.interface.js';

describe('Realtime Protobuf Gateway E2E', () => {
  let app: INestApplication;
  let eventEmitter: EventEmitter2;
  let clientSocket: Socket;
  let port: number;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const address = app.getHttpServer().address();
    port = typeof address === 'string' ? 3000 : address.port;
    eventEmitter = app.get(EventEmitter2);
  });

  afterEach(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    await app.close();
  });

  it('should deliver binary snapshot:proto upon joining a zone', async () => {
    const testReading: ValidatedSensorReading = {
      nodeId: 'NODE_E2E_1',
      zoneId: 'ZONE_E2E',
      sensorType: 'tilt',
      value: 8.92,
      unit: 'degrees',
      timestamp: new Date().toISOString(),
      sequenceNumber: 50,
      receivedAt: new Date().toISOString(),
    };

    // Pre-populate service state via event
    eventEmitter.emit('sensor.reading.deduped', testReading);

    clientSocket = io(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      clientSocket.on('connect', () => {
        clientSocket.emit('join_zone', { zoneId: 'ZONE_E2E' });
      });

      clientSocket.on('snapshot:proto', (binaryData: any) => {
        try {
          const decoded = decodeZoneSnapshot(new Uint8Array(binaryData));
          expect(decoded.zoneId).toBe('ZONE_E2E');
          expect(decoded.readings.length).toBeGreaterThanOrEqual(1);
          const found = decoded.readings.find(r => r.nodeId === 'NODE_E2E_1');
          expect(found).toBeDefined();
          expect(found?.value).toBe(8.92);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      setTimeout(() => reject(new Error('Timeout waiting for snapshot:proto')), 3000);
    });
  });

  it('should broadcast binary readings:proto when readings are emitted', async () => {
    clientSocket = io(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      clientSocket.on('connect', () => {
        clientSocket.emit('join_zone', { zoneId: 'ZONE_E2E_STREAM' });

        // Emit reading after joining
        setTimeout(() => {
          const reading: ValidatedSensorReading = {
            nodeId: 'NODE_STREAM_1',
            zoneId: 'ZONE_E2E_STREAM',
            sensorType: 'vibration',
            value: 4.15,
            unit: 'mm/s',
            timestamp: new Date().toISOString(),
            sequenceNumber: 101,
            receivedAt: new Date().toISOString(),
          };
          eventEmitter.emit('sensor.reading.deduped', reading);
        }, 100);
      });

      clientSocket.on('readings:proto', (binaryData: any) => {
        try {
          const decoded = decodeSensorReadingBatch(new Uint8Array(binaryData));
          expect(decoded.zoneId).toBe('ZONE_E2E_STREAM');
          expect(decoded.readings.length).toBeGreaterThanOrEqual(1);
          expect(decoded.readings[0].nodeId).toBe('NODE_STREAM_1');
          expect(decoded.readings[0].value).toBe(4.15);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      setTimeout(() => reject(new Error('Timeout waiting for readings:proto')), 3000);
    });
  });
});
