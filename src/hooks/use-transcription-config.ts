"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  BrowserTranscriptionConfig,
  TranscriptionEngineType,
  OnlineASRConfig,
} from "@/types";

const STORAGE_KEY = "linksy-transcription-config";

const DEFAULT_ONLINE_ASR_CONFIG: OnlineASRConfig = {
  provider: "qwen",
  modelName: "qwen3-asr-flash-filetrans",
  apiKey: "",
  baseUrl: "https://dashscope.aliyuncs.com/api/v1",
  enableITN: true,
};

const DEFAULT_CONFIG: BrowserTranscriptionConfig = {
  activeEngine: "local-whisper",
  onlineASR: DEFAULT_ONLINE_ASR_CONFIG,
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

    const parsed = JSON.parse(stored) as Partial<BrowserTranscriptionConfig> & {
      whisper?: unknown;
    };
    const storedOnlineASR = { ...DEFAULT_ONLINE_ASR_CONFIG, ...parsed.onlineASR };
    if (storedOnlineASR.modelName === "qwen3-asr-flash") {
      storedOnlineASR.modelName = DEFAULT_ONLINE_ASR_CONFIG.modelName;
    }

    return {
      activeEngine: parsed.activeEngine ?? DEFAULT_CONFIG.activeEngine,
      onlineASR: storedOnlineASR,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * 保存转录配置到 localStorage
 */
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
 *
 * 返回：
 * - config: 当前转录配置
 * - updateConfig: 部分更新配置
 * - setActiveEngine: 切换转录引擎
 * - updateOnlineASRConfig: 更新在线 ASR 子配置
 * - resetConfig: 重置为默认配置
 */
export function useTranscriptionConfig() {
  const [config, setConfig] = useState<BrowserTranscriptionConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  // 初始化：从 localStorage 加载
  useEffect(() => {
    setConfig(getStoredTranscriptionConfig());
    setLoaded(true);
  }, []);

  // 配置变更时自动持久化
  useEffect(() => {
    if (loaded) {
      saveTranscriptionConfig(config);
    }
  }, [config, loaded]);

  const updateConfig = useCallback(
    (updates: Partial<BrowserTranscriptionConfig>) => {
      setConfig((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  const setActiveEngine = useCallback(
    (engine: TranscriptionEngineType) => {
      setConfig((prev) => ({ ...prev, activeEngine: engine }));
    },
    [],
  );

  const updateOnlineASRConfig = useCallback(
    (updates: Partial<OnlineASRConfig>) => {
      setConfig((prev) => ({
        ...prev,
        onlineASR: { ...prev.onlineASR, ...updates },
      }));
    },
    [],
  );

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  return {
    config,
    loaded,
    updateConfig,
    setActiveEngine,
    updateOnlineASRConfig,
    resetConfig,
  };
}
