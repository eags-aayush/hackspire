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

      {/* Right: Clean Institutional Controls (Language, Theme, Clock, Status Badge) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Language Picker */}
        <select
          value={language}
          onChange={e => setLanguage(e.target.value as 'en' | 'hi')}
          className="px-2.5 py-1 text-xs font-serif rounded-sm bg-white dark:bg-[#14213d] text-[#003366] dark:text-[#93c5fd] border border-[#c9c9c9] dark:border-[#334155] outline-none cursor-pointer hidden sm:block shrink-0 shadow-sm"
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
          className="px-3 py-1 text-xs font-serif rounded-sm bg-white hover:bg-slate-100 dark:bg-[#14213d] dark:hover:bg-[#1a2e4c] text-[#003366] dark:text-white border border-[#c9c9c9] dark:border-[#334155] transition-all shadow-sm shrink-0 cursor-pointer flex items-center gap-1.5"
          title={mounted ? `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme` : 'Switch Theme'}
        >
          {mounted && theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-[#c9a227]" />
              <span className="hidden sm:inline">Light mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-[#003366]" />
              <span className="hidden sm:inline">Dark mode</span>
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
          className={`px-3 py-1 text-xs font-serif font-bold uppercase rounded-sm border shrink-0 select-none tracking-wider ${
            activeAlertsCount > 0
              ? 'bg-[#fdeaea] text-[#8b0000] border-[#8b0000] animate-pulse'
              : isConnected
              ? 'bg-[#e8f4ea] text-[#2e6b3e] border-[#2e6b3e]'
              : 'bg-[#fef3e2] text-[#b45309] border-[#b45309]'
          }`}
          title="DGMS National Monitoring Operational Status"
        >
          {activeAlertsCount > 0 ? 'DANGER' : isConnected ? 'NOMINAL' : 'CAUTION'}
        </div>
      </div>
    </header>
  );
}
