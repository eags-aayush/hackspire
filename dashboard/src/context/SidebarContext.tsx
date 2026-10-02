"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMobileOpen: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Desktop collapsed state: default collapsed (true) for optimal workspace space
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('sih_sidebar_collapsed');
        if (saved !== null) {
          return saved === 'true';
        }
      } catch {
        // Ignore localStorage error
      }
    }
    return true;
  });

  // Mobile / small-screen drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-collapse sidebar on smaller laptop screens (< 1280px) to maximize data view
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280 && window.innerWidth >= 1024) {
        // On compact laptops, default to collapsed unless explicitly toggled
        setCollapsed(true);
      }
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sih_sidebar_collapsed', String(next));
      } catch {
        // Ignore localStorage error
      }
      return next;
    });
  }, []);

  const toggleMobileOpen = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        setCollapsed,
        toggleSidebar,
        mobileOpen,
        setMobileOpen,
        toggleMobileOpen,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return ctx;
}
