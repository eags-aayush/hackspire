import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';
import { ConfigService } from '@nestjs/config';
import type { StorageAdapter } from './storage.interface.js';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';

@Injectable()
export class InfluxDbStorageService implements StorageAdapter, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InfluxDbStorageService.name);
  
  private influxDB: InfluxDB;
  private writeApi: WriteApi;
  private readingsCount = 0;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('INFLUXDB_URL');
    const token = this.configService.get<string>('INFLUXDB_TOKEN');
    const org = this.configService.get<string>('INFLUXDB_ORG');
    const bucket = this.configService.get<string>('INFLUXDB_BUCKET');

    if (!url || !token || !org || !bucket) {
      this.logger.error('InfluxDB configuration missing in environment variables');
      return;
    }

    this.influxDB = new InfluxDB({ url, token });
    this.writeApi = this.influxDB.getWriteApi(org, bucket, 'ns');
    this.logger.log(`[storage] Connected to InfluxDB at ${url}`);
  }

  // Listen to the deduped event from ProcessingModule
  @OnEvent('sensor.reading.deduped')
  handleDedupedReading(reading: ValidatedSensorReading) {
    this.saveReading(reading).catch(err => {
      this.logger.error(`Failed to save reading: ${err.message}`);
    });
  }

  async saveReading(reading: ValidatedSensorReading): Promise<void> {
    if (!this.writeApi) return;

    const point = new Point('sensor_reading')
      .tag('nodeId', reading.nodeId)
      .tag('zoneId', reading.zoneId)
      .tag('sensorType', reading.sensorType)
      .tag('unit', reading.unit)
      .floatField('value', reading.value)
      .intField('sequenceNumber', reading.sequenceNumber)
      .timestamp(new Date(reading.timestamp));

    try {
      this.writeApi.writePoint(point);
      this.readingsCount++;

      if (this.readingsCount % 50 === 0) {
        this.logger.log(`[storage] Currently storing ${this.readingsCount} readings total to InfluxDB.`);
      }
    } catch (error) {
      this.logger.error(`Error writing to InfluxDB: ${error}`);
    }
  }

  async getTotalReadingsCount(): Promise<number> {
    return this.readingsCount;
  }

  async onModuleDestroy() {
    this.logger.log(`\n=== FINAL STORAGE COUNT: ${this.readingsCount} readings ===\n`);
    if (this.writeApi) {
      try {
        await this.writeApi.close();
      } catch (error) {
        this.logger.error(`Error closing InfluxDB write API: ${error}`);
      }
    }
  }
}
