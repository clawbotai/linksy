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

  // For DashScope, reuse the existing connection test logic
  if (card.presetType === "dashscope" || !card.presetType) {
    try {
      const baseUrl = (card.baseUrl || "https://dashscope.aliyuncs.com/v1").replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/tasks/linksy_connection_test`, {
        headers: {
          Authorization: `Bearer ${card.apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
      });

      if (response.status === 401 || response.status === 403) {
        return { success: false, message: "API Key 无效" };
      }
      if (response.status === 404 || response.status === 400 || response.ok) {
        return { success: true, message: "连接可用" };
      }
      return { success: false, message: `连接失败 (${response.status})` };
    } catch {
      return { success: false, message: "无法连接到服务器，可能被 CORS 拦截" };
    }
  }

  // For other providers, do a lightweight GET to the base URL
  try {
    const baseUrl = card.baseUrl.replace(/\/$/, "");
    const response = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${card.apiKey}` },
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: "API Key 无效" };
    }
    if (response.ok || response.status === 404 || response.status === 405) {
      return { success: true, message: "连接可用" };
    }
    return { success: false, message: `连接失败 (${response.status})` };
  } catch {
    return { success: false, message: "无法连接到服务器，可能被 CORS 拦截" };
  }
}
