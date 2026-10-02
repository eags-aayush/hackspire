"use client";

import React, { useState } from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import {
  Sparkles,
  Play,
  Square,
  Zap,
  Activity,
  AlertTriangle,
  Flame,
  Droplets,
  Layers,
  Radio,
  CheckCircle2,
  RefreshCw,
  Sliders,
} from 'lucide-react';

interface SimulationScenarioPanelProps {
  isSimulationActive: boolean;
  onToggleSimulation: () => void;
  onTriggerMlEvent: (
    nodeId?: string,
    anomalyClass?: 'subsidence_risk' | 'equipment_noise' | 'normal'
  ) => void;
}

const GEOTECHNICAL_SCENARIOS = [
  {
    id: 'normal',
    name: 'Normal Quiet Baseline',
    icon: CheckCircle2,
    badge: 'NORMAL',
    badgeVariant: 'success' as const,
    accentColor: 'emerald',
    targetZone: 'ZONE_01 & ZONE_02',
    description:
      'Nominal mine strata. Zero ground tilt, low ambient vibrations (<0.5 mm/s), quiet methane (<10 ppm), dry floor (<0.3m).',
    sensorsInvolved: 'All sensors nominal',
    mlExpected: 'Normal (98% conf, GREEN alert)',
  },
  {
    id: 'shearer_noise',
    name: 'Longwall Shearer Cutting Vibration',
    icon: Zap,
    badge: 'EQUIPMENT NOISE',
    badgeVariant: 'warning' as const,
    accentColor: 'amber',
    targetZone: 'ZONE_01 (NODE_02)',
    description:
      'Continuous mechanical cutting head vibration (>2.5 mm/s) without ground tilt or displacement. Tests ML noise rejection filter.',
    sensorsInvolved: 'Vibration 2.5-3.8 mm/s, Tilt <0.2°',
    mlExpected: 'Equipment Noise (94% conf, YELLOW alert)',
  },
  {
    id: 'methane_surge',
    name: 'Tailgate Methane Gas Outburst',
    icon: Flame,
    badge: 'GAS HAZARD',
    badgeVariant: 'danger' as const,
    accentColor: 'red',
    targetZone: 'ZONE_02 (NODE_04)',
    description:
      'Coal seam gas pocket puncture causing acute CH4 surge breaching safety threshold (>25 ppm). Atmospheric alert beacon.',
    sensorsInvolved: 'Gas 35-48 ppm (Threshold: 25 ppm)',
    mlExpected: 'Gas safety breach, ORANGE alert',
  },
  {
    id: 'sump_flood',
    name: 'Aquifer Inrush & Sump Flood',
    icon: Droplets,
    badge: 'WATER INRUSH',
    badgeVariant: 'danger' as const,
    accentColor: 'cyan',
    targetZone: 'ZONE_02 (NODE_05)',
    description:
      'Underground drainage sump water level inrush breaching 2.0m critical threshold. Flooding risk along transport roadway.',
    sensorsInvolved: 'Water 2.2-3.8m (Threshold: 2.0m)',
    mlExpected: 'Hydraulic safety breach, ORANGE alert',
  },
  {
    id: 'fault_rupture',
    name: 'Fault Slip & Subsidence Collapse',
    icon: AlertTriangle,
    badge: 'SUBSIDENCE RISK',
    badgeVariant: 'danger' as const,
    accentColor: 'red',
    targetZone: 'ZONE_01 (NODE_03) / ZONE_02 (NODE_06)',
    description:
      'Acute biaxial tilt acceleration (>3.0°), expanding fracture aperture (>12mm), acoustic emissions. Precursor to imminent roof fall.',
    sensorsInvolved: 'Tilt >3.5°, Disp >14mm, Crack: Active',
    mlExpected: 'Subsidence Risk (>95% conf, RED alert)',
  },
];

export function SimulationScenarioPanel({
  isSimulationActive,
  onToggleSimulation,
  onTriggerMlEvent,
}: SimulationScenarioPanelProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>('fault_rupture');
  const [targetNode, setTargetNode] = useState<string>('NODE_03');
  const [anomalyClass, setAnomalyClass] = useState<'subsidence_risk' | 'equipment_noise' | 'normal'>('subsidence_risk');
  const [lastDispatched, setLastDispatched] = useState<string | null>(null);

  const handleDispatch = () => {
    onTriggerMlEvent(targetNode, anomalyClass);
    setLastDispatched(`${anomalyClass.toUpperCase()} on ${targetNode} at ${new Date().toLocaleTimeString()}`);
  };

  const handleQuickScenarioTrigger = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    if (!isSimulationActive) {
      onToggleSimulation();
    }
    if (scenarioId === 'shearer_noise') {
      onTriggerMlEvent('NODE_02', 'equipment_noise');
      setLastDispatched(`Equipment Noise on NODE_02 at ${new Date().toLocaleTimeString()}`);
    } else if (scenarioId === 'fault_rupture') {
      onTriggerMlEvent('NODE_03', 'subsidence_risk');
      setLastDispatched(`Subsidence Risk on NODE_03 at ${new Date().toLocaleTimeString()}`);
    } else if (scenarioId === 'normal') {
      onTriggerMlEvent('NODE_01', 'normal');
      setLastDispatched(`Normal Baseline at ${new Date().toLocaleTimeString()}`);
    } else {
      onTriggerMlEvent('NODE_04', 'equipment_noise');
      setLastDispatched(`${scenarioId.toUpperCase()} simulated at ${new Date().toLocaleTimeString()}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Simulation Engine Master Switch Card */}
      <Card className="p-5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`p-3 rounded-2xl border transition-all ${
              isSimulationActive
                ? 'bg-[#fca311]/15 text-[#fca311] border-[#fca311]/40 shadow-lg shadow-[#fca311]/10'
                : 'bg-[#f4f5f7] dark:bg-[#000000] text-[#5c677d] dark:text-[#94a3b8] border-[#e5e5e5] dark:border-[#14213d]'
            }`}
          >
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#000000] dark:text-white font-mono">
                Browser Geotechnical Mesh Simulator
              </h3>
              <Badge
                variant={isSimulationActive ? 'success' : 'outline'}
                className="text-[10px] font-mono font-bold"
              >
                {isSimulationActive ? 'SIMULATION RUNNING' : 'STANDBY (REAL HARDWARE MODE)'}
              </Badge>
            </div>
            <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-0.5">
              Generates high-frequency multi-channel telemetry for 6 nodes across 2 zones with mathematical waveforms, physical sensor physics, and automated Phase A &amp; Phase B risk cycles.
            </p>
          </div>
        </div>

        <button
          onClick={onToggleSimulation}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wide transition-all shadow-md cursor-pointer ${
            isSimulationActive
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25'
              : 'bg-[#fca311] hover:bg-[#ffb733] text-[#000000] shadow-[#fca311]/25 hover:scale-105 active:scale-95'
          }`}
        >
          {isSimulationActive ? (
            <>
              <Square className="w-4 h-4" /> Stop Simulation
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Start Simulation
            </>
          )}
        </button>
      </Card>

      {/* Geotechnical Scenario Injector Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono uppercase font-bold text-[#5c677d] dark:text-[#94a3b8] tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#fca311]" />
            Pre-Calibrated Geological &amp; Mechanical Test Scenarios
          </h4>
          <span className="text-[11px] font-mono text-[#5c677d] dark:text-[#94a3b8]">
            Click any scenario to inject into telemetry stream
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GEOTECHNICAL_SCENARIOS.map(sc => {
            const Icon = sc.icon;
            const isSelected = selectedScenario === sc.id;

            return (
              <Card
                key={sc.id}
                onClick={() => handleQuickScenarioTrigger(sc.id)}
                className={`p-4 cursor-pointer transition-all border text-left flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white dark:bg-[#14213d]/80 border-[#fca311] shadow-md shadow-[#fca311]/10 ring-1 ring-[#fca311]'
                    : 'bg-white/90 dark:bg-[#14213d]/30 border-[#e5e5e5] dark:border-[#14213d] hover:border-[#fca311]/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-[#f4f5f7] dark:bg-[#000000] text-[#14213d] dark:text-[#fca311]">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-[#000000] dark:text-white font-mono">
                        {sc.name}
                      </span>
                    </div>
                    <Badge variant={sc.badgeVariant} className="text-[9px] font-mono">
                      {sc.badge}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] leading-relaxed">
                    {sc.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e5e5e5] dark:border-[#14213d]/80 space-y-1 text-[10px] font-mono">
                  <div className="flex justify-between text-[#5c677d] dark:text-[#94a3b8]">
                    <span>Target:</span>
                    <strong className="text-[#000000] dark:text-white">{sc.targetZone}</strong>
                  </div>
                  <div className="flex justify-between text-[#5c677d] dark:text-[#94a3b8]">
                    <span>Telemetry:</span>
                    <span className="text-amber-700 dark:text-[#fca311] font-semibold">{sc.sensorsInvolved}</span>
                  </div>
                  <div className="flex justify-between text-[#5c677d] dark:text-[#94a3b8]">
                    <span>Expected ML:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{sc.mlExpected}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Manual ML Demo Event Dispatcher */}
      <Card className="p-5 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#e5e5e5] dark:border-[#14213d]">
          <div>
            <h4 className="text-sm font-bold text-[#000000] dark:text-white font-mono flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#fca311]" />
              Interactive AI Anomaly Event Generator
            </h4>
            <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-0.5 font-medium">
              Simulate high-priority deep learning inference output on a specific mesh node to evaluate dashboard alerts, latency, and audio sirens.
            </p>
          </div>

          {lastDispatched && (
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              Dispatched: {lastDispatched}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          {/* Target Node */}
          <div className="flex items-center gap-2">
            <span className="text-[#5c677d] dark:text-[#94a3b8] font-semibold">Node:</span>
            <select
              value={targetNode}
              onChange={e => setTargetNode(e.target.value)}
              className="bg-[#f4f5f7] dark:bg-[#000000] border border-[#e5e5e5] dark:border-[#14213d] text-[#000000] dark:text-white rounded-xl px-3 py-2 font-mono text-xs font-bold cursor-pointer"
            >
              {['NODE_01', 'NODE_02', 'NODE_03', 'NODE_04', 'NODE_05', 'NODE_06'].map(n => (
                <option key={n} value={n} className="bg-white dark:bg-[#14213d]">
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Anomaly Class */}
          <div className="flex items-center gap-2">
            <span className="text-[#5c677d] dark:text-[#94a3b8] font-semibold">Classification:</span>
            <select
              value={anomalyClass}
              onChange={e =>
                setAnomalyClass(
                  e.target.value as 'subsidence_risk' | 'equipment_noise' | 'normal'
                )
              }
              className="bg-[#f4f5f7] dark:bg-[#000000] border border-[#e5e5e5] dark:border-[#14213d] text-[#000000] dark:text-white rounded-xl px-3 py-2 font-mono text-xs font-bold cursor-pointer"
            >
              <option value="subsidence_risk" className="bg-white dark:bg-[#14213d]">
                🚨 Subsidence Risk (RED / 95% conf)
              </option>
              <option value="equipment_noise" className="bg-white dark:bg-[#14213d]">
                ⛏️ Equipment Noise (YELLOW / 92% conf)
              </option>
              <option value="normal" className="bg-white dark:bg-[#14213d]">
                🌿 Normal Quiet (GREEN / 98% conf)
              </option>
            </select>
          </div>

          <button
            onClick={handleDispatch}
            className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] hover:scale-105 active:scale-95 text-xs font-bold font-mono tracking-wide transition-all shadow-md cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Dispatch ML Event
          </button>
        </div>
      </Card>
    </div>
  );
}
