"use client";

import React, { useState, useEffect } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { useTheme } from '@/context/ThemeContext';
import { useSidebar } from '@/context/SidebarContext';
import { Badge } from '../common/Badge';
import { getLatencyRating } from '@/lib/utils';
import {
  Radio,
  RefreshCw,
  Clock,
  Layers,
  Cpu,
  ShieldAlert,
  Sun,
  Moon,
  Trash2,
  Check,
  Sparkles,
  Volume2,
  VolumeX,
  Menu,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';

export function AppHeader() {
  const {
    isConnected,
    metrics,
    stats,
    reconnect,
    alerts,
    clearCache,
    isSimulationActive,
    toggleSimulation,
    voiceAlertsEnabled,
    toggleVoiceAlerts,
    isSpeaking,
  } = useRealtime();
  const { theme, toggleTheme } = useTheme();
  const { collapsed, toggleSidebar, toggleMobileOpen } = useSidebar();
  const [timeString, setTimeString] = useState<string>('');
  const [purgedRecently, setPurgedRecently] = useState(false);

  const handlePurge = () => {
    clearCache();
    setPurgedRecently(true);
    setTimeout(() => setPurgedRecently(false), 2000);
  };

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const latencyRating = getLatencyRating(metrics.avgLatency);
  const activeAlertsCount = alerts.filter(a => a.severity === 'critical').length;

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-[#000000]/90 backdrop-blur-xl border-b border-[#e5e5e5] dark:border-[#14213d]/80 px-3 sm:px-5 lg:px-6 flex items-center justify-between transition-colors duration-300 select-none min-w-0">
      {/* Left: Hamburger & Brand Identifier */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Toggle (< 1024px) */}
        <button
          onClick={toggleMobileOpen}
          className="p-2 rounded-xl bg-[#f4f5f7] dark:bg-[#14213d]/60 text-[#14213d] dark:text-[#fca311] border border-[#e5e5e5] dark:border-[#14213d] hover:scale-105 active:scale-95 transition-all lg:hidden cursor-pointer shrink-0"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Desktop Sidebar Toggle Icon Button (>= 1024px) */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex p-2 rounded-xl bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/60 dark:hover:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border border-[#e5e5e5] dark:border-[#14213d] hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        {/* Brand Icon */}
        <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#14213d] border border-[#fca311]/50 text-[#fca311] shadow-md shadow-black/20 group shrink-0">
          <div className="absolute inset-0 rounded-xl bg-[#fca311]/10 animate-pulse-slow" />
          <Radio className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 transition-transform duration-300 group-hover:scale-110" />
        </div>

        {/* Brand Text */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 truncate">
            <span className="font-black text-xs sm:text-sm lg:text-base tracking-wide text-[#000000] dark:text-white truncate">
              GEO-MESH <span className="text-[#fca311]">SUBSIDENCE</span>
            </span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-md bg-[#e5e5e5] dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border border-[#d4d4d4] dark:border-[#14213d] shrink-0">
              SIH-2026
            </span>
          </div>
          <p className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] hidden 2xl:block font-medium truncate">
            Autonomous Mine Subsidence Early Warning &amp; Telemetry Pipeline
          </p>
        </div>
      </div>

      {/* Center: Live Pipeline Benchmarks (Adapts to screen space) */}
      <div className="hidden xl:flex items-center gap-2.5 shrink-0">
        {/* Latency badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f4f5f7] dark:bg-[#14213d]/60 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono">
          <span className="text-[#5c677d] dark:text-[#94a3b8]">Latency:</span>
          <span className={`font-bold ${latencyRating.color}`}>
            {metrics.avgLatency}ms
          </span>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] hidden 2xl:inline">(&lt;500ms target)</span>
        </div>

        {/* Node health ratio */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f4f5f7] dark:bg-[#14213d]/60 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono text-[#5c677d] dark:text-[#94a3b8]">
          <Cpu className="w-3.5 h-3.5 text-[#fca311] shrink-0" />
          <span>Nodes:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {stats.onlineNodes}
          </span>
          <span>/</span>
          <span className="text-[#14213d] dark:text-[#e5e5e5]">{stats.totalNodes}</span>
        </div>

        {/* Zones active */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f4f5f7] dark:bg-[#14213d]/60 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono text-[#5c677d] dark:text-[#94a3b8]">
          <Layers className="w-3.5 h-3.5 text-amber-700 dark:text-[#fca311] shrink-0" />
          <span>Zones:</span>
          <span className="font-bold text-[#14213d] dark:text-[#ffffff]">
            {stats.totalZones}
          </span>
        </div>
      </div>

      {/* Right: Actions, Theme Switcher & Clock */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {activeAlertsCount > 0 && (
          <Badge variant="danger" pulse className="hidden sm:inline-flex text-[10px] py-1">
            <ShieldAlert className="w-3 h-3" />
            {activeAlertsCount} Critical
          </Badge>
        )}

        {/* WS Stream Status */}
        <Badge
          variant={isConnected ? 'success' : 'danger'}
          pulse={isConnected}
          className="cursor-pointer text-[10px] py-1 px-2 font-mono shrink-0"
          onClick={reconnect}
          title="Click to reconnect WebSocket"
        >
          {isConnected ? 'LIVE WS' : 'OFFLINE'}
        </Badge>

        {/* Simulated Telemetry Mesh Indicator (if active) */}
        {isSimulationActive && (
          <button
            onClick={toggleSimulation}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-[#fca311]/15 hover:bg-[#fca311]/25 border border-[#fca311]/50 text-[#fca311] text-[10px] sm:text-[11px] font-mono font-bold tracking-wider animate-pulse hover:scale-105 transition-all shadow-sm shrink-0 cursor-pointer"
            title="Browser demo simulation active. Click to stop."
          >
            <Sparkles className="w-3 h-3 text-[#fca311] shrink-0" />
            <span className="hidden sm:inline">SIM RUNNING</span>
            <span className="sm:hidden">SIM</span>
          </button>
        )}

        {/* Purge Cache Button */}
        <button
          onClick={handlePurge}
          className={`px-2 sm:px-2.5 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer ${
            purgedRecently
              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/60 dark:hover:bg-[#14213d] text-[#14213d] dark:text-[#e5e5e5] border-[#e5e5e5] dark:border-[#14213d]'
          }`}
          title="Clear cached telemetry & reset ghost nodes"
        >
          {purgedRecently ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-mono hidden sm:inline">Cleaned</span>
            </>
          ) : (
            <>
              <Trash2 className="w-3.5 h-3.5 text-amber-700 dark:text-[#fca311]" />
              <span className="hidden lg:inline text-[11px] font-mono">Purge</span>
            </>
          )}
        </button>

        {/* Reconnect WebSocket */}
        <button
          onClick={reconnect}
          className="p-1.5 sm:p-2 rounded-xl bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/60 dark:hover:bg-[#14213d] text-[#14213d] dark:text-[#e5e5e5] border border-[#e5e5e5] dark:border-[#14213d] transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
          title="Reconnect WebSocket Stream"
        >
          <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Voice Alert Speech & Chime Announcer Toggle */}
        <button
          onClick={toggleVoiceAlerts}
          className={`relative p-1.5 sm:p-2 rounded-xl border transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm flex items-center gap-1 shrink-0 cursor-pointer ${
            voiceAlertsEnabled
              ? isSpeaking
                ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/50 animate-pulse'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-[#fca311] border-amber-500/40'
              : 'bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/60 dark:hover:bg-[#14213d] text-[#5c677d] dark:text-[#94a3b8] border-[#e5e5e5] dark:border-[#14213d]'
          }`}
          title={
            voiceAlertsEnabled
              ? isSpeaking
                ? 'Voice Alert speaking... Click to mute'
                : 'Voice Alerts Active. Click to mute'
              : 'Voice Alerts Muted. Click to activate'
          }
          aria-label="Toggle Voice Alerts"
        >
          {voiceAlertsEnabled ? (
            <>
              <Volume2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSpeaking ? 'animate-bounce text-red-500' : 'text-amber-700 dark:text-[#fca311]'}`} />
              <span className="hidden 2xl:inline text-[10px] font-mono font-bold">
                {isSpeaking ? 'SPEAKING' : 'VOICE ON'}
              </span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#5c677d] dark:text-[#94a3b8]" />
              <span className="hidden 2xl:inline text-[10px] font-mono">MUTED</span>
            </>
          )}
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="relative p-1.5 sm:p-2 rounded-xl bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/80 dark:hover:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border border-[#e5e5e5] dark:border-[#fca311]/40 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm shrink-0 cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
        >
          <div className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 overflow-hidden">
            <Sun
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 absolute inset-0 transition-all duration-500 transform ${
                theme === 'dark'
                  ? 'opacity-100 rotate-0 scale-100 text-[#fca311]'
                  : 'opacity-0 -rotate-90 scale-0 text-amber-500'
              }`}
            />
            <Moon
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 absolute inset-0 transition-all duration-500 transform ${
                theme === 'light'
                  ? 'opacity-100 rotate-0 scale-100 text-[#14213d]'
                  : 'opacity-0 rotate-90 scale-0 text-[#14213d]'
              }`}
            />
          </div>
        </button>

        {/* Live Clock */}
        <div className="hidden 2xl:flex items-center gap-1.5 text-xs text-[#5c677d] dark:text-[#94a3b8] font-mono pl-2 border-l border-[#e5e5e5] dark:border-[#14213d] shrink-0">
          <Clock className="w-3.5 h-3.5 text-[#fca311]" />
          <span className="font-semibold text-[#14213d] dark:text-[#e5e5e5]">
            {timeString || '--:--:--'}
          </span>
        </div>
      </div>
    </header>
  );
}
