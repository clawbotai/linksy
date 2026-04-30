'use client';

import type { LanguageModelProviderCard, LanguageModelSettings } from "@/types";
import { normalizeLanguageModelSettings } from "@/lib/language-models";

const CACHE_KEY = "memoflow-language-model-settings-cache";

function toCachedProviderSettings(provider: LanguageModelProviderCard): LanguageModelProviderCard {
  return {
    ...provider,
    apiKey: "",
    apiKeyConfigured: Boolean(provider.apiKeyConfigured ?? provider.apiKey),
  };
}

function toCachedSettings(settings: LanguageModelSettings): LanguageModelSettings {
  return {
    providers: settings.providers.map((provider) => toCachedProviderSettings(provider)),
  };
}

export function readCachedLanguageModelSettings(): LanguageModelSettings | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeLanguageModelSettings(JSON.parse(raw) as Partial<LanguageModelSettings>);
  } catch {
    return null;
  }
}

export function writeCachedLanguageModelSettings(settings: LanguageModelSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(toCachedSettings(settings)));
  } catch (error) {
    console.error("保存语言模型缓存失败:", error);
  }
}

export function mergeCachedLanguageModelSettings(
  remoteSettings: LanguageModelSettings,
  cachedSettings: LanguageModelSettings | null,
): LanguageModelSettings {
  if (!cachedSettings) {
    return remoteSettings;
  }

  const remoteById = new Map(remoteSettings.providers.map((provider) => [provider.id, provider]));
  const mergedProviders = remoteSettings.providers.map((remoteProvider) => {
    const cachedProvider = cachedSettings.providers.find((provider) => provider.id === remoteProvider.id);
    if (!cachedProvider) {
      return remoteProvider;
    }

    const shouldUseCachedModels =
      cachedProvider.models.length > remoteProvider.models.length
      || (
        cachedProvider.models.length === remoteProvider.models.length
        && cachedProvider.selectedModelId !== remoteProvider.selectedModelId
        && cachedProvider.models.some((item) => item.id === cachedProvider.selectedModelId)
      );

    if (!shouldUseCachedModels) {
      return {
        ...remoteProvider,
        apiKeyConfigured: remoteProvider.apiKeyConfigured ?? cachedProvider.apiKeyConfigured,
      };
    }

    return {
      ...remoteProvider,
      selectedModelId:
        cachedProvider.models.some((item) => item.id === cachedProvider.selectedModelId)
          ? cachedProvider.selectedModelId
          : remoteProvider.selectedModelId,
      models: cachedProvider.models,
      apiKeyConfigured: remoteProvider.apiKeyConfigured ?? cachedProvider.apiKeyConfigured,
    };
  });

  cachedSettings.providers.forEach((provider) => {
    if (!remoteById.has(provider.id) && provider.kind === "custom") {
      mergedProviders.push(provider);
    }
  });

  return normalizeLanguageModelSettings({ providers: mergedProviders });
}
