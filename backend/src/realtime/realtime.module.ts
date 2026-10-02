import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeService } from './realtime.service.js';
import { AlertsModule } from '../alerts/alerts.module.js';

@Module({
  imports: [AlertsModule],
  controllers: [],
  providers: [RealtimeGateway, RealtimeService],
  exports: [],
})
export class RealtimeModule {}
