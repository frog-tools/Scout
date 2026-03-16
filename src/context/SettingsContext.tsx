import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Settings } from '../types';
import { loadSettings, saveSettings } from '../services/storage';

interface SettingsContextValue {
  settings: Settings;
  updateToken: (token: string) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({ discogsToken: '' });
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

  return (
    <SettingsContext.Provider value={{ settings, updateToken, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
