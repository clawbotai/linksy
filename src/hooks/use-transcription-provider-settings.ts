"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  TranscriptionProviderCard,
  TranscriptionProviderSettings,
} from "@/types";
import {
  createCustomTranscriptionProviderCard,
  createDefaultTranscriptionProviderSettings,
} from "@/lib/transcription-providers";
import {
  fetchTranscriptionProviderSettings,
  saveTranscriptionProviderSettings,
  testTranscriptionProviderConnection,
} from "@/lib/transcription-provider-settings";

export interface TranscriptionTestResult {
  success: boolean;
  message: string;
  providerId: string;
}

export function useTranscriptionProviderSettings() {
  const [settings, setSettings] = useState<TranscriptionProviderSettings>(
    createDefaultTranscriptionProviderSettings,
  );
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [dirtyProviderIds, setDirtyProviderIds] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, TranscriptionTestResult>>({});
  const settingsRef = useRef(settings);

  const applySettings = useCallback((next: TranscriptionProviderSettings) => {
    setSettings(next);
    settingsRef.current = next;
  }, []);

  const persistSettings = useCallback(async (nextSettings: TranscriptionProviderSettings) => {
    setSaving(true);
    try {
      const next = await saveTranscriptionProviderSettings(
        nextSettings.providers,
        nextSettings.activeProviderId,
      );
      applySettings(next);
      setDirtyProviderIds(new Set());
      return next;
    } finally {
      setSaving(false);
    }
  }, [applySettings]);

  const loadSettings = useCallback(async () => {
    try {
      const next = await fetchTranscriptionProviderSettings();
      applySettings(next);
      setDirtyProviderIds(new Set());
    } catch (error) {
      console.error("读取转录供应商设置失败:", error);
    } finally {
      setLoaded(true);
    }
  }, [applySettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const markDirty = useCallback((providerId: string) => {
    setDirtyProviderIds((prev) => {
      const next = new Set(prev);
      next.add(providerId);
      return next;
    });
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
  }, []);

  const updateProviderCard = useCallback(
    (
      providerId: string,
      updater: (current: TranscriptionProviderCard) => TranscriptionProviderCard,
    ) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          providers: prev.providers.map((p) =>
            p.id === providerId ? updater(p) : p,
          ),
        };
        settingsRef.current = next;
        return next;
      });
      markDirty(providerId);
    },
    [markDirty],
  );

  const addProvider = useCallback(() => {
    const newCard = createCustomTranscriptionProviderCard();
    setSettings((prev) => {
      const next = {
        ...prev,
        providers: [...prev.providers, newCard],
        activeProviderId: newCard.id,
      };
      settingsRef.current = next;
      return next;
    });
    markDirty(newCard.id);
    return newCard.id;
  }, [markDirty]);

  const removeProvider = useCallback((providerId: string) => {
    const current = settingsRef.current;
    const remaining = current.providers.filter((p) => p.id !== providerId);
    const nextActiveId =
      current.activeProviderId === providerId
        ? remaining[0]?.id ?? ""
        : current.activeProviderId;
    const next = { providers: remaining, activeProviderId: nextActiveId };
    applySettings(next);
    setDirtyProviderIds((prev) => {
      const next = new Set(prev);
      next.delete(providerId);
      return next;
    });
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
    void persistSettings(next);
  }, [applySettings, persistSettings]);

  const updateProvider = useCallback(
    (providerId: string, updates: Partial<TranscriptionProviderCard>) => {
      updateProviderCard(providerId, (current) => ({
        ...current,
        ...updates,
      }));
    },
    [updateProviderCard],
  );

  const setActiveProvider = useCallback((providerId: string) => {
    const current = settingsRef.current;
    if (!current.providers.some((provider) => provider.id === providerId)) return;

    const next = {
      ...current,
      activeProviderId: providerId,
    };
    applySettings(next);
    void persistSettings(next);
  }, [applySettings, persistSettings]);

  const saveProvider = useCallback(async (providerId: string) => {
    const current = settingsRef.current;
    await persistSettings(current);
  }, [persistSettings]);

  const saveAll = useCallback(async () => {
    const current = settingsRef.current;
    await persistSettings(current);
  }, [persistSettings]);

  const testConnection = useCallback(async (providerId: string) => {
    setTesting(providerId);
    try {
      const provider = settingsRef.current.providers.find((p) => p.id === providerId);
      if (!provider) {
        return { success: false, message: "未找到指定的供应商", providerId };
      }

      const result = await testTranscriptionProviderConnection(provider);
      const testResult: TranscriptionTestResult = { ...result, providerId };
      setTestResults((prev) => ({ ...prev, [providerId]: testResult }));
      return testResult;
    } finally {
      setTesting(null);
    }
  }, []);

  const getTestResult = useCallback(
    (providerId: string) => testResults[providerId],
    [testResults],
  );

  return {
    settings,
    loaded,
    saving,
    testing,
    dirtyProviderIds,
    testResults,
    reload: loadSettings,
    addProvider,
    removeProvider,
    updateProvider,
    setActiveProvider,
    saveProvider,
    saveAll,
    testConnection,
    getTestResult,
  };
}
