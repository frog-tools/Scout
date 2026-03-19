import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Settings, ThemeMode } from '../types';
import { loadSettings, saveSettings } from '../services/storage';

interface SettingsContextValue {
  settings: Settings;
  updateToken: (token: string) => void;
  updateThemeMode: (mode: ThemeMode) => void;
  updateRedApiKey: (key: string) => void;
  setFrogMode: (enabled: boolean) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({ discogsToken: '', themeMode: 'system', redApiKey: '', frogMode: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings().then((data) => {
      setSettings(data);
      setIsLoading(false);
    });
  }, []);

  const updateToken = useCallback((token: string) => {
    setSettings((prev) => {
      const next = { ...prev, discogsToken: token };
      saveSettings(next);
      return next;
    });
  }, []);

  const updateThemeMode = useCallback((mode: ThemeMode) => {
    setSettings((prev) => {
      const next = { ...prev, themeMode: mode };
      saveSettings(next);
      return next;
    });
  }, []);

  const updateRedApiKey = useCallback((key: string) => {
    setSettings((prev) => {
      const next = { ...prev, redApiKey: key };
      saveSettings(next);
      return next;
    });
  }, []);

  const setFrogMode = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, frogMode: enabled };
      saveSettings(next);
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateToken, updateThemeMode, updateRedApiKey, setFrogMode, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
