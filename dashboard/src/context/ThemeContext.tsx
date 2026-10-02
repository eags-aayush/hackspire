"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'Hackspire_theme_preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const applyThemeToDOM = (t: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  };

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored === 'light' || stored === 'dark') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Synchronize state with whatever theme class the inline blocking script applied to <html>
    const root = document.documentElement;
    const isDarkInDOM = root.classList.contains('dark');
    const currentDomTheme: Theme = isDarkInDOM ? 'dark' : 'light';
    if (currentDomTheme !== theme) {
      setThemeState(currentDomTheme);
    }
    applyThemeToDOM(currentDomTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyThemeToDOM(theme);
  }, [theme, mounted]);

  // Synchronize across tabs and listen for OS system theme changes if no manual preference is saved
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue);
        applyThemeToDOM(e.newValue);
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (!stored) {
        const nextSystemTheme: Theme = e.matches ? 'dark' : 'light';
        setThemeState(nextSystemTheme);
        applyThemeToDOM(nextSystemTheme);
      }
    };

    window.addEventListener('storage', handleStorage);
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyThemeToDOM(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <div className={mounted ? 'contents' : 'contents theme-hydrating'}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
