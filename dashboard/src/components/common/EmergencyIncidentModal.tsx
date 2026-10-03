"use client";

import React from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import {
  AlertTriangle,
  Download,
  VolumeX,
  X,
  Flame,
  Thermometer,
  Droplets,
  Activity,
  Compass,
  FileText,
  ShieldAlert,
} from 'lucide-react';

interface EmergencyIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmergencyIncidentModal({ isOpen, onClose }: EmergencyIncidentModalProps) {
  const {
    isSosAlarmActive,
    sosAlarmReason,
    silenceSosAlarm,
    downloadLatestIncidentPdf,
    lastIncidentReport,
    livePortData,
  } = useRealtime();

  if (!isOpen) return null;

  // Use values from lastIncidentReport, falling back to current livePortData
  const telemetry = lastIncidentReport?.telemetry || {
    temp: livePortData?.temp ?? null,
    hum: livePortData?.hum ?? null,
    mq4: livePortData?.mq4 ?? null,
    mq135: livePortData?.mq135 ?? null,
    water: livePortData?.water ?? null,
    ml: livePortData?.ml ?? null,
    tilt: livePortData ? +(Math.sqrt((livePortData.ax || 0) ** 2 + (livePortData.ay || 0) ** 2) * 5.73).toFixed(2) : null,
    ax: livePortData?.ax ?? null,
    ay: livePortData?.ay ?? null,
    az: livePortData?.az ?? null,
  };

  const incidentId = lastIncidentReport?.incidentId || `INC-${Date.now().toString().slice(-6)}`;
  const reason = sosAlarmReason || lastIncidentReport?.reason || 'Critical Geotechnical Sensor Anomaly';
  const timestamp = lastIncidentReport?.timestamp
    ? new Date(lastIncidentReport.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-[#071328] border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)] overflow-hidden">
        {/* Emergency Header */}
        <div className="bg-gradient-to-r from-red-950 via-red-700 to-red-950 text-white px-6 py-4 flex items-center justify-between border-b border-red-500">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-red-600 animate-pulse text-white">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono tracking-widest font-black uppercase text-red-200">
                  DGMS EMERGENCY AUDIT // {incidentId}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-red-700 uppercase">
                  ALARM ACTIVE
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-wide font-sans text-white">
                Emergency Incident Telemetry Snapshot
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alarm Reason Strip */}
        <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 px-6 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
                Trigger Cause:
              </p>
              <p className="text-sm font-bold text-red-950 dark:text-red-100">
                {reason}
              </p>
              <p className="text-[11px] text-red-700 dark:text-red-400 mt-0.5">
                Logged at: {timestamp} (IST) &bull; Location: Zone 01 - Longwall Mining Face
              </p>
            </div>
          </div>
        </div>

        {/* Telemetry Values Grid */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sensor Values Recorded Upon Alarm Activation
            </h3>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              DGMS Coal Mines Regulations 2017 Audit
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* MQ-4 Methane */}
            <div className={`p-3.5 rounded-xl border ${
              telemetry.mq4 != null && telemetry.mq4 >= 2500
                ? 'bg-red-50 dark:bg-red-950/30 border-red-500 ring-2 ring-red-400'
                : 'bg-slate-50 dark:bg-[#0b1b36] border-slate-200 dark:border-[#14213d]'
            }`}>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Methane (MQ-4)</span>
                <Flame className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white">
                {telemetry.mq4 != null ? `${Math.round(telemetry.mq4)}` : '--'}
                <span className="text-xs font-normal text-slate-500 ml-1">ppm</span>
              </div>
              <div className="text-[10px] font-semibold mt-1 text-slate-500 dark:text-slate-400">
                Safe limit: &lt; 1000 ppm
              </div>
            </div>

            {/* MQ-135 Toxic Gas */}
            <div className={`p-3.5 rounded-xl border ${
              telemetry.mq135 != null && telemetry.mq135 >= 1200
                ? 'bg-red-50 dark:bg-red-950/30 border-red-500 ring-2 ring-red-400'
                : 'bg-slate-50 dark:bg-[#0b1b36] border-slate-200 dark:border-[#14213d]'
            }`}>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Toxic Gas (MQ-135)</span>
                <Activity className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white">
                {telemetry.mq135 != null ? `${Math.round(telemetry.mq135)}` : '--'}
                <span className="text-xs font-normal text-slate-500 ml-1">ppm</span>
              </div>
              <div className="text-[10px] font-semibold mt-1 text-slate-500 dark:text-slate-400">
                Safe limit: &lt; 500 ppm
              </div>
            </div>

            {/* Temperature */}
            <div className={`p-3.5 rounded-xl border ${
              telemetry.temp != null && telemetry.temp >= 42
                ? 'bg-red-50 dark:bg-red-950/30 border-red-500 ring-2 ring-red-400'
                : 'bg-slate-50 dark:bg-[#0b1b36] border-slate-200 dark:border-[#14213d]'
            }`}>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Temperature</span>
                <Thermometer className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white">
                {telemetry.temp != null ? telemetry.temp.toFixed(1) : '--'}
                <span className="text-xs font-normal text-slate-500 ml-1">°C</span>
              </div>
              <div className="text-[10px] font-semibold mt-1 text-slate-500 dark:text-slate-400">
                Ceiling: 42.0 °C
              </div>
            </div>

            {/* Humidity */}
            <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-[#0b1b36] border-slate-200 dark:border-[#14213d]">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Humidity</span>
                <Droplets className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white">
                {telemetry.hum != null ? telemetry.hum.toFixed(1) : '--'}
                <span className="text-xs font-normal text-slate-500 ml-1">%</span>
              </div>
              <div className="text-[10px] font-semibold mt-1 text-slate-500 dark:text-slate-400">
                Safe: 40 - 75 %
              </div>
            </div>

            {/* Water Clearance */}
            <div className={`p-3.5 rounded-xl border ${
              telemetry.water != null && telemetry.water < 30
                ? 'bg-red-50 dark:bg-red-950/30 border-red-500 ring-2 ring-red-400'
                : 'bg-slate-50 dark:bg-[#0b1b36] border-slate-200 dark:border-[#14213d]'
            }`}>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Water Clearance</span>
                <Droplets className="w-3.5 h-3.5 text-cyan-500" />
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white">
                {telemetry.water != null ? telemetry.water.toFixed(1) : '--'}
                <span className="text-xs font-normal text-slate-500 ml-1">cm</span>
              </div>
              <div className="text-[10px] font-semibold mt-1 text-slate-500 dark:text-slate-400">
                Flood risk: &lt; 30 cm
              </div>
            </div>

            {/* Seismic ML */}
            <div className={`p-3.5 rounded-xl border ${
              telemetry.ml != null && telemetry.ml >= 0.8
                ? 'bg-red-50 dark:bg-red-950/30 border-red-500 ring-2 ring-red-400'
                : 'bg-slate-50 dark:bg-[#0b1b36] border-slate-200 dark:border-[#14213d]'
            }`}>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Seismic Shock</span>
                <Activity className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white">
                {telemetry.ml != null ? telemetry.ml.toFixed(2) : '--'}
                <span className="text-xs font-normal text-slate-500 ml-1">ML</span>
              </div>
              <div className="text-[10px] font-semibold mt-1 text-slate-500 dark:text-slate-400">
                Shock: &ge; 0.80 ML
              </div>
            </div>

            {/* Strata Tilt */}
            <div className={`p-3.5 rounded-xl border ${
              telemetry.tilt != null && telemetry.tilt >= 1.5
                ? 'bg-red-50 dark:bg-red-950/30 border-red-500 ring-2 ring-red-400'
                : 'bg-slate-50 dark:bg-[#0b1b36] border-slate-200 dark:border-[#14213d]'
            }`}>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Strata Tilt</span>
                <Compass className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white">
                {telemetry.tilt != null ? telemetry.tilt.toFixed(2) : '--'}
                <span className="text-xs font-normal text-slate-500 ml-1">°</span>
              </div>
              <div className="text-[10px] font-semibold mt-1 text-slate-500 dark:text-slate-400">
                Shear slip: &ge; 1.50°
              </div>
            </div>

            {/* IMU Acceleration */}
            <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-[#0b1b36] border-slate-200 dark:border-[#14213d]">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[11px] font-bold">Acceleration</span>
                <Activity className="w-3.5 h-3.5 text-yellow-500" />
              </div>
              <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                Ax: {(telemetry.ax || 0).toFixed(2)}g<br />
                Ay: {(telemetry.ay || 0).toFixed(2)}g<br />
                Az: {(telemetry.az || 1).toFixed(2)}g
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Primary Export PDF Action */}
        <div className="bg-slate-100 dark:bg-[#000000]/60 border-t border-slate-200 dark:border-[#14213d] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <FileText className="w-4 h-4 text-amber-500" />
            <span>PDF report complies with statutory DGMS reporting standard</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                downloadLatestIncidentPdf();
              }}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4 text-slate-950" />
              <span>Export PDF (All Values)</span>
            </button>

            {isSosAlarmActive && (
              <button
                onClick={() => {
                  silenceSosAlarm();
                  onClose();
                }}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                <VolumeX className="w-4 h-4" />
                <span>Silence Siren</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
