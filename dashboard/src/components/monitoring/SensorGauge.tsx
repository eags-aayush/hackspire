import React from 'react';
import { ValidatedSensorReading } from '@/types/sensor';
import { SENSOR_CONFIGS } from '@/lib/constants';
import { formatSensorValue, getSensorSeverity } from '@/lib/utils';
import {
  Compass,
  Activity,
  MoveVertical,
  Zap,
  Flame,
  Droplets,
  Gauge,
  Thermometer,
  CloudRain,
  Sliders,
} from 'lucide-react';

interface SensorGaugeProps {
  reading: ValidatedSensorReading;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tilt: Compass,
  vibration: Activity,
  displacement: MoveVertical,
  distance: MoveVertical,
  crack: Zap,
  gas: Flame,
  gas_ppm: Flame,
  water: Droplets,
  water_level_cm: Droplets,
  temperature: Thermometer,
  temperature_c: Thermometer,
  humidity: CloudRain,
  humidity_pct: CloudRain,
  potentiometer: Sliders,
  pot: Sliders,
};

export function SensorGauge({ reading }: SensorGaugeProps) {
  const { sensorType, value, unit } = reading;
  const meta = SENSOR_CONFIGS[sensorType];
  const Icon = ICONS[sensorType] || Gauge;
  const { formatted, unit: displayUnit } = formatSensorValue(sensorType, value, unit);
  const severity = getSensorSeverity(sensorType, value);

  const severityClasses = {
    normal: 'border-[#e5e5e5] dark:border-[#14213d] bg-[#f4f5f7] dark:bg-[#000000]/60 text-[#14213d] dark:text-[#e5e5e5]',
    warning: 'border-[#fca311]/60 bg-[#fca311]/10 text-amber-900 dark:text-[#fca311]',
    critical: 'border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300 animate-pulse',
  };

  const iconColors = {
    normal: 'text-[#14213d] dark:text-[#fca311]',
    warning: 'text-amber-600 dark:text-[#fca311]',
    critical: 'text-red-600 dark:text-red-400',
  };

  return (
    <div
      className={`p-3 rounded-xl border flex flex-col justify-between transition-all duration-200 ${severityClasses[severity]}`}
    >
      <div className="flex items-center justify-between text-xs text-[#5c677d] dark:text-[#94a3b8] mb-1">
        <div className="flex items-center gap-1.5 truncate">
          <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColors[severity]}`} />
          <span className="capitalize font-bold truncate">
            {meta?.label || sensorType}
          </span>
        </div>
        {severity !== 'normal' && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${severity === 'critical'
                ? 'bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30'
                : 'bg-[#fca311]/20 text-amber-900 dark:text-[#fca311] border border-[#fca311]/40'
              }`}
          >
            {severity}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between mt-1">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-base font-black tracking-tight text-[#000000] dark:text-white transition-all duration-300">
            {formatted}
          </span>
          {displayUnit && (
            <span className="text-[11px] font-semibold text-[#5c677d] dark:text-[#94a3b8]">
              {displayUnit}
            </span>
          )}
        </div>
        {reading.rawValue !== undefined && (
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium tracking-tight"
            title={`Moving Average Smoothed (Raw Input: ${reading.rawValue})`}
          >
            SMA
          </span>
        )}
      </div>

      {reading.sequenceNumber !== undefined && (
        <div className="mt-2 pt-1.5 border-t border-[#e5e5e5] dark:border-[#14213d]/80 flex items-center justify-between text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
          <span>Seq #{reading.sequenceNumber}</span>
          <span>{new Date(reading.timestamp).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}
