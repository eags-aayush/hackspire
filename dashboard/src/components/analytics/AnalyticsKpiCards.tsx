"use client";

import React, { useMemo } from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { SystemLatencyMetrics } from '@/types/socket';
import { GatewayStatus } from '@/context/RealtimeContext';
import { ValidatedSensorReading } from '@/types/sensor';
import { ShadowMlPrediction } from '@/types/ml';
import { SENSOR_CONFIGS } from '@/lib/constants';
import {
  Activity,
  Compass,
  Zap,
  BrainCircuit,
  Radio,
  MoveVertical,
  Droplets,
  Flame,
  Thermometer,
} from 'lucide-react';

interface AnalyticsKpiCardsProps {
  readings: Record<string, Record<string, Record<string, ValidatedSensorReading>>>;
  mlPredictions: Record<string, Record<string, ShadowMlPrediction>>;
  metrics: SystemLatencyMetrics;
  gatewayStatus: GatewayStatus;
  stats: {
    totalZones: number;
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    totalGaps: number;
    activeSensorsCount: number;
  };
  isSimulationActive: boolean;
}

export function AnalyticsKpiCards({
  readings,
  mlPredictions,
  metrics,
  stats,
  isSimulationActive,
}: AnalyticsKpiCardsProps) {
  // Aggregate peak sensor values across all zones and nodes
  const aggregates = useMemo(() => {
    let maxTilt = 0;
    let maxTiltNode = 'NODE_01';
    let minDistance = 180.0;
    let minDistanceNode = 'NODE_01';
    let maxGas = 0;
    let maxGasNode = 'NODE_01';
    let maxWater = 0;
    let maxWaterNode = 'NODE_01';
    let maxHumidity = 0;
    let maxTemp = 0;
    let totalReadingsCount = 0;

    Object.values(readings).forEach(zoneNodes => {
      Object.entries(zoneNodes).forEach(([nodeId, sensorMap]) => {
        Object.values(sensorMap).forEach(r => {
          totalReadingsCount++;
          if (r.sensorType === 'tilt' && r.value > maxTilt) {
            maxTilt = r.value;
            maxTiltNode = nodeId;
          }
          if ((r.sensorType === 'distance' || r.sensorType === 'displacement') && r.value < minDistance && r.value > 0) {
            minDistance = r.value;
            minDistanceNode = nodeId;
          }
          if (r.sensorType === 'gas' && r.value > maxGas) {
            maxGas = r.value;
            maxGasNode = nodeId;
          }
          if (r.sensorType === 'water' && r.value > maxWater) {
            maxWater = r.value;
            maxWaterNode = nodeId;
          }
          if (r.sensorType === 'humidity' && r.value > maxHumidity) {
            maxHumidity = r.value;
          }
          if (r.sensorType === 'temperature' && r.value > maxTemp) {
            maxTemp = r.value;
          }
        });
      });
    });

    // Aggregate ML Predictions
    let maxSeverity = 0;
    let highestRiskNode = 'None';
    let highestAlertLevel = 'GREEN';
    let highestRiskClass = 'normal';
    let totalMlPreds = 0;
    let sumLatency = 0;

    Object.values(mlPredictions).forEach(zonePreds => {
      Object.entries(zonePreds).forEach(([nodeId, pred]) => {
        totalMlPreds++;
        sumLatency += pred.inferenceLatencyMs || 12;
        if (pred.severity > maxSeverity) {
          maxSeverity = pred.severity;
          highestRiskNode = nodeId;
          highestAlertLevel = pred.alert_level || 'GREEN';
          highestRiskClass = pred.anomaly_class || 'normal';
        }
      });
    });

    return {
      maxTilt,
      maxTiltNode,
      minDistance: minDistance === 180 ? 0 : minDistance,
      minDistanceNode,
      maxGas,
      maxGasNode,
      maxWater,
      maxWaterNode,
      maxHumidity,
      maxTemp,
      totalReadingsCount,
      maxSeverity,
      highestRiskNode,
      highestAlertLevel,
      highestRiskClass,
      totalMlPreds,
      avgInferenceLatency: totalMlPreds > 0 ? Math.round(sumLatency / totalMlPreds) : 14,
    };
  }, [readings, mlPredictions]);

  const alertBadgeVariant = useMemo(() => {
    switch (aggregates.highestAlertLevel) {
      case 'RED':
        return 'danger';
      case 'ORANGE':
      case 'YELLOW':
        return 'warning';
      default:
        return 'success';
    }
  }, [aggregates.highestAlertLevel]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 min-w-0">
      {/* 1. Fleet Telemetry Stream */}
      <Card className="p-3.5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] relative overflow-hidden group hover:border-[#fca311]/50 transition-all shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#5c677d] dark:text-[#94a3b8] tracking-wider uppercase font-mono">
            Fleet Telemetry
          </span>
          <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className="text-xl font-black text-[#000000] dark:text-white font-mono">
            {stats.onlineNodes}
            <span className="text-xs font-normal text-[#5c677d] dark:text-[#94a3b8]">/{stats.totalNodes}</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
            {isSimulationActive ? 'SIM ACTIVE' : 'LIVE MESH'}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#e5e5e5]/80 dark:border-[#14213d]/80 flex items-center justify-between text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
          <span>Rate: <strong className="text-[#14213d] dark:text-white">{metrics.packetsPerSec} pps</strong></span>
          <span className="text-emerald-500 font-medium">Protobuf</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500/70" />
      </Card>

      {/* 2. Peak Strata Tilt */}
      <Card className="p-3.5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] relative overflow-hidden group hover:border-[#fca311]/50 transition-all shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#5c677d] dark:text-[#94a3b8] tracking-wider uppercase font-mono">
            Peak Ground Tilt
          </span>
          <div
            className={`p-1 rounded-lg ${
              aggregates.maxTilt >= SENSOR_CONFIGS.tilt.criticalThreshold
                ? 'bg-red-500/10 text-red-600'
                : aggregates.maxTilt >= SENSOR_CONFIGS.tilt.warningThreshold
                ? 'bg-amber-500/10 text-[#fca311]'
                : 'bg-blue-500/10 text-blue-600'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-xl font-black text-[#000000] dark:text-white font-mono">
            {aggregates.maxTilt.toFixed(2)}°
          </span>
          <Badge
            variant={
              aggregates.maxTilt >= SENSOR_CONFIGS.tilt.criticalThreshold
                ? 'danger'
                : aggregates.maxTilt >= SENSOR_CONFIGS.tilt.warningThreshold
                ? 'warning'
                : 'info'
            }
            className="text-[8px] uppercase font-mono px-1 py-0"
          >
            {aggregates.maxTilt >= SENSOR_CONFIGS.tilt.criticalThreshold ? 'CRIT' : aggregates.maxTilt >= 2.0 ? 'WARN' : 'NORM'}
          </Badge>
        </div>
        <div className="mt-2 pt-2 border-t border-[#e5e5e5]/80 dark:border-[#14213d]/80 flex items-center justify-between text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
          <span>Max: <strong className="text-[#14213d] dark:text-white">{aggregates.maxTiltNode}</strong></span>
          <span>Lim: 3.5°</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#fca311]" />
      </Card>

      {/* 3. Roof Distance / Convergence */}
      <Card className="p-3.5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] relative overflow-hidden group hover:border-[#fca311]/50 transition-all shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#5c677d] dark:text-[#94a3b8] tracking-wider uppercase font-mono">
            Min Roof Distance
          </span>
          <div className="p-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <MoveVertical className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-xl font-black text-[#000000] dark:text-white font-mono">
            {aggregates.minDistance.toFixed(1)}
            <span className="text-xs font-normal text-[#5c677d] dark:text-[#94a3b8]"> cm</span>
          </span>
          <Badge
            variant={aggregates.minDistance <= 10.0 ? 'danger' : aggregates.minDistance <= 15.0 ? 'warning' : 'success'}
            className="text-[8px] uppercase font-mono px-1 py-0"
          >
            {aggregates.minDistance <= 10.0 ? 'CRIT' : aggregates.minDistance <= 15.0 ? 'WARN' : 'SAFE'}
          </Badge>
        </div>
        <div className="mt-2 pt-2 border-t border-[#e5e5e5]/80 dark:border-[#14213d]/80 flex items-center justify-between text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
          <span>Node: <strong className="text-[#14213d] dark:text-white">{aggregates.minDistanceNode}</strong></span>
          <span>Safe: &gt;15cm</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500/70" />
      </Card>

      {/* 4. Hydrological Water Level */}
      <Card className="p-3.5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] relative overflow-hidden group hover:border-[#fca311]/50 transition-all shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#5c677d] dark:text-[#94a3b8] tracking-wider uppercase font-mono">
            Peak Water Inflow
          </span>
          <div className="p-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Droplets className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-xl font-black text-[#000000] dark:text-white font-mono">
            {aggregates.maxWater.toFixed(2)}
            <span className="text-xs font-normal text-[#5c677d] dark:text-[#94a3b8]"> m</span>
          </span>
          <Badge
            variant={aggregates.maxWater >= 2.0 ? 'danger' : aggregates.maxWater >= 1.0 ? 'warning' : 'info'}
            className="text-[8px] uppercase font-mono px-1 py-0"
          >
            {aggregates.maxWater >= 2.0 ? 'FLOOD' : aggregates.maxWater >= 1.0 ? 'HIGH' : 'NOMINAL'}
          </Badge>
        </div>
        <div className="mt-2 pt-2 border-t border-[#e5e5e5]/80 dark:border-[#14213d]/80 flex items-center justify-between text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
          <span>Node: <strong className="text-[#14213d] dark:text-white">{aggregates.maxWaterNode}</strong></span>
          <span>Inflow Sump</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500/70" />
      </Card>

      {/* 5. MQ-6 Gas Concentration */}
      <Card className="p-3.5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] relative overflow-hidden group hover:border-[#fca311]/50 transition-all shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#5c677d] dark:text-[#94a3b8] tracking-wider uppercase font-mono">
            Peak Gas Concentration
          </span>
          <div className="p-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Flame className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-xl font-black text-[#000000] dark:text-white font-mono">
            {aggregates.maxGas}
            <span className="text-xs font-normal text-[#5c677d] dark:text-[#94a3b8]"> ppm</span>
          </span>
          <Badge
            variant={aggregates.maxGas >= 45 ? 'danger' : aggregates.maxGas >= 25 ? 'warning' : 'success'}
            className="text-[8px] uppercase font-mono px-1 py-0"
          >
            {aggregates.maxGas >= 45 ? 'DANGER' : aggregates.maxGas >= 25 ? 'ELEVATED' : 'SAFE'}
          </Badge>
        </div>
        <div className="mt-2 pt-2 border-t border-[#e5e5e5]/80 dark:border-[#14213d]/80 flex items-center justify-between text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
          <span>Airway: <strong className="text-[#14213d] dark:text-white">{aggregates.maxGasNode}</strong></span>
          <span>MQ-6 Sensor</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500/70" />
      </Card>

      {/* 6. AI Deep Learning Subsidence Risk */}
      <Card className="p-3.5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] relative overflow-hidden group hover:border-[#fca311]/50 transition-all shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#5c677d] dark:text-[#94a3b8] tracking-wider uppercase font-mono">
            AI Subsidence Risk
          </span>
          <div
            className={`p-1 rounded-lg ${
              aggregates.maxSeverity >= 0.6
                ? 'bg-red-500/10 text-red-600 animate-pulse'
                : aggregates.maxSeverity >= 0.2
                ? 'bg-amber-500/10 text-[#fca311]'
                : 'bg-emerald-500/10 text-emerald-600'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-xl font-black text-[#000000] dark:text-white font-mono">
            {Math.round(aggregates.maxSeverity * 100)}%
          </span>
          <Badge variant={alertBadgeVariant} className="text-[8px] font-mono font-bold px-1 py-0">
            {aggregates.highestAlertLevel}
          </Badge>
        </div>
        <div className="mt-2 pt-2 border-t border-[#e5e5e5]/80 dark:border-[#14213d]/80 flex items-center justify-between text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
          <span className="truncate max-w-[90px]" title={aggregates.highestRiskClass}>
            {aggregates.highestRiskClass.replace(/_/g, ' ')}
          </span>
          <span>{aggregates.avgInferenceLatency}ms</span>
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 ${
            aggregates.maxSeverity >= 0.6 ? 'bg-red-500' : 'bg-emerald-500/70'
          }`}
        />
      </Card>
    </div>
  );
}
