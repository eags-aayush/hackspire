// ─── Edge Alert Types (mirrors backend alert.interface.ts) ────

export type EdgeAlertLevel = 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NORMAL';
export type EdgeAlertColor = 'red' | 'yellow' | 'blue' | 'green';
export type EdgeBuzzerMode = 'siren' | 'beep' | 'chirp' | 'off';
export type EdgeLedPattern = 'strobe' | 'pulse' | 'solid' | 'heartbeat';

export const EDGE_ALERT_CONFIGS: Record<
  EdgeAlertLevel,
  {
    color: EdgeAlertColor;
    buzzer: boolean;
    buzzerMode: EdgeBuzzerMode;
    ledPattern: EdgeLedPattern;
    label: string;
    description: string;
  }
> = {
  CRITICAL: {
    color: 'red',
    buzzer: true,
    buzzerMode: 'siren',
    ledPattern: 'strobe',
    label: 'Critical Emergency',
    description: 'Imminent subsidence / strata rupture / emergency evacuation',
  },
  WARNING: {
    color: 'yellow',
    buzzer: true,
    buzzerMode: 'beep',
    ledPattern: 'pulse',
    label: 'Warning',
    description: 'Elevated ground tilt / gas hazard / strain threshold breach',
  },
  ADVISORY: {
    color: 'blue',
    buzzer: true,
    buzzerMode: 'chirp',
    ledPattern: 'solid',
    label: 'Advisory',
    description: 'Geotechnical inspection required / maintenance alert',
  },
  NORMAL: {
    color: 'green',
    buzzer: false,
    buzzerMode: 'off',
    ledPattern: 'heartbeat',
    label: 'Normal / All Clear',
    description: 'Hazard resolved / baseline safe operations',
  },
};

export interface EdgeAlertCommand {
  commandId: string;
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
