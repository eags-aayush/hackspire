"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Activity,
  Cpu,
  ShieldAlert,
  BarChart3,
  Network,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Server,
  BrainCircuit,
  Globe2,
  X,
} from 'lucide-react';
import { useRealtime } from '@/hooks/useRealtime';
import { useSidebar } from '@/context/SidebarContext';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, toggleSidebar, mobileOpen, closeMobile } = useSidebar();
  const { alerts, stats, metrics } = useRealtime();

  // Close mobile drawer when route changes
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  const criticalAlertsCount = alerts.filter(a => a.severity === 'critical').length;

  const navItems = [
    {
      label: 'Executive Overview',
      href: '/',
      icon: Home,
      badge: null,
      description: 'System landing & pipeline summary',
    },
    {
      label: 'Digital Twin GIS',
      href: '/digital-twin',
      icon: Globe2,
      badge: 'GIS Live',
      badgeColor: 'bg-[#fca311]/15 text-amber-800 dark:text-[#fca311] border-[#fca311]/40',
      description: 'OpenStreetMap & 3D strata model',
    },
    {
      label: 'Realtime Monitoring',
      href: '/monitoring',
      icon: Activity,
      badge: stats.onlineNodes > 0 ? `${stats.onlineNodes} Live` : null,
      badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      description: 'Zone sensor telemetry grid',
    },
    {
      label: 'Node Fleet Health',
      href: '/nodes',
      icon: Cpu,
      badge: stats.totalGaps > 0 ? `${stats.totalGaps} Gaps` : null,
      badgeColor: 'bg-[#fca311]/15 text-amber-800 dark:text-[#fca311] border-[#fca311]/40',
      description: 'Packet gaps & LWT status',
    },
    {
      label: 'Alerts & Anomalies',
      href: '/alerts',
      icon: ShieldAlert,
      badge: criticalAlertsCount > 0 ? `${criticalAlertsCount}` : null,
      badgeColor: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 animate-pulse',
      description: 'Early warning threshold triggers',
    },
    {
      label: 'Historical Analytics',
      href: '/analytics',
      icon: BarChart3,
      badge: 'PRD §8',
      badgeColor: 'bg-[#14213d]/15 text-[#14213d] dark:text-[#fca311] border-[#14213d]/30 dark:border-[#fca311]/30',
      description: 'Time-series query interface',
    },
    {
      label: 'System Architecture',
      href: '/architecture',
      icon: Network,
      badge: null,
      description: 'Mesh to dashboard topology',
    },
    {
      label: 'ML Testing Lab',
      href: '/ml-demo',
      icon: BrainCircuit,
      badge: 'Phase 6',
      badgeColor: 'bg-[#fca311]/15 text-[#fca311] border-[#fca311]/40',
      description: 'Model inference & drift sandbox',
    },
  ];

  // Common Nav Link List Renderer
  const renderNavList = (isDrawer = false) => (
    <div className="flex-1 py-3 px-2 sm:px-2.5 space-y-1 overflow-y-auto overflow-x-hidden">
      <div
        className={cn(
          'px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#5c677d] dark:text-[#94a3b8]',
          collapsed && !isDrawer && 'hidden'
        )}
      >
        Navigation
      </div>

      {navItems.map(item => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={isDrawer ? closeMobile : undefined}
            title={collapsed && !isDrawer ? item.label : undefined}
            className={cn(
              'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 relative min-w-0',
              isActive
                ? 'bg-[#14213d]/10 dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border border-[#14213d]/30 dark:border-[#fca311]/50 shadow-sm'
                : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white hover:bg-[#f4f5f7] dark:hover:bg-[#14213d]/40 border border-transparent'
            )}
          >
            <Icon
              className={cn(
                'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                isActive
                  ? 'text-[#14213d] dark:text-[#fca311]'
                  : 'text-[#5c677d] dark:text-[#94a3b8] group-hover:text-[#14213d] dark:group-hover:text-white'
              )}
            />

            {(!collapsed || isDrawer) && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate text-xs font-bold tracking-tight">{item.label}</span>
                {item.badge && (
                  <span
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold border shrink-0 ml-1.5',
                      item.badgeColor
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            )}

            {/* Active gold pill indicator */}
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-md bg-[#fca311] shadow-[0_0_8px_rgba(252,163,17,0.7)]" />
            )}
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      {/* 1. Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={closeMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* 2. Mobile Sliding Drawer (< 1024px) */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#000000] border-r border-[#e5e5e5] dark:border-[#14213d] shadow-2xl flex flex-col lg:hidden transition-transform duration-300 ease-out transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#e5e5e5] dark:border-[#14213d] flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-sm tracking-wide text-[#000000] dark:text-white">
            <span className="text-[#fca311]">GEO-MESH</span> SUBSIDENCE
          </div>
          <button
            onClick={closeMobile}
            className="p-1.5 rounded-lg bg-[#f4f5f7] dark:bg-[#14213d] text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white transition-colors"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {renderNavList(true)}

        {/* Drawer Footer */}
        <div className="p-3 border-t border-[#e5e5e5] dark:border-[#14213d] text-[10px] font-mono text-[#5c677d] dark:text-[#94a3b8] flex items-center justify-between">
          <span>Hackspire-2026 Coal Mine</span>
          <span className="text-[#fca311] font-bold">v0.1.0</span>
        </div>
      </div>

      {/* 3. Desktop Persistent Sidebar (>= 1024px) */}
      <aside
        className={cn(
          'hidden lg:flex relative bg-white dark:bg-[#000000] border-r border-[#e5e5e5] dark:border-[#14213d]/80 transition-all duration-300 flex-col z-30 shrink-0 select-none min-h-screen',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {renderNavList(false)}

        {/* Pipeline Quick Info */}
        {!collapsed && (
          <div className="p-3 mx-2.5 mb-3 rounded-xl bg-[#f4f5f7] dark:bg-[#14213d]/50 border border-[#e5e5e5] dark:border-[#14213d] text-[11px] space-y-2 shadow-sm min-w-0">
            <div className="flex items-center gap-2 text-[#14213d] dark:text-white font-bold truncate">
              <Server className="w-3.5 h-3.5 text-[#fca311] shrink-0" />
              <span className="truncate">Ingestion Pipeline</span>
            </div>
            <p className="text-[#5c677d] dark:text-[#94a3b8] text-[10px] leading-relaxed line-clamp-2">
              MQTT QoS 1 • EMQX • NestJS EventBus • Socket.IO Gateway
            </p>
            <div className="pt-1.5 border-t border-[#e5e5e5] dark:border-[#14213d]/60 space-y-1 text-[10px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[#5c677d] dark:text-[#94a3b8]">Protocol</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Protobuf v3
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5c677d] dark:text-[#94a3b8]">Saved Bandwidth</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                  ~{metrics.estimatedBandwidthSavedPercent || 80}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Collapse toggle button at bottom */}
        <div className="p-2 border-t border-[#e5e5e5] dark:border-[#14213d]/80 flex items-center justify-between min-w-0">
          {!collapsed && (
            <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] px-2 font-mono flex items-center gap-1 truncate">
              <Terminal className="w-3 h-3 text-[#fca311] shrink-0" /> v0.1.0-Hackspire
            </span>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/60 dark:hover:bg-[#14213d] text-[#5c677d] hover:text-[#000000] dark:text-[#94a3b8] dark:hover:text-white transition-colors ml-auto cursor-pointer"
            title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
