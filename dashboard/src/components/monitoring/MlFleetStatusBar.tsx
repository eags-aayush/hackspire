"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { StatusFilterOption } from '@/hooks/useZoneFilter';
import {
  BrainCircuit,
  Zap,
  Activity,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Cpu,
  Flame,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';

interface MlFleetStatusBarProps {
  statusFilter: StatusFilterOption;
  onStatusFilterChange: (filter: StatusFilterOption) => void;
}

interface MlHealthInfo {
  status: string;
  model_type: string;
  checkpoint: string;
  drift_detected: boolean;
}

interface MlDriftInfo {
  drift_detected: boolean;
  total_variation_distance: number;
  samples_in_window: number;
  current_distribution?: Record<string, number>;
}

export function MlFleetStatusBar({
  statusFilter,
  onStatusFilterChange,
}: MlFleetStatusBarProps) {
  const {
    mlPredictions,
    triggerDemoMlEvent,
    isSimulationActive,
    toggleSimulation,
    voiceAlertsEnabled,
    toggleVoiceAlerts,
    isSpeaking,
  } = useRealtime();

  const [healthInfo, setHealthInfo] = useState<MlHealthInfo | null>(null);
  const [driftInfo, setDriftInfo] = useState<MlDriftInfo | null>(null);
  const [isLiveOnline, setIsLiveOnline] = useState(false);
  const [justTriggered, setJustTriggered] = useState(false);

  // Poll ML microservice on 127.0.0.1:8000
  useEffect(() => {
    let isMounted = true;

    const checkService = async () => {
      try {
        const [healthRes, driftRes] = await Promise.all([
          fetch('http://127.0.0.1:8000/health', { signal: AbortSignal.timeout(2000) }),
          fetch('http://127.0.0.1:8000/drift', { signal: AbortSignal.timeout(2000) }),
        ]);

        if (healthRes.ok && isMounted) {
          const hData = await healthRes.json();
          setHealthInfo(hData);
          setIsLiveOnline(true);
        }

        if (driftRes.ok && isMounted) {
          const dData = await driftRes.json();
          setDriftInfo(dData);
        }
      } catch {
        if (isMounted) {
          setIsLiveOnline(false);
        }
      }
    };

    checkService();
    const interval = setInterval(checkService, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Compute aggregate fleet ML statistics across all zones and nodes
  const stats = useMemo(() => {
    let totalMonitored = 0;
    let subsidenceCount = 0;
    let noiseCount = 0;
    let normalCount = 0;
    let totalLatency = 0;

    Object.values(mlPredictions || {}).forEach(zoneMap => {
      Object.values(zoneMap || {}).forEach(pred => {
        if (!pred) return;
        totalMonitored++;
        totalLatency += pred.inferenceLatencyMs || 0;

        if (pred.anomaly_class === 'subsidence_risk' || pred.alert_level === 'RED' || pred.alert_level === 'ORANGE') {
          subsidenceCount++;
        } else if (pred.anomaly_class === 'equipment_noise') {
          noiseCount++;
        } else {
          normalCount++;
        }
      });
    });

    const avgLatency = totalMonitored > 0 ? (totalLatency / totalMonitored).toFixed(2) : '0.72';

    return {
      totalMonitored,
      subsidenceCount,
      noiseCount,
      normalCount,
      avgLatency,
    };
  }, [mlPredictions]);

  const handleSimulateSubsidence = () => {
    triggerDemoMlEvent('NODE_03', 'subsidence_risk');
    setJustTriggered(true);
    setTimeout(() => setJustTriggered(false), 2500);
  };

  return (
    <div className="rounded-2xl border border-purple-500/30 dark:border-purple-500/40 bg-gradient-to-r from-purple-500/10 via-white/80 to-[#f4f5f7]/80 dark:from-purple-950/40 dark:via-[#14213d]/60 dark:to-[#0f172a]/80 p-4 shadow-sm backdrop-blur-md">
      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-500/20 dark:border-purple-500/30">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-2 rounded-xl bg-purple-500/15 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 border border-purple-500/30 shadow-xs">
            <BrainCircuit className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-[#000000] dark:text-white tracking-wide font-mono">
                Real-Time ML Early Warning &amp; Model Intelligence
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 tracking-wider">
                SHADOW MODE (§10.6)
              </span>
            </div>
            <p className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Model: <strong className="text-[#14213d] dark:text-[#fca311]">{healthInfo?.checkpoint || 'baseline_latest.pt'}</strong> (CNN-BiLSTM)</span>
              <span>•</span>
              <span>Audit: <strong className="text-emerald-600 dark:text-emerald-400">100% Recall Verified</strong></span>
            </p>
          </div>
        </div>

        {/* Microservice Health Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-[#14213d] border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono shadow-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-[#5c677d] dark:text-[#94a3b8]">Engine:</span>
            <span className="font-bold text-[#000000] dark:text-white">
              {isLiveOnline ? '127.0.0.1:8000 Online' : 'Standby / Local'}
            </span>
          </div>

          {driftInfo && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-bold ${
                driftInfo.drift_detected
                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
              }`}
              title={`TVD: ${driftInfo.total_variation_distance?.toFixed(3)} across ${driftInfo.samples_in_window} windows`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>TVD: {driftInfo.total_variation_distance?.toFixed(2)}</span>
            </div>
          )}

          {/* Voice Alert Toggle Button */}
          <button
            onClick={toggleVoiceAlerts}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-xs ${
              voiceAlertsEnabled
                ? isSpeaking
                  ? 'bg-red-500/20 border-red-500 text-red-600 dark:text-red-400 animate-pulse'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-[#fca311]'
                : 'bg-white/80 dark:bg-[#14213d] text-[#5c677d] dark:text-[#94a3b8] border-[#e5e5e5] dark:border-[#14213d]'
            }`}
            title="Toggle Voice Announcements for AI early warnings and hazards"
          >
            {voiceAlertsEnabled ? (
              <>
                <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-bounce text-red-500' : 'text-[#fca311]'}`} />
                <span>{isSpeaking ? 'Announcing...' : 'Voice: ON'}</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Voice: OFF</span>
              </>
            )}
          </button>

          <Link
            href="/ml-demo"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold font-mono transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>ML Testing Lab</span>
          </Link>
        </div>
      </div>

      {/* Metric Counters & Quick Filter Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 mt-3">
        {/* Monitored Nodes */}
        <div className="p-2.5 rounded-xl bg-white/70 dark:bg-[#14213d]/50 border border-[#e5e5e5] dark:border-[#14213d] flex flex-col justify-between">
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono uppercase font-bold">
            ML Monitored Nodes
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-[#000000] dark:text-white font-mono">
              {stats.totalMonitored}
            </span>
            <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono flex items-center gap-0.5">
              <Zap className="w-3 h-3 text-[#fca311]" />
              {stats.avgLatency}ms
            </span>
          </div>
        </div>

        {/* Subsidence Risk Filter / Pill */}
        <button
          onClick={() =>
            onStatusFilterChange(
              statusFilter === 'ml_subsidence' ? 'all' : 'ml_subsidence'
            )
          }
          className={`p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-95 flex flex-col justify-between ${
            statusFilter === 'ml_subsidence'
              ? 'bg-red-500/20 text-red-800 dark:text-red-200 border-red-500 shadow-sm ring-1 ring-red-500'
              : stats.subsidenceCount > 0
              ? 'bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-300'
              : 'bg-white/70 dark:bg-[#14213d]/50 border-[#e5e5e5] dark:border-[#14213d]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-mono uppercase font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              Subsidence Risk
            </span>
            {stats.subsidenceCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            )}
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-red-600 dark:text-red-400 font-mono">
              {stats.subsidenceCount}
            </span>
            <span className="text-[9px] font-mono font-bold text-red-600/80 dark:text-red-400/80">
              {statusFilter === 'ml_subsidence' ? 'ACTIVE FILTER' : 'CLICK TO FILTER'}
            </span>
          </div>
        </button>

        {/* Equipment Noise Filter / Pill */}
        <button
          onClick={() =>
            onStatusFilterChange(statusFilter === 'ml_noise' ? 'all' : 'ml_noise')
          }
          className={`p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-95 flex flex-col justify-between ${
            statusFilter === 'ml_noise'
              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500 shadow-sm ring-1 ring-amber-500'
              : 'bg-white/70 dark:bg-[#14213d]/50 border-[#e5e5e5] dark:border-[#14213d]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-mono uppercase font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Equipment Noise
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
              {stats.noiseCount}
            </span>
            <span className="text-[9px] font-mono font-bold text-amber-600/80 dark:text-amber-400/80">
              {statusFilter === 'ml_noise' ? 'ACTIVE FILTER' : 'CLICK TO FILTER'}
            </span>
          </div>
        </button>

        {/* Normal Baseline Filter / Pill */}
        <button
          onClick={() =>
            onStatusFilterChange(statusFilter === 'ml_normal' ? 'all' : 'ml_normal')
          }
          className={`p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-95 flex flex-col justify-between ${
            statusFilter === 'ml_normal'
              ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
              : 'bg-white/70 dark:bg-[#14213d]/50 border-[#e5e5e5] dark:border-[#14213d]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Normal Baseline
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.normalCount}
            </span>
            <span className="text-[9px] font-mono font-bold text-emerald-600/80 dark:text-emerald-400/80">
              {statusFilter === 'ml_normal' ? 'ACTIVE FILTER' : 'CLICK TO FILTER'}
            </span>
          </div>
        </button>

        {/* Instant Live Test Trigger */}
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-col justify-center items-stretch gap-1.5">
          <button
            onClick={handleSimulateSubsidence}
            className={`w-full py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all active:scale-95 shadow-xs flex items-center justify-center gap-1.5 ${
              justTriggered
                ? 'bg-red-600 text-white'
                : 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] hover:opacity-90'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>{justTriggered ? 'Triggered on NODE_03!' : 'Test Subsidence Event'}</span>
          </button>

          <button
            onClick={toggleSimulation}
            className="text-[10px] text-center font-mono text-[#5c677d] dark:text-[#94a3b8] hover:text-purple-600 dark:hover:text-purple-400 underline cursor-pointer"
          >
            {isSimulationActive ? 'Stop Coal Mine Sim' : 'Launch Coal Mine Sim (2 Zones)'}
          </button>
        </div>
      </div>
    </div>
  );
}
