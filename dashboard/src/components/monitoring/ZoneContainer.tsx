"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { NodeCard } from './NodeCard';
import { ValidatedSensorReading, SensorType } from '@/types/sensor';
import { NodeStatusState } from '@/types/node';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Activity,
  Compass,
  MoveVertical,
  Zap,
  Flame,
  Droplets,
  Gauge,
  Radio,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { SENSOR_CONFIGS, isExcludedMonitoringSensor, SENSOR_DISPLAY_ORDER } from '@/lib/constants';
import { getSensorSeverity } from '@/lib/utils';
import { ShadowMlPrediction } from '@/types/ml';
import type { EdgeAlertLevel, EdgeNodeActuatorState } from '@/types/edgeAlert';
import { SosButtonGroup } from '../alerts/SosButtonGroup';

interface ZoneContainerProps {
  zoneId: string;
  nodeIds: string[];
  readings: Record<string, Record<string, ValidatedSensorReading>>;
  statuses: Record<string, NodeStatusState>;
  mlPredictions?: Record<string, ShadowMlPrediction>;
  edgeActuatorStates?: Record<string, EdgeNodeActuatorState>;
  onDispatchEdgeAlert?: (params: { nodeId: string; zoneId: string; level: EdgeAlertLevel }) => void;
}

const SENSOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tilt: Compass,
  vibration: Activity,
  displacement: MoveVertical,
  crack: Zap,
  gas: Flame,
  water: Droplets,
};

export function ZoneContainer({
  zoneId,
  nodeIds,
  readings,
  statuses,
  mlPredictions,
  edgeActuatorStates,
  onDispatchEdgeAlert,
}: ZoneContainerProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Horizontal Scroll & Paging State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Measure visible width and calculate active page
  const updateScrollPagination = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);

    const firstCard = el.firstElementChild as HTMLElement | null;
    const cardWidth = firstCard ? firstCard.offsetWidth + 16 : clientWidth / 3;
    const visibleCards = Math.max(1, Math.round(clientWidth / cardWidth));
    const pages = Math.max(1, Math.ceil(nodeIds.length / visibleCards));
    setTotalPages(pages);

    const activePage = Math.min(
      pages,
      Math.max(1, Math.floor((scrollLeft + cardWidth * 0.4) / (cardWidth * visibleCards)) + 1)
    );
    setCurrentPage(activePage);
  }, [nodeIds.length]);

  const handleScroll = useCallback(() => {
    requestAnimationFrame(updateScrollPagination);
  }, [updateScrollPagination]);

  useEffect(() => {
    updateScrollPagination();
    const handleResize = () => updateScrollPagination();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateScrollPagination]);

  const scrollToNext = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.85, behavior: 'smooth' });
  }, []);

  const scrollToPrev = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: -el.clientWidth * 0.85, behavior: 'smooth' });
  }, []);

  const scrollToPageIndex = useCallback((targetPage: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ left: (targetPage - 1) * el.clientWidth * 0.85, behavior: 'smooth' });
  }, []);

  // Compute zone statistics
  const totalNodes = nodeIds.length;
  let onlineNodes = 0;
  let zoneGaps = 0;

  nodeIds.forEach(id => {
    const st = statuses[id];
    if (st?.status === 'online') onlineNodes++;
    zoneGaps += st?.gapCount || 0;
  });

  const allOnline = onlineNodes === totalNodes && totalNodes > 0;

  // Compute Real-Time Sensor Averages across all nodes subscribed to this zone
  const sensorAverages = useMemo(() => {
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

    // Collect any extra custom sensors reported by nodes
    const allSensorTypes = new Set<SensorType>(defaultSensorOrder);
    nodeIds.forEach(nodeId => {
      const nodeSensors = readings[nodeId];
      if (nodeSensors) {
        Object.keys(nodeSensors).forEach(st => {
          if (!isExcludedMonitoringSensor(st)) {
            allSensorTypes.add(st);
          }
        });
      }
    });

    return Array.from(allSensorTypes).map(sensorType => {
      const meta = SENSOR_CONFIGS[sensorType];
      const values: number[] = [];
      let unit = meta?.defaultUnit || '';

      nodeIds.forEach(nodeId => {
        const r = readings[nodeId]?.[sensorType];
        if (r && typeof r.value === 'number' && !isNaN(r.value)) {
          values.push(r.value);
          if (r.unit) unit = r.unit;
        }
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
          totalNodes,
          severity: 'normal' as const,
          thresholdRatio: 0,
          isRuptured: false,
          rupturedCount: 0,
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
          totalNodes,
          severity: (isRuptured ? 'critical' : 'normal') as 'critical' | 'normal',
          thresholdRatio: isRuptured ? 1 : 0,
          isRuptured,
          rupturedCount,
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
        totalNodes,
        severity,
        thresholdRatio,
        isRuptured: false,
        rupturedCount: 0,
      };
    })
      .filter(s => !isExcludedMonitoringSensor(s.sensorType))
      .filter((s, _, arr) => {
        if (s.sensorType === 'temperature_c' && arr.some(x => x.sensorType === 'temperature')) return false;
        if (s.sensorType === 'humidity_pct' && arr.some(x => x.sensorType === 'humidity')) return false;
        if (s.sensorType === 'crack_displacement_mm' && arr.some(x => x.sensorType === 'crack')) return false;
        return true;
      })
      .sort((a, b) => {
        const orderA = SENSOR_DISPLAY_ORDER.indexOf(a.sensorType);
        const orderB = SENSOR_DISPLAY_ORDER.indexOf(b.sensorType);
        const idxA = orderA === -1 ? 999 : orderA;
        const idxB = orderB === -1 ? 999 : orderB;
        return idxA - idxB;
      });
  }, [nodeIds, readings, totalNodes]);

  // Overall Zone Threat Assessment based on computed averages
  const hasCriticalAverage = sensorAverages.some(s => s.severity === 'critical');
  const hasWarningAverage = sensorAverages.some(s => s.severity === 'warning');
  const activeReportingCount = Math.max(...sensorAverages.map(s => s.reportingCount), 0);

  return (
    <div className="rounded-2xl border border-[#e5e5e5] dark:border-[#14213d] bg-white/95 dark:bg-[#14213d]/25 overflow-hidden shadow-sm dark:shadow-md transition-all duration-300">
      {/* Zone Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3.5 bg-[#f4f5f7] dark:bg-[#14213d]/70 border-b border-[#e5e5e5] dark:border-[#14213d] flex items-center justify-between cursor-pointer hover:bg-[#e5e5e5]/50 dark:hover:bg-[#14213d] transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#14213d]/10 dark:bg-[#14213d] border border-[#14213d]/25 dark:border-[#fca311]/40 text-[#14213d] dark:text-[#fca311]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm lg:text-base text-[#000000] dark:text-white tracking-wide">
                Zone: <span className="text-[#14213d] dark:text-[#fca311] font-mono">{zoneId}</span>
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono font-bold">
                {totalNodes} {totalNodes === 1 ? 'Node' : 'Nodes'}
              </Badge>
            </div>
            <p className="text-[11px] text-[#5c677d] dark:text-[#94a3b8]">
              WebSocket Room: <code className="text-[#14213d] dark:text-[#fca311] font-semibold">zone:{zoneId}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status summary */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
            <span className="text-[#5c677d] dark:text-[#94a3b8]">Active:</span>
            <span
              className={`font-bold ${
                allOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-[#fca311]'
              }`}
            >
              {onlineNodes} / {totalNodes}
            </span>
          </div>

          {zoneGaps > 0 && (
            <Badge variant="warning" className="text-[10px] hidden md:inline-flex">
              <AlertTriangle className="w-3 h-3" />
              {zoneGaps} Gaps
            </Badge>
          )}

          {allOnline && (
            <Badge variant="success" className="text-[10px] hidden md:inline-flex">
              <ShieldCheck className="w-3 h-3" /> Healthy
            </Badge>
          )}

          <button className="p-1.5 rounded-lg text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white transition-colors">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Zone Content: Real-Time Averages Row + Node Cards */}
      {isOpen && (
        <div className="space-y-4">
          {/* Real-Time Sensor Telemetry Averages Row */}
          <div className="border-b border-[#e5e5e5] dark:border-[#14213d]/80 bg-gradient-to-r from-[#f8f9fa] via-white to-[#f4f5f7] dark:from-[#14213d]/50 dark:via-[#14213d]/30 dark:to-[#000000]/40 p-4">
            {/* Averages Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#14213d]/10 dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311]">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-[#000000] dark:text-white">
                      Zone Telemetry Averages
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      REAL-TIME STREAM
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] mt-0.5">
                    Live computed mean across {activeReportingCount} active reporting {activeReportingCount === 1 ? 'node' : 'nodes'} in{' '}
                    <span className="font-mono font-semibold text-[#14213d] dark:text-[#fca311]">{zoneId}</span>
                  </p>
                </div>
              </div>

              {/* Threat Status Badge for Zone Average */}
              <div className="flex items-center gap-2">
                {hasCriticalAverage ? (
                  <Badge variant="danger" pulse className="text-[10px] font-mono font-bold">
                    Zone Critical Threshold Exceeded
                  </Badge>
                ) : hasWarningAverage ? (
                  <Badge variant="warning" pulse className="text-[10px] font-mono font-bold">
                    Zone Elevated Warning
                  </Badge>
                ) : (
                  <Badge variant="success" className="text-[10px] font-mono font-bold">
                    Zone Averages Nominal
                  </Badge>
                )}
              </div>
            </div>

            {/* Averages Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {sensorAverages.map(item => {
                const Icon = SENSOR_ICONS[item.sensorType] || Gauge;
                const isCrack = item.sensorType === 'crack';
                const isPending = item.reportingCount === 0;

                const severityCardStyles = {
                  normal:
                    'bg-white/95 dark:bg-[#000000]/40 border-[#e5e5e5] dark:border-[#14213d] hover:border-[#14213d]/40 dark:hover:border-[#fca311]/40 shadow-xs',
                  warning:
                    'bg-[#fca311]/10 dark:bg-[#fca311]/10 border-[#fca311]/60 dark:border-[#fca311]/60 shadow-[0_0_12px_rgba(252,163,17,0.15)]',
                  critical:
                    'bg-red-500/10 dark:bg-red-950/30 border-red-500/60 dark:border-red-600/70 shadow-[0_0_16px_rgba(239,68,68,0.2)] animate-pulse',
                }[item.severity];

                const iconColors = {
                  normal: 'text-[#14213d] dark:text-[#fca311]',
                  warning: 'text-amber-600 dark:text-[#fca311]',
                  critical: 'text-red-600 dark:text-red-400',
                }[item.severity];

                const progressColors = {
                  normal: 'bg-emerald-500',
                  warning: 'bg-[#fca311]',
                  critical: 'bg-red-500',
                }[item.severity];

                return (
                  <div
                    key={item.sensorType}
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all duration-200 group relative overflow-hidden ${severityCardStyles}`}
                  >
                    {/* Top: Icon + Label + Status Pill */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <div className="p-1 rounded-md bg-[#14213d]/5 dark:bg-[#14213d]/60 shrink-0">
                          <Icon className={`w-3.5 h-3.5 ${iconColors}`} />
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

                    {/* Middle: Average Value */}
                    <div className="my-1.5">
                      {isPending ? (
                        <div className="text-[11px] font-mono text-[#5c677d] dark:text-[#94a3b8] italic">
                          Awaiting nodes...
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
                          <span className="font-mono text-lg lg:text-xl font-black tracking-tight text-[#000000] dark:text-white">
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

                    {/* Bottom: Range (Min/Max Spread) & Reporting Nodes */}
                    <div className="pt-2 border-t border-[#e5e5e5]/80 dark:border-[#14213d]/80 flex items-center justify-between text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
                      {!isPending && !isCrack ? (
                        <>
                          <span title={`Min: ${item.min.toFixed(2)} | Max: ${item.max.toFixed(2)}`}>
                            Δ {(item.max - item.min).toFixed(2)} {item.unit}
                          </span>
                          <span>
                            {item.reportingCount}/{item.totalNodes} nodes
                          </span>
                        </>
                      ) : (
                        <>
                          <span>{isCrack ? 'Binary gauge' : 'No data'}</span>
                          <span>{item.reportingCount} active</span>
                        </>
                      )}
                    </div>

                    {/* Threshold Visual Progress Line */}
                    {!isPending && !isCrack && (
                      <div className="w-full bg-[#e5e5e5] dark:bg-[#14213d] h-1 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${progressColors}`}
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

          {/* Node Horizontal Carousel Sub-Section */}
          <div className="p-4 pt-0 bg-transparent">
            {/* Carousel Header & Pagination Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[#e5e5e5]/60 dark:border-[#14213d]/60">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-[#fca311]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#5c677d] dark:text-[#94a3b8]">
                  Individual Sensor Nodes ({nodeIds.length})
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#14213d]/5 dark:bg-[#14213d]/60 text-[#14213d] dark:text-[#e5e5e5]">
                  {onlineNodes} Online · {nodeIds.length - onlineNodes} Inactive
                </span>
              </div>

              {/* Navigation Controls & Pagination Indicator */}
              {nodeIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-semibold text-[#5c677d] dark:text-[#94a3b8] px-2.5 py-1 rounded-lg bg-[#f4f5f7] dark:bg-[#14213d]/60 border border-[#e5e5e5] dark:border-[#14213d]">
                    Page <strong className="text-[#14213d] dark:text-[#fca311]">{currentPage}</strong> of {totalPages}
                    <span className="text-[#5c677d] dark:text-[#94a3b8] ml-1.5 hidden sm:inline">
                      ({nodeIds.length} {nodeIds.length === 1 ? 'Node' : 'Nodes'})
                    </span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={scrollToPrev}
                      disabled={!canScrollLeft}
                      aria-label="Scroll left to previous nodes"
                      className="p-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#14213d] bg-white dark:bg-[#14213d]/80 text-[#14213d] dark:text-[#e5e5e5] hover:bg-[#fca311]/15 hover:border-[#fca311] hover:text-[#fca311] disabled:opacity-25 disabled:pointer-events-none transition-all active:scale-95 shadow-xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={scrollToNext}
                      disabled={!canScrollRight}
                      aria-label="Scroll right to next nodes"
                      className="p-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#14213d] bg-white dark:bg-[#14213d]/80 text-[#14213d] dark:text-[#e5e5e5] hover:bg-[#fca311]/15 hover:border-[#fca311] hover:text-[#fca311] disabled:opacity-25 disabled:pointer-events-none transition-all active:scale-95 shadow-xs"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Carousel Container */}
            {nodeIds.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#5c677d] dark:text-[#94a3b8] italic">
                No matching nodes found in zone {zoneId}.
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="flex items-stretch gap-4 overflow-x-auto snap-x snap-mandatory py-2 px-0.5 scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e5e5e5] dark:[&::-webkit-scrollbar-thumb]:bg-[#14213d] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#fca311]"
                >
                  {nodeIds.map(nodeId => (
                    <div
                      key={nodeId}
                      className="shrink-0 snap-start w-[88vw] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] min-w-[280px] max-w-[440px]"
                    >
                      <NodeCard
                        nodeId={nodeId}
                        zoneId={zoneId}
                        status={statuses[nodeId]}
                        sensors={readings[nodeId] || {}}
                        mlPrediction={mlPredictions?.[nodeId]}
                        actuatorState={edgeActuatorStates?.[nodeId]}
                        onDispatchEdgeAlert={onDispatchEdgeAlert}
                      />
                    </div>
                  ))}
                </div>

                {/* Pagination Dots */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => scrollToPageIndex(idx + 1)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          currentPage === idx + 1
                            ? 'w-6 bg-[#14213d] dark:bg-[#fca311]'
                            : 'w-1.5 bg-[#e5e5e5] dark:bg-[#14213d] hover:bg-[#5c677d]'
                        }`}
                        title={`Jump to Page ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
