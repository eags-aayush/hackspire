"use client";

import React, { useState, useMemo } from 'react';
import { ValidatedSensorReading, SensorType } from '@/types/sensor';
import { NodeStatusState } from '@/types/node';
import {
  Globe,
  ChevronDown,
  ChevronUp,
  Activity,
  Compass,
  MoveVertical,
  Zap,
  Flame,
  Droplets,
  Gauge,
  Layers,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { SENSOR_CONFIGS, isExcludedMonitoringSensor, SENSOR_DISPLAY_ORDER } from '@/lib/constants';
import { getSensorSeverity } from '@/lib/utils';
import { isOpPpNode } from '@/hooks/useZoneFilter';

interface GlobalZoneAveragesProps {
  readings: Record<string, Record<string, Record<string, ValidatedSensorReading>>>;
  nodeStatuses: Record<string, Record<string, NodeStatusState>>;
  activeZones: string[];
  onlyOpPp?: boolean;
}

const SENSOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tilt: Compass,
  vibration: Activity,
  displacement: MoveVertical,
  crack: Zap,
  gas: Flame,
  water: Droplets,
};

interface PeakNodeInfo {
  zoneId: string;
  nodeId: string;
  value: number;
}

interface GlobalSensorAverageMetric {
  sensorType: SensorType;
  label: string;
  avg: number;
  min: number;
  max: number;
  unit: string;
  reportingCount: number;
  zonesCount: number;
  totalNodes: number;
  severity: 'normal' | 'warning' | 'critical';
  thresholdRatio: number;
  isRuptured: boolean;
  rupturedCount: number;
  rupturedZones: string[];
  peakNode: PeakNodeInfo | null;
  lowestNode: PeakNodeInfo | null;
}

export function GlobalZoneAverages({
  readings,
  nodeStatuses,
  activeZones,
  onlyOpPp = false,
}: GlobalZoneAveragesProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Compute fleet-wide statistics
  const fleetAverages = useMemo(() => {
    const defaultSensorOrder: SensorType[] = [
      'tilt',
      'vibration',
      'displacement',
      'crack',
      'gas_ppm',
      'water_level_cm',
      'temperature',
      'humidity',
    ];

    // Collect all known zones from either activeZones or readings
    const allKnownZones = Array.from(
      new Set([...activeZones, ...Object.keys(readings), ...Object.keys(nodeStatuses)])
    )
      .filter(Boolean)
      .sort();

    // Collect all sensors present across all zones and nodes (respecting filter)
    const allSensorTypes = new Set<SensorType>(defaultSensorOrder);
    allKnownZones.forEach(zoneId => {
      const zoneNodes = readings[zoneId] || {};
      Object.entries(zoneNodes).forEach(([nodeId, nodeSensors]) => {
        if (onlyOpPp && !isOpPpNode(nodeId)) return;
        Object.keys(nodeSensors).forEach(st => {
          if (!isExcludedMonitoringSensor(st)) {
            allSensorTypes.add(st);
          }
        });
      });
    });

    let totalDiscoveredNodes = 0;
    allKnownZones.forEach(zoneId => {
      const nodeKeys = new Set([
        ...Object.keys(readings[zoneId] || {}),
        ...Object.keys(nodeStatuses[zoneId] || {}),
      ]);
      const validNodes = onlyOpPp
        ? Array.from(nodeKeys).filter(isOpPpNode)
        : Array.from(nodeKeys);
      totalDiscoveredNodes += validNodes.length;
    });

    const results: GlobalSensorAverageMetric[] = Array.from(allSensorTypes).map(sensorType => {
      const meta = SENSOR_CONFIGS[sensorType];
      const values: number[] = [];
      const zonesWithSensor = new Set<string>();
      let peakNode: PeakNodeInfo | null = null;
      let lowestNode: PeakNodeInfo | null = null;
      let unit = meta?.defaultUnit || '';
      const rupturedZones = new Set<string>();

      allKnownZones.forEach(zoneId => {
        const zoneNodes = readings[zoneId] || {};
        Object.entries(zoneNodes).forEach(([nodeId, sensorMap]) => {
          if (onlyOpPp && !isOpPpNode(nodeId)) return;
          const r = sensorMap[sensorType];
          if (r && typeof r.value === 'number' && !isNaN(r.value)) {
            values.push(r.value);
            zonesWithSensor.add(zoneId);
            if (r.unit) unit = r.unit;

            const isNodeOnline = nodeStatuses[zoneId]?.[nodeId]?.status === 'online';
            if (sensorType === 'crack' && r.value >= 1 && isNodeOnline) {
              rupturedZones.add(zoneId);
            }

            if (!peakNode || r.value > peakNode.value) {
              peakNode = { zoneId, nodeId, value: r.value };
            }
            if (!lowestNode || r.value < lowestNode.value) {
              lowestNode = { zoneId, nodeId, value: r.value };
            }
          }
        });
      });

      if (values.length === 0) {
        return {
          sensorType,
          label: meta?.label || sensorType,
          avg: 0,
          min: 0,
          max: 0,
          unit,
          reportingCount: 0,
          zonesCount: 0,
          totalNodes: totalDiscoveredNodes,
          severity: 'normal' as const,
          thresholdRatio: 0,
          isRuptured: false,
          rupturedCount: 0,
          rupturedZones: [],
          peakNode: null,
          lowestNode: null,
        };
      }

      const sum = values.reduce((acc, v) => acc + v, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      if (sensorType === 'crack' && max <= 1) {
        const rupturedCount = values.filter(v => v >= 1).length;
        const isRuptured = rupturedCount > 0;
        return {
          sensorType,
          label: meta?.label || 'Crack Opening',
          avg: isRuptured ? 1 : 0,
          min,
          max,
          unit: '',
          reportingCount: values.length,
          zonesCount: zonesWithSensor.size,
          totalNodes: totalDiscoveredNodes,
          severity: (isRuptured ? 'critical' : 'normal') as 'critical' | 'normal',
          thresholdRatio: isRuptured ? 1 : 0,
          isRuptured,
          rupturedCount,
          rupturedZones: Array.from(rupturedZones),
          peakNode,
          lowestNode,
        };
      }

      const severity = getSensorSeverity(sensorType, avg);
      let thresholdRatio = 0;
      if (sensorType === 'displacement' || sensorType === 'distance') {
        thresholdRatio = Math.max(0, Math.min(1, (30 - avg) / 20));
      } else if (sensorType === 'gas' || sensorType === 'gas_ppm') {
        thresholdRatio = avg <= 600 ? Math.max(0, Math.min(1, (600 - avg) / 400)) : 0;
      } else if (sensorType === 'tilt' || sensorType === 'tilt_x_deg' || sensorType === 'tilt_y_deg') {
        const maxThresh = meta?.criticalThreshold || 3.5;
        thresholdRatio = Math.min(1, Math.max(0, Math.abs(avg) / (maxThresh || 1)));
      } else {
        const maxThresh =
          meta?.criticalThreshold || (meta?.warningThreshold ? meta.warningThreshold * 1.5 : 100);
        thresholdRatio = Math.min(1, Math.max(0, avg / (maxThresh || 1)));
      }

      return {
        sensorType,
        label: meta?.label || sensorType,
        avg,
        min,
        max,
        unit,
        reportingCount: values.length,
        zonesCount: zonesWithSensor.size,
        totalNodes: totalDiscoveredNodes,
        severity,
        thresholdRatio,
        isRuptured: false,
        rupturedCount: 0,
        rupturedZones: [],
        peakNode,
        lowestNode,
      };
    });

    const filteredResults = results
      .filter(r => !isExcludedMonitoringSensor(r.sensorType))
      .filter((r, _, arr) => {
        if (r.sensorType === 'temperature_c' && arr.some(x => x.sensorType === 'temperature')) return false;
        if (r.sensorType === 'humidity_pct' && arr.some(x => x.sensorType === 'humidity')) return false;
        if (r.sensorType === 'crack_displacement_mm' && arr.some(x => x.sensorType === 'crack')) return false;
        return true;
      })
      .sort((a, b) => {
        const orderA = SENSOR_DISPLAY_ORDER.indexOf(a.sensorType);
        const orderB = SENSOR_DISPLAY_ORDER.indexOf(b.sensorType);
        const idxA = orderA === -1 ? 999 : orderA;
        const idxB = orderB === -1 ? 999 : orderB;
        return idxA - idxB;
      });

    return {
      sensorMetrics: filteredResults,
      totalZonesCount: allKnownZones.length,
      totalDiscoveredNodes,
    };
  }, [readings, nodeStatuses, activeZones]);

  const { sensorMetrics, totalZonesCount, totalDiscoveredNodes } = fleetAverages;

  // Fleet-wide threat assessment
  const hasCritical = sensorMetrics.some(s => s.severity === 'critical');
  const hasWarning = sensorMetrics.some(s => s.severity === 'warning');
  const maxReportingNodes = Math.max(...sensorMetrics.map(s => s.reportingCount), 0);

  return (
    <div className="rounded-2xl border border-[#e5e5e5] dark:border-[#14213d] bg-white/95 dark:bg-[#14213d]/35 backdrop-blur-xl shadow-sm dark:shadow-md overflow-hidden transition-all duration-300">
      {/* Fleet Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3.5 bg-gradient-to-r from-[#f4f5f7] via-white to-[#f4f5f7] dark:from-[#14213d]/80 dark:via-[#14213d]/60 dark:to-[#000000]/60 border-b border-[#e5e5e5] dark:border-[#14213d] flex items-center justify-between cursor-pointer hover:bg-[#e5e5e5]/50 dark:hover:bg-[#14213d] transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#fca311]/15 dark:bg-[#fca311]/20 border border-[#fca311]/40 text-[#14213d] dark:text-[#fca311] shadow-xs">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-sm lg:text-base text-[#000000] dark:text-white tracking-wide">
                All Active Zones — Mine-Wide Telemetry Averages
              </h2>
              {onlyOpPp && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#fca311]/20 text-amber-800 dark:text-[#fca311] border border-[#fca311]/40 font-bold">
                  NODE_OP &amp; NODE_PP ONLY
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                FLEET CONCURRENT SYNC
              </span>
            </div>
            <p className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] mt-0.5">
              Concurrent real-time averages across{' '}
              <span className="font-semibold text-[#14213d] dark:text-[#fca311]">
                {totalZonesCount} active {totalZonesCount === 1 ? 'zone' : 'zones'}
              </span>{' '}
              ({maxReportingNodes} / {totalDiscoveredNodes} reporting mesh nodes)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mine Threat Status */}
          <div className="hidden sm:flex items-center">
            {hasCritical ? (
              <Badge variant="danger" pulse className="text-[10px] font-mono font-bold">
                Critical Hazard Detected
              </Badge>
            ) : hasWarning ? (
              <Badge variant="warning" pulse className="text-[10px] font-mono font-bold">
                Elevated Fleet Warning
              </Badge>
            ) : (
              <Badge variant="success" className="text-[10px] font-mono font-bold">
                All Zones Nominal
              </Badge>
            )}
          </div>

          <button className="p-1.5 rounded-lg text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white transition-colors">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Fleet Averages Grid Body */}
      {isOpen && (
        <div className="p-4 bg-gradient-to-b from-[#f8f9fa] to-white dark:from-[#14213d]/40 dark:to-[#000000]/30">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {sensorMetrics.map(item => {
              const Icon = SENSOR_ICONS[item.sensorType] || Gauge;
              const isCrack = item.sensorType === 'crack';
              const isPending = item.reportingCount === 0;

              const severityStyles = {
                normal:
                  'bg-white/95 dark:bg-[#000000]/50 border-[#e5e5e5] dark:border-[#14213d] hover:border-[#14213d]/40 dark:hover:border-[#fca311]/40 shadow-xs',
                warning:
                  'bg-[#fca311]/10 dark:bg-[#fca311]/10 border-[#fca311]/60 dark:border-[#fca311]/60 shadow-[0_0_14px_rgba(252,163,17,0.18)]',
                critical:
                  'bg-red-500/10 dark:bg-red-950/30 border-red-500/60 dark:border-red-600/70 shadow-[0_0_18px_rgba(239,68,68,0.22)] animate-pulse',
              }[item.severity];

              const iconColor = {
                normal: 'text-[#14213d] dark:text-[#fca311]',
                warning: 'text-amber-600 dark:text-[#fca311]',
                critical: 'text-red-600 dark:text-red-400',
              }[item.severity];

              const progressColor = {
                normal: 'bg-emerald-500',
                warning: 'bg-[#fca311]',
                critical: 'bg-red-500',
              }[item.severity];

              return (
                <div
                  key={item.sensorType}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all duration-200 group relative overflow-hidden ${severityStyles}`}
                >
                  {/* Card Header: Icon + Label + Severity */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <div className="p-1.5 rounded-lg bg-[#14213d]/5 dark:bg-[#14213d]/60 shrink-0">
                        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                      </div>
                      <span className="text-xs font-bold text-[#14213d] dark:text-[#e5e5e5] truncate capitalize">
                        {item.label}
                      </span>
                    </div>
                    {item.severity !== 'normal' && (
                      <span
                        className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                          item.severity === 'critical'
                            ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                            : 'bg-[#fca311]/20 text-amber-800 dark:text-[#fca311]'
                        }`}
                      >
                        {item.severity}
                      </span>
                    )}
                  </div>

                  {/* Card Body: Average Number */}
                  <div className="my-1.5">
                    {isPending ? (
                      <div className="text-[11px] font-mono text-[#5c677d] dark:text-[#94a3b8] italic">
                        Awaiting mesh...
                      </div>
                    ) : isCrack ? (
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`font-mono text-base lg:text-lg font-black tracking-tight ${
                            item.isRuptured
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {item.isRuptured ? 'RUPTURE' : 'SECURE'}
                        </span>
                        <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
                          ({item.rupturedCount}/{item.reportingCount})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-xl lg:text-2xl font-black tracking-tight text-[#000000] dark:text-white">
                          {item.avg.toFixed(2)}
                        </span>
                        {item.unit && (
                          <span className="text-xs font-semibold text-[#5c677d] dark:text-[#94a3b8]">
                            {item.unit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Peak Reading & Range Spread */}
                  <div className="pt-2 border-t border-[#e5e5e5]/80 dark:border-[#14213d]/80 space-y-1 text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
                    {!isPending && !isCrack ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span title={`Min: ${item.min.toFixed(2)} | Max: ${item.max.toFixed(2)}`}>
                            Δ {(item.max - item.min).toFixed(2)} {item.unit}
                          </span>
                          <span className="text-[#14213d] dark:text-[#fca311] font-semibold truncate max-w-[100px]" title={item.peakNode ? `Peak at ${item.peakNode.zoneId} (${item.peakNode.nodeId})` : undefined}>
                            {item.peakNode ? `Pk: ${item.peakNode.zoneId}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-[#5c677d]/80 dark:text-[#94a3b8]/80">
                          <span>{item.zonesCount} {item.zonesCount === 1 ? 'zone' : 'zones'}</span>
                          <span>{item.reportingCount} nodes</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span>{isCrack ? 'Ground tripwires' : 'Idle'}</span>
                          <span>{item.zonesCount} zones active</span>
                        </div>
                        {isCrack && item.rupturedZones.length > 0 && (
                          <div className="text-[9px] text-red-600 dark:text-red-400 truncate font-semibold">
                            Zones: {item.rupturedZones.join(', ')}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Visual Threshold Bar */}
                  {!isPending && !isCrack && (
                    <div className="w-full bg-[#e5e5e5] dark:bg-[#14213d] h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                        style={{
                          width: `${Math.max(6, Math.min(100, item.thresholdRatio * 100))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
