import { SensorType } from './sensor';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertRule {
  id: string;
  name: string;
  sensorType: SensorType;
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
  sensorType: SensorType;
  value: number;
  threshold: number;
  unit: string;
  severity: AlertSeverity;
  timestamp: string;
  message: string;
  resolved?: boolean;
}
