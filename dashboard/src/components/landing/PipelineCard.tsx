import React from 'react';
import { Card } from '../common/Card';
import { Radio, Server, Activity, ShieldCheck } from 'lucide-react';

export function PipelineCard() {
  const steps = [
    {
      title: 'Sensor Mesh / Gateway ESP32',
      subtitle: 'Surface nodes (tilt, vibration, crack, gas)',
      detail: 'QoS 1, LWT offline status, seq numbers',
      icon: Radio,
      color: 'border-[#fca311]/40 bg-[#fca311]/10 text-amber-800 dark:text-[#fca311]',
    },
    {
      title: 'EMQX MQTT Broker',
      subtitle: 'Port 8883 / TLS',
      detail: 'Topic pattern: mine/{zoneId}/{nodeId}/#',
      icon: Server,
      color: 'border-[#14213d]/30 bg-[#14213d]/10 dark:bg-[#14213d] text-[#14213d] dark:text-white',
    },
    {
      title: 'NestJS Pipeline Engine',
      subtitle: 'Thin Ingestion + Processing deduplication',
      detail: 'EventEmitter2 bus, sequence gap detection',
      icon: ShieldCheck,
      color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    },
    {
      title: 'Realtime Socket.IO Gateway',
      subtitle: 'Sub-500ms room broadcast',
      detail: 'RxJS 250ms batch window, zone rooms',
      icon: Activity,
      color: 'border-[#fca311]/40 bg-[#fca311]/10 text-amber-800 dark:text-[#fca311]',
    },
  ];

  return (
    <Card className="p-6 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-6 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <h3 className="text-base font-bold text-[#000000] dark:text-white tracking-wide">
            End-to-End Data Pipeline Architecture
          </h3>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8]">
            Validated against dummy simulator and ready for drop-in real ESP32 hardware replacement.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-[#f4f5f7] dark:bg-[#14213d] text-[10px] font-mono font-bold text-[#14213d] dark:text-[#fca311] border border-[#e5e5e5] dark:border-[#14213d] w-fit">
          Design&amp;Architecture.md §1
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className="p-4 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/60 border border-[#e5e5e5] dark:border-[#14213d] flex flex-col justify-between relative group hover:border-[#fca311]/60 transition-all duration-300 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl border ${s.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#5c677d] dark:text-[#94a3b8]">
                    0{idx + 1}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-[#000000] dark:text-white tracking-wide">
                  {s.title}
                </h4>
                <p className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] mt-1">
                  {s.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-[#e5e5e5] dark:border-[#14213d]/80 text-[10px] text-[#14213d] dark:text-[#fca311] font-mono font-semibold">
                {s.detail}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
