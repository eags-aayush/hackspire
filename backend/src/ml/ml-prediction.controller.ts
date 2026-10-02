import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  MlPredictionStoreService,
  type QueryPredictionsOptions,
} from './ml-prediction-store.service.js';

@Controller('ml/predictions')
export class MlPredictionController {
  constructor(private readonly storeService: MlPredictionStoreService) {}

  @Get('stats')
  getStats() {
    return this.storeService.getStoreStats();
  }

  @Get()
  getPredictions(
    @Query('nodeId') nodeId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('predictedClass') predictedClass?: string,
    @Query('confirmedOnly') confirmedOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includeWindow') includeWindow?: string,
  ) {
    const options: QueryPredictionsOptions = {
      nodeId,
      zoneId,
      startDate,
      endDate,
      predictedClass,
      confirmedOnly: confirmedOnly === 'true',
      limit: limit ? Math.min(Math.max(parseInt(limit, 10) || 100, 1), 5000) : 100,
      offset: offset ? Math.max(parseInt(offset, 10) || 0, 0) : 0,
      includeWindow: includeWindow !== 'false',
    };

    const records = this.storeService.getPredictions(options);
    const total = this.storeService.countPredictions(nodeId);

    return {
      total,
      count: records.length,
      limit: options.limit,
      offset: options.offset,
      records,
    };
  }

  @Get('export')
  exportPredictions(
    @Query('nodeId') nodeId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format = 'json',
    @Res() res?: Response,
  ) {
    const options: QueryPredictionsOptions = {
      nodeId,
      zoneId,
      startDate,
      endDate,
      limit: 10000,
      offset: 0,
      includeWindow: true,
    };

    const records = this.storeService.getPredictions(options);

    if (format.toLowerCase() === 'csv') {
      if (!res) throw new HttpException('Response object unavailable', HttpStatus.INTERNAL_SERVER_ERROR);

      const headers = [
        'prediction_id',
        'node_id',
        'zone_id',
        'timestamp',
        'predicted_class',
        'severity',
        'alert_level',
        'model_version',
        'inference_latency_ms',
        'confirmed_label',
        'input_window',
      ];

      const csvRows = [headers.join(',')];

      for (const r of records) {
        // Escape JSON input_window string for CSV embedding
        const escapedWindow = `"${r.input_window.replace(/"/g, '""')}"`;
        const row = [
          r.prediction_id,
          r.node_id,
          r.zone_id,
          r.timestamp,
          r.predicted_class,
          r.severity,
          r.alert_level,
          r.model_version,
          r.inference_latency_ms,
          r.confirmed_label ?? '',
          escapedWindow,
        ];
        csvRows.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=predictions_${nodeId || 'all'}_export.csv`);
      return res.status(200).send(csvRows.join('\n'));
    }

    // Default JSON
    if (res) {
      return res.status(200).json({
        count: records.length,
        exportedAt: new Date().toISOString(),
        records,
      });
    }

    return {
      count: records.length,
      exportedAt: new Date().toISOString(),
      records,
    };
  }

  @Patch(':predictionId/confirm')
  confirmLabel(
    @Param('predictionId') predictionId: string,
    @Body() body: { confirmed_label: string },
  ) {
    if (!body || !body.confirmed_label) {
      throw new HttpException('confirmed_label is required', HttpStatus.BAD_REQUEST);
    }

    const updated = this.storeService.setConfirmedLabel(predictionId, body.confirmed_label);
    if (!updated) {
      throw new HttpException('Prediction record not found or update failed', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      predictionId,
      confirmed_label: body.confirmed_label,
      updatedAt: new Date().toISOString(),
    };
  }
}
