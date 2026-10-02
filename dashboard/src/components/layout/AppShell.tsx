"use client";

import React, { useState } from 'react';
import { SidebarProvider } from '@/context/SidebarContext';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { LiveStatusBar } from './LiveStatusBar';
import { EmergencySosButton } from '../common/EmergencySosButton';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sosActive, setSosActive] = useState(false);

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
              className={`w-full py-1.5 px-4 text-center text-xs font-serif font-semibold select-none border-b transition-colors duration-300 shrink-0 ${
                sosActive
                  ? 'bg-[#8b0000] text-white border-red-500 animate-pulse font-bold'
                  : 'bg-[#e8eef5] dark:bg-[#071328] text-[#003366] dark:text-[#93c5fd] border-[#c9c9c9] dark:border-[#14213d]'
              }`}
            >
              {sosActive
                ? '◈ EMERGENCY SOS ACTIVE &mdash; EVACUATE ALL SECTORS / SIREN SOUNDING IMMEDIATELY ◈'
                : '◈ All systems nominal. Continuous multi-modal telemetry active under DGMS Safety Regulations. ◈'}
            </div>

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
      <EmergencySosButton onTriggerSos={active => setSosActive(active)} />
    </div>
  </SidebarProvider>
  );
}
