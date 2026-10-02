import { Module } from '@nestjs/common';
import { ProcessingService } from './processing.service.js';
import { MovingAverageFilterService } from './moving-average-filter.service.js';
import { MlModule } from '../ml/ml.module.js';

@Module({
  imports: [MlModule],
  controllers: [],
  providers: [ProcessingService, MovingAverageFilterService],
  exports: [ProcessingService, MovingAverageFilterService],
})
export class ProcessingModule {}
