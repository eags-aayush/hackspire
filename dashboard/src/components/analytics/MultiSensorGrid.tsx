"use client";

import React from 'react';
import { SensorChartCard } from './SensorChartCard';
import { SENSOR_CONFIGS } from '@/lib/constants';
import {
  Compass,
  Activity,
  MoveVertical,
  Droplets,
  Flame,
  Thermometer,
  Zap,
  Split,
} from 'lucide-react';

export interface MultiSensorGridDataPoint {
  id: string;
  timestamp: string;
  timeLabel: string;
  nodeId: string;
  sequenceNumber?: number;
  tilt: number;
  tilt_x_deg: number;
  tilt_y_deg: number;
  distance: number;
  displacement: number;
  water: number;
  gas: number;
  humidity: number;
  temperature: number;
  vibration: number;
  crack: number;
}

interface MultiSensorGridProps {
  data: MultiSensorGridDataPoint[];
  selectedNode: string;
  onFocusSensor: (sensorKey: string) => void;
}

export function MultiSensorGrid({
  data,
  selectedNode,
  onFocusSensor,
}: MultiSensorGridProps) {
  return (
    <div className="space-y-4">
      {/* Sub-header status bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs font-mono text-[#5c677d] dark:text-[#94a3b8]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Synchronized Telemetry Matrix</span>
          <span className="text-slate-400">•</span>
          <span>Node: <strong className="text-[#000000] dark:text-white font-bold">{selectedNode}</strong></span>
          <span className="text-slate-400">•</span>
          <span>{data.length} telemetry frames captured</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#fca311]" /> Warning Level
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Critical Limit (DGMS)
          </span>
        </div>
      </div>

      {/* Grid of Recharts cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* 1. Biaxial Ground Tilt */}
        <SensorChartCard
          title="Biaxial Ground Tilt"
          sensorType="tilt"
          icon={<Compass className="w-4 h-4 text-[#fca311]" />}
          unit="°"
          data={data}
          dataKey="tilt"
          primaryColor="#fca311"
          gradientId="grad-tilt"
          warningThreshold={SENSOR_CONFIGS.tilt.warningThreshold}
          criticalThreshold={SENSOR_CONFIGS.tilt.criticalThreshold}
          onFocus={() => onFocusSensor('tilt')}
        />

        {/* 2. Gyroscope Dual-Axis (Pitch X & Roll Y) */}
        <SensorChartCard
          title="Gyro Angular Deviation"
          sensorType="gyro"
          icon={<Activity className="w-4 h-4 text-cyan-400" />}
          unit="°"
          data={data}
          series={[
            { key: 'tilt_x_deg', name: 'Pitch (X)', color: '#06b6d4', type: 'line' },
            { key: 'tilt_y_deg', name: 'Roll (Y)', color: '#f59e0b', type: 'line' },
          ]}
          primaryColor="#06b6d4"
          gradientId="grad-gyro"
          warningThreshold={2.0}
          criticalThreshold={3.5}
          onFocus={() => onFocusSensor('gyro')}
        />

        {/* 3. Ultrasonic Distance & Roof Sag */}
        <SensorChartCard
          title="Ultrasonic Roof Distance"
          sensorType="distance"
          icon={<MoveVertical className="w-4 h-4 text-purple-400" />}
          unit="cm"
          data={data}
          dataKey="distance"
          primaryColor="#a855f7"
          gradientId="grad-distance"
          warningThreshold={SENSOR_CONFIGS.displacement.warningThreshold}
          criticalThreshold={SENSOR_CONFIGS.displacement.criticalThreshold}
          invertedRisk={true}
          onFocus={() => onFocusSensor('distance')}
        />

        {/* 4. Hydrological Water Level / Inrush */}
        <SensorChartCard
          title="Water Inrush & Table Level"
          sensorType="water"
          icon={<Droplets className="w-4 h-4 text-sky-400" />}
          unit="m"
          data={data}
          dataKey="water"
          primaryColor="#0284c7"
          gradientId="grad-water"
          warningThreshold={1.0}
          criticalThreshold={2.0}
          onFocus={() => onFocusSensor('water')}
        />

        {/* 5. MQ-6 Combustible & Toxic Gas */}
        <SensorChartCard
          title="MQ-6 Gas Concentration"
          sensorType="gas"
          icon={<Flame className="w-4 h-4 text-rose-400" />}
          unit="ppm"
          data={data}
          dataKey="gas"
          primaryColor="#ef4444"
          gradientId="grad-gas"
          warningThreshold={25}
          criticalThreshold={45}
          onFocus={() => onFocusSensor('gas')}
        />

        {/* 6. DHT22 Environmental Microclimate (Humidity % & Temperature °C) */}
        <SensorChartCard
          title="DHT22 Microclimate"
          sensorType="microclimate"
          icon={<Thermometer className="w-4 h-4 text-emerald-400" />}
          unit="% / °C"
          data={data}
          series={[
            { key: 'humidity', name: 'Humidity (%)', color: '#10b981', type: 'area' },
            { key: 'temperature', name: 'Temp (°C)', color: '#f43f5e', type: 'line' },
          ]}
          primaryColor="#10b981"
          gradientId="grad-climate"
          warningThreshold={70}
          criticalThreshold={85}
          onFocus={() => onFocusSensor('humidity')}
        />

        {/* 7. Seismic Vibration Acceleration */}
        <SensorChartCard
          title="Seismic Vibration"
          sensorType="vibration"
          icon={<Zap className="w-4 h-4 text-amber-400" />}
          unit="g"
          data={data}
          dataKey="vibration"
          primaryColor="#eab308"
          gradientId="grad-vibe"
          warningThreshold={SENSOR_CONFIGS.vibration.warningThreshold}
          criticalThreshold={SENSOR_CONFIGS.vibration.criticalThreshold}
          onFocus={() => onFocusSensor('vibration')}
        />

        {/* 8. Fissure & Strata Rupture Opening */}
        <SensorChartCard
          title="Fissure / Strata Rupture"
          sensorType="crack"
          icon={<Split className="w-4 h-4 text-pink-400" />}
          unit="mm"
          data={data}
          dataKey="displacement"
          primaryColor="#ec4899"
          gradientId="grad-crack"
          warningThreshold={15}
          criticalThreshold={25}
          onFocus={() => onFocusSensor('displacement')}
        />
      </div>
    </div>
  );
}
