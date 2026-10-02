import React, { useState, useMemo } from 'react';
import { NodeStatusState } from '@/types/node';
import { ValidatedSensorReading } from '@/types/sensor';
import { ShadowMlPrediction } from '@/types/ml';
import type { EdgeAlertLevel, EdgeNodeActuatorState } from '@/types/edgeAlert';
import { SensorGauge } from './SensorGauge';
import { Badge } from '../common/Badge';
import { Card } from '../common/Card';
import { MlPredictionInspectorModal } from '../common/MlPredictionInspectorModal';
import { SosButtonGroup } from '../alerts/SosButtonGroup';
import { formatRelativeTime } from '@/lib/utils';
import { isExcludedMonitoringSensor, SENSOR_DISPLAY_ORDER } from '@/lib/constants';
import { Cpu, AlertTriangle, WifiOff, Clock, Brain, Zap, ExternalLink } from 'lucide-react';

interface NodeCardProps {
  nodeId: string;
  zoneId: string;
  status?: NodeStatusState;
  sensors: Record<string, ValidatedSensorReading>;
  mlPrediction?: ShadowMlPrediction;
  actuatorState?: EdgeNodeActuatorState;
  onDispatchEdgeAlert?: (params: { nodeId: string; zoneId: string; level: EdgeAlertLevel }) => void;
}

export const NodeCard = React.memo(function NodeCard({
  nodeId,
  zoneId,
  status,
  sensors,
  mlPrediction,
  actuatorState,
  onDispatchEdgeAlert,
}: NodeCardProps) {
  const [showInspector, setShowInspector] = useState(false);
  const isOnline = status?.status === 'online';
  const isStale = status?.status === 'stale';
  const hasGaps = (status?.gapCount || 0) > 0;

  const statusVariant = isOnline ? 'success' : isStale ? 'warning' : 'danger';
  const statusLabel = isOnline ? 'Online' : isStale ? 'Stale' : 'Offline / LWT';

  // Filter out secondary, raw ADC, and duplicate sensor channels for clean monitoring presentation
  const visibleSensors = useMemo(() => {
    return Object.entries(sensors)
      .filter(([sensorType]) => !isExcludedMonitoringSensor(sensorType))
      .filter(([sensorType]) => {
        // Prevent duplicate temp/hum/crack cards if both canonical and suffixed types exist
        if (sensorType === 'temperature_c' && sensors['temperature']) return false;
        if (sensorType === 'humidity_pct' && sensors['humidity']) return false;
        if (sensorType === 'crack_displacement_mm' && sensors['crack']) return false;
        return true;
      })
      .sort(([a], [b]) => {
        const orderA = SENSOR_DISPLAY_ORDER.indexOf(a);
        const orderB = SENSOR_DISPLAY_ORDER.indexOf(b);
        const idxA = orderA === -1 ? 999 : orderA;
        const idxB = orderB === -1 ? 999 : orderB;
        return idxA - idxB;
      });
  }, [sensors]);

  return (
    <Card
      accent={isOnline ? 'none' : 'red'}
      className={`relative transition-all duration-300 h-full flex flex-col justify-between select-none ${isOnline
          ? 'bg-white/95 dark:bg-[#14213d]/45'
          : 'bg-red-500/5 dark:bg-red-950/20 border-red-500/30 dark:border-red-900/50'
        }`}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#e5e5e5] dark:border-[#14213d]/80">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl border ${isOnline
                ? 'bg-[#14213d]/10 dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border-[#14213d]/25 dark:border-[#fca311]/40 shadow-sm'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
              }`}
          >
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-mono font-bold text-sm text-[#000000] dark:text-white tracking-wide">
                {nodeId}
              </h4>
              {!isOnline && (
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-950 px-1.5 py-0.5 rounded border border-red-500/30 dark:border-red-800/60 flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5" /> No Signal
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono">Zone: {zoneId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasGaps && (
            <Badge variant="warning" className="text-[10px]">
              <AlertTriangle className="w-3 h-3" />
              {status?.gapCount} Gaps
            </Badge>
          )}

          <Badge variant={statusVariant} pulse={isOnline} className="text-[10px] uppercase font-mono font-bold">
            {statusLabel}
          </Badge>
        </div>
      </div>

      {/* Compact SOS Edge Dispatch Buttons */}
      {onDispatchEdgeAlert && (
        <div className="pb-3 mb-1 border-b border-[#e5e5e5] dark:border-[#14213d]/80">
          <SosButtonGroup
            nodeId={nodeId}
            zoneId={zoneId}
            actuatorState={actuatorState}
            onDispatch={onDispatchEdgeAlert}
            compact
          />
        </div>
      )}

      {/* Sensor Grid */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 transition-opacity ${
          isOnline ? 'opacity-100' : 'opacity-60'
        }`}
      >
        {visibleSensors.length > 0 ? (
          visibleSensors.map(([sensorType, reading]) => (
            <SensorGauge key={sensorType} reading={reading} />
          ))
        ) : !isOnline ? (
          <div className="col-span-full py-6 px-4 text-center rounded-xl border border-dashed border-red-500/20 dark:border-red-900/40 bg-red-500/5 dark:bg-red-950/10 flex flex-col items-center justify-center gap-1">
            <WifiOff className="w-4 h-4 text-red-500/70 dark:text-red-400/70" />
            <p className="text-xs font-semibold text-red-700 dark:text-red-300">
              No Readings Received (Node Offline)
            </p>
          </div>
        ) : (
          <div className="col-span-full py-6 text-center text-xs text-[#5c677d] dark:text-[#94a3b8] italic">
            Waiting for first sensor reading from {nodeId}...
          </div>
        )}
      </div>

      {/* ML Prediction (Shadow Mode) — Strict Isolation from Raw Sensors */}
      {mlPrediction && (
        <div className="mt-3 p-2.5 rounded-xl border border-purple-500/25 dark:border-purple-500/35 bg-purple-500/5 dark:bg-purple-950/25 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Brain className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="text-[11px] font-bold tracking-wide text-purple-950 dark:text-purple-200 font-mono">
                ML Assessment
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold tracking-wider">
                SHADOW
              </span>
            </div>

            {mlPrediction && (
              <span className="text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8] flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#fca311]" />
                {mlPrediction.inferenceLatencyMs}ms
              </span>
            )}
          </div>

          {mlPrediction ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#000000] dark:text-white capitalize flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      mlPrediction.anomaly_class === 'subsidence_risk'
                        ? 'bg-red-500 animate-pulse'
                        : mlPrediction.anomaly_class === 'equipment_noise'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <span>
                    {mlPrediction.anomaly_class.replace(/_/g, ' ')}{' '}
                    <strong className="text-[10px] opacity-80">
                      ({Math.round((mlPrediction.class_probs?.[mlPrediction.anomaly_class] || 0) * 100)}%)
                    </strong>
                  </span>
                </span>
                <span
                  className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                    mlPrediction.alert_level === 'RED'
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40'
                      : mlPrediction.alert_level === 'ORANGE'
                      ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/40'
                      : mlPrediction.alert_level === 'YELLOW'
                      ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/40'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40'
                  }`}
                >
                  {mlPrediction.alert_level}
                </span>
              </div>

              {/* Severity Bar */}
              <div>
                <div className="flex justify-between text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono mb-0.5">
                  <span>Estimated Severity:</span>
                  <span className="font-bold text-[#14213d] dark:text-[#e5e5e5]">
                    {(mlPrediction.severity * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      mlPrediction.severity > 0.6
                        ? 'bg-red-500'
                        : mlPrediction.severity > 0.2
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, mlPrediction.severity * 100))}%` }}
                  />
                </div>
              </div>

              {/* Multi-channel Probabilities Micro-Grid */}
              <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-purple-500/15 text-[9px] font-mono text-center">
                <div className="p-0.5 rounded bg-black/5 dark:bg-white/5">
                  <span className="text-[#5c677d] dark:text-[#94a3b8]">Norm</span>{' '}
                  <span className="font-bold">{Math.round((mlPrediction.class_probs?.normal || 0) * 100)}%</span>
                </div>
                <div className="p-0.5 rounded bg-black/5 dark:bg-white/5">
                  <span className="text-[#5c677d] dark:text-[#94a3b8]">Noise</span>{' '}
                  <span className="font-bold">{Math.round((mlPrediction.class_probs?.equipment_noise || 0) * 100)}%</span>
                </div>
                <div className="p-0.5 rounded bg-black/5 dark:bg-white/5">
                  <span className="text-red-600 dark:text-red-400 font-bold">Risk</span>{' '}
                  <span className="font-bold text-red-600 dark:text-red-400">{Math.round((mlPrediction.class_probs?.subsidence_risk || 0) * 100)}%</span>
                </div>
              </div>

              <div className="pt-0.5 flex items-center justify-between text-[9px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
                <button
                  onClick={() => setShowInspector(true)}
                  className="text-purple-600 dark:text-purple-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Inspect Window
                </button>
                <span className="text-[8.5px] italic text-purple-700 dark:text-purple-300 font-sans">
                  Shadow Mode • Informational
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2 text-center text-[10px] text-[#5c677d] dark:text-[#94a3b8] italic">
              Buffering window (awaiting 32 readings)...
            </div>
          )}
        </div>
      )}

      {/* Reusable ML Prediction Inspector Modal */}
      {mlPrediction && (
        <MlPredictionInspectorModal
          prediction={mlPrediction}
          isOpen={showInspector}
          onClose={() => setShowInspector(false)}
        />
      )}

      {/* Node Footer: Health, Sequence, Last Seen */}
      <div className="mt-3.5 pt-2.5 border-t border-[#e5e5e5] dark:border-[#14213d]/80 flex items-center justify-between text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#fca311]" />
          <span>Last seen:</span>
          <span className="text-[#14213d] dark:text-[#e5e5e5] font-semibold">
            {status?.lastSeenAt ? formatRelativeTime(status.lastSeenAt) : 'N/A'}
          </span>
        </div>

        {status?.lastSequenceNumber !== undefined && (
          <div>
            <span>Last Seq: </span>
            <span className="text-[#14213d] dark:text-[#fca311] font-bold">
              #{status.lastSequenceNumber}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
});
