"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  BrowserTranscriptionConfig,
  TranscriptionProviderCard,
} from "@/types";
import {
  readCachedTranscriptionProviderSettings,
} from "@/lib/transcription-provider-settings-cache";
import {
  createDefaultTranscriptionProviderCard,
} from "@/lib/transcription-providers";

const STORAGE_KEY = "linksy-transcription-config";

const DEFAULT_CONFIG: BrowserTranscriptionConfig = {
  activeEngine: "qwen-asr",
  onlineASR: {
    provider: "qwen",
    modelName: "qwen3-asr-flash-filetrans",
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com/api/v1",
    enableITN: true,
  },
};

/**
 * 从 localStorage 读取转录配置
 * 在 SSR 环境下返回默认值
 */
export function getStoredTranscriptionConfig(): BrowserTranscriptionConfig {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_CONFIG;

    const parsed = JSON.parse(stored) as Partial<BrowserTranscriptionConfig>;
    return {
      activeEngine: "qwen-asr",
      onlineASR: { ...DEFAULT_CONFIG.onlineASR, ...parsed.onlineASR },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveTranscriptionConfig(config: BrowserTranscriptionConfig): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("保存配置到 localStorage 失败:", error);
  }
}

/**
 * React hook: 管理转录配置的 localStorage 读写
 */
export function useTranscriptionConfig() {
  const [config, setConfig] = useState<BrowserTranscriptionConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setConfig(getStoredTranscriptionConfig());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveTranscriptionConfig(config);
    }
  }, [config, loaded]);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  return {
    config,
    loaded,
    resetConfig,
  };
}

/**
 * 获取当前激活的转录供应商配置（含运行时 apiKey）
 * 优先从新的供应商设置中读取，fallback 到旧的 onlineASR 配置
 */
export function getActiveTranscriptionProvider(): TranscriptionProviderCard | null {
  const providerSettings = readCachedTranscriptionProviderSettings();
  if (providerSettings && providerSettings.providers.length > 0) {
    const active = providerSettings.providers.find(
      (p) => p.id === providerSettings.activeProviderId,
    );
    if (active) return active;
    return providerSettings.providers[0];
  }

  // Fallback: read legacy config and convert
  const legacyConfig = getStoredTranscriptionConfig();
  if (legacyConfig.onlineASR.apiKey) {
    const card = createDefaultTranscriptionProviderCard("dashscope");
    card.apiKey = legacyConfig.onlineASR.apiKey;
    card.baseUrl = legacyConfig.onlineASR.baseUrl;
    card.modelName = legacyConfig.onlineASR.modelName;
    card.enableITN = legacyConfig.onlineASR.enableITN;
    card.apiFormat = "dashscope";
    return card;
  }

  return null;
}
