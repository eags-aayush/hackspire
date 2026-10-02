import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service.js';

@Module({
  imports: [],
  controllers: [],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
