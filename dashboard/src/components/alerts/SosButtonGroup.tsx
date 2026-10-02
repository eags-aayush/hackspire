"use client";

import React, { useState, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  ShieldCheck,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { EdgeAlertLevel, EdgeNodeActuatorState } from '@/types/edgeAlert';
import { EDGE_ALERT_CONFIGS } from '@/types/edgeAlert';

interface SosButtonGroupProps {
  nodeId: string;
  zoneId: string;
  actuatorState?: EdgeNodeActuatorState;
  onDispatch: (params: { nodeId: string; zoneId: string; level: EdgeAlertLevel }) => void;
  /** Compact mode for inline use in NodeCard */
  compact?: boolean;
}

const LEVEL_ORDER: EdgeAlertLevel[] = ['CRITICAL', 'WARNING', 'ADVISORY', 'NORMAL'];

const LEVEL_STYLES: Record<
  EdgeAlertLevel,
  {
    bg: string;
    hoverBg: string;
    activeBg: string;
    ring: string;
    text: string;
    icon: React.ComponentType<{ className?: string }>;
    glow: string;
  }
> = {
  CRITICAL: {
    bg: 'bg-red-600',
    hoverBg: 'hover:bg-red-700',
    activeBg: 'bg-red-700',
    ring: 'ring-red-500/60',
    text: 'text-white',
    icon: ShieldAlert,
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]',
  },
  WARNING: {
    bg: 'bg-amber-500',
    hoverBg: 'hover:bg-amber-600',
    activeBg: 'bg-amber-600',
    ring: 'ring-amber-400/60',
    text: 'text-white',
    icon: AlertTriangle,
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',
  },
  ADVISORY: {
    bg: 'bg-blue-500',
    hoverBg: 'hover:bg-blue-600',
    activeBg: 'bg-blue-600',
    ring: 'ring-blue-400/60',
    text: 'text-white',
    icon: Info,
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
  },
  NORMAL: {
    bg: 'bg-emerald-500',
    hoverBg: 'hover:bg-emerald-600',
    activeBg: 'bg-emerald-600',
    ring: 'ring-emerald-400/60',
    text: 'text-white',
    icon: ShieldCheck,
    glow: 'shadow-[0_0_16px_rgba(16,185,129,0.35)]',
  },
};

const LED_COLORS: Record<string, string> = {
  red: 'bg-red-500',
  yellow: 'bg-amber-400',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
};

export const SosButtonGroup = React.memo(function SosButtonGroup({
  nodeId,
  zoneId,
  actuatorState,
  onDispatch,
  compact = false,
}: SosButtonGroupProps) {
  const [dispatching, setDispatching] = useState<EdgeAlertLevel | null>(null);

  const handleClick = useCallback(
    (level: EdgeAlertLevel) => {
      setDispatching(level);
      onDispatch({ nodeId, zoneId, level });
      setTimeout(() => setDispatching(null), 1500);
    },
    [nodeId, zoneId, onDispatch],
  );

  const activeLevel = actuatorState?.level;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {/* Compact: Actuator status indicator */}
        {actuatorState && (
          <div className="flex items-center gap-1 mr-1">
            <span
              className={`w-2 h-2 rounded-full ${LED_COLORS[actuatorState.color] || 'bg-gray-400'} ${
                actuatorState.level === 'CRITICAL' ? 'animate-ping' : actuatorState.level === 'WARNING' ? 'animate-pulse' : ''
              }`}
            />
            {actuatorState.buzzer ? (
              <Volume2 className="w-2.5 h-2.5 text-red-500" />
            ) : (
              <VolumeX className="w-2.5 h-2.5 text-gray-400" />
            )}
          </div>
        )}

        {LEVEL_ORDER.map((level) => {
          const style = LEVEL_STYLES[level];
          const Icon = style.icon;
          const isActive = activeLevel === level;
          const isDispatching = dispatching === level;

          return (
            <button
              key={level}
              onClick={() => handleClick(level)}
              disabled={isDispatching}
              title={`${EDGE_ALERT_CONFIGS[level].label}: ${EDGE_ALERT_CONFIGS[level].description}`}
              className={`
                relative p-1.5 rounded-lg transition-all duration-200 cursor-pointer
                ${isActive ? `${style.activeBg} ${style.text} ring-2 ${style.ring} ${style.glow}` : `${style.bg} ${style.text} ${style.hoverBg} opacity-80 hover:opacity-100`}
                ${isDispatching ? 'scale-90 opacity-60' : 'active:scale-90'}
              `}
            >
              <Icon className="w-3 h-3" />
              {isActive && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Full-size SOS button group
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-[#fca311]" />
        <span className="text-xs font-bold font-mono text-[#14213d] dark:text-white tracking-wider uppercase">
          SOS Edge Dispatch
        </span>
        {actuatorState && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span
              className={`w-2.5 h-2.5 rounded-full ${LED_COLORS[actuatorState.color] || 'bg-gray-400'} ${
                actuatorState.level === 'CRITICAL' ? 'animate-ping' : actuatorState.level === 'WARNING' ? 'animate-pulse' : ''
              }`}
            />
            <span className="text-[9px] font-mono text-[#5c677d] dark:text-[#94a3b8] uppercase font-bold">
              {actuatorState.level} • {actuatorState.acknowledged ? '✓ ACK' : '⏳ Pending'}
            </span>
          </div>
        )}
      </div>

      {/* Button Grid */}
      <div className="grid grid-cols-4 gap-2">
        {LEVEL_ORDER.map((level) => {
          const style = LEVEL_STYLES[level];
          const config = EDGE_ALERT_CONFIGS[level];
          const Icon = style.icon;
          const isActive = activeLevel === level;
          const isDispatching = dispatching === level;

          return (
            <button
              key={level}
              onClick={() => handleClick(level)}
              disabled={isDispatching}
              title={config.description}
              className={`
                relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-300 cursor-pointer
                ${isActive
                  ? `${style.activeBg} ${style.text} border-transparent ring-2 ${style.ring} ${style.glow}`
                  : `${style.bg} ${style.text} ${style.hoverBg} border-transparent opacity-85 hover:opacity-100 hover:scale-105`
                }
                ${isDispatching ? 'scale-95 opacity-60' : 'active:scale-95'}
              `}
            >
              <Icon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
              <span className="text-[9px] font-mono font-black tracking-wide leading-tight text-center">
                {level}
              </span>
              {isActive && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white animate-ping" />
              )}
              {isDispatching && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                  <span className="text-[10px] font-mono font-bold">Sending...</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Buzzer Status */}
      {actuatorState && (
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
          {actuatorState.buzzer ? (
            <>
              <Volume2 className="w-3 h-3 text-red-500" />
              <span>Buzzer: <strong className="text-red-600 dark:text-red-400 uppercase">{actuatorState.buzzerMode}</strong></span>
            </>
          ) : (
            <>
              <VolumeX className="w-3 h-3 text-emerald-500" />
              <span>Buzzer: <strong className="text-emerald-600 dark:text-emerald-400">OFF</strong></span>
            </>
          )}
          <span className="text-[#d4d4d4] dark:text-[#14213d]">|</span>
          <span>LED: <strong className="uppercase">{actuatorState.color} {actuatorState.ledPattern}</strong></span>
        </div>
      )}
    </div>
  );
});
