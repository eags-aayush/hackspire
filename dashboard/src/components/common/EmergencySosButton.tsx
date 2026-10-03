"use client";

import React, { useRef, useEffect } from 'react';
import { VolumeX, Download, FileText } from 'lucide-react';
import { useRealtime } from '@/hooks/useRealtime';

interface EmergencySosButtonProps {
  onTriggerSos?: (active: boolean) => void;
}

export function EmergencySosButton({ onTriggerSos }: EmergencySosButtonProps) {
  const { isSosAlarmActive, sosAlarmReason, triggerSosAlarm, silenceSosAlarm, downloadLatestIncidentPdf } = useRealtime();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const osc1Ref = useRef<OscillatorNode | null>(null);
  const osc2Ref = useRef<OscillatorNode | null>(null);
  const sweepIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopSiren = () => {
    if (sweepIntervalRef.current) {
      clearInterval(sweepIntervalRef.current);
      sweepIntervalRef.current = null;
    }
    try {
      osc1Ref.current?.stop();
      osc1Ref.current?.disconnect();
    } catch {}
    try {
      osc2Ref.current?.stop();
      osc2Ref.current?.disconnect();
    } catch {}
    osc1Ref.current = null;
    osc2Ref.current = null;
  };

  const startSiren = async () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      const ctx = audioCtxRef.current;
      if (osc1Ref.current && osc2Ref.current) return;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'sawtooth';
      osc1.frequency.value = 720;
      osc2.frequency.value = 1080;
      gain.gain.value = 0.25; // Controlled, safe volume

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      osc1Ref.current = osc1;
      osc2Ref.current = osc2;

      let high = true;
      if (sweepIntervalRef.current) {
        clearInterval(sweepIntervalRef.current);
      }
      sweepIntervalRef.current = setInterval(() => {
        if (!osc1Ref.current || !osc2Ref.current) return;
        const f1 = high ? 880 : 520;
        const f2 = high ? 1320 : 780;
        const t = ctx.currentTime;
        osc1Ref.current.frequency.setTargetAtTime(f1, t, 0.04);
        osc2Ref.current.frequency.setTargetAtTime(f2, t, 0.04);
        high = !high;
      }, 280);
    } catch (err) {
      console.warn('Audio siren playback error:', err);
    }
  };

  // Synchronize Web Audio siren sweeps with global isSosAlarmActive
  useEffect(() => {
    if (isSosAlarmActive) {
      startSiren();
      onTriggerSos?.(true);
    } else {
      stopSiren();
      onTriggerSos?.(false);
    }
  }, [isSosAlarmActive, onTriggerSos]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSiren();
    };
  }, []);

  const handleToggle = () => {
    if (isSosAlarmActive) {
      silenceSosAlarm();
    } else {
      triggerSosAlarm('MANUAL SOS ACTIVATION - CONTROL ROOM');
    }
  };

  return (
    <>
      {/* Floating Export PDF Action Pill when Emergency Alarm is Activated */}
      {isSosAlarmActive && (
        <div className="fixed bottom-28 sm:bottom-32 right-6 z-50 animate-bounce">
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadLatestIncidentPdf();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-2xl border-2 border-white hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-amber-400/50"
            title="Export official incident PDF report containing all sensor values at time of alarm"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>Export PDF (All Values)</span>
          </button>
        </div>
      )}

      <button
        onClick={handleToggle}
        className={`fixed bottom-6 right-6 z-50 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl select-none ${
          isSosAlarmActive
            ? 'bg-[#cc0000] border-4 border-white text-white animate-bounce shadow-[0_0_40px_rgba(255,0,0,0.95)] scale-105 ring-4 ring-red-400'
            : 'bg-[#8b0000] hover:bg-[#a00000] border-4 border-[#ff6b6b] text-white hover:scale-105 active:scale-95 shadow-[0_8px_25px_rgba(139,0,0,0.45)]'
        }`}
        title={
          isSosAlarmActive
            ? `SIREN ACTIVE (${sosAlarmReason || 'EMERGENCY'}) — Click to silence`
            : 'Emergency SOS Alarm — Click to activate siren'
        }
        aria-label="Emergency SOS Alarm"
      >
        <span className="font-black text-xl sm:text-2xl tracking-widest font-mono leading-none">
          {isSosAlarmActive ? <VolumeX className="w-6 h-6 sm:w-7 sm:h-7 mx-auto animate-pulse" /> : 'SOS'}
        </span>
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mt-1 opacity-90 text-center px-1 leading-tight">
          {isSosAlarmActive ? 'SILENCE' : 'EMERGENCY'}
        </span>
        {isSosAlarmActive && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-400 animate-ping" />
        )}
      </button>
    </>
  );
}

export default EmergencySosButton;
