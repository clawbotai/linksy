'use client';

import type {
  LanguageModelModelConfig,
  LanguageModelProviderCard,
  LanguageModelSettings,
  LanguageModelTestResult,
} from "@/types";
import { normalizeLanguageModelSettings } from "@/lib/language-models";
import { emitLanguageModelSettingsChanged } from "@/lib/language-model-events";
import {
  readCachedLanguageModelSettings,
  writeCachedLanguageModelSettings,
} from "@/lib/language-model-settings-cache";

// Web 版：LLM 设置存储在 localStorage，不经过 helper API
export async function fetchLanguageModelSettings(): Promise<LanguageModelSettings> {
  const cached = readCachedLanguageModelSettings();
  return normalizeLanguageModelSettings(cached ?? undefined);
}

export async function saveLanguageModelSettings(
  providers: LanguageModelProviderCard[],
): Promise<LanguageModelSettings> {
  const current = readCachedLanguageModelSettings();
  const nextSettings = normalizeLanguageModelSettings({ ...current, providers });
  writeCachedLanguageModelSettings(nextSettings);
  emitLanguageModelSettingsChanged();
  return nextSettings;
}

export async function testLanguageModelConnection(
  providerId: string,
  modelId: string,
  _modelConfig: LanguageModelModelConfig,
  connection: Pick<LanguageModelProviderCard, "apiKey" | "apiKeyConfigured" | "baseUrl" | "apiFormat" | "name" | "presetType" | "kind">,
): Promise<LanguageModelTestResult> {
  try {
    const res = await fetch("/api/llm/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId,
        modelId,
        apiKey: connection.apiKey,
        baseUrl: connection.baseUrl,
      }),
    });
    const data = await res.json();
    return {
      success: data.success,
      message: data.message || (data.success ? "连接成功" : "连接失败"),
      providerId,
    };
  } catch (error) {
    return {
      success: false,
      message: `连接失败: ${error instanceof Error ? error.message : "未知错误"}`,
      providerId,
    };
  }
}
