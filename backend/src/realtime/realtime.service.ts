import { Injectable } from '@nestjs/common';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import type { NodeStatusState } from '../ingestion/node-status.interface.js';
import type { ShadowMlPrediction } from '../ml/ml.interface.js';

export interface GatewayStatusState {
  brokerConnected: boolean;
  loraGatewayConnected: boolean;
  status: 'online' | 'offline' | 'standby';
  lastLoraPacketAt: string | null;
  totalLoraPackets: number;
  gatewayType: string;
  topic: string;
  nodeId?: string;
}

@Injectable()
export class RealtimeService {
  // zoneId -> (nodeId:sensorType -> reading)
  private readonly snapshot = new Map<string, Map<string, ValidatedSensorReading>>();
  
  // zoneId -> (nodeId -> nodeStatus)
  private readonly statusSnapshot = new Map<string, Map<string, NodeStatusState>>();

  // zoneId -> (nodeId -> ShadowMlPrediction) - STRICTLY SEPARATE from sensor telemetry
  private readonly shadowPredictions = new Map<string, Map<string, ShadowMlPrediction>>();

  private currentGatewayStatus: GatewayStatusState = {
    brokerConnected: false,
    loraGatewayConnected: false,
    status: 'standby',
    lastLoraPacketAt: null,
    totalLoraPackets: 0,
    gatewayType: 'ESP32 LoRa Gateway (SX1276)',
    topic: 'sensors/lora/#',
    nodeId: 'NODE_01',
  };

  setGatewayStatus(status: GatewayStatusState) {
    this.currentGatewayStatus = status;
  }

  getGatewayStatus(): GatewayStatusState {
    return this.currentGatewayStatus;
  }
  
  updateSnapshot(reading: ValidatedSensorReading) {
    const { zoneId, nodeId, sensorType } = reading;
    
    if (!this.snapshot.has(zoneId)) {
      this.snapshot.set(zoneId, new Map());
    }
    
    const zoneMap = this.snapshot.get(zoneId)!;
    zoneMap.set(`${nodeId}:${sensorType}`, reading);
  }

  updateNodeStatus(status: NodeStatusState) {
    const { zoneId, nodeId } = status;
    
    if (!this.statusSnapshot.has(zoneId)) {
      this.statusSnapshot.set(zoneId, new Map());
    }
    
    const zoneMap = this.statusSnapshot.get(zoneId)!;
    zoneMap.set(nodeId, status);

    // Retain latest sensor readings and shadow predictions in snapshot
    // so dashboard displays last-known states with offline badge instead of blanking out.
  }

  updateShadowPrediction(prediction: ShadowMlPrediction) {
    const { zoneId, nodeId } = prediction;
    if (!this.shadowPredictions.has(zoneId)) {
      this.shadowPredictions.set(zoneId, new Map());
    }
    this.shadowPredictions.get(zoneId)!.set(nodeId, prediction);
  }

  getSnapshotForZone(zoneId: string): {
    readings: ValidatedSensorReading[];
    statuses: NodeStatusState[];
    mlPredictions: ShadowMlPrediction[];
  } {
    const readingsMap = this.snapshot.get(zoneId);
    const statusesMap = this.statusSnapshot.get(zoneId);
    const predictionsMap = this.shadowPredictions.get(zoneId);

    return {
      readings: readingsMap ? Array.from(readingsMap.values()) : [],
      statuses: statusesMap ? Array.from(statusesMap.values()) : [],
      mlPredictions: predictionsMap ? Array.from(predictionsMap.values()) : [],
    };
  }

  getActiveZones(): string[] {
    const zones = new Set<string>([
      ...this.snapshot.keys(),
      ...this.statusSnapshot.keys(),
      ...this.shadowPredictions.keys(),
    ]);
    return Array.from(zones);
  }
}
