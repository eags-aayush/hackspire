"use client";

import React from 'react';
import Link from 'next/link';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { PipelineCard } from '@/components/landing/PipelineCard';
import { MetricCard } from '@/components/common/MetricCard';
import { HardwareOnboardingWizard } from '@/components/common/HardwareOnboardingWizard';
import { useRealtime } from '@/hooks/useRealtime';
import {
  Activity,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Gauge,
} from 'lucide-react';

export default function LandingPage() {
  const { metrics, stats } = useRealtime();

  return (
    <div className="space-y-8 pb-10">
      {/* GSAP-Powered Hero Banner */}
      <HeroSection />

      {/* Live System Telemetry Status Overview */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-[#000000] dark:text-white tracking-wide flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#fca311]" />
              Live Telemetry &amp; Pipeline Status
            </h2>
            <p className="text-xs text-[#5c677d] dark:text-[#94a3b8]">
              Real-time synchronization status with EMQX Broker and NestJS Ingestion Core
            </p>
          </div>
          <Link
            href="/monitoring"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#14213d] dark:text-[#fca311] hover:underline transition-colors"
          >
            Go to Full Live Operations Room
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Avg Sensor Latency"
            value={metrics.avgLatency}
            unit="ms"
            subtext="Target: < 500ms budget"
            icon={Gauge}
            variant={metrics.avgLatency <= 500 ? 'emerald' : 'amber'}
            status={metrics.avgLatency <= 500 ? 'Optimal (Pass)' : 'Exceeded'}
          />

          <MetricCard
            title="Online Hardware Nodes"
            value={stats.onlineNodes}
            unit={`/ ${stats.totalNodes || 0}`}
            subtext="LWT status verified"
            icon={Cpu}
            variant="blue"
            status={`${stats.totalZones} active zones`}
          />

          <MetricCard
            title="Sequence Packet Gaps"
            value={stats.totalGaps}
            unit="gaps"
            subtext="Deduplicated sequence audit"
            icon={stats.totalGaps > 0 ? AlertTriangle : ShieldCheck}
            variant={stats.totalGaps > 0 ? 'amber' : 'emerald'}
            status={stats.totalGaps === 0 ? 'Zero Packet Loss' : 'Gaps Flagged'}
          />

          <MetricCard
            title="Total Ingested Messages"
            value={metrics.count.toLocaleString()}
            subtext="Non-blocking event loop"
            icon={Activity}
            variant="purple"
            status={`${metrics.packetsPerSec} msg/sec`}
          />
        </div>

        {/* First-Time Visit & Zero-Hardware Onboarding Fallback / Config Center */}
        <HardwareOnboardingWizard compact={stats.totalNodes > 0} />
      </section>

      {/* End-to-End Pipeline Architecture Card */}
      <section>
        <PipelineCard />
      </section>

      {/* Technical Features & Compliance Grid */}
      <section>
        <FeaturesGrid />
      </section>

      {/* Bottom Mission CTA */}
      <section className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-[#14213d] via-[#14213d]/95 to-[#000000] border border-[#14213d] text-center space-y-4 shadow-2xl relative overflow-hidden text-white">
        <div className="absolute -right-20 -top-20 w-60 h-60 rounded-full bg-[#fca311]/15 blur-3xl pointer-events-none" />
        
        <h3 className="font-display text-2xl lg:text-4xl font-bold text-white tracking-tight relative z-10">
          Ready for Autonomous Mine Telemetry Operations?
        </h3>
        <p className="text-xs sm:text-sm text-[#e5e5e5] max-w-xl mx-auto relative z-10 leading-relaxed">
          Explore the live monitoring room to inspect per-zone node readings, view packet loss logs,
          or test failure scenarios against the simulated MQTT gateway.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3 relative z-10">
          <Link
            href="/monitoring"
            className="px-7 py-3 rounded-xl bg-gradient-to-r from-[#fca311] to-[#e5920a] hover:from-[#ffb733] hover:to-[#fca311] text-[#000000] text-xs font-black transition-all duration-200 shadow-lg shadow-[#fca311]/30 hover:scale-105 active:scale-95 cursor-pointer"
          >
            Launch Live Monitoring
          </Link>
          <Link
            href="/nodes"
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/20 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
          >
            Inspect Node Health
          </Link>
        </div>
      </section>
    </div>
  );
}
