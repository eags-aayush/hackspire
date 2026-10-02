"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, AlertOctagon } from 'lucide-react';

interface EmergencySosButtonProps {
  onTriggerSos?: (active: boolean) => void;
}

export function EmergencySosButton({ onTriggerSos }: EmergencySosButtonProps) {
  const [isActive, setIsActive] = useState(false);
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
    setIsActive(false);
    onTriggerSos?.(false);
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
      sweepIntervalRef.current = setInterval(() => {
        if (!osc1Ref.current || !osc2Ref.current) return;
        const f1 = high ? 880 : 520;
        const f2 = high ? 1320 : 780;
        const t = ctx.currentTime;
        osc1Ref.current.frequency.setTargetAtTime(f1, t, 0.04);
        osc2Ref.current.frequency.setTargetAtTime(f2, t, 0.04);
        high = !high;
      }, 280);

      setIsActive(true);
      onTriggerSos?.(true);
    } catch (err) {
      console.warn('Audio playback error:', err);
      setIsActive(false);
    }
  };

  const handleToggle = () => {
    if (isActive) {
      stopSiren();
    } else {
      startSiren();
    }
  };

  useEffect(() => {
    return () => {
      stopSiren();
    };
  }, []);

  return (
    <button
      onClick={handleToggle}
      className={`fixed bottom-6 right-6 z-50 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl select-none ${
        isActive
          ? 'bg-[#cc0000] border-4 border-white text-white animate-bounce shadow-[0_0_35px_rgba(255,0,0,0.85)] scale-105'
          : 'bg-[#8b0000] hover:bg-[#a00000] border-4 border-[#ff6b6b] text-white hover:scale-105 active:scale-95 shadow-[0_8px_25px_rgba(139,0,0,0.45)]'
      }`}
      title={isActive ? 'Click to silence Emergency SOS siren' : 'Emergency SOS Alarm — Click for loud audible siren'}
      aria-label="Emergency SOS Alarm"
    >
      <span className="font-black text-xl sm:text-2xl tracking-widest font-mono leading-none">
        {isActive ? <VolumeX className="w-6 h-6 sm:w-7 sm:h-7 mx-auto animate-pulse" /> : 'SOS'}
      </span>
      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mt-1 opacity-90">
        {isActive ? 'STOP ALARM' : 'EMERGENCY'}
      </span>
      {isActive && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-400 animate-ping" />
      )}
    </button>
  );
}

export default EmergencySosButton;
