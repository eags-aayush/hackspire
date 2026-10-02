export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export function getSensorSeverity(sensorType: string, value: number): 'normal' | 'warning' | 'critical' {
  return 'normal';
}

export function formatSensorValue(sensorType: string, value: number, unit?: string) {
  return { formatted: value.toFixed(2), unit: unit || '' };
}

export function getLatencyRating(ms: number): 'good' | 'fair' | 'poor' { 
  return ms < 200 ? 'good' : ms < 500 ? 'fair' : 'poor'; 
}
