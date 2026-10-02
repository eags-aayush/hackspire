import React from 'react';
import { Card } from '../common/Card';
import {
  Zap,
  ShieldCheck,
  Radio,
  Activity,
  Layers,
  BrainCircuit,
} from 'lucide-react';

export function FeaturesGrid() {
  const features = [
    {
      icon: Zap,
      title: 'Sub-500ms Realtime Delivery',
      description:
        'Continuous sensor readings stream from hardware or simulation clients through EMQX MQTT and NestJS to the dashboard in under 500ms.',
      tag: 'PRD Performance Target',
      color: 'text-amber-600 dark:text-[#fca311]',
    },
    {
      icon: ShieldCheck,
      title: 'Zero Packet Loss & Deduplication',
      description:
        'MQTT QoS 1 ensures guaranteed delivery, while the ProcessingModule dedupes by (nodeId, sequenceNumber) and flags sequence gaps as real safety signals.',
      tag: 'Safety-Critical',
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: Radio,
      title: 'LWT Node Health Tracking',
      description:
        'Hardware node failures and disconnected gateway clients are captured in real-time via MQTT Last Will and Testament, eliminating slow polling loops.',
      tag: 'Zero-Polling',
      color: 'text-amber-600 dark:text-[#fca311]',
    },
    {
      icon: Activity,
      title: 'Multi-Modal Geotechnical Sensors',
      description:
        'Unified telemetry model for biaxial tilt, seismic peak particle velocity (vibration), surface displacement, binary crack rupture, gas, and piezometer water levels.',
      tag: 'DGMS / IS Standards',
      color: 'text-[#14213d] dark:text-[#fca311]',
    },
    {
      icon: Layers,
      title: 'Zone-Scoped WebSocket Rooms',
      description:
        'Clients subscribe to zone-specific rooms (`zone:{zoneId}`), avoiding browser flood while batching updates into smooth 250ms coalesced streams.',
      tag: 'Scalable Broadcast',
      color: 'text-[#14213d] dark:text-[#e5e5e5]',
    },
    {
      icon: BrainCircuit,
      title: 'AI/ML Subsidence Prediction Hooks',
      description:
        'Clean decoupled architecture ready for AI/ML subsidence forecasting models, historical time-series queries, and automated DGMS early warning triggers.',
      tag: 'Phase 5 Ready',
      color: 'text-amber-600 dark:text-[#fca311]',
    },
  ];

  return (
    <div className="py-6 space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="font-display text-3xl lg:text-4xl font-bold text-[#000000] dark:text-white tracking-tight">
          Engineered for Extreme Mining Reliability
        </h2>
        <p className="mt-2 text-sm text-[#5c677d] dark:text-[#94a3b8]">
          Built according to the rigorous requirements of Hackspire-2026 and geotechnical subsidence safety guidelines.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <Card
              key={i}
              hoverEffect
              className="flex flex-col justify-between p-6 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d]"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/70 border border-[#e5e5e5] dark:border-[#14213d]">
                    <Icon className={`w-5 h-5 ${f.color}`} />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-[#f4f5f7] dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border border-[#e5e5e5] dark:border-[#14213d]">
                    {f.tag}
                  </span>
                </div>

                <h3 className="text-base font-bold text-[#000000] dark:text-white tracking-wide">
                  {f.title}
                </h3>
                <p className="mt-2 text-xs text-[#5c677d] dark:text-[#94a3b8] leading-relaxed">
                  {f.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[#e5e5e5] dark:border-[#14213d]/80 flex items-center text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
                <span>Contract Verified</span>
                <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-semibold">● Active</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
