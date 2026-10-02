"use client";

import React from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { formatRelativeTime } from '@/lib/utils';
import { Badge } from '../common/Badge';
import { Card } from '../common/Card';
import {
  Radio,
  Wifi,
  Server,
  Activity,
  Cpu,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Binary,
  Layers,
} from 'lucide-react';

interface GatewayStatusCardProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function GatewayStatusCard({
  variant = 'full',
  className = '',
}: GatewayStatusCardProps) {
  const { isConnected, gatewayStatus, metrics, stats, isSimulationActive } = useRealtime();

  const isSimStreaming = isSimulationActive && stats.onlineNodes > 0;
  const isOnline = Boolean(gatewayStatus.loraGatewayConnected || isSimStreaming);

  const lastSeenDisplay = isOnline
    ? isSimStreaming
      ? 'Streaming (Sim)'
      : gatewayStatus.lastLoraPacketAt
      ? formatRelativeTime(gatewayStatus.lastLoraPacketAt)
      : 'Broker Connected (No Data)'
    : gatewayStatus.lastLoraPacketAt
    ? `Disconnected (${formatRelativeTime(gatewayStatus.lastLoraPacketAt)})`
    : 'Not Connected to MQTT Broker';

  // --- COMPACT VARIANT (For Landing Page / Hero Section) ---
  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex flex-wrap items-center justify-center gap-2.5 p-2 px-3 sm:px-4 rounded-2xl bg-white/90 dark:bg-[#14213d]/60 border border-[#e5e5e5] dark:border-[#14213d] shadow-md backdrop-blur-md transition-all select-none ${className}`}
      >
        {/* 1. ESP32 LoRa Gateway Status */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs transition-colors ${
            isOnline
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/15 border-red-500/40 shadow-sm shadow-red-500/10'
          }`}
        >
          <div className="relative flex items-center justify-center">
            {isOnline ? (
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            )}
            {isOnline && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <span className="font-semibold text-[#14213d] dark:text-white">LoRa Gateway:</span>
          <span
            className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
              isOnline
                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15'
                : 'text-red-700 dark:text-red-300 bg-red-500/20'
            }`}
          >
            {isOnline ? 'Gateway Connected' : 'Not Connected'}
          </span>
        </div>

        {/* Separator dot */}
        <span className="text-[#d4d4d4] dark:text-[#14213d] hidden sm:inline">•</span>

        {/* 2. WebSocket Live Telemetry Status */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5]/80 dark:border-[#14213d]/80 text-xs">
          <div className="relative flex items-center justify-center">
            <Wifi
              className={`w-3.5 h-3.5 ${
                isConnected ? 'text-blue-500 animate-pulse' : 'text-red-500'
              }`}
            />
          </div>
          <span className="font-semibold text-[#14213d] dark:text-white">WebSocket:</span>
          <span
            className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
              isConnected
                ? 'text-blue-700 dark:text-blue-300 bg-blue-500/10'
                : 'text-red-700 dark:text-red-300 bg-red-500/10'
            }`}
          >
            {isConnected ? 'Connected (Live)' : 'Disconnected'}
          </span>
        </div>

        {/* Separator dot */}
        <span className="text-[#d4d4d4] dark:text-[#14213d] hidden md:inline">•</span>

        {/* 3. MQTT Broker Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5]/80 dark:border-[#14213d]/80 text-xs font-mono text-[#5c677d] dark:text-[#94a3b8]">
          <Server className="w-3 h-3 text-[#fca311]" />
          <span>MQTT: 1883</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">QoS 1</span>
        </div>
      </div>
    );
  }

  // --- FULL VARIANT (For Monitoring Page) ---
  return (
    <Card
      className={`bg-white/95 dark:bg-[#14213d]/35 border-[#e5e5e5] dark:border-[#14213d] p-4 sm:p-5 shadow-sm select-none transition-all ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 mb-3 border-b border-[#e5e5e5] dark:border-[#14213d]/80">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-2xl border shadow-sm shrink-0 transition-colors ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                : 'bg-red-500/15 text-red-500 border-red-500/40 shadow-red-500/10'
            }`}
          >
            {isOnline ? (
              <Radio className="w-5 h-5 animate-pulse" />
            ) : (
              <AlertTriangle className="w-5 h-5 animate-pulse text-red-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-[#000000] dark:text-white tracking-wide">
                Hardware Gateway &amp; Ingestion Pipeline Status
              </h3>
              <Badge
                variant={isOnline ? 'success' : 'danger'}
                pulse={isOnline}
                className="text-[10px] font-mono uppercase"
              >
                {isOnline ? 'Gateway Connected' : 'Not Connected'}
              </Badge>
            </div>
            <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-0.5">
              Live link verification: ESP32 LoRa Gateway RF bridge &rarr; EMQX MQTT &rarr; NestJS WebSocket
            </p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d]">
            <Server className="w-3.5 h-3.5 text-[#fca311]" />
            <span className="text-[#5c677d] dark:text-[#94a3b8]">Broker:</span>
            <span className="font-bold text-[#14213d] dark:text-white">Port 1883</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d]">
            <Binary className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[#5c677d] dark:text-[#94a3b8]">Transport:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {metrics.transportFormat || 'Protobuf Binary'}
            </span>
          </div>
        </div>
      </div>

      {/* Tri-Column Diagnostics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* 1. LoRa Gateway (ESP32) Card */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isOnline
              ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30'
              : 'bg-red-500/5 dark:bg-red-950/25 border-red-500/40 shadow-sm shadow-red-500/10'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Cpu className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
              )}
              <span className="font-bold text-xs text-[#000000] dark:text-white">
                ESP32 LoRa Gateway
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-extrabold'
              }`}
            >
              {isOnline ? 'Gateway Connected' : 'Not Connected'}
            </span>
          </div>

          <div className="space-y-1 text-[11px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
            <div className="flex items-center justify-between">
              <span>Hardware Link:</span>
              <span
                className={`font-semibold ${
                  isOnline
                    ? 'text-[#14213d] dark:text-white'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {isOnline ? 'SX1276 LoRa RF (Active)' : 'SX1276 (Link Severed)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ingestion Topic:</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">sensors/lora/#</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[#e5e5e5] dark:border-[#14213d]/60 text-[10px]">
              <span>Last Packet:</span>
              <span
                className={`font-bold ${
                  isOnline
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {lastSeenDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* 2. EMQX MQTT Broker Card */}
        <div className="p-3.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#fca311]" />
              <span className="font-bold text-xs text-[#000000] dark:text-white">
                EMQX Broker
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              Active / QoS 1
            </span>
          </div>

          <div className="space-y-1 text-[11px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
            <div className="flex items-center justify-between">
              <span>Broker URL:</span>
              <span className="text-[#14213d] dark:text-white font-semibold">mqtt://localhost:1883</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Client ID:</span>
              <span className="text-[#14213d] dark:text-[#e5e5e5] font-semibold">backend-ingestion</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[#e5e5e5] dark:border-[#14213d]/60 text-[10px]">
              <span>Reliability:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">At-Least-Once (QoS 1)</span>
            </div>
          </div>
        </div>

        {/* 3. WebSocket Socket.IO Ingestion Card */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isConnected
              ? 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/30'
              : 'bg-red-500/5 dark:bg-red-950/20 border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wifi
                className={`w-4 h-4 ${
                  isConnected ? 'text-blue-500' : 'text-red-500'
                }`}
              />
              <span className="font-bold text-xs text-[#000000] dark:text-white">
                WebSocket Ingestion
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                isConnected
                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                  : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
              }`}
            >
              {isConnected ? 'Live WebSocket' : 'Offline'}
            </span>
          </div>

          <div className="space-y-1 text-[11px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
            <div className="flex items-center justify-between">
              <span>Avg Latency:</span>
              <span className="text-[#14213d] dark:text-[#fca311] font-bold">
                {metrics.avgLatency}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Throughput:</span>
              <span className="text-[#14213d] dark:text-white font-semibold">
                {metrics.packetsPerSec} msg/sec
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[#e5e5e5] dark:border-[#14213d]/60 text-[10px]">
              <span>Wire Protocol:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                Protobuf (-80% payload)
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
