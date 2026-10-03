"use client";

import React, { useState } from 'react';
import { SidebarProvider } from '@/context/SidebarContext';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { LiveStatusBar } from './LiveStatusBar';
import { EmergencySosButton } from '../common/EmergencySosButton';
import { EmergencyIncidentModal } from '../common/EmergencyIncidentModal';

import { useRealtime } from '@/hooks/useRealtime';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const {
    isSerialConnected,
    livePortData,
    isConnected,
    alerts,
    isSosAlarmActive,
    sosAlarmReason,
    silenceSosAlarm,
    downloadLatestIncidentPdf,
    lastIncidentReport,
  } = useRealtime();

  // Determine dynamic operational status banner
  let bannerText = '◈ WAITING FOR SERIAL PORT // NO LIVE DATA ◈';
  let bannerClass = 'bg-[#f0f0f0] dark:bg-[#071328] text-slate-500 dark:text-slate-400 border-[#c9c9c9] dark:border-[#14213d]';

  if (isSosAlarmActive) {
    bannerText = `◈ EMERGENCY SOS ACTIVE: ${sosAlarmReason || 'SUDDEN VALUE CHANGE ANOMALY'} — EVACUATE SECTOR ◈`;
    bannerClass = 'bg-[#8b0000] text-white border-red-500 animate-pulse font-bold shadow-lg';
  } else if (isSerialConnected && livePortData) {
    const isCritical =
      (livePortData.mq4 != null && livePortData.mq4 > 3000) ||
      (livePortData.temp != null && livePortData.temp > 48) ||
      (livePortData.ml != null && livePortData.ml >= 1.5) ||
      (livePortData.water != null && livePortData.water < 20);

    const isCaution =
      (livePortData.mq4 != null && livePortData.mq4 > 1800) ||
      (livePortData.temp != null && livePortData.temp > 40) ||
      (livePortData.ml != null && livePortData.ml >= 0.5) ||
      (livePortData.water != null && livePortData.water < 45);

    if (isCritical) {
      bannerText = `◈ CRITICAL EMERGENCY — DANGER TELEMETRY DETECTED (CH₄: ${Math.round(livePortData.mq4 || 0)} ppm | TEMP: ${livePortData.temp?.toFixed(1) || '--'}°C) ◈`;
      bannerClass = 'bg-[#8b0000] text-white border-red-500 animate-pulse font-bold';
    } else if (isCaution) {
      bannerText = `◈ CAUTION REQUIRED — ELEVATED READINGS (CH₄: ${Math.round(livePortData.mq4 || 0)} ppm | TEMP: ${livePortData.temp?.toFixed(1) || '--'}°C) ◈`;
      bannerClass = 'bg-[#fef3e2] text-[#b45309] border-[#b45309] font-bold';
    } else {
      bannerText = `◈ ALL SYSTEMS NOMINAL // MINEGUARD ACTIVE — SERIAL PORT STREAMING (CH₄: ${Math.round(livePortData.mq4 || 0)} ppm | TEMP: ${livePortData.temp?.toFixed(1) || '--'}°C | HUM: ${livePortData.hum?.toFixed(1) || '--'}%) ◈`;
      bannerClass = 'bg-[#e8f4ea] dark:bg-[#062414] text-[#2e6b3e] dark:text-[#4ade80] border-[#2e6b3e] dark:border-[#14532d]';
    }
  } else if (isConnected) {
    bannerText = '◈ ALL SYSTEMS NOMINAL // MINEGUARD CLOUD TELEMETRY ACTIVE ◈';
    bannerClass = 'bg-[#e8eef5] dark:bg-[#071328] text-[#003366] dark:text-[#93c5fd] border-[#c9c9c9] dark:border-[#14213d]';
  }

  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-[#000000] text-[#14213d] dark:text-white font-sans transition-colors duration-300 min-w-0 select-none">
        {/* Official Government of India Top Banner */}
        <div className="gov-top-bar bg-[#003366] text-white text-[11px] sm:text-xs px-3 sm:px-6 py-1.5 flex justify-between items-center border-b-[3px] border-[#c9a227] select-none font-serif z-50 shrink-0">
          <span className="truncate">
            An official portal of the National Mine Safety Monitoring Programme &mdash; Directorate General of Mines Safety (DGMS)
          </span>
          <div className="hidden md:flex items-center gap-4 text-[11px] font-sans opacity-90">
            <span className="hover:underline cursor-pointer">Accessibility</span>
            <span>&bull;</span>
            <span className="hover:underline cursor-pointer">DGMS Rules 1955</span>
            <span>&bull;</span>
            <span className="hover:underline cursor-pointer">National Safety Helpdesk</span>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Navigation Sidebar (Desktop persistent + Mobile sliding drawer) */}
          <AppSidebar />

          {/* Main Flexible Viewport Container */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
            {/* Top Responsive Navigation & Control Header */}
            <AppHeader />

            {/* Official Operational Status Banner */}
            <div
              className={`w-full py-1.5 px-4 text-center text-xs font-serif font-semibold select-none border-b transition-colors duration-300 shrink-0 ${bannerClass}`}
            >
              {bannerText}
            </div>

            {/* High-visibility Emergency Alarm Banner when SOS is active */}
            {isSosAlarmActive && (
              <div className="bg-gradient-to-r from-red-950 via-red-700 to-red-950 text-white px-4 py-2 border-b-2 border-red-500 flex items-center justify-between shadow-2xl animate-pulse z-40 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-400 animate-ping shrink-0" />
                  <span className="font-mono font-bold text-xs uppercase tracking-wider text-red-200 shrink-0">
                    [AUTOMATIC SOS TRIGGERED]
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white truncate">
                    {sosAlarmReason || 'Sudden critical sensor value shift detected'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => setShowIncidentModal(true)}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded uppercase tracking-wider shadow border border-white/40 flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                    title="Inspect all sensor values recorded at the time of emergency alarm"
                  >
                    <span>📊 Inspect Values</span>
                  </button>
                  <button
                    onClick={downloadLatestIncidentPdf}
                    className="px-3.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-xs rounded uppercase tracking-wider shadow-lg flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all ring-2 ring-amber-300/40"
                    title="Export official DGMS incident PDF report containing all sensor values at time of alarm"
                  >
                    <span>📄 Export PDF (All Values)</span>
                  </button>
                  <button
                    onClick={silenceSosAlarm}
                    className="px-3.5 py-1 bg-white hover:bg-red-100 text-red-800 font-bold text-xs rounded uppercase tracking-wider shadow-lg shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                  >
                    Silence Siren
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable Page Content Area with Fluid Responsive Padding */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden relative px-3 sm:px-5 lg:px-6 xl:px-8 pt-3 sm:pt-4 pb-6 sm:pb-8 bg-[#fdfdfd] dark:bg-[#000000] transition-colors duration-300 min-w-0">
            {/* Ambient Lighting & Mesh Gradient Overlays */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
              {/* Dark Theme Ambient Orbs */}
              <div className="hidden dark:block absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#14213d]/60 via-[#14213d]/20 to-transparent blur-[120px] animate-float-orb" />
              <div className="hidden dark:block absolute top-1/3 -right-20 w-[450px] h-[450px] rounded-full bg-gradient-to-tl from-[#fca311]/12 via-[#fca311]/4 to-transparent blur-[100px] animate-pulse-slow" />
              <div className="hidden dark:block absolute -bottom-32 left-10 w-[500px] h-[500px] rounded-full bg-[#14213d]/40 blur-[130px]" />

              {/* Light Theme Ambient Radiance */}
              <div className="block dark:hidden absolute -top-32 left-1/3 w-[550px] h-[550px] rounded-full bg-gradient-to-br from-[#14213d]/5 via-[#fca311]/5 to-transparent blur-[100px] animate-float-orb" />
              <div className="block dark:hidden absolute top-1/2 -right-20 w-[400px] h-[400px] rounded-full bg-gradient-to-bl from-[#fca311]/8 via-transparent to-transparent blur-[90px]" />

              {/* Tech Matrix Cyber Dot Grid */}
              <div className="absolute inset-0 cyber-grid-overlay opacity-30 dark:opacity-20" />
            </div>

            {/* Responsive Page Viewport Container */}
            <div className="w-full max-w-[1700px] mx-auto space-y-5 sm:space-y-6 relative z-10 min-w-0">
              {children}
            </div>
          </main>

          {/* Realtime Bottom Status Bar */}
          <LiveStatusBar />
        </div>
      </div>

      {/* Floating Emergency SOS Siren Alarm Button */}
      <EmergencySosButton />

      {/* Emergency Incident Telemetry Inspection & PDF Export Modal */}
      <EmergencyIncidentModal
        isOpen={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
      />
    </div>
  </SidebarProvider>
  );
}
