"use client";

import type { TranscriptionProviderCard, TranscriptionProviderSettings } from "@/types";
import { normalizeTranscriptionProviderSettings } from "@/lib/transcription-providers";
import { emitTranscriptionProviderSettingsChanged } from "@/lib/transcription-provider-events";
import {
  readCachedTranscriptionProviderSettings,
  writeCachedTranscriptionProviderSettings,
} from "@/lib/transcription-provider-settings-cache";

export async function fetchTranscriptionProviderSettings(): Promise<TranscriptionProviderSettings> {
  const cached = readCachedTranscriptionProviderSettings();
  return normalizeTranscriptionProviderSettings(cached ?? undefined);
}

export async function saveTranscriptionProviderSettings(
  providers: TranscriptionProviderCard[],
  activeProviderId: string,
): Promise<TranscriptionProviderSettings> {
  const nextSettings = normalizeTranscriptionProviderSettings({ providers, activeProviderId });
  writeCachedTranscriptionProviderSettings(nextSettings);
  emitTranscriptionProviderSettingsChanged();
  return nextSettings;
}

export async function testTranscriptionProviderConnection(
  card: TranscriptionProviderCard,
): Promise<{ success: boolean; message: string }> {
  if (!card.apiKey.trim()) {
    return { success: false, message: "API Key 不能为空" };
  }

  try {
    const response = await fetch("/api/online-asr/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: card.apiKey,
        baseUrl: card.baseUrl,
        apiFormat: card.apiFormat,
        modelName: card.modelName,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { success: false, message: payload?.message || `连接失败 (${response.status})` };
    }
    return {
      success: Boolean(payload?.success),
      message: payload?.message || (payload?.success ? "连接验证通过" : "连接失败"),
    };
  } catch {
    return { success: false, message: "无法连接到转录测试服务" };
  }
}
