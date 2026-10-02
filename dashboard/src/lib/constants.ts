export const LATENCY_BUDGET_MS = 500;

export const DEFAULT_ALERT_RULES = [];

export const SENSOR_CONFIGS: Record<string, any> = {
  tilt: { name: 'Tilt', unit: '°', max: 90 },
  vibration: { name: 'Vibration', unit: 'g', max: 10 },
  displacement: { name: 'Displacement', unit: 'mm', max: 100 },
  gas: { name: 'Gas', unit: 'ppm', max: 1000 },
  water: { name: 'Water Level', unit: 'cm', max: 500 },
  crack: { name: 'Crack', unit: 'mm', max: 10 },
};

export const SENSOR_DISPLAY_ORDER = ['tilt', 'vibration', 'displacement', 'gas', 'water', 'crack'];

export function isExcludedMonitoringSensor(sensorType: string): boolean {
  return false;
}
