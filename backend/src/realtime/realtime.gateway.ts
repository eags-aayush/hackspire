import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RealtimeService } from './realtime.service.js';
import { EdgeAlertService } from '../alerts/edge-alert.service.js';
import { OnEvent } from '@nestjs/event-emitter';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import type { NodeStatusState } from '../ingestion/node-status.interface.js';
import type { ShadowMlPrediction } from '../ml/ml.interface.js';
import type { EdgeAlertLevel, EdgeAlertCommand, EdgeNodeActuatorState } from '../alerts/alert.interface.js';
import { Subject, bufferTime, filter } from 'rxjs';
import {
  encodeSensorReadingBatch,
  encodeNodeStatusBatch,
  encodeZoneSnapshot,
} from './telemetry.proto.js';

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly updateSubject = new Subject<ValidatedSensorReading>();
  private readonly statusSubject = new Subject<NodeStatusState>();

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly edgeAlertService: EdgeAlertService,
  ) {
    this.updateSubject
      .pipe(
        bufferTime(250),
        filter(updates => updates.length > 0)
      )
      .subscribe(updates => this.flushUpdates(updates));
      
    this.statusSubject
      .pipe(
        bufferTime(250),
        filter(updates => updates.length > 0)
      )
      .subscribe(updates => this.flushStatusUpdates(updates));
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('gateway:status', this.realtimeService.getGatewayStatus());
    // Send current edge actuator states to newly connected clients
    client.emit('edge_alert:state_batch', this.edgeAlertService.getNodeActuatorStates());
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('get_gateway_status')
  handleGetGatewayStatus(@ConnectedSocket() client: Socket) {
    client.emit('gateway:status', this.realtimeService.getGatewayStatus());
  }

  @SubscribeMessage('get_zones')
  handleGetZones(@ConnectedSocket() client: Socket) {
    const zones = this.realtimeService.getActiveZones();
    client.emit('active_zones', zones);
    client.emit('gateway:status', this.realtimeService.getGatewayStatus());
  }

  @SubscribeMessage('join_zone')
  handleJoinZone(@MessageBody() data: { zoneId: string }, @ConnectedSocket() client: Socket) {
    const { zoneId } = data;
    if (!zoneId) return;

    client.join(`zone:${zoneId}`);
    this.logger.log(`Client ${client.id} joined zone:${zoneId}`);

    // Send full snapshot for this zone (Protobuf binary primary, JSON fallback)
    const snapshot = this.realtimeService.getSnapshotForZone(zoneId);
    try {
      const protoSnapshot = encodeZoneSnapshot(zoneId, snapshot);
      client.emit('snapshot:proto', protoSnapshot);
    } catch (err) {
      this.logger.error(`Failed to encode Protobuf snapshot for zone ${zoneId}:`, err);
    }
    client.emit('snapshot', snapshot);
  }

  // ─── Edge Alert Socket.IO Handlers ────

  /**
   * Dashboard operator dispatches an SOS alert to edge node(s) via WebSocket.
   */
  @SubscribeMessage('dispatch_edge_alert')
  async handleDispatchEdgeAlert(
    @MessageBody() data: {
      nodeId: string;
      zoneId: string;
      level: EdgeAlertLevel;
      message?: string;
      targetType?: 'node' | 'zone';
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `[WS] Client ${client.id} dispatching edge alert: ${data.level} → ${data.nodeId} (${data.zoneId})`,
    );

    try {
      const command = await this.edgeAlertService.dispatchEdgeAlert({
        ...data,
        dispatchedBy: 'operator',
      });
      client.emit('edge_alert:dispatch_result', { success: true, command });
    } catch (err) {
      client.emit('edge_alert:dispatch_result', {
        success: false,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Dashboard requests current actuator states for all nodes.
   */
  @SubscribeMessage('get_edge_actuator_states')
  handleGetEdgeStates(@ConnectedSocket() client: Socket) {
    client.emit('edge_alert:state_batch', this.edgeAlertService.getNodeActuatorStates());
  }

  // ─── Internal Event Handlers ────

  @OnEvent('gateway.status.changed')
  handleGatewayStatusChanged(status: any) {
    this.realtimeService.setGatewayStatus(status);
    this.server?.emit('gateway:status', status);
  }

  @OnEvent('node.status.changed')
  handleNodeStatusChanged(status: NodeStatusState) {
    this.realtimeService.updateNodeStatus(status);
    this.statusSubject.next(status);
  }

  @OnEvent('sensor.reading.deduped')
  handleDedupedReading(reading: ValidatedSensorReading) {
    // Let service update its internal state
    this.realtimeService.updateSnapshot(reading);
    
    // Add to buffer
    this.updateSubject.next(reading);
  }

  @OnEvent('ml.prediction.generated')
  handleMlPrediction(prediction: ShadowMlPrediction) {
    // 1. Update internal shadow snapshot
    this.realtimeService.updateShadowPrediction(prediction);

    // 2. Broadcast on dedicated shadow prediction channel — to zone room and global dashboard
    this.server?.to(`zone:${prediction.zoneId}`).emit('ml:prediction', prediction);
    this.server?.emit('ml:prediction', prediction);
    this.logger.debug(
      `[RealtimeGateway] Broadcasted ML prediction for node=${prediction.nodeId} class=${prediction.anomaly_class} latency=${prediction.inferenceLatencyMs}ms (Shadow Mode)`,
    );
  }

  /**
   * When EdgeAlertService dispatches a command, broadcast to all connected dashboard clients.
   */
  @OnEvent('edge.alert.dispatched')
  handleEdgeAlertDispatched(data: { command: EdgeAlertCommand; state: EdgeNodeActuatorState }) {
    this.server?.to(`zone:${data.command.zoneId}`).emit('edge_alert:update', data);
    this.server?.emit('edge_alert:update', data);
    this.logger.log(
      `[WS] Broadcasted edge_alert:update → ${data.command.nodeId} level=${data.command.level}`,
    );
  }

  /**
   * When an edge node ACK is confirmed, broadcast the updated actuator state.
   */
  @OnEvent('edge.alert.ack.confirmed')
  handleEdgeAlertAck(state: EdgeNodeActuatorState) {
    this.server?.to(`zone:${state.zoneId}`).emit('edge_alert:ack', state);
    this.server?.emit('edge_alert:ack', state);
    this.logger.log(
      `[WS] Broadcasted edge_alert:ack → ${state.nodeId} (acknowledged)`,
    );
  }

  private flushUpdates(updates: ValidatedSensorReading[]) {
    // Group updates by zone to broadcast efficiently
    const updatesByZone = new Map<string, ValidatedSensorReading[]>();
    
    for (const update of updates) {
      if (!updatesByZone.has(update.zoneId)) {
        updatesByZone.set(update.zoneId, []);
      }
      updatesByZone.get(update.zoneId)!.push(update);
    }

    for (const [zoneId, zoneUpdates] of updatesByZone.entries()) {
      // 1. Broadcast coalesced readings via binary Protobuf (Ultra-low bandwidth)
      try {
        const protoBuffer = encodeSensorReadingBatch(zoneId, zoneUpdates);
        this.server.to(`zone:${zoneId}`).emit('readings:proto', protoBuffer);
      } catch (err) {
        this.logger.error(`Failed to encode Protobuf readings for zone ${zoneId}:`, err);
      }

      // 2. Broadcast legacy JSON readings as fallback
      this.server.to(`zone:${zoneId}`).emit('readings', zoneUpdates);
    }
  }

  private flushStatusUpdates(updates: NodeStatusState[]) {
    const updatesByZone = new Map<string, NodeStatusState[]>();
    
    for (const update of updates) {
      if (!updatesByZone.has(update.zoneId)) {
        updatesByZone.set(update.zoneId, []);
      }
      updatesByZone.get(update.zoneId)!.push(update);
    }

    for (const [zoneId, zoneUpdates] of updatesByZone.entries()) {
      // 1. Broadcast coalesced status updates via binary Protobuf
      try {
        const protoBuffer = encodeNodeStatusBatch(zoneId, zoneUpdates);
        this.server.to(`zone:${zoneId}`).emit('nodeStatuses:proto', protoBuffer);
      } catch (err) {
        this.logger.error(`Failed to encode Protobuf nodeStatuses for zone ${zoneId}:`, err);
      }

      // 2. Broadcast legacy JSON statuses as fallback
      this.server.to(`zone:${zoneId}`).emit('nodeStatuses', zoneUpdates);
    }
  }
}

