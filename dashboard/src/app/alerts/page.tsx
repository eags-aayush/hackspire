"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { AlertRuleCard } from '@/components/alerts/AlertRuleCard';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { MlPredictionInspectorModal } from '@/components/common/MlPredictionInspectorModal';
import { DEFAULT_ALERT_RULES } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import { ShadowMlPrediction } from '@/types/ml';
import { SubsidenceAlert } from '@/types/alert';
import {
  ShieldAlert,
  AlertTriangle,
  BellRing,
  Trash2,
  BrainCircuit,
  Zap,
  ExternalLink,
  Flame,
  Layers,
  Volume2,
  VolumeX,
  FileText,
} from 'lucide-react';
import { ReportModal } from '@/components/common/ReportModal';
import { SosEmergencyBanner } from '@/components/alerts/SosEmergencyBanner';
import { buildAlertsReport, ExecutiveReportData } from '@/lib/reportGenerator';

interface MlPredictionCardProps {
  pred: ShadowMlPrediction;
  isAdvisorySent: boolean;
  onInspect: (pred: ShadowMlPrediction) => void;
  onDispatchAdvisory: (nodeId: string) => void;
}

const MlPredictionCard = React.memo(function MlPredictionCard({
  pred,
  isAdvisorySent,
  onInspect,
  onDispatchAdvisory,
}: MlPredictionCardProps) {
  const isDanger =
    pred.anomaly_class === 'subsidence_risk' ||
    pred.alert_level === 'RED' ||
    pred.alert_level === 'ORANGE';
  const isNoise = pred.anomaly_class === 'equipment_noise';
  const confidence = Math.round((pred.class_probs?.[pred.anomaly_class] || 0) * 100);
  const severityPct = Math.round(pred.severity * 100);

  return (
    <Card
      className={`p-4 border transition-all hover:shadow-md flex flex-col justify-between ${
        isDanger
          ? 'border-red-500/60 bg-red-500/5 dark:bg-red-950/20 ring-1 ring-red-500/30'
          : isNoise
          ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/15'
          : 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/15'
      }`}
    >
      <div>
        {/* Top Row: Node ID & Alert Badge */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-[#000000] dark:text-white font-mono">
                {pred.nodeId}
              </h4>
              {isDanger && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </div>
            <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
              Zone: {pred.zoneId}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge
              variant={isDanger ? 'danger' : isNoise ? 'warning' : 'success'}
              pulse={isDanger}
              className="text-[10px] uppercase font-mono font-bold"
            >
              {pred.alert_level}
            </Badge>
            <span className="text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8] flex items-center gap-0.5">
              <Zap className="w-3 h-3 text-amber-500" />
              {pred.inferenceLatencyMs}ms
            </span>
          </div>
        </div>

        {/* Detection Class & Confidence */}
        <div className="flex items-center justify-between my-2 text-xs">
          <span className="font-medium text-[#5c677d] dark:text-[#94a3b8]">Detection:</span>
          <span
            className={`font-bold uppercase tracking-wider text-[11px] flex items-center gap-1 ${
              isDanger
                ? 'text-red-600 dark:text-red-400'
                : isNoise
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {pred.anomaly_class.replace(/_/g, ' ')} ({confidence}%)
          </span>
        </div>

        {/* Severity Meter */}
        <div className="space-y-1 my-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
            <span>Subsidence Severity</span>
            <span className="font-bold text-[#000000] dark:text-white">{severityPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                severityPct > 60
                  ? 'bg-red-500'
                  : severityPct > 20
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, severityPct))}%` }}
            />
          </div>
        </div>

        {/* Multi-channel Probabilities Grid */}
        <div className="grid grid-cols-3 gap-1 pt-2 border-t border-black/5 dark:border-white/5 text-[9px] font-mono text-center">
          <div className="p-1 rounded bg-black/5 dark:bg-white/5">
            <div className="text-[#5c677d] dark:text-[#94a3b8]">Norm</div>
            <div className="font-bold">{Math.round((pred.class_probs?.normal || 0) * 100)}%</div>
          </div>
          <div className="p-1 rounded bg-black/5 dark:bg-white/5">
            <div className="text-[#5c677d] dark:text-[#94a3b8]">Noise</div>
            <div className="font-bold">{Math.round((pred.class_probs?.equipment_noise || 0) * 100)}%</div>
          </div>
          <div className="p-1 rounded bg-black/5 dark:bg-white/5">
            <div className="text-[#5c677d] dark:text-[#94a3b8]">Risk</div>
            <div className="font-bold text-red-500">
              {Math.round((pred.class_probs?.subsidence_risk || 0) * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Card Actions */}
      <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
        <button
          onClick={() => onInspect(pred)}
          className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <ExternalLink className="w-3 h-3" />
          Inspect &amp; Confirm
        </button>

        {isDanger && (
          <button
            onClick={() => onDispatchAdvisory(pred.nodeId)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all active:scale-95 ${
              isAdvisorySent
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
            }`}
          >
            {isAdvisorySent ? 'Advisory Dispatched!' : 'Dispatch Safety Crew'}
          </button>
        )}
      </div>
    </Card>
  );
});

interface AlertRowProps {
  alert: SubsidenceAlert;
}

const AlertRow = React.memo(function AlertRow({ alert }: AlertRowProps) {
  const isCritical = alert.severity === 'critical';
  const isMlAlert = alert.message.includes('[AI/ML Early Warning]');

  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#f4f5f7]/80 dark:hover:bg-[#14213d]/40 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-xl border mt-0.5 ${
            isCritical
              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
              : isMlAlert
              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
              : 'bg-[#fca311]/15 text-amber-800 dark:text-[#fca311] border-[#fca311]/40'
          }`}
        >
          {isCritical ? (
            <ShieldAlert className="w-4 h-4" />
          ) : isMlAlert ? (
            <BrainCircuit className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-[#000000] dark:text-white tracking-wide">
              {alert.message}
            </h4>
            <Badge
              variant={isCritical ? 'danger' : isMlAlert ? 'info' : 'warning'}
              pulse={isCritical}
              className="text-[10px] uppercase font-mono font-bold"
            >
              {isMlAlert ? 'AI/ML Warning' : alert.severity}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
            <span>Node: <strong className="text-[#000000] dark:text-white">{alert.nodeId}</strong></span>
            <span>Zone: <strong className="text-[#14213d] dark:text-[#fca311]">{alert.zoneId}</strong></span>
            <span>Value: <strong className="text-[#14213d] dark:text-[#fca311]">{alert.value} {alert.unit}</strong></span>
            <span>Threshold: {alert.threshold} {alert.unit}</span>
          </div>
        </div>
      </div>

      <span className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono self-start sm:self-auto shrink-0">
        {formatRelativeTime(alert.timestamp)}
      </span>
    </div>
  );
});

export default function AlertsPage() {
  const {
    alerts,
    clearAlerts,
    mlPredictions,
    triggerDemoMlEvent,
    voiceAlertsEnabled,
    toggleVoiceAlerts,
    testVoiceAlert,
    isSpeaking,
    lastSpokenMessage,
    stats,
    metrics,
    edgeActuatorStates,
    dispatchEdgeAlert,
  } = useRealtime();
  const [activeTab, setActiveTab] = useState<'all' | 'ml' | 'hardware'>('all');
  const [selectedMlPrediction, setSelectedMlPrediction] = useState<ShadowMlPrediction | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [advisorySentNodes, setAdvisorySentNodes] = useState<Record<string, boolean>>({});

  // Safety Incident Dossier Report State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState<ExecutiveReportData | null>(null);

  const handleGenerateReport = () => {
    const report = buildAlertsReport({
      alerts,
      mlPredictions,
      stats,
      metrics,
    });
    setReportData(report);
    setIsReportOpen(true);
  };

  // Flatten all active ML predictions across all zones
  const activeMlPredictions = useMemo(() => {
    return Object.values(mlPredictions || {})
      .flatMap(zoneMap => Object.values(zoneMap || {}))
      .filter(Boolean);
  }, [mlPredictions]);

  // Identify active subsidence risk predictions
  const criticalMlPredictions = useMemo(() => {
    return activeMlPredictions.filter(
      p => p.anomaly_class === 'subsidence_risk' || p.alert_level === 'RED' || p.alert_level === 'ORANGE'
    );
  }, [activeMlPredictions]);

  // Categorize alerts and calculate counts in a single pass
  const { criticalCount, warningCount, mlAlerts, hardwareAlerts } = useMemo(() => {
    let crit = 0;
    let warn = 0;
    const ml: SubsidenceAlert[] = [];
    const hw: SubsidenceAlert[] = [];

    for (const a of alerts) {
      if (a.severity === 'critical') crit++;
      else if (a.severity === 'warning') warn++;

      if (a.message.includes('[AI/ML Early Warning]')) {
        ml.push(a);
      } else {
        hw.push(a);
      }
    }

    return { criticalCount: crit, warningCount: warn, mlAlerts: ml, hardwareAlerts: hw };
  }, [alerts]);

  const displayedAlerts = useMemo(() => {
    if (activeTab === 'ml') return mlAlerts;
    if (activeTab === 'hardware') return hardwareAlerts;
    return alerts;
  }, [activeTab, alerts, mlAlerts, hardwareAlerts]);

  const handleInspect = useCallback((prediction: ShadowMlPrediction) => {
    setSelectedMlPrediction(prediction);
    setIsInspectorOpen(true);
  }, []);

  const handleDispatchAdvisory = useCallback((nodeId: string) => {
    setAdvisorySentNodes(prev => ({ ...prev, [nodeId]: true }));
    setTimeout(() => {
      setAdvisorySentNodes(prev => ({ ...prev, [nodeId]: false }));
    }, 4000);
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#000000] dark:text-white tracking-wide flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            Subsidence Early Warning &amp; Safety Alerts
          </h1>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-1 font-medium">
            Real-time CNN-BiLSTM deep learning inference, physical sensor thresholds &amp; automated hazard dispatch
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Voice Alert Toggle Button */}
          <button
            onClick={toggleVoiceAlerts}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-sm ${
              voiceAlertsEnabled
                ? isSpeaking
                  ? 'bg-red-500/20 border-red-500 text-red-600 dark:text-red-400 animate-pulse'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-[#fca311]'
                : 'bg-[#f4f5f7] dark:bg-[#14213d] text-[#5c677d] dark:text-[#94a3b8] border-[#e5e5e5] dark:border-[#14213d]'
            }`}
            title="Toggle Voice Alerts (Web Speech API & Industrial Chimes)"
          >
            {voiceAlertsEnabled ? (
              <>
                <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-bounce text-red-500' : 'text-[#fca311]'}`} />
                <span>{isSpeaking ? 'Speaking Alert...' : 'Voice Alerts: ON'}</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Voice Alerts: OFF</span>
              </>
            )}
          </button>

          {/* Test Voice Audio Button */}
          <button
            onClick={testVoiceAlert}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d] dark:hover:bg-[#14213d]/80 text-[#14213d] dark:text-[#e5e5e5] border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono transition-all hover:scale-105 active:scale-95"
            title="Play test emergency audio chime and speech announcement"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#fca311]" />
            Test Voice
          </button>

          {alerts.length > 0 && (
            <button
              onClick={clearAlerts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d] dark:hover:bg-[#14213d]/80 text-xs text-[#14213d] dark:text-[#e5e5e5] border border-[#e5e5e5] dark:border-[#14213d] transition-all hover:scale-105"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Log
            </button>
          )}

          <button
            onClick={() => triggerDemoMlEvent('NODE_03', 'subsidence_risk')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold font-mono transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            Simulate ML Risk
          </button>

          {/* Incident Dossier Report Button */}
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 text-xs font-mono font-bold tracking-wide transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Generate DGMS Geotechnical Safety Incident Audit Dossier"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Incident Dossier</span>
          </button>

          <div className="px-3.5 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#14213d]/70 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono text-[#14213d] dark:text-[#e5e5e5] shadow-sm">
            Active: <span className="text-red-600 dark:text-red-400 font-bold">{criticalCount} Crit</span> /{' '}
            <span className="text-amber-600 dark:text-[#fca311] font-bold">{warningCount} Warn</span>
          </div>
        </div>
      </div>

      {/* SOS Emergency Anomaly Banner */}
      <SosEmergencyBanner
        alerts={alerts}
        mlPredictions={mlPredictions}
        edgeActuatorStates={edgeActuatorStates}
        onDispatch={dispatchEdgeAlert}
      />

      {/* Real-Time Live Voice Announcer Speech Indicator (Stable visual container, zero layout jump) */}
      {lastSpokenMessage && (
        <div
          className={`p-3 rounded-2xl border text-xs font-mono transition-all duration-300 flex items-center justify-between gap-3 shadow-sm ${
            isSpeaking
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-950 dark:text-amber-200 ring-2 ring-amber-500/30 animate-pulse'
              : 'bg-[#f4f5f7] dark:bg-[#14213d]/50 border-[#e5e5e5] dark:border-[#14213d] text-[#5c677d] dark:text-[#94a3b8]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-lg transition-colors ${
                isSpeaking
                  ? 'bg-amber-500 text-black animate-bounce'
                  : 'bg-black/5 dark:bg-white/10 text-[#5c677d] dark:text-[#94a3b8]'
              }`}
            >
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold uppercase tracking-wider text-[10px] block opacity-80">
                {isSpeaking ? 'Control Room Voice Announcer Broadcasting:' : 'Last Voice Advisory Broadcast:'}
              </span>
              <span className={`font-medium text-xs sm:text-sm ${isSpeaking ? 'text-black dark:text-white font-bold' : ''}`}>
                &ldquo;{lastSpokenMessage}&rdquo;
              </span>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
              isSpeaking
                ? 'bg-amber-500 text-black animate-pulse'
                : 'bg-black/5 dark:bg-white/10 text-[#5c677d] dark:text-[#94a3b8]'
            }`}
          >
            {isSpeaking ? 'AUDIO LIVE' : 'COMPLETED'}
          </span>
        </div>
      )}

      {/* Critical Subsidence Early Warning Emergency Banner */}
      {criticalMlPredictions.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-500/15 border-2 border-red-500/60 dark:border-red-500/80 shadow-lg animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-red-600 text-white shadow-md">
              <ShieldAlert className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono uppercase bg-red-600 text-white">
                  URGENT EARLY WARNING
                </span>
                <span className="text-xs font-mono text-red-700 dark:text-red-300 font-bold">
                  {criticalMlPredictions.length} Node(s) Exhibiting Subsidence Precursor Dynamics
                </span>
              </div>
              <p className="text-sm font-black text-red-950 dark:text-red-100 mt-1">
                Multi-channel neural network detected imminent ground subsidence pattern on{' '}
                {criticalMlPredictions.map(p => `${p.nodeId} (${p.zoneId})`).join(', ')}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => handleInspect(criticalMlPredictions[0])}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-bold transition-all shadow-md active:scale-95"
            >
              Inspect Risk Window
            </button>
          </div>
        </div>
      )}

      {/* Dual Stream Filter Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/95 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d] shadow-sm flex-wrap">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all ${
            activeTab === 'all'
              ? 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-black shadow-sm'
              : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Incidents</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-black/10 dark:bg-white/10">
            {alerts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ml')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all ${
            activeTab === 'ml'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-purple-600 dark:hover:text-purple-400'
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          <span>AI/ML Early Warnings</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-200 font-bold">
            {mlAlerts.length}
          </span>
          {criticalMlPredictions.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('hardware')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all ${
            activeTab === 'hardware'
              ? 'bg-amber-500 text-black shadow-sm'
              : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Hardware Threshold Breaches</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-black/10 dark:bg-white/10">
            {hardwareAlerts.length}
          </span>
        </button>
      </div>

      {/* AI/ML Deep Learning Early Warning Assessments Grid */}
      {(activeTab === 'all' || activeTab === 'ml') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#000000] dark:text-white tracking-wide flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
              AI/ML Subsidence Model Assessments (Shadow Mode §10.6)
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                {activeMlPredictions.length} Nodes Inferred
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hidden sm:inline">
                Serving: baseline_latest.pt
              </span>
            </div>
          </div>

          {activeMlPredictions.length === 0 ? (
            <Card className="p-8 text-center text-xs text-[#5c677d] dark:text-[#94a3b8] border-[#e5e5e5] dark:border-[#14213d] bg-white/95 dark:bg-[#14213d]/30">
              <BrainCircuit className="w-8 h-8 mx-auto mb-2 text-purple-500/60 animate-pulse" />
              <p className="font-semibold text-sm text-[#000000] dark:text-white mb-1">
                Awaiting Telemetry Stream to Prime 32-Sample Window
              </p>
              <p className="max-w-md mx-auto">
                Model inference microservice is active at port 8000. Click &quot;Simulate ML Risk&quot; above to push real-time test inference events.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeMlPredictions.map(pred => (
                <MlPredictionCard
                  key={`${pred.zoneId}-${pred.nodeId}`}
                  pred={pred}
                  isAdvisorySent={!!advisorySentNodes[pred.nodeId]}
                  onInspect={handleInspect}
                  onDispatchAdvisory={handleDispatchAdvisory}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Safety Threshold Rules Grid (Hidden in ML-only tab) */}
      {activeTab !== 'ml' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#000000] dark:text-white tracking-wide flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#fca311]" />
            Predefined Physical Safety Thresholds
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DEFAULT_ALERT_RULES.map(rule => (
              <AlertRuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        </div>
      )}

      {/* Live Incident Stream */}
      <Card className="p-0 overflow-hidden bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d]">
        <div className="p-4 border-b border-[#e5e5e5] dark:border-[#14213d] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#000000] dark:text-white tracking-wide flex items-center gap-2">
              <span>Live Alert &amp; Incident Stream</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 font-normal">
                {displayedAlerts.length} events
              </span>
            </h3>
            <p className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] mt-0.5">
              Filtered view: <strong className="capitalize">{activeTab}</strong> alerts in session
            </p>
          </div>
        </div>

        {displayedAlerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#5c677d] dark:text-[#94a3b8] italic">
            No active incidents matching current filter criteria. System telemetry operating in normal range.
          </div>
        ) : (
          <div className="divide-y divide-[#e5e5e5] dark:divide-[#14213d]/80">
            {displayedAlerts.map(alert => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </Card>

      {/* Reusable ML Prediction Inspector Modal */}
      <MlPredictionInspectorModal
        prediction={selectedMlPrediction}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />

      {/* DGMS Safety Incident Dossier Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        report={reportData}
      />
    </div>
  );
}
