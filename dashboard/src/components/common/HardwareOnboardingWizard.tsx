"use client";

import React, { useState } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { Card } from './Card';
import { Badge } from './Badge';
import {
  Radio,
  Cpu,
  Server,
  Play,
  Square,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Wifi,
} from 'lucide-react';

interface HardwareOnboardingWizardProps {
  compact?: boolean;
}

export function HardwareOnboardingWizard({ compact = false }: HardwareOnboardingWizardProps) {
  const {
    isConnected,
    stats,
    isSimulationActive,
    toggleSimulation,
    clearCache,
  } = useRealtime();

  const [activeTab, setActiveTab] = useState<'sim' | 'esp32' | 'cli'>('sim');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const esp32Snippet = `// ESP32 Mine Subsidence Mesh Node Config
#define MQTT_BROKER "192.168.1.100" // Your PC/Server IP
#define MQTT_PORT 1883              // Or 8883 for EMQX TLS
#define ZONE_ID "ZONE_1"
#define NODE_ID "NODE_01"

// Telemetry Topic: mine/{zoneId}/{nodeId}/{sensorType}
const char* topic_tilt = "mine/ZONE_1/NODE_01/tilt";
const char* topic_status = "mine/ZONE_1/NODE_01/status";

// Payload schema: {"nodeId":"NODE_01","zoneId":"ZONE_1","sensorType":"tilt","value":1.25,"unit":"degrees","sequenceNumber":12,"timestamp":"..."}`;

  const cliCommand = `node backend/test_mqtt.js`;

  return (
    <Card className="p-5 sm:p-6 bg-white/95 dark:bg-[#14213d]/35 border-[#e5e5e5] dark:border-[#14213d] shadow-lg relative overflow-hidden transition-all duration-300">
      {/* Ambient background accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#fca311]/10 via-[#14213d]/5 to-transparent blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div className="flex items-start gap-3.5">
          <div className="relative p-2.5 rounded-2xl bg-[#14213d]/10 dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border border-[#14213d]/25 dark:border-[#fca311]/40 shadow-sm shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#fca311] animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-[#000000] dark:text-white tracking-wide">
                Hardware Node &amp; Gateway Configuration Guide
              </h3>
              <Badge
                variant={stats.totalNodes > 0 ? 'success' : 'warning'}
                pulse={stats.totalNodes === 0}
                className="text-[10px] font-mono uppercase"
              >
                {stats.totalNodes > 0 ? `${stats.onlineNodes} Nodes Live` : 'Standby: 0 Nodes'}
              </Badge>
            </div>
            <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-0.5">
              Connect your physical ESP32 gateway mesh, trigger the local MQTT simulator, or launch the built-in browser demo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Quick Purge Cache Button */}
          <button
            onClick={() => clearCache()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/70 dark:hover:bg-[#14213d] text-xs font-semibold text-[#14213d] dark:text-[#e5e5e5] border border-[#e5e5e5] dark:border-[#14213d] transition-all hover:scale-105"
            title="Flush old stored readings to only display fresh real-time data"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#fca311]" />
            <span>Purge Cache</span>
          </button>

          {compact && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#14213d]/70 text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white border border-[#e5e5e5] dark:border-[#14213d] transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="mt-5 space-y-5">
          {/* Live Pipeline Diagnostics Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            {/* 1. MQTT Broker */}
            <div className="p-3 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#fca311]" />
                <div>
                  <span className="font-bold text-[#000000] dark:text-white block">EMQX MQTT</span>
                  <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8]">Port 1883 / 1884</span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">QoS 1 Ready</Badge>
            </div>

            {/* 2. NestJS WebSocket Core */}
            <div className="p-3 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-500" />
                <div>
                  <span className="font-bold text-[#000000] dark:text-white block">WebSocket Ingestion</span>
                  <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8]">ws://localhost:3000</span>
                </div>
              </div>
              <Badge variant={isConnected ? 'success' : 'danger'} pulse={isConnected} className="text-[10px]">
                {isConnected ? 'Connected' : 'Offline'}
              </Badge>
            </div>

            {/* 3. Discovered Hardware Mesh */}
            <div className="p-3 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#14213d] dark:text-[#fca311]" />
                <div>
                  <span className="font-bold text-[#000000] dark:text-white block">Mesh Nodes</span>
                  <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8]">Subscribed: mine/+/+/#</span>
                </div>
              </div>
              <span className="font-mono font-bold text-[#14213d] dark:text-[#fca311] text-sm">
                {stats.totalNodes} Nodes
              </span>
            </div>
          </div>

          {/* Action Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/70 border border-[#e5e5e5] dark:border-[#14213d] w-fit text-xs font-semibold">
            <button
              onClick={() => setActiveTab('sim')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'sim'
                  ? 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] font-bold shadow-sm'
                  : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              1-Click Browser Demo
            </button>
            <button
              onClick={() => setActiveTab('cli')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'cli'
                  ? 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] font-bold shadow-sm'
                  : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              Terminal Simulator CLI
            </button>
            <button
              onClick={() => setActiveTab('esp32')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'esp32'
                  ? 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] font-bold shadow-sm'
                  : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              Physical ESP32 Setup
            </button>
          </div>

          {/* Tab Content 1: 1-Click Interactive Demo */}
          {activeTab === 'sim' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#f4f5f7]/80 dark:bg-[#000000]/70 border border-[#e5e5e5] dark:border-[#14213d] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-[#000000] dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#fca311]" />
                    Instant Telemetry Test Drive (No Hardware Required)
                  </h4>
                  <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-0.5 leading-relaxed">
                    Test the live monitoring gauges, zone rooms, sequence gap auditors, and sub-500ms latency benchmarks directly in your browser.
                  </p>
                </div>

                <button
                  onClick={toggleSimulation}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all duration-200 shadow-md hover:scale-105 active:scale-95 cursor-pointer shrink-0 ${
                    isSimulationActive
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                      : 'bg-gradient-to-r from-[#fca311] to-[#e5920a] hover:from-[#ffb733] hover:to-[#fca311] text-[#000000] shadow-[#fca311]/25'
                  }`}
                >
                  {isSimulationActive ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Stop Simulated Telemetry
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Launch Simulated Mesh Telemetry
                    </>
                  )}
                </button>
              </div>

              {isSimulationActive && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Simulating 6 Coal Mine Mesh Nodes across 2 Deep Seam Zones (ZONE_01_LONGWALL_FACE, ZONE_02_RETURN_AIRWAY) with Live ML Subsidence Precursor &amp; Shearer Noise • 4s Real-Time Cycle
                  </span>
                  <span className="font-mono text-[11px] font-bold">&lt;120ms latency</span>
                </div>
              )}
            </div>
          )}

          {/* Tab Content 2: Terminal CLI Simulator */}
          {activeTab === 'cli' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#f4f5f7]/80 dark:bg-[#000000]/70 border border-[#e5e5e5] dark:border-[#14213d] space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#000000] dark:text-white">
                    Publish Real MQTT Packets via Local Node.js Script
                  </h4>
                  <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-0.5">
                    Execute the pre-bundled test script from the project root to publish live QoS 1 packets over port 1884/1883.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(cliCommand, 'cli')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#14213d] border border-[#e5e5e5] dark:border-[#14213d] text-xs font-semibold text-[#14213d] dark:text-[#fca311] hover:scale-105 transition-all shadow-sm"
                >
                  {copiedKey === 'cli' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cli' ? 'Copied' : 'Copy Command'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#000000] border border-[#14213d] font-mono text-xs text-[#fca311] overflow-x-auto">
                <code>$ {cliCommand}</code>
              </div>
            </div>
          )}

          {/* Tab Content 3: Physical ESP32 Hardware Configuration */}
          {activeTab === 'esp32' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#f4f5f7]/80 dark:bg-[#000000]/70 border border-[#e5e5e5] dark:border-[#14213d] space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#000000] dark:text-white">
                    Physical ESP32 Gateway &amp; Mesh Firmware Settings
                  </h4>
                  <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-0.5">
                    Flash your ESP32 microcontrollers with these canonical MQTT credentials and topic patterns.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(esp32Snippet, 'esp32')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#14213d] border border-[#e5e5e5] dark:border-[#14213d] text-xs font-semibold text-[#14213d] dark:text-[#fca311] hover:scale-105 transition-all shadow-sm"
                >
                  {copiedKey === 'esp32' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'esp32' ? 'Copied' : 'Copy C++ Code'}</span>
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-[#000000] border border-[#14213d] font-mono text-[11px] text-[#e5e5e5] overflow-x-auto leading-relaxed">
                <code>{esp32Snippet}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
