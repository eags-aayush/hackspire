"use client";

import React, { useState, useEffect } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { useTheme } from '@/context/ThemeContext';
import { useSidebar } from '@/context/SidebarContext';
import {
  Clock,
  Sun,
  Moon,
  Menu,
} from 'lucide-react';

export function AppHeader() {
  const {
    isConnected,
    alerts,
    isSerialConnected,
    connectSerialPort,
    disconnectSerialPort,
    livePortData,
  } = useRealtime();
  const { theme, toggleTheme, mounted } = useTheme();
  const { toggleMobileOpen } = useSidebar();
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [timeString, setTimeString] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const datePart = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timePart = now.toLocaleTimeString('en-IN', { hour12: false });
      setTimeString(`${datePart} · ${timePart}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeAlertsCount = alerts.filter(a => a.severity === 'critical').length;
  const isLive = isSerialConnected || isConnected;

  let statusText = 'OFFLINE';
  let statusClass = 'bg-[#f0f0f0] dark:bg-[#1e293b] text-slate-500 border-slate-400';

  if (isLive) {
    const isCritical =
      activeAlertsCount > 0 ||
      (livePortData?.mq4 != null && livePortData.mq4 > 3000) ||
      (livePortData?.temp != null && livePortData.temp > 48) ||
      (livePortData?.ml != null && livePortData.ml >= 1.5);

    const isCaution =
      (livePortData?.mq4 != null && livePortData.mq4 > 1800) ||
      (livePortData?.temp != null && livePortData.temp > 40) ||
      (livePortData?.ml != null && livePortData.ml >= 0.5);

    if (isCritical) {
      statusText = 'DANGER';
      statusClass = 'bg-[#fdeaea] text-[#8b0000] border-[#8b0000] animate-pulse';
    } else if (isCaution) {
      statusText = 'CAUTION';
      statusClass = 'bg-[#fef3e2] text-[#b45309] border-[#b45309]';
    } else {
      statusText = 'NOMINAL';
      statusClass = 'bg-[#e8f4ea] text-[#2e6b3e] border-[#2e6b3e]';
    }
  }

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

        {/* Official DGMS Logo Shield */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#003366] border-2 border-[#c9a227] rounded-sm flex items-center justify-center text-white text-xl sm:text-2xl font-serif shadow-md select-none shrink-0">
            &#9733;
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-sm sm:text-base lg:text-lg tracking-wide text-[#003366] dark:text-[#93c5fd] leading-tight truncate">
                MineGuard IoT
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-serif font-bold uppercase rounded-sm bg-[#e8eef5] dark:bg-[#14213d] text-[#003366] dark:text-[#fca311] border border-[#c9c9c9] dark:border-[#14213d] shrink-0">
                DGMS National Portal
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#3d4551] dark:text-[#cbd5e1] font-serif truncate leading-tight mt-0.5">
              Department of Mining Safety &mdash; Smart Safety Bubble Monitoring System v4.0
            </p>
          </div>
        </div>
      </div>

      {/* Right: Clean Institutional Controls (Port Connect, Language, Theme, Clock, Status Badge) */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Web Serial Port Connection Button */}
        {isSerialConnected ? (
          <button
            onClick={() => disconnectSerialPort()}
            className="px-2.5 py-1 text-xs font-serif font-bold rounded-sm bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-400 shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 transition-all"
            title="USB Serial Port connected (115200 baud). Click to disconnect."
          >
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
            <span>PORT CONNECTED</span>
          </button>
        ) : (
          <button
            onClick={() => connectSerialPort(115200)}
            className="px-2.5 py-1 text-xs font-serif font-bold rounded-sm bg-[#003366] hover:bg-[#1a4480] dark:bg-[#c9a227] dark:hover:bg-[#d4b03b] text-white dark:text-[#003366] border border-[#c9a227] dark:border-[#003366] shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 transition-all"
            title="Connect hardware via USB Serial Port (Web Serial API at 115200/9600 baud)"
          >
            <span>⚡ CONNECT PORT</span>
          </button>
        )}

        {/* Language Picker */}
        <select
          value={language}
          onChange={e => setLanguage(e.target.value as 'en' | 'hi')}
          className="px-2 py-1 text-xs font-serif rounded-sm bg-white dark:bg-[#14213d] text-[#003366] dark:text-[#93c5fd] border border-[#c9c9c9] dark:border-[#334155] outline-none cursor-pointer hidden sm:block shrink-0 shadow-sm"
          title="Select Portal Language"
        >
          <option value="en">English</option>
          <option value="hi">हिंदी</option>
        </select>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          suppressHydrationWarning
          className="px-2.5 py-1 text-xs font-serif rounded-sm bg-white hover:bg-slate-100 dark:bg-[#14213d] dark:hover:bg-[#1a2e4c] text-[#003366] dark:text-white border border-[#c9c9c9] dark:border-[#334155] transition-all shadow-sm shrink-0 cursor-pointer flex items-center gap-1"
          title={mounted ? `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme` : 'Switch Theme'}
        >
          {mounted && theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-[#c9a227]" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-[#003366]" />
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>

        {/* Live Clock with Date (IST) */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#3d4551] dark:text-[#cbd5e1] font-serif px-2 border-l border-[#c9c9c9] dark:border-[#334155] shrink-0">
          <Clock className="w-3.5 h-3.5 text-[#003366] dark:text-[#c9a227]" />
          <span className="font-semibold whitespace-nowrap">
            {timeString || '-- --- ---- · --:--:--'}
          </span>
        </div>

        {/* Global DGMS Status Badge */}
        <div
          className={`px-3 py-1 text-xs font-serif font-bold uppercase rounded-sm border shrink-0 select-none tracking-wider ${statusClass}`}
          title="DGMS National Monitoring Operational Status"
        >
          {statusText}
        </div>
      </div>
    </header>
  );
}
