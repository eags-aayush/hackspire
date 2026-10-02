export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertRule {
  id: string;
  name: string;
  sensorType: string;
  operator: '>' | '<' | '==' | '>=' | '<=';
  threshold: number;
  unit: string;
  severity: AlertSeverity;
  description: string;
}

export interface SubsidenceAlert {
  id: string;
  nodeId: string;
  zoneId: string;
  sensorType: string;
  value: number;
  threshold: number;
  unit: string;
  severity: AlertSeverity;
  timestamp: string;
  message: string;
  resolved?: boolean;
}

// ─── Edge Alert Downlink Types (Dashboard → Gateway → Edge Node) ────

export type EdgeAlertLevel = 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NORMAL';
export type EdgeAlertColor = 'red' | 'yellow' | 'blue' | 'green';
export type EdgeBuzzerMode = 'siren' | 'beep' | 'chirp' | 'off';
export type EdgeLedPattern = 'strobe' | 'pulse' | 'solid' | 'heartbeat';

/** Maps each alert level to its physical actuator configuration */
export const EDGE_ALERT_CONFIGS: Record<
  EdgeAlertLevel,
  { color: EdgeAlertColor; buzzer: boolean; buzzerMode: EdgeBuzzerMode; ledPattern: EdgeLedPattern }
> = {
  CRITICAL: { color: 'red', buzzer: true, buzzerMode: 'siren', ledPattern: 'strobe' },
  WARNING:  { color: 'yellow', buzzer: true, buzzerMode: 'beep', ledPattern: 'pulse' },
  ADVISORY: { color: 'blue', buzzer: true, buzzerMode: 'chirp', ledPattern: 'solid' },
  NORMAL:   { color: 'green', buzzer: false, buzzerMode: 'off', ledPattern: 'heartbeat' },
};

/** Command dispatched from Dashboard to Edge Node via MQTT Gateway */
export interface EdgeAlertCommand {
  commandId: string;
  /** 'node' targets a single node, 'zone' targets all nodes in a zone */
  targetType: 'node' | 'zone';
  nodeId: string;
  zoneId: string;
  level: EdgeAlertLevel;
  color: EdgeAlertColor;
  buzzer: boolean;
  buzzerMode: EdgeBuzzerMode;
  ledPattern: EdgeLedPattern;
  message: string;
  dispatchedBy: 'operator' | 'auto-ml' | 'auto-threshold';
  timestamp: string;
}

/** Tracks the physical actuator state of a given edge node */
export interface EdgeNodeActuatorState {
  nodeId: string;
  zoneId: string;
  level: EdgeAlertLevel;
  color: EdgeAlertColor;
  buzzer: boolean;
  buzzerMode: EdgeBuzzerMode;
  ledPattern: EdgeLedPattern;
  lastCommandId: string;
  lastUpdatedAt: string;
  acknowledged: boolean;
}
