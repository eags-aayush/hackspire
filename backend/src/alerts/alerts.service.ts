import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import type { NodeStatusState } from '../ingestion/node-status.interface.js';
import type { ShadowMlPrediction } from '../ml/ml.interface.js';
import type { SubsidenceAlert, AlertSeverity, AlertRule } from './alert.interface.js';

export const THRESHOLD_RULES: AlertRule[] = [
  {
    id: 'rule-tilt-crit',
    name: 'Severe Subsidence Tilt',
    sensorType: 'tilt',
    operator: '>=',
    threshold: 10.0,
    unit: '°',
    severity: 'critical',
    description: 'Biaxial tilt exceeds critical structural safety limit (10.0°)',
  },
  {
    id: 'rule-tilt-warn',
    name: 'Elevated Strata Tilt',
    sensorType: 'tilt',
    operator: '>=',
    threshold: 5.0,
    unit: '°',
    severity: 'warning',
    description: 'Ground slope displacement elevated above baseline (5.0°)',
  },
  {
    id: 'rule-vibe-crit',
    name: 'Extreme Strata Tremor',
    sensorType: 'vibration',
    operator: '>=',
    threshold: 10.0,
    unit: 'g',
    severity: 'critical',
    description: 'Ground peak particle acceleration exceeded emergency threshold (10.0 g)',
  },
  {
    id: 'rule-vibe-warn',
    name: 'Elevated Seismic Vibration',
    sensorType: 'vibration',
    operator: '>=',
    threshold: 5.0,
    unit: 'g',
    severity: 'warning',
    description: 'Ground vibration elevated above baseline (5.0 g)',
  },
  {
    id: 'rule-dist-crit',
    name: 'Roof Sag Critical',
    sensorType: 'displacement',
    operator: '>=',
    threshold: 35.0,
    unit: 'cm',
    severity: 'critical',
    description: 'Ultrasonic roof displacement reached critical threshold (35 cm)',
  },
  {
    id: 'rule-dist-warn',
    name: 'Roof Sag Warning',
    sensorType: 'displacement',
    operator: '>=',
    threshold: 25.0,
    unit: 'cm',
    severity: 'warning',
    description: 'Ultrasonic roof displacement elevated (25 cm)',
  },
  {
    id: 'rule-water-crit',
    name: 'Piezometer In-Rush Flood Hazard',
    sensorType: 'water',
    operator: '>=',
    threshold: 2000,
    unit: 'raw',
    severity: 'critical',
    description: 'Water level reached critical threshold (2000 raw)',
  },
  {
    id: 'rule-water-warn',
    name: 'Rising Water Table',
    sensorType: 'water',
    operator: '>=',
    threshold: 1000,
    unit: 'raw',
    severity: 'warning',
    description: 'Water level reached warning threshold (1000 raw)',
  },
  {
    id: 'rule-temp-crit',
    name: 'Critical Temperature',
    sensorType: 'temperature',
    operator: '>=',
    threshold: 33.0,
    unit: '°C',
    severity: 'critical',
    description: 'Temperature reached critical limit (33°C)',
  },
  {
    id: 'rule-temp-warn',
    name: 'Elevated Temperature',
    sensorType: 'temperature',
    operator: '>=',
    threshold: 32.5,
    unit: '°C',
    severity: 'warning',
    description: 'Temperature reached warning limit (32.5°C)',
  },
  {
    id: 'rule-hum-crit',
    name: 'Low Humidity Critical',
    sensorType: 'humidity',
    operator: '<=',
    threshold: 70.0,
    unit: '%',
    severity: 'critical',
    description: 'Humidity dropped to critical level (70%)',
  },
  {
    id: 'rule-hum-warn',
    name: 'Low Humidity Warning',
    sensorType: 'humidity',
    operator: '<=',
    threshold: 75.0,
    unit: '%',
    severity: 'warning',
    description: 'Humidity dropped to warning level (75%)',
  },
  {
    id: 'rule-gas-crit',
    name: 'Critical Gas Hazard',
    sensorType: 'gas',
    operator: '>=',
    threshold: 500,
    unit: 'raw',
    severity: 'critical',
    description: 'Gas level reached critical threshold (500 raw)',
  },
  {
    id: 'rule-gas-warn',
    name: 'Hazardous Gas Accumulation',
    sensorType: 'gas',
    operator: '>=',
    threshold: 375,
    unit: 'raw',
    severity: 'warning',
    description: 'Gas level elevated above safe baseline (375 raw)',
  },
  {
    id: 'rule-pot-crit',
    name: 'Severe Fissure Opening',
    sensorType: 'potentiometer',
    operator: '>=',
    threshold: 1000,
    unit: 'raw',
    severity: 'critical',
    description: 'Potentiometer crack opening exceeded danger limit (1000 raw)',
  },
  {
    id: 'rule-pot-warn',
    name: 'Fissure Opening Warning',
    sensorType: 'potentiometer',
    operator: '>=',
    threshold: 300,
    unit: 'raw',
    severity: 'warning',
    description: 'Potentiometer displacement reached warning limit (300 raw)',
  },
  {
    id: 'rule-miner-proximity',
    name: 'Personnel Hazard Zone Proximity',
    sensorType: 'miner_proximity',
    operator: '>=',
    threshold: 1,
    unit: 'beacon',
    severity: 'critical',
    description: 'ESP-NOW beacon detected active miner personnel near hazard sensor node',
  },
];

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  // In-memory ring buffer of recent alerts
  private readonly alerts: SubsidenceAlert[] = [];
  private readonly MAX_ALERTS = 100;

  // Debounce map: `nodeId:ruleId` -> lastTriggeredTimestampMs (prevents alert storm on 5s loop)
  private readonly alertCooldowns = new Map<string, number>();
  private readonly COOLDOWN_MS = 25_000; // 25s cooldown between identical alerts per node

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent('node.status.changed')
  handleNodeStatusChanged(status: NodeStatusState) {
    if (status.status === 'offline') {
      const cooldownKey = `${status.nodeId}:node-offline`;
      const now = Date.now();
      const last = this.alertCooldowns.get(cooldownKey) || 0;
      if (now - last < this.COOLDOWN_MS) return;
      this.alertCooldowns.set(cooldownKey, now);

      const alert: SubsidenceAlert = {
        id: `offline-${status.nodeId}-${now}`,
        nodeId: status.nodeId,
        zoneId: status.zoneId,
        sensorType: 'tilt',
        value: 0,
        threshold: 0,
        unit: '',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        message: `Node ${status.nodeId} communication lost (>30s without LoRa packet)`,
      };

      this.recordAndEmitAlert(alert);
    }
  }

  @OnEvent('sensor.reading.deduped')
  handleDedupedReading(reading: ValidatedSensorReading) {
    const { nodeId, zoneId, sensorType, value, unit, sequenceNumber, timestamp } = reading;

    for (const rule of THRESHOLD_RULES) {
      if (rule.sensorType.toLowerCase() !== sensorType.toLowerCase()) continue;

      let triggered = false;
      const compareVal = (rule.sensorType === 'tilt' || rule.sensorType === 'tilt_x_deg' || rule.sensorType === 'tilt_y_deg')
        ? Math.abs(value >= 40 ? value - 80 : value)
        : value;
      if (rule.operator === '>=' && compareVal >= rule.threshold) triggered = true;
      else if (rule.operator === '>' && compareVal > rule.threshold) triggered = true;
      else if (rule.operator === '<=' && compareVal <= rule.threshold) triggered = true;
      else if (rule.operator === '<' && compareVal < rule.threshold) triggered = true;
      else if (rule.operator === '==' && compareVal === rule.threshold) triggered = true;

      if (triggered) {
        const cooldownKey = `${nodeId}:${rule.id}`;
        const now = Date.now();
        const last = this.alertCooldowns.get(cooldownKey) || 0;
        if (now - last < this.COOLDOWN_MS) continue;
        this.alertCooldowns.set(cooldownKey, now);

        const alert: SubsidenceAlert = {
          id: `hw-${nodeId}-${sensorType}-${sequenceNumber}-${now}`,
          nodeId,
          zoneId,
          sensorType,
          value,
          threshold: rule.threshold,
          unit,
          severity: rule.severity,
          timestamp: timestamp || new Date().toISOString(),
          message: `${rule.severity.toUpperCase()}: ${rule.name} on ${nodeId} (${value} ${unit} >= ${rule.threshold} ${rule.unit})`,
        };

        this.recordAndEmitAlert(alert);
        // Break after matching highest severity rule for this channel
        if (rule.severity === 'critical') break;
      }
    }
  }

  @OnEvent('ml.prediction.generated')
  handleMlPrediction(prediction: ShadowMlPrediction) {
    const isRisk =
      prediction.anomaly_class === 'subsidence_risk' ||
      prediction.alert_level === 'RED' ||
      prediction.alert_level === 'ORANGE';

    if (isRisk) {
      const cooldownKey = `${prediction.nodeId}:ml-subsidence-risk`;
      const now = Date.now();
      const last = this.alertCooldowns.get(cooldownKey) || 0;
      if (now - last < this.COOLDOWN_MS) return;
      this.alertCooldowns.set(cooldownKey, now);

      const isCritical = prediction.alert_level === 'RED' || prediction.severity >= 0.6;
      const confidencePct = Math.round(
        (prediction.class_probs?.[prediction.anomaly_class] || 0) * 100,
      );
      const severityPct = Math.round(prediction.severity * 100);

      const alert: SubsidenceAlert = {
        id: prediction.predictionId || `ml-risk-${prediction.nodeId}-${now}`,
        nodeId: prediction.nodeId,
        zoneId: prediction.zoneId,
        sensorType: 'tilt',
        value: prediction.severity,
        threshold: 0.2,
        unit: 'severity',
        severity: isCritical ? 'critical' : 'warning',
        timestamp: prediction.timestamp || new Date().toISOString(),
        message: `[AI/ML Early Warning] ${
          prediction.anomaly_class === 'subsidence_risk'
            ? 'Imminent Strata Subsidence Precursor'
            : 'Heavy Machinery Cutting Vibration'
        } on ${prediction.nodeId} (${confidencePct}% confidence, severity: ${severityPct}%)`,
      };

      this.recordAndEmitAlert(alert);
    }
  }

  private recordAndEmitAlert(alert: SubsidenceAlert): void {
    this.alerts.unshift(alert);
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts.pop();
    }

    this.logger.warn(`[AlertsService] ${alert.message}`);
    this.eventEmitter.emit('alert.triggered', alert);
  }

  getActiveAlerts(): SubsidenceAlert[] {
    return [...this.alerts];
  }

  resolveAlert(id: string): boolean {
    const found = this.alerts.find((a) => a.id === id);
    if (found) {
      found.resolved = true;
      this.eventEmitter.emit('alert.resolved', found);
      return true;
    }
    return false;
  }
}
