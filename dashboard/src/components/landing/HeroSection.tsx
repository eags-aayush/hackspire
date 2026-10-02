"use client";

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ArrowRight, Activity, Cpu, Sparkles } from 'lucide-react';
import { useRealtime } from '@/hooks/useRealtime';
import { GatewayStatusCard } from '../monitoring/GatewayStatusCard';

export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);

  const { stats, metrics } = useRealtime();

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.6 }
      )
        .fromTo(
          titleRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.8 },
          '-=0.3'
        )
        .fromTo(
          subtitleRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.7 },
          '-=0.4'
        )
        .fromTo(
          ctaRef.current,
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 0.6 },
          '-=0.3'
        )
        .fromTo(
          metricsRef.current?.children || [],
          { opacity: 0, y: 30, stagger: 0.1 },
          { opacity: 1, y: 0, duration: 0.6 },
          '-=0.3'
        );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={heroRef} className="relative overflow-hidden pt-1 pb-6 lg:pt-2 lg:pb-8 font-sans">
      {/* Background ambient radiant glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-80 bg-gradient-to-tr from-[#14213d]/20 via-[#fca311]/15 to-transparent blur-3xl pointer-events-none rounded-full" />

      <div className="relative text-center max-w-4xl mx-auto space-y-3.5 sm:space-y-4">
        {/* Top Mission Pill with Script Signature */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-script text-lg sm:text-xl text-[#fca311] tracking-wide inline-flex items-center gap-1.5 select-none drop-shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen Autonomous Geotechnical Mesh
          </span>
          <div
            ref={badgeRef}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-[#14213d] border border-[#e5e5e5] dark:border-[#fca311]/40 text-xs text-[#14213d] dark:text-[#e5e5e5] shadow-md shadow-black/5 dark:shadow-black/40 backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-[#fca311] animate-ping" />
            <span className="font-extrabold text-[#14213d] dark:text-[#fca311]">SIH-2026</span>
            <span className="text-[#5c677d] dark:text-[#94a3b8]">•</span>
            <span className="font-medium font-roboto">Early Warning &amp; Telemetry Operations</span>
          </div>
        </div>

        {/* Hero Title with Amber Shimmer */}
        <h1
          ref={titleRef}
          className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#000000] dark:text-white leading-[1.15]"
        >
          Real-Time Ground Stability &amp;{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fca311] via-amber-300 to-[#e5920a] dark:from-[#fca311] dark:via-yellow-100 dark:to-amber-400">
            Mine Subsidence
          </span>{' '}
          Early Warning
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="text-base sm:text-lg text-[#5c677d] dark:text-[#94a3b8] max-w-2xl mx-auto leading-relaxed font-normal"
        >
          High-frequency IoT sensor telemetry ingestion with zero packet loss, sub-500ms broadcast
          latency, MQTT LWT hardware fault detection, and real-time subsidence risk forecasting.
        </p>

        {/* Call to Actions */}
        <div
          ref={ctaRef}
          className="flex flex-wrap items-center justify-center gap-4 pt-2"
        >
          <Link
            href="/monitoring"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#fca311] to-[#e5920a] hover:from-[#ffb733] hover:to-[#fca311] text-[#000000] text-sm font-extrabold shadow-lg shadow-[#fca311]/25 hover:shadow-[#fca311]/40 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Activity className="w-4 h-4" />
            Launch Live Operations Room
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/architecture"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white dark:bg-[#14213d] hover:bg-[#f4f5f7] dark:hover:bg-[#14213d]/80 border border-[#e5e5e5] dark:border-[#14213d] text-[#14213d] dark:text-[#ffffff] text-sm font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
          >
            <Cpu className="w-4 h-4 text-[#fca311]" />
            System Architecture
          </Link>
        </div>

        {/* Live ESP32 LoRa Gateway & WebSocket Ingestion Status */}
        <div className="pt-2 sm:pt-3 flex justify-center">
          <GatewayStatusCard variant="compact" />
        </div>

        {/* Live System Counter Cards */}
        <div
          ref={metricsRef}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 sm:pt-5 text-left max-w-3xl mx-auto"
        >
          <div className="p-4 rounded-2xl bg-white/95 dark:bg-[#14213d]/50 border border-[#e5e5e5] dark:border-[#14213d] backdrop-blur-md shadow-sm dark:shadow-md transition-all duration-300 hover:border-[#fca311]/40">
            <span className="text-[11px] font-bold text-[#5c677d] dark:text-[#94a3b8] uppercase tracking-wider block">
              Transport Latency
            </span>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-[#14213d] dark:text-[#fca311]">
                {metrics.avgLatency}
              </span>
              <span className="text-xs text-[#5c677d] dark:text-[#94a3b8] font-mono">ms</span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 block font-mono">
              &lt;500ms PRD Budget
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/95 dark:bg-[#14213d]/50 border border-[#e5e5e5] dark:border-[#14213d] backdrop-blur-md shadow-sm dark:shadow-md transition-all duration-300 hover:border-[#fca311]/40">
            <span className="text-[11px] font-bold text-[#5c677d] dark:text-[#94a3b8] uppercase tracking-wider block">
              Online Nodes
            </span>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {stats.onlineNodes}
              </span>
              <span className="text-xs text-[#5c677d] dark:text-[#94a3b8] font-mono">
                / {stats.totalNodes}
              </span>
            </div>
            <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-medium mt-1 block">
              LWT Monitored
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/95 dark:bg-[#14213d]/50 border border-[#e5e5e5] dark:border-[#14213d] backdrop-blur-md shadow-sm dark:shadow-md transition-all duration-300 hover:border-[#fca311]/40">
            <span className="text-[11px] font-bold text-[#5c677d] dark:text-[#94a3b8] uppercase tracking-wider block">
              Packet Loss Gaps
            </span>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span
                className={`text-2xl font-black font-mono ${
                  stats.totalGaps === 0
                    ? 'text-[#14213d] dark:text-white'
                    : 'text-[#fca311]'
                }`}
              >
                {stats.totalGaps}
              </span>
            </div>
            <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-medium mt-1 block">
              Sequence Gap Detection
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/95 dark:bg-[#14213d]/50 border border-[#e5e5e5] dark:border-[#14213d] backdrop-blur-md shadow-sm dark:shadow-md transition-all duration-300 hover:border-[#fca311]/40">
            <span className="text-[11px] font-bold text-[#5c677d] dark:text-[#94a3b8] uppercase tracking-wider block">
              Active Zones
            </span>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-[#14213d] dark:text-[#fca311]">
                {stats.totalZones}
              </span>
            </div>
            <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-medium mt-1 block">
              Room-based Broadcast
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
