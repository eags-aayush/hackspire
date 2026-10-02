"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShadowMlPrediction } from '@/types/ml';
import { Badge } from '@/components/common/Badge';
import { formatRelativeTime } from '@/lib/utils';
import {
  BrainCircuit,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  X,
  Layers,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

interface MlPredictionInspectorModalProps {
  prediction: ShadowMlPrediction | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MlPredictionInspectorModal({
  prediction,
  isOpen,
  onClose,
}: MlPredictionInspectorModalProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !prediction || !mounted) return null;

  const isRisk = prediction.anomaly_class === 'subsidence_risk';
  const isNoise = prediction.anomaly_class === 'equipment_noise';
  const confidencePct = Math.round(
    (prediction.class_probs?.[prediction.anomaly_class] || 0) * 100
  );
  const severityPct = Math.round(prediction.severity * 100);

  const normalPct = Math.round((prediction.class_probs?.normal || 0) * 100);
  const noisePct = Math.round((prediction.class_probs?.equipment_noise || 0) * 100);
  const riskPct = Math.round((prediction.class_probs?.subsidence_risk || 0) * 100);

  const handleConfirmLabel = async (label: 'normal' | 'equipment_noise' | 'subsidence_risk') => {
    setIsSubmitting(true);
    try {
      if (prediction.predictionId) {
        // Attempt to call backend SQLite prediction log confirmation
        await fetch(`http://localhost:3001/ml/predictions/${encodeURIComponent(prediction.predictionId)}/confirm`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed_label: label }),
        }).catch(() => {});
      }
      setFeedbackSubmitted(label);
    } catch {
      setFeedbackSubmitted(label);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ml-inspector-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#0d1527] border border-[#e5e5e5] dark:border-[#14213d] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#e5e5e5] dark:border-[#14213d]/80 flex items-center justify-between bg-black/5 dark:bg-black/20">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                isRisk
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                  : isNoise
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
              }`}
            >
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h3 id="ml-inspector-title" className="text-sm font-bold text-[#000000] dark:text-white font-mono flex items-center gap-2">
                ML Assessment Inspector
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  SHADOW MODE
                </span>
              </h3>
              <p className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
                Node: <strong className="text-[#000000] dark:text-white">{prediction.nodeId}</strong> • Zone: {prediction.zoneId}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close inspector modal"
            className="p-1.5 rounded-xl text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Main Anomaly Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
              isRisk
                ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                : isNoise
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider font-bold opacity-80">
                Primary Classification
              </div>
              <div className="text-base font-black uppercase tracking-wide flex items-center gap-2 mt-0.5">
                {isRisk ? <ShieldAlert className="w-5 h-5 text-red-600" /> : null}
                {prediction.anomaly_class.replace(/_/g, ' ')}
                <span className="text-xs font-mono font-bold opacity-90">({confidencePct}%)</span>
              </div>
            </div>

            <div className="text-right">
              <Badge
                variant={isRisk ? 'danger' : isNoise ? 'warning' : 'success'}
                pulse={isRisk}
                className="text-xs font-mono uppercase font-black px-2.5 py-1"
              >
                Level: {prediction.alert_level}
              </Badge>
              <div className="text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8] mt-1 flex items-center justify-end gap-1">
                <Zap className="w-3 h-3 text-[#fca311]" />
                {prediction.inferenceLatencyMs}ms
              </div>
            </div>
          </div>

          {/* Probability Distribution */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#000000] dark:text-white tracking-wide uppercase font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Softmax Probability Distribution
            </h4>

            <div className="space-y-2.5 text-xs font-mono">
              {/* Normal */}
              <div className="space-y-1">
                <div className="flex justify-between text-[#5c677d] dark:text-[#94a3b8]">
                  <span>Normal Operation:</span>
                  <span className="font-bold text-[#000000] dark:text-white">{normalPct}%</span>
                </div>
                <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, normalPct)}%` }}
                  />
                </div>
              </div>

              {/* Equipment Noise */}
              <div className="space-y-1">
                <div className="flex justify-between text-[#5c677d] dark:text-[#94a3b8]">
                  <span>Equipment Noise:</span>
                  <span className="font-bold text-[#000000] dark:text-white">{noisePct}%</span>
                </div>
                <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, noisePct)}%` }}
                  />
                </div>
              </div>

              {/* Subsidence Risk */}
              <div className="space-y-1">
                <div className="flex justify-between text-[#5c677d] dark:text-[#94a3b8]">
                  <span className="font-bold text-red-600 dark:text-red-400">Subsidence Risk:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{riskPct}%</span>
                </div>
                <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, riskPct)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Severity & Parameters */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs font-mono">
            <div>
              <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8]">Continuous Severity</span>
              <div className="text-base font-bold text-[#000000] dark:text-white mt-0.5">
                {severityPct}%
              </div>
            </div>
            <div>
              <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8]">Window / Stride</span>
              <div className="text-sm font-bold text-[#000000] dark:text-white mt-0.5">
                {prediction.windowLen || 32} / {prediction.stride || 4}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8]">Serving Checkpoint</span>
              <div className="text-[11px] font-bold text-[#14213d] dark:text-[#fca311] truncate mt-0.5">
                {prediction.model_version || 'baseline_latest.pt'}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8]">Timestamp</span>
              <div className="text-[11px] font-bold text-[#000000] dark:text-white truncate mt-0.5">
                {formatRelativeTime(prediction.timestamp)}
              </div>
            </div>
          </div>

          {/* Ground Truth Confirmation Feedback Section */}
          <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#000000] dark:text-white tracking-wide font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Operator Ground Truth Feedback Loop
              </span>
              {feedbackSubmitted && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Confirmed: {feedbackSubmitted}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#5c677d] dark:text-[#94a3b8]">
              Verify or correct model prediction for the offline continuous retraining dataset:
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                disabled={isSubmitting || !!feedbackSubmitted}
                onClick={() => handleConfirmLabel('subsidence_risk')}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-mono bg-red-500/15 hover:bg-red-500/25 text-red-700 dark:text-red-300 border border-red-500/30 transition-all active:scale-95 disabled:opacity-50"
              >
                Confirm Subsidence
              </button>
              <button
                disabled={isSubmitting || !!feedbackSubmitted}
                onClick={() => handleConfirmLabel('equipment_noise')}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-mono bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition-all active:scale-95 disabled:opacity-50"
              >
                Flag Noise
              </button>
              <button
                disabled={isSubmitting || !!feedbackSubmitted}
                onClick={() => handleConfirmLabel('normal')}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-mono bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition-all active:scale-95 disabled:opacity-50"
              >
                Confirm Normal
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#e5e5e5] dark:border-[#14213d]/80 bg-black/5 dark:bg-black/20 flex items-center justify-between text-xs">
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] italic">
            ML §10.6 Non-interfering shadow prediction
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#14213d] text-white dark:bg-[#fca311] dark:text-black font-bold text-xs hover:opacity-90 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
