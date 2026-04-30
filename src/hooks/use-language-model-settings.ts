"use client";

import * as React from "react";
import type {
  LanguageModelModelConfig,
  LanguageModelProviderCard,
  LanguageModelSettings,
  LanguageModelTestResult,
} from "@/types";
import {
  createCustomLanguageModelProviderCard,
  createDefaultLanguageModelSettings,
  createLanguageModelModelConfig,
  getLanguageModelProviderCardById,
} from "@/lib/language-models";
import {
  fetchLanguageModelSettings,
  saveLanguageModelSettings,
  testLanguageModelConnection,
} from "@/lib/language-model-settings";
import { writeCachedLanguageModelSettings } from "@/lib/language-model-settings-cache";

function getModelResultKey(providerId: string, modelId: string) {
  return `${providerId}:${modelId}`;
}

export function useLanguageModelSettings() {
  const [settings, setSettings] = React.useState<LanguageModelSettings>(
    createDefaultLanguageModelSettings,
  );
  const [loaded, setLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [savingProviderId, setSavingProviderId] = React.useState<string | null>(null);
  const [testingModelKey, setTestingModelKey] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [dirtyProviderIds, setDirtyProviderIds] = React.useState<Set<string>>(new Set());
  const [testResults, setTestResults] = React.useState<Record<string, LanguageModelTestResult>>({});
  const settingsRef = React.useRef(settings);

  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const next = await fetchLanguageModelSettings();
      setSettings(next);
      settingsRef.current = next;
      setDirtyProviderIds(new Set());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "读取语言模型设置失败");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  const clearProviderTestResults = React.useCallback((providerId: string) => {
    setTestResults((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${providerId}:`)) {
          delete next[key];
        }
      });
      return next;
    });
  }, []);

  const markProviderDirty = React.useCallback((providerId: string) => {
    setDirtyProviderIds((prev) => {
      const next = new Set(prev);
      next.add(providerId);
      return next;
    });
    clearProviderTestResults(providerId);
  }, [clearProviderTestResults]);

  const updateProviderCard = React.useCallback(
    (
      providerId: string,
      updater: (current: LanguageModelProviderCard) => LanguageModelProviderCard,
    ) => {
      setSettings((prev) => {
        const nextProviders = prev.providers.map((provider) =>
          provider.id === providerId ? updater(provider) : provider,
        );
        const next = { providers: nextProviders };
        settingsRef.current = next;
        return next;
      });
      markProviderDirty(providerId);
    },
    [markProviderDirty],
  );

  const addProvider = React.useCallback(() => {
    const nextProvider = createCustomLanguageModelProviderCard();
    setSettings((prev) => {
      const next = {
        providers: [...prev.providers, nextProvider],
      };
      settingsRef.current = next;
      return next;
    });
    markProviderDirty(nextProvider.id);
    return nextProvider.id;
  }, [markProviderDirty]);

  const removeProvider = React.useCallback((providerId: string) => {
    setSettings((prev) => {
      const next = {
        providers: prev.providers.filter((provider) => provider.id !== providerId),
      };
      settingsRef.current = next;
      return next;
    });
    setDirtyProviderIds((prev) => {
      const next = new Set(prev);
      next.delete(providerId);
      return next;
    });
    clearProviderTestResults(providerId);
  }, [clearProviderTestResults]);

  const updateProviderConnection = React.useCallback(
    (
      providerId: string,
      updates: Partial<Pick<LanguageModelProviderCard, "apiKey" | "apiKeyConfigured" | "baseUrl" | "name" | "apiFormat">>,
    ) => {
      updateProviderCard(providerId, (current) => ({
        ...current,
        ...updates,
      }));
    },
    [updateProviderCard],
  );

  const updateProviderConfig = React.useCallback(
    (
      providerId: string,
      modelId: string,
      updates: Partial<LanguageModelModelConfig>,
    ) => {
      updateProviderCard(providerId, (current) => ({
        ...current,
        models: current.models.map((item) => {
          if (item.id !== modelId) {
            return item;
          }
          const nextModel = { ...item, ...updates };
          if (
            Object.prototype.hasOwnProperty.call(updates, "model")
            && !Object.prototype.hasOwnProperty.call(updates, "name")
            && (!item.name || item.name === item.model)
          ) {
            nextModel.name = String(updates.model || item.name).trim() || item.name;
          }
          return nextModel;
        }),
      }));
    },
    [updateProviderCard],
  );

  const setSelectedProviderModel = React.useCallback(
    (providerId: string, modelId: string) => {
      updateProviderCard(providerId, (current) => ({
        ...current,
        selectedModelId: modelId,
      }));
    },
    [updateProviderCard],
  );

  const addProviderModel = React.useCallback(
    (providerId: string) => {
      const provider = getLanguageModelProviderCardById(settingsRef.current, providerId);
      const nextModel = createLanguageModelModelConfig(provider?.presetType, {
        name: "New Model",
        model: "",
      }, provider?.apiFormat);
      updateProviderCard(providerId, (current) => ({
        ...current,
        selectedModelId: nextModel.id,
        models: [...current.models, nextModel],
      }));
      return nextModel.id;
    },
    [updateProviderCard],
  );

  const removeProviderModel = React.useCallback(
    (providerId: string, modelId: string) => {
      updateProviderCard(providerId, (current) => {
        if (current.models.length <= 1) {
          return current;
        }

        const models = current.models.filter((item) => item.id !== modelId);
        return {
          ...current,
          selectedModelId:
            current.selectedModelId === modelId ? models[0]?.id || current.selectedModelId : current.selectedModelId,
          models,
        };
      });
    },
    [updateProviderCard],
  );

  const saveProviderConfig = React.useCallback(
    async (providerId: string) => {
      setSavingProviderId(providerId);

      try {
        const submittedSettings = settingsRef.current;
        const next = await saveLanguageModelSettings(submittedSettings.providers);
        setSettings(next);
        settingsRef.current = next;
        writeCachedLanguageModelSettings(next);
        setDirtyProviderIds(new Set());
      } finally {
        setSavingProviderId(null);
      }
    },
    [],
  );

  const testProviderConfig = React.useCallback(
    async (providerId: string, modelId: string) => {
      const modelKey = getModelResultKey(providerId, modelId);
      setTestingModelKey(modelKey);

      try {
        const provider = getLanguageModelProviderCardById(settingsRef.current, providerId);
        if (!provider) {
          throw new Error("未找到指定的 Provider");
        }
        const currentModelConfig =
          provider.models.find((item) => item.id === modelId)
          ?? provider.models[0]
          ?? createLanguageModelModelConfig(provider.presetType, { id: modelId });

        const result = await testLanguageModelConnection(
          providerId,
          modelId,
          currentModelConfig,
          {
            apiKey: provider.apiKey,
            apiKeyConfigured: provider.apiKeyConfigured,
            baseUrl: provider.baseUrl,
            apiFormat: provider.apiFormat,
            name: provider.name,
            presetType: provider.presetType,
            kind: provider.kind,
          },
        );

        setTestResults((prev) => ({
          ...prev,
          [modelKey]: result,
        }));

        return result;
      } finally {
        setTestingModelKey(null);
      }
    },
    [],
  );

  const getTestResult = React.useCallback(
    (providerId: string, modelId: string) => testResults[getModelResultKey(providerId, modelId)],
    [testResults],
  );

  return {
    settings,
    loaded,
    loading,
    loadError,
    savingProviderId,
    testingModelKey,
    dirtyProviderIds,
    reload: loadSettings,
    addProvider,
    removeProvider,
    updateProviderConnection,
    updateProviderConfig,
    setSelectedProviderModel,
    addProviderModel,
    removeProviderModel,
    saveProviderConfig,
    testProviderConfig,
    getTestResult,
  };
}
