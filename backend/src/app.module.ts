import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { IngestionModule } from './ingestion/ingestion.module.js';
import { ProcessingModule } from './processing/processing.module.js';
import { StorageModule } from './storage/storage.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { MlModule } from './ml/ml.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    EventEmitterModule.forRoot(),
    IngestionModule,
    ProcessingModule,
    StorageModule,
    RealtimeModule,
    AlertsModule,
    MlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
