"use client";

import React, { useMemo } from 'react';
import { SosButtonGroup } from './SosButtonGroup';
import { ShieldAlert, Radio } from 'lucide-react';
import type { EdgeAlertLevel, EdgeNodeActuatorState } from '@/types/edgeAlert';
import type { ShadowMlPrediction } from '@/types/ml';
import type { SubsidenceAlert } from '@/types/alert';

interface SosEmergencyBannerProps {
  alerts: SubsidenceAlert[];
  mlPredictions: Record<string, Record<string, ShadowMlPrediction>>;
  edgeActuatorStates: Record<string, EdgeNodeActuatorState>;
  onDispatch: (params: { nodeId: string; zoneId: string; level: EdgeAlertLevel }) => void;
}

export const SosEmergencyBanner = React.memo(function SosEmergencyBanner({
  alerts,
  mlPredictions,
  edgeActuatorStates,
  onDispatch,
}: SosEmergencyBannerProps) {
  // Find the most critical active anomaly
  const emergencyNode = useMemo(() => {
    // Check ML predictions for subsidence risk first
    for (const [zoneId, nodes] of Object.entries(mlPredictions || {})) {
      for (const [nodeId, pred] of Object.entries(nodes || {})) {
        if (
          pred.anomaly_class === 'subsidence_risk' ||
          pred.alert_level === 'RED' ||
          pred.alert_level === 'ORANGE'
        ) {
          return { nodeId, zoneId, source: 'ml' as const, prediction: pred };
        }
      }
    }

    // Check recent critical hardware alerts
    const critAlert = alerts.find(a => a.severity === 'critical');
    if (critAlert) {
      return {
        nodeId: critAlert.nodeId,
        zoneId: critAlert.zoneId,
        source: 'threshold' as const,
        alert: critAlert,
      };
    }

    return null;
  }, [mlPredictions, alerts]);

  if (!emergencyNode) return null;

  const isMl = emergencyNode.source === 'ml';
  const pred = isMl ? emergencyNode.prediction : undefined;
  const severity = pred ? Math.round(pred!.severity * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/50 dark:border-red-600/50 bg-gradient-to-r from-red-500/10 via-red-600/5 to-orange-500/10 dark:from-red-950/40 dark:via-red-900/20 dark:to-orange-950/30 p-4 shadow-lg shadow-red-500/10">
      {/* Animated danger stripe */}
      <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(239,68,68,0.3) 20px, rgba(239,68,68,0.3) 22px)',
            animation: 'slide-stripes 3s linear infinite',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes slide-stripes {
          0% { transform: translateX(-42px); }
          100% { transform: translateX(0); }
        }
      `}</style>

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Emergency Info */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/20 dark:bg-red-900/40 border border-red-500/30 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-red-700 dark:text-red-300 tracking-wide uppercase">
                ⚡ Anomaly Detected — Immediate SOS Action Required
              </h3>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            </div>
            <p className="text-xs text-red-800/80 dark:text-red-200/70 mt-1 font-medium max-w-xl">
              {isMl ? (
                <>
                  <strong className="font-mono">[AI/ML]</strong>{' '}
                  {pred!.anomaly_class.replace(/_/g, ' ')} detected on{' '}
                  <strong className="font-mono text-red-900 dark:text-red-100">{emergencyNode.nodeId}</strong>{' '}
                  ({emergencyNode.zoneId.replace(/_/g, ' ')}) — Severity{' '}
                  <strong>{severity}%</strong> — Alert Level:{' '}
                  <strong>{pred!.alert_level}</strong>
                </>
              ) : (
                <>
                  <strong className="font-mono">[Threshold]</strong>{' '}
                  {emergencyNode.alert?.message} on{' '}
                  <strong className="font-mono text-red-900 dark:text-red-100">{emergencyNode.nodeId}</strong>
                </>
              )}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 text-[9px] font-mono text-red-700/60 dark:text-red-300/50">
              <Radio className="w-3 h-3" />
              <span>Click a button below to dispatch SOS command to the edge node's LED &amp; Buzzer via LoRa Gateway</span>
            </div>
          </div>
        </div>

        {/* Right: SOS Buttons */}
        <div className="shrink-0">
          <SosButtonGroup
            nodeId={emergencyNode.nodeId}
            zoneId={emergencyNode.zoneId}
            actuatorState={edgeActuatorStates[emergencyNode.nodeId]}
            onDispatch={onDispatch}
          />
        </div>
      </div>
    </div>
  );
});
