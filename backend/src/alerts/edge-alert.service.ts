import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { IngestionService } from '../ingestion/ingestion.service.js';
import type {
  EdgeAlertLevel,
  EdgeAlertCommand,
  EdgeNodeActuatorState,
} from './alert.interface.js';
import { EDGE_ALERT_CONFIGS } from './alert.interface.js';

@Injectable()
export class EdgeAlertService {
  private readonly logger = new Logger(EdgeAlertService.name);

  /** In-memory map of current physical actuator states per node */
  private readonly nodeActuatorStates = new Map<string, EdgeNodeActuatorState>();

  /** Dispatch history ring buffer */
  private readonly dispatchHistory: EdgeAlertCommand[] = [];
  private readonly MAX_HISTORY = 50;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly ingestionService: IngestionService,
  ) {}

  /**
   * Dispatch an edge alert command to one or more nodes via MQTT Gateway.
   * Publishes QoS 1 downlink to:
   *   - mine/{zoneId}/{nodeId}/alert   (per-node)
   *   - sensors/lora/downlink          (LoRa gateway relay)
   */
  async dispatchEdgeAlert(params: {
    nodeId: string;
    zoneId: string;
    level: EdgeAlertLevel;
    message?: string;
    dispatchedBy?: 'operator' | 'auto-ml' | 'auto-threshold';
    targetType?: 'node' | 'zone';
  }): Promise<EdgeAlertCommand> {
    const config = EDGE_ALERT_CONFIGS[params.level];
    const commandId = `sos-${params.nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const command: EdgeAlertCommand = {
      commandId,
      targetType: params.targetType || 'node',
      nodeId: params.nodeId,
      zoneId: params.zoneId,
      level: params.level,
      color: config.color,
      buzzer: config.buzzer,
      buzzerMode: config.buzzerMode,
      ledPattern: config.ledPattern,
      message: params.message || `${params.level} alert dispatched to ${params.nodeId}`,
      dispatchedBy: params.dispatchedBy || 'operator',
      timestamp: now,
    };

    // Update in-memory actuator state
    const state: EdgeNodeActuatorState = {
      nodeId: params.nodeId,
      zoneId: params.zoneId,
      level: params.level,
      color: config.color,
      buzzer: config.buzzer,
      buzzerMode: config.buzzerMode,
      ledPattern: config.ledPattern,
      lastCommandId: commandId,
      lastUpdatedAt: now,
      acknowledged: false,
    };
    this.nodeActuatorStates.set(params.nodeId, state);

    // Record in history
    this.dispatchHistory.unshift(command);
    if (this.dispatchHistory.length > this.MAX_HISTORY) {
      this.dispatchHistory.pop();
    }

    // Publish MQTT downlink payloads (fire-and-forget with error logging)
    const jsonPayloadFull = JSON.stringify(command);

    // CRITICAL FIX: LoRa SX1278 hardware has a strict 255 byte limit per packet.
    // We must strip verbose string fields (message, timestamp, dispatchedBy, zoneId) 
    // to ensure the payload is well under 255 bytes.
    const loraCommand = {
      commandId: command.commandId,
      targetType: command.targetType,
      nodeId: "ALL", // OVERRIDE: Broadcast this emergency to ALL nodes in the area!
      level: command.level,
      color: command.color,
      buzzerMode: command.buzzerMode,
      ledPattern: command.ledPattern,
    };
    const jsonPayloadLora = JSON.stringify(loraCommand);

    try {
      await this.ingestionService.publishMqtt(`mine/${params.zoneId}/${params.nodeId}/alert`, jsonPayloadFull, 1);
    } catch (err) {
      this.logger.warn(`[EdgeAlert] Failed to publish to mine topic: ${(err as Error).message}`);
    }

    try {
      await this.ingestionService.publishMqtt('sensors/lora/downlink', jsonPayloadLora, 1);
    } catch (err) {
      this.logger.warn(`[EdgeAlert] Failed to publish to lora topic: ${(err as Error).message}`);
    }

    this.logger.warn(
      `[EdgeAlert] 🚨 DISPATCHED: ${params.level} → ${params.nodeId} (${params.zoneId}) | LED: ${config.color} ${config.ledPattern} | Buzzer: ${config.buzzer ? config.buzzerMode : 'OFF'}`,
    );

    // Emit internal event for RealtimeGateway to broadcast over WebSocket
    this.eventEmitter.emit('edge.alert.dispatched', { command, state });

    return command;
  }

  /**
   * Handle ACK from edge node confirming command receipt
   */
  @OnEvent('edge.alert.acknowledged')
  handleAlertAck(ack: { nodeId?: string; commandId?: string; zoneId?: string }) {
    if (!ack.nodeId) return;

    const existing = this.nodeActuatorStates.get(ack.nodeId);
    if (existing && (!ack.commandId || existing.lastCommandId === ack.commandId)) {
      existing.acknowledged = true;
      existing.lastUpdatedAt = new Date().toISOString();
      this.nodeActuatorStates.set(ack.nodeId, existing);

      this.logger.log(
        `[EdgeAlert] ✅ ACK received from ${ack.nodeId} for command ${ack.commandId || existing.lastCommandId}`,
      );

      this.eventEmitter.emit('edge.alert.ack.confirmed', existing);
    }
  }

  /**
   * Returns current actuator state for all tracked nodes
   */
  getNodeActuatorStates(): Record<string, EdgeNodeActuatorState> {
    const result: Record<string, EdgeNodeActuatorState> = {};
    for (const [nodeId, state] of this.nodeActuatorStates) {
      result[nodeId] = { ...state };
    }
    return result;
  }

  /**
   * Returns dispatch history
   */
  getDispatchHistory(): EdgeAlertCommand[] {
    return [...this.dispatchHistory];
  }
}
