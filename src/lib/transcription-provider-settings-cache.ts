"use client";

import type { TranscriptionProviderCard, TranscriptionProviderSettings } from "@/types";
import {
  normalizeTranscriptionProviderSettings,
  migrateFromLegacyTranscriptionConfig,
} from "@/lib/transcription-providers";

const CACHE_KEY = "linksy-transcription-provider-settings-cache";

function toCachedProviderCard(card: TranscriptionProviderCard): TranscriptionProviderCard {
  return {
    ...card,
    apiKey: card.apiKey,
    apiKeyConfigured: Boolean(card.apiKeyConfigured ?? card.apiKey),
  };
}

function toCachedSettings(settings: TranscriptionProviderSettings): TranscriptionProviderSettings {
  return {
    activeProviderId: settings.activeProviderId,
    providers: settings.providers.map(toCachedProviderCard),
  };
}

export function readCachedTranscriptionProviderSettings(): TranscriptionProviderSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) {
      return normalizeTranscriptionProviderSettings(
        JSON.parse(raw) as Partial<TranscriptionProviderSettings>,
      );
    }

    // Migration from legacy config
    const migrated = migrateFromLegacyTranscriptionConfig();
    if (migrated) {
      writeCachedTranscriptionProviderSettings(migrated);
      return migrated;
    }

    return null;
  } catch {
    return null;
  }
}

export function writeCachedTranscriptionProviderSettings(
  settings: TranscriptionProviderSettings,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(toCachedSettings(settings)));
  } catch (error) {
    console.error("保存转录供应商缓存失败:", error);
  }
}
