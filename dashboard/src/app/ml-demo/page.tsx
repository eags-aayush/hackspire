"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  BrainCircuit,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Play,
  Square,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Radio,
  Sliders,
  RefreshCw,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { ReportModal } from '@/components/common/ReportModal';
import { buildMlDemoReport, ExecutiveReportData } from '@/lib/reportGenerator';

interface PredictionResponse {
  anomaly_class: string;
  class_probs: {
    normal: number;
    equipment_noise: number;
    subsidence_risk: number;
  };
  severity: number;
  alert_level: string;
  model_version: string;
}

interface DriftResponse {
  drift_detected: boolean;
  total_variation_distance: number;
  current_distribution: Record<string, number>;
  baseline_distribution: Record<string, number>;
  samples_in_window: number;
  total_predictions: number;
  message: string;
}

const SENSOR_CHANNELS = [
  { key: 'tilt_x_deg', label: 'Primary Ground Tilt X', unit: '°', min: -5.0, max: 5.0, step: 0.05, desc: 'Biaxial IMU ground inclination' },
  { key: 'tilt_y_deg', label: 'Secondary Ground Tilt Y', unit: '°', min: -5.0, max: 5.0, step: 0.05, desc: 'Biaxial IMU cross-axis tilt' },
  { key: 'vibration_amplitude_g', label: 'Vibration Amplitude', unit: 'g', min: 0.0, max: 2.5, step: 0.02, desc: 'Peak dynamic acceleration probe' },
  { key: 'vibration_freq_hz', label: 'Vibration Frequency', unit: 'Hz', min: 0, max: 120, step: 1, desc: 'Dominant frequency from FFT' },
  { key: 'crack_displacement_mm', label: 'Crack Aperture / Disp.', unit: 'mm', min: 0.0, max: 25.0, step: 0.2, desc: 'LVDT structural crack sensor' },
  { key: 'water_level_cm', label: 'Groundwater / Piezometer', unit: 'cm', min: 0, max: 150, step: 1, desc: 'Hydrostatic aquifer / sump level' },
  { key: 'gas_ppm', label: 'Toxic Gas (CH4 / CO)', unit: 'ppm', min: 0, max: 100, step: 1, desc: 'Electrochemical gas probe' },
  { key: 'temperature_c', label: 'Ambient Temperature', unit: '°C', min: 10, max: 50, step: 0.5, desc: 'Thermal environmental baseline' },
  { key: 'humidity_pct', label: 'Relative Humidity', unit: '%', min: 20, max: 100, step: 1, desc: 'Atmospheric humidity baseline' },
];

const PRESETS = {
  normal: {
    name: '🌿 Normal Quiet Baseline',
    desc: 'Normal mine floor, zero tilt, quiet vibrations',
    values: {
      tilt_x_deg: 0.05, tilt_y_deg: 0.02, vibration_amplitude_g: 0.03, vibration_freq_hz: 12,
      crack_displacement_mm: 0.2, water_level_cm: 15, gas_ppm: 12, temperature_c: 24.5, humidity_pct: 65,
    },
  },
  drilling: {
    name: '⛏️ Equipment / Drill Noise',
    desc: 'High mechanical vibration without ground tilt',
    values: {
      tilt_x_deg: 0.12, tilt_y_deg: 0.08, vibration_amplitude_g: 1.45, vibration_freq_hz: 68,
      crack_displacement_mm: 0.4, water_level_cm: 18, gas_ppm: 14, temperature_c: 28.0, humidity_pct: 62,
    },
  },
  early_sub: {
    name: '⚠️ Early Subsidence Creep',
    desc: 'Biaxial tilt acceleration & expanding crack aperture',
    values: {
      tilt_x_deg: 1.85, tilt_y_deg: 0.95, vibration_amplitude_g: 0.18, vibration_freq_hz: 24,
      crack_displacement_mm: 6.8, water_level_cm: 45, gas_ppm: 26, temperature_c: 26.2, humidity_pct: 78,
    },
  },
  critical_sub: {
    name: '🚨 Critical Ground Collapse',
    desc: 'High tilt, acute aperture opening, acoustic vibration',
    values: {
      tilt_x_deg: 4.20, tilt_y_deg: 2.85, vibration_amplitude_g: 0.85, vibration_freq_hz: 38,
      crack_displacement_mm: 19.4, water_level_cm: 85, gas_ppm: 48, temperature_c: 29.5, humidity_pct: 88,
    },
  },
};

export default function MLDemoPage() {
  const [sensorValues, setSensorValues] = useState<Record<string, number>>(PRESETS.normal.values);
  const [activePreset, setActivePreset] = useState<string>('normal');
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [driftStatus, setDriftStatus] = useState<DriftResponse | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [activeCheckpoint, setActiveCheckpoint] = useState<string>('baseline_latest.pt');
  const streamRef = useRef<NodeJS.Timeout | null>(null);

  // Model Validation Audit Report State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState<ExecutiveReportData | null>(null);

  const handleGenerateReport = () => {
    const report = buildMlDemoReport({
      sensorValues,
      prediction,
      driftStatus,
      activePreset,
      activeCheckpoint,
    });
    setReportData(report);
    setIsReportOpen(true);
  };

  const ML_BASE_URL = 'http://127.0.0.1:8000';

  // Check ML Service health on mount
  useEffect(() => {
    checkHealth();
    runInference(PRESETS.normal.values);
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${ML_BASE_URL}/health`);
      if (res.ok) {
        const d = await res.json();
        setServiceOnline(true);
        if (d.checkpoint) setActiveCheckpoint(d.checkpoint);
      } else {
        setServiceOnline(false);
      }
    } catch {
      setServiceOnline(false);
    }
  };

  const fetchDrift = async () => {
    try {
      const res = await fetch(`${ML_BASE_URL}/drift`);
      if (res.ok) {
        const d: DriftResponse = await res.json();
        setDriftStatus(d);
      }
    } catch {
      // Ignore
    }
  };

  const updateSensor = (key: string, val: number) => {
    setActivePreset('custom');
    setSensorValues(prev => ({ ...prev, [key]: val }));
  };

  const loadPreset = (key: keyof typeof PRESETS) => {
    setActivePreset(key);
    setSensorValues(PRESETS[key].values);
    runInference(PRESETS[key].values);
  };

  // Build 32-sample sliding window
  const buildWindow = (currentVals: Record<string, number>) => {
    const channels = SENSOR_CHANNELS.map(c => currentVals[c.key]);
    const windowRows: number[][] = [];
    for (let t = 0; t < 32; t++) {
      const factor = 0.7 + 0.3 * (t / 31);
      const noise = (Math.random() - 0.5) * 0.02;
      const row = channels.map(v => Number((v * factor + noise).toFixed(4)));
      windowRows.push(row);
    }
    return windowRows;
  };

  const runInference = async (valsToUse = sensorValues) => {
    const windowPayload = buildWindow(valsToUse);
    const t0 = performance.now();

    try {
      const res = await fetch(`${ML_BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          window: windowPayload,
          reference_id: `browser-client-${Date.now()}`,
        }),
      });
      const elapsed = performance.now() - t0;
      setLatency(Number(elapsed.toFixed(2)));

      if (res.ok) {
        const data: PredictionResponse = await res.json();
        setPrediction(data);
        setServiceOnline(true);
        fetchDrift();
      } else {
        throw new Error('ML Server error');
      }
    } catch {
      // Fallback local physical simulation if ML server not directly reachable from client
      const elapsed = performance.now() - t0;
      setLatency(Number(elapsed.toFixed(2)));
      setServiceOnline(false);

      const tilt = Math.abs(valsToUse.tilt_x_deg) + Math.abs(valsToUse.tilt_y_deg);
      const crack = valsToUse.crack_displacement_mm;
      const vib = valsToUse.vibration_amplitude_g;

      let anomalyClass = 'normal';
      let sev = 0.05;
      let alertLevel = 'GREEN';
      let probs = { normal: 0.94, equipment_noise: 0.05, subsidence_risk: 0.01 };

      if (tilt > 1.5 || crack > 5.0) {
        anomalyClass = 'subsidence_risk';
        sev = Math.min(1.0, 0.4 + (tilt / 10) + (crack / 30));
        alertLevel = sev > 0.8 ? 'RED' : (sev > 0.6 ? 'ORANGE' : 'YELLOW');
        probs = { normal: 0.02, equipment_noise: 0.03, subsidence_risk: 0.95 };
      } else if (vib > 0.6) {
        anomalyClass = 'equipment_noise';
        sev = Math.min(0.5, 0.15 + vib * 0.15);
        alertLevel = 'YELLOW';
        probs = { normal: 0.08, equipment_noise: 0.90, subsidence_risk: 0.02 };
      }

      setPrediction({
        anomaly_class: anomalyClass,
        severity: Number(sev.toFixed(2)),
        alert_level: alertLevel,
        class_probs: probs,
        model_version: 'baseline_local_fallback',
      });
    }
  };

  const toggleStreaming = () => {
    if (isStreaming) {
      if (streamRef.current) clearInterval(streamRef.current);
      streamRef.current = null;
      setIsStreaming(false);
    } else {
      setIsStreaming(true);
      streamRef.current = setInterval(() => {
        setSensorValues(prev => {
          const jitter = (Math.random() - 0.5) * 0.08;
          const updated = { ...prev, tilt_x_deg: Number((prev.tilt_x_deg + jitter).toFixed(2)) };
          runInference(updated);
          return updated;
        });
      }, 1200);
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) clearInterval(streamRef.current);
    };
  }, []);

  const getAlertBadgeColor = (level: string) => {
    switch (level) {
      case 'RED': return 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse';
      case 'ORANGE': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'YELLOW': return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      default: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#000000] dark:text-white tracking-wide flex items-center gap-2.5">
            <BrainCircuit className="w-6 h-6 text-[#fca311]" />
            ML Model Interactive Testing Lab
          </h1>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-1 font-medium">
            Phase 6 verified real-time multi-sensor inference playground & continuous drift verification (§10.7)
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold ${
            serviceOnline
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
          }`}>
            <span className="h-2 w-2 rounded-full bg-current animate-ping" />
            <span>{serviceOnline ? 'ML Microservice: 127.0.0.1:8000 (Connected)' : 'Local Direct Mode'}</span>
          </div>

          <a
            href="http://127.0.0.1:8000/demo"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold bg-[#14213d] hover:bg-[#1f3056] text-white dark:bg-[#fca311] dark:hover:bg-[#e59200] dark:text-black border-[#14213d] dark:border-[#fca311] transition-all shadow-sm"
          >
            <span>Open Standalone Webview</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Model Audit Report Button */}
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border-slate-700 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Generate AI Model Validation & Drift Certification Report"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Model Audit Report</span>
          </button>
        </div>
      </div>

      {/* Main Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Presets & 9-Channel Sliders */}
        <div className="lg:col-span-7 space-y-5">
          {/* Preset Buttons */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#070b14] border border-[#e5e5e5] dark:border-[#14213d] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#14213d] dark:text-[#94a3b8] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#fca311]" />
                Geotechnical Incident Presets
              </span>
              <span className="text-[11px] text-[#5c677d] dark:text-[#64748b]">1-Click Multi-Channel Scenarios</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(PRESETS).map(([k, p]) => (
                <button
                  key={k}
                  onClick={() => loadPreset(k as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    activePreset === k
                      ? 'bg-[#fca311]/15 border-[#fca311] text-[#14213d] dark:text-[#fca311] shadow-sm'
                      : 'bg-[#f9fafb] dark:bg-[#0c1220] border-[#e5e5e5] dark:border-[#14213d] text-[#4b5563] dark:text-[#94a3b8] hover:border-[#fca311]/50'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{p.name}</div>
                  <div className="text-[10px] text-[#5c677d] dark:text-[#64748b] truncate mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sliders Grid */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#070b14] border border-[#e5e5e5] dark:border-[#14213d] shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#f1f5f9] dark:border-[#14213d]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#14213d] dark:text-[#94a3b8] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#fca311]" />
                9-Sensor Telemetry Controls (32-Timestep Rolling Window)
              </span>
              <button
                onClick={() => loadPreset('normal')}
                className="text-[11px] text-[#fca311] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SENSOR_CHANNELS.map(c => {
                const val = sensorValues[c.key] ?? 0;
                return (
                  <div key={c.key} className="space-y-1.5 p-2.5 rounded-xl bg-[#f9fafb] dark:bg-[#0c1220] border border-[#f1f5f9] dark:border-[#14213d]/60">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-[#14213d] dark:text-[#cbd5e1]">{c.label}</span>
                      <span className="font-mono font-bold text-[#fca311]">
                        {val} {c.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={c.min}
                      max={c.max}
                      step={c.step}
                      value={val}
                      onChange={e => updateSensor(c.key, parseFloat(e.target.value))}
                      className="w-full accent-[#fca311] h-1.5 bg-[#e2e8f0] dark:bg-[#1e293b] rounded-lg cursor-pointer"
                    />
                    <div className="text-[10px] text-[#5c677d] dark:text-[#64748b] truncate">{c.desc}</div>
                  </div>
                );
              })}
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3 pt-5 mt-3 border-t border-[#f1f5f9] dark:border-[#14213d]">
              <button
                onClick={() => runInference()}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#fca311] to-[#e8590c] hover:opacity-95 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <Activity className="w-4 h-4" />
                <span>Run Model Inference</span>
              </button>

              <button
                onClick={toggleStreaming}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                  isStreaming
                    ? 'bg-red-500/15 border-red-500 text-red-500 animate-pulse'
                    : 'bg-[#f4f5f7] dark:bg-[#14213d]/50 hover:bg-[#e5e5e5] dark:hover:bg-[#14213d] text-[#14213d] dark:text-white border-[#e5e5e5] dark:border-[#14213d]'
                }`}
              >
                {isStreaming ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isStreaming ? 'Stop Streaming' : 'Live Continuous'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Prediction Diagnostics & Drift Monitor */}
        <div className="lg:col-span-5 space-y-5">
          {/* Main Inference Result Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#070b14] border border-[#e5e5e5] dark:border-[#14213d] shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9] dark:border-[#14213d]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#14213d] dark:text-[#94a3b8] flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#fca311]" />
                Inference Result
              </span>
              <span className="font-mono text-xs text-[#fca311] font-bold">
                Latency: {latency !== null ? `${latency} ms` : '--'}
              </span>
            </div>

            {/* Hero Class Display */}
            {prediction && (
              <div className="text-center p-4 rounded-xl bg-[#f9fafb] dark:bg-[#0c1220] border border-[#f1f5f9] dark:border-[#14213d] space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-[#5c677d] dark:text-[#64748b]">
                  Predicted Class
                </div>
                <div className={`text-2xl font-black font-mono tracking-tight uppercase ${
                  prediction.anomaly_class === 'subsidence_risk'
                    ? 'text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    : prediction.anomaly_class === 'equipment_noise'
                    ? 'text-blue-500'
                    : 'text-emerald-500'
                }`}>
                  {prediction.anomaly_class.replace('_', ' ')}
                </div>

                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-bold border ${getAlertBadgeColor(prediction.alert_level)}`}>
                    {prediction.alert_level} ALERT
                  </span>
                </div>

                <div className="text-[11px] text-[#5c677d] dark:text-[#64748b] font-mono pt-1">
                  Model: {activeCheckpoint} (Shadow Mode)
                </div>
              </div>
            )}

            {/* Severity Meter */}
            {prediction && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-[#14213d] dark:text-[#94a3b8]">Continuous Severity Score</span>
                  <span className="font-mono font-bold text-[#fca311]">{prediction.severity.toFixed(2)} / 1.00</span>
                </div>
                <div className="h-3 w-full bg-[#e2e8f0] dark:bg-[#1e293b] rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 via-orange-500 to-red-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(2, prediction.severity * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#5c677d] dark:text-[#64748b]">
                  <span>0.00 GREEN</span>
                  <span>0.20 YELLOW</span>
                  <span>0.60 ORANGE</span>
                  <span>0.80 RED</span>
                </div>
              </div>
            )}

            {/* Softmax Probability Bars */}
            {prediction && (
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5c677d] dark:text-[#94a3b8]">
                  Softmax Probability Distribution
                </span>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#14213d] dark:text-[#cbd5e1]">Normal Baseline</span>
                      <span className="font-mono font-bold">{(prediction.class_probs.normal * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-[#e2e8f0] dark:bg-[#1e293b] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${prediction.class_probs.normal * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#14213d] dark:text-[#cbd5e1]">Equipment Noise</span>
                      <span className="font-mono font-bold">{(prediction.class_probs.equipment_noise * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-[#e2e8f0] dark:bg-[#1e293b] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all" style={{ width: `${prediction.class_probs.equipment_noise * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-red-500">[!] Subsidence Risk</span>
                      <span className="font-mono font-bold text-red-500">{(prediction.class_probs.subsidence_risk * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-[#e2e8f0] dark:bg-[#1e293b] rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 transition-all" style={{ width: `${prediction.class_probs.subsidence_risk * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rolling Drift Monitor (§10.7) Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#070b14] border border-[#e5e5e5] dark:border-[#14213d] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9] dark:border-[#14213d]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#14213d] dark:text-[#94a3b8] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#fca311]" />
                Rolling Drift Monitor (§10.7)
              </span>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                driftStatus?.drift_detected
                  ? 'bg-red-500/15 text-red-400 border-red-500/40 animate-pulse'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}>
                {driftStatus ? `TVD = ${driftStatus.total_variation_distance} ${driftStatus.drift_detected ? '(DRIFT)' : '(PASS)'}` : 'Tracking'}
              </span>
            </div>

            <p className="text-xs text-[#5c677d] dark:text-[#94a3b8]">
              Tracks class divergence over a 500-sample sliding window against baseline training distribution (`TVD &lt; 0.20`).
            </p>

            {driftStatus && (
              <div className="p-3 rounded-xl bg-[#f9fafb] dark:bg-[#0c1220] border border-[#f1f5f9] dark:border-[#14213d] text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#5c677d] dark:text-[#64748b]">Samples Evaluated:</span>
                  <span className="font-bold">{driftStatus.total_predictions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c677d] dark:text-[#64748b]">Window Primed:</span>
                  <span className="font-bold">{driftStatus.samples_in_window} / 500</span>
                </div>
                <div className="pt-1 text-[11px] text-[#5c677d] dark:text-[#64748b] truncate">
                  {driftStatus.message}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Model Validation & Drift Certification Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        report={reportData}
      />
    </div>
  );
}
