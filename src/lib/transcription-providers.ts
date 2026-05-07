"use client";

import type {
  TranscriptionApiFormat,
  TranscriptionProviderCard,
  TranscriptionProviderPresetType,
  TranscriptionProviderSettings,
} from "@/types";

export interface TranscriptionProviderMeta {
  id: TranscriptionProviderPresetType;
  label: string;
  defaultBaseUrl: string;
  defaultModelName: string;
  defaultEnableITN?: boolean;
  apiKeyPlaceholder: string;
  modelSuggestions: string[];
  apiFormat: TranscriptionApiFormat;
  /** 能力标签：长音频/短音频提示 */
  capabilityLabel: string;
}

export const TRANSCRIPTION_PROVIDER_ORDER: TranscriptionProviderPresetType[] = [
  "dashscope",
  "openai-whisper",
  "gemini",
];

export const TRANSCRIPTION_PROVIDER_META: Record<
  TranscriptionProviderPresetType,
  TranscriptionProviderMeta
> = {
  dashscope: {
    id: "dashscope",
    label: "千问 DashScope",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/api/v1",
    defaultModelName: "qwen3-asr-flash-filetrans",
    defaultEnableITN: true,
    apiKeyPlaceholder: "sk-...",
    modelSuggestions: ["qwen3-asr-flash-filetrans", "qwen3-asr-flash"],
    apiFormat: "dashscope",
    capabilityLabel: "长音频 ✓ 异步无超时",
  },
  "openai-whisper": {
    id: "openai-whisper",
    label: "OpenAI Whisper",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModelName: "whisper-1",
    apiKeyPlaceholder: "sk-...",
    modelSuggestions: ["whisper-1"],
    apiFormat: "openai-whisper",
    capabilityLabel: "短音频 推荐 ≤15 分钟",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModelName: "gemini-2.5-pro",
    apiKeyPlaceholder: "AIza...",
    modelSuggestions: ["gemini-2.5-pro", "gemini-2.5-flash"],
    apiFormat: "gemini",
    capabilityLabel: "短音频 推荐 ≤15 分钟",
  },
  assemblyai: {
    id: "assemblyai",
    label: "AssemblyAI",
    defaultBaseUrl: "https://api.assemblyai.com/v2",
    defaultModelName: "best",
    apiKeyPlaceholder: "填写 AssemblyAI API Key",
    modelSuggestions: ["best", "nano"],
    apiFormat: "openai-whisper",
    capabilityLabel: "",
  },
  deepgram: {
    id: "deepgram",
    label: "Deepgram",
    defaultBaseUrl: "https://api.deepgram.com/v1",
    defaultModelName: "nova-2",
    apiKeyPlaceholder: "填写 Deepgram API Key",
    modelSuggestions: ["nova-2", "nova-1", "whisper-large"],
    apiFormat: "openai-whisper",
    capabilityLabel: "",
  },
};

function randomId(prefix: string) {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomPart}`;
}

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function isKnownPresetType(value: unknown): value is TranscriptionProviderPresetType {
  return (
    typeof value === "string" &&
    (TRANSCRIPTION_PROVIDER_ORDER as readonly string[]).includes(value)
  );
}

export function createTranscriptionProviderCardId(
  kind: "preset" | "custom",
  presetType?: TranscriptionProviderPresetType,
): string {
  if (kind === "preset" && presetType) {
    return `preset:${presetType}`;
  }
  return randomId("asr");
}

export function getTranscriptionProviderName(
  card: Pick<TranscriptionProviderCard, "name" | "presetType">,
): string {
  if (card.name.trim()) return card.name.trim();
  if (card.presetType) return TRANSCRIPTION_PROVIDER_META[card.presetType].label;
  return "未命名供应商";
}

export function createDefaultTranscriptionProviderCard(
  presetType: TranscriptionProviderPresetType,
): TranscriptionProviderCard {
  const meta = TRANSCRIPTION_PROVIDER_META[presetType];
  return {
    id: createTranscriptionProviderCardId("preset", presetType),
    kind: "preset",
    presetType,
    name: meta.label,
    apiKey: "",
    baseUrl: meta.defaultBaseUrl,
    modelName: meta.defaultModelName,
    enabled: true,
    apiFormat: meta.apiFormat,
    ...(meta.defaultEnableITN !== undefined ? { enableITN: meta.defaultEnableITN } : {}),
  };
}

export function createCustomTranscriptionProviderCard(): TranscriptionProviderCard {
  return {
    id: createTranscriptionProviderCardId("custom"),
    kind: "custom",
    name: "",
    apiKey: "",
    baseUrl: "",
    modelName: "",
    enabled: true,
    apiFormat: "openai-whisper",
  };
}

export function createDefaultTranscriptionProviderSettings(): TranscriptionProviderSettings {
  const providers = TRANSCRIPTION_PROVIDER_ORDER.map((presetType) =>
    createDefaultTranscriptionProviderCard(presetType),
  );
  return {
    providers,
    activeProviderId: providers[0]?.id ?? "",
  };
}

function normalizeTranscriptionApiFormat(
  value: unknown,
  fallback: TranscriptionApiFormat,
): TranscriptionApiFormat {
  return value === "dashscope" || value === "openai-whisper" || value === "gemini"
    ? value
    : fallback;
}

function normalizeTranscriptionProviderCard(
  source: Partial<TranscriptionProviderCard> | Record<string, unknown> | undefined,
  fallbackPresetType?: TranscriptionProviderPresetType,
): TranscriptionProviderCard {
  const src = source && typeof source === "object" ? source : {};
  const rawPresetType = (src as TranscriptionProviderCard).presetType;
  const presetType = isKnownPresetType(rawPresetType)
    ? rawPresetType
    : fallbackPresetType;
  const kind: TranscriptionProviderCard["kind"] =
    presetType || (src as TranscriptionProviderCard).kind === "preset"
      ? "preset"
      : "custom";
  const defaults = presetType
    ? createDefaultTranscriptionProviderCard(presetType)
    : createCustomTranscriptionProviderCard();

  return {
    id: normalizeString(
      (src as TranscriptionProviderCard).id,
      kind === "preset" && presetType
        ? createTranscriptionProviderCardId("preset", presetType)
        : createTranscriptionProviderCardId("custom"),
    ),
    kind,
    ...(kind === "preset" && presetType ? { presetType } : {}),
    name: normalizeString((src as TranscriptionProviderCard).name, defaults.name),
    apiKey: normalizeString((src as TranscriptionProviderCard).apiKey, defaults.apiKey),
    apiKeyConfigured: typeof (src as TranscriptionProviderCard).apiKeyConfigured === "boolean"
      ? (src as TranscriptionProviderCard).apiKeyConfigured
      : undefined,
    baseUrl: normalizeString(
      (src as TranscriptionProviderCard).baseUrl,
      defaults.baseUrl,
    ).replace(/\/$/, ""),
    modelName: normalizeString(
      (src as TranscriptionProviderCard).modelName,
      defaults.modelName,
    ),
    enabled: normalizeBoolean((src as TranscriptionProviderCard).enabled, defaults.enabled),
    enableITN: typeof (src as TranscriptionProviderCard).enableITN === "boolean"
      ? (src as TranscriptionProviderCard).enableITN
      : defaults.enableITN,
    apiFormat: normalizeTranscriptionApiFormat(
      (src as TranscriptionProviderCard).apiFormat,
      defaults.apiFormat,
    ),
  };
}

export function normalizeTranscriptionProviderSettings(
  settings?: Partial<TranscriptionProviderSettings> | null,
): TranscriptionProviderSettings {
  const sourceProviders = Array.isArray(settings?.providers) ? settings!.providers : [];
  const activeProviderId = normalizeString(settings?.activeProviderId, "");

  const presets = TRANSCRIPTION_PROVIDER_ORDER.map((presetType) => {
    const match = sourceProviders.find((item) => item?.presetType === presetType);
    return normalizeTranscriptionProviderCard(match, presetType);
  });

  const customs = sourceProviders
    .filter((item) => item && item.kind === "custom" && !item.presetType)
    .map((item) => normalizeTranscriptionProviderCard(item))
    .filter(
      (item, index, list) =>
        list.findIndex((candidate) => candidate.id === item.id) === index,
    );

  const allProviders = presets.concat(customs);
  const resolvedActiveId =
    activeProviderId && allProviders.some((p) => p.id === activeProviderId)
      ? activeProviderId
      : allProviders[0]?.id ?? "";

  return {
    providers: allProviders,
    activeProviderId: resolvedActiveId,
  };
}

export function migrateFromLegacyTranscriptionConfig(): TranscriptionProviderSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem("linksy-transcription-config");
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      activeEngine?: string;
      onlineASR?: {
        apiKey?: string;
        baseUrl?: string;
        modelName?: string;
        enableITN?: boolean;
      };
    };

    if (!parsed.onlineASR?.apiKey) return null;

    const dashScopeCard = createDefaultTranscriptionProviderCard("dashscope");
    dashScopeCard.apiKey = parsed.onlineASR.apiKey;
    dashScopeCard.apiFormat = "dashscope";
    if (parsed.onlineASR.baseUrl) dashScopeCard.baseUrl = parsed.onlineASR.baseUrl.replace(/\/$/, "");
    if (parsed.onlineASR.modelName) dashScopeCard.modelName = parsed.onlineASR.modelName;
    if (typeof parsed.onlineASR.enableITN === "boolean") dashScopeCard.enableITN = parsed.onlineASR.enableITN;

    return {
      providers: [dashScopeCard],
      activeProviderId: dashScopeCard.id,
    };
  } catch {
    return null;
  }
}
