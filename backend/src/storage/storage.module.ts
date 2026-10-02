import { Module } from '@nestjs/common';
import { STORAGE_ADAPTER } from './storage.interface.js';
import { InfluxDbStorageService } from './influxdb-storage.service.js';

@Module({
  imports: [],
  controllers: [],
  providers: [
    InfluxDbStorageService,
    {
      provide: STORAGE_ADAPTER,
      useExisting: InfluxDbStorageService,
    }
  ],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
