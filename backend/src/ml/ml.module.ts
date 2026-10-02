import { Module } from '@nestjs/common';
import { MlWindowBufferService } from './ml-window-buffer.service.js';
import { MlInferenceService } from './ml-inference.service.js';
import { MlPredictionStoreService } from './ml-prediction-store.service.js';
import { MlPredictionController } from './ml-prediction.controller.js';

@Module({
  controllers: [MlPredictionController],
  providers: [MlWindowBufferService, MlInferenceService, MlPredictionStoreService],
  exports: [MlWindowBufferService, MlInferenceService, MlPredictionStoreService],
})
export class MlModule {}

