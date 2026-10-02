import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service.js';
import { EdgeAlertService } from './edge-alert.service.js';
import { AlertsController } from './alerts.controller.js';
import { IngestionModule } from '../ingestion/ingestion.module.js';

@Module({
  imports: [IngestionModule],
  controllers: [AlertsController],
  providers: [AlertsService, EdgeAlertService],
  exports: [EdgeAlertService],
})
export class AlertsModule {}
