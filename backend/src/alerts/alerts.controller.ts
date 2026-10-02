import { Controller, Post, Get, Body, Logger, HttpCode } from '@nestjs/common';
import { EdgeAlertService } from './edge-alert.service.js';
import { AlertsService } from './alerts.service.js';
import type { EdgeAlertLevel } from './alert.interface.js';

@Controller('api/alerts')
export class AlertsController {
  private readonly logger = new Logger(AlertsController.name);

  constructor(
    private readonly edgeAlertService: EdgeAlertService,
    private readonly alertsService: AlertsService,
  ) {}

  /**
   * POST /api/alerts/dispatch-edge
   * Dispatches an edge alert command to a specific node or zone.
   */
  @Post('dispatch-edge')
  @HttpCode(200)
  async dispatchEdgeAlert(
    @Body()
    body: {
      nodeId: string;
      zoneId: string;
      level: EdgeAlertLevel;
      message?: string;
      dispatchedBy?: 'operator' | 'auto-ml' | 'auto-threshold';
      targetType?: 'node' | 'zone';
    },
  ) {
    this.logger.log(
      `[REST] Dispatch edge alert: ${body.level} → ${body.nodeId} (${body.zoneId})`,
    );

    const command = await this.edgeAlertService.dispatchEdgeAlert(body);
    return { success: true, command };
  }

  /**
   * GET /api/alerts/edge-states
   * Returns current actuator states of all tracked edge nodes.
   */
  @Get('edge-states')
  getEdgeActuatorStates() {
    return this.edgeAlertService.getNodeActuatorStates();
  }

  /**
   * GET /api/alerts/active
   * Returns all active subsidence alerts (threshold + ML).
   */
  @Get('active')
  getActiveAlerts() {
    return this.alertsService.getActiveAlerts();
  }

  /**
   * GET /api/alerts/dispatch-history
   * Returns recent edge alert dispatch history.
   */
  @Get('dispatch-history')
  getDispatchHistory() {
    return this.edgeAlertService.getDispatchHistory();
  }
}
