import type {
  LanguageModelApiFormat,
  LanguageModelModelConfig,
  LanguageModelProvider,
  LanguageModelProviderCard,
  LanguageModelProviderConfig,
  LanguageModelSettings,
} from "@/types";

export interface LanguageModelProviderMeta {
  id: LanguageModelProvider;
  label: string;
  description: string;
  apiKeyPlaceholder: string;
  modelSuggestions: string[];
}

export interface LanguageModelOption {
  providerId: string;
  providerName: string;
  modelId: string;
  label: string;
  model: string;
  value: string;
}

type LegacyProviderSettings = {
  apiKey?: string;
  apiKeyConfigured?: boolean;
  baseUrl?: string;
  apiFormat?: LanguageModelApiFormat;
  selectedModelId?: string;
  models?: Partial<LanguageModelModelConfig>[];
  model?: string;
};

export const LANGUAGE_MODEL_PROVIDER_ORDER: LanguageModelProvider[] = [
  "openai",
  "claude",
  "gemini",
  "qwen",
  "zhipu",
];

const LANGUAGE_MODEL_PROVIDER_IDS = [
  "openai",
  "claude",
  "anthropic-third-party",
  "gemini",
  "qwen",
  "zhipu",
] as const satisfies readonly LanguageModelProvider[];

export const LANGUAGE_MODEL_PROVIDER_META: Record<LanguageModelProvider, LanguageModelProviderMeta> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    description: "GPT 系列模型，适合通用对话、总结和推理任务。",
    apiKeyPlaceholder: "sk-...",
    modelSuggestions: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
  },
  claude: {
    id: "claude",
    label: "Claude",
    description: "Anthropic Claude 模型，适合长文本理解与稳健写作。",
    apiKeyPlaceholder: "sk-ant-...",
    modelSuggestions: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-7-sonnet-latest"],
  },
  "anthropic-third-party": {
    id: "anthropic-third-party",
    label: "Third-party API",
    description: "第三方预置 Provider，保持项目现有 OpenAI-compatible 连接方式。",
    apiKeyPlaceholder: "填写第三方 API Key",
    modelSuggestions: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-7-sonnet-latest"],
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    description: "Gemini 多模态模型，适合通用生成与快速推理。",
    apiKeyPlaceholder: "AIza...",
    modelSuggestions: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  },
  qwen: {
    id: "qwen",
    label: "Qwen",
    description: "通义千问文本模型。",
    apiKeyPlaceholder: "sk-...",
    modelSuggestions: ["qwen-plus", "qwen-max", "qwen-turbo"],
  },
  zhipu: {
    id: "zhipu",
    label: "ZhiPu AI",
    description: "智谱 GLM 模型，适合中文场景与通用文本任务。",
    apiKeyPlaceholder: "填写智谱 API Key",
    modelSuggestions: ["glm-4.5-flash", "glm-4.5", "glm-4-flash"],
  },
};

export const DEFAULT_LANGUAGE_MODEL_PROVIDER_CONNECTION: Record<
  LanguageModelProvider,
  { apiKey: string; baseUrl: string; apiFormat: LanguageModelApiFormat }
> = {
  openai: {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    apiFormat: "openai",
  },
  claude: {
    apiKey: "",
    baseUrl: "https://api.anthropic.com/v1",
    apiFormat: "anthropic",
  },
  "anthropic-third-party": {
    apiKey: "",
    baseUrl: "",
    apiFormat: "openai",
  },
  gemini: {
    apiKey: "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiFormat: "openai",
  },
  qwen: {
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiFormat: "openai",
  },
  zhipu: {
    apiKey: "",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    apiFormat: "openai",
  },
};

export const DEFAULT_LANGUAGE_MODEL_PROVIDER_CONFIGS: Record<
  LanguageModelProvider,
  Omit<LanguageModelModelConfig, "id" | "name">
> = {
  openai: {
    model: "gpt-4.1-mini",
    temperature: 0.7,
    maxTokens: 4096,
    enabled: false,
  },
  claude: {
    model: "claude-sonnet-4-5",
    temperature: 0.7,
    maxTokens: 4096,
    enabled: false,
  },
  "anthropic-third-party": {
    model: "claude-sonnet-4-5",
    temperature: 0.7,
    maxTokens: 4096,
    enabled: false,
  },
  gemini: {
    model: "gemini-2.5-flash",
    temperature: 0.7,
    maxTokens: 4096,
    enabled: false,
  },
  qwen: {
    model: "qwen-plus",
    temperature: 0.7,
    maxTokens: 4096,
    enabled: false,
  },
  zhipu: {
    model: "glm-4.5-flash",
    temperature: 0.7,
    maxTokens: 4096,
    enabled: false,
  },
};

function randomId(prefix: string) {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomPart}`;
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function normalizeApiFormat(value: unknown, fallback: LanguageModelApiFormat): LanguageModelApiFormat {
  return value === "anthropic" || value === "openai" ? value : fallback;
}

function isKnownProvider(value: unknown): value is LanguageModelProvider {
  return typeof value === "string" && LANGUAGE_MODEL_PROVIDER_IDS.includes(value as LanguageModelProvider);
}

function getDefaultsProvider(
  presetType?: LanguageModelProvider,
  apiFormat: LanguageModelApiFormat = "openai",
): LanguageModelProvider {
  if (presetType && isKnownProvider(presetType)) {
    return presetType;
  }
  return apiFormat === "anthropic" ? "anthropic-third-party" : "openai";
}

export function createLanguageModelConfigId(providerId = "provider") {
  return randomId(providerId);
}

export function createLanguageModelProviderCardId(kind: "preset" | "custom", presetType?: LanguageModelProvider) {
  if (kind === "preset" && presetType) {
    return `preset:${presetType}`;
  }
  return randomId("provider");
}

function getLegacyThirdPartyProviderId() {
  return "legacy:anthropic-third-party";
}

function getLegacyThirdPartyModelId(index = 0) {
  return `legacy:anthropic-third-party:model:${index}`;
}

export function getProviderName(provider: Pick<LanguageModelProviderCard, "name" | "presetType">) {
  if (provider.name.trim()) {
    return provider.name.trim();
  }
  if (provider.presetType) {
    return LANGUAGE_MODEL_PROVIDER_META[provider.presetType].label;
  }
  return "Untitled Provider";
}

export function getProviderApiKeyPlaceholder(
  provider: Pick<LanguageModelProviderCard, "presetType" | "kind" | "apiFormat">,
) {
  if (provider.presetType) {
    return LANGUAGE_MODEL_PROVIDER_META[provider.presetType].apiKeyPlaceholder;
  }
  if (provider.apiFormat === "anthropic") {
    return "sk-ant-...";
  }
  return "sk-...";
}

export function getProviderModelSuggestions(
  provider: Pick<LanguageModelProviderCard, "presetType" | "apiFormat">,
) {
  if (!provider.presetType) {
    return provider.apiFormat === "anthropic"
      ? LANGUAGE_MODEL_PROVIDER_META.claude.modelSuggestions
      : LANGUAGE_MODEL_PROVIDER_META.openai.modelSuggestions;
  }
  return LANGUAGE_MODEL_PROVIDER_META[provider.presetType].modelSuggestions;
}

export function createLanguageModelModelConfig(
  provider: LanguageModelProvider | undefined,
  overrides: Partial<LanguageModelModelConfig> = {},
  apiFormat: LanguageModelApiFormat = "openai",
): LanguageModelModelConfig {
  const defaultsProvider = getDefaultsProvider(provider, apiFormat);
  const defaults = DEFAULT_LANGUAGE_MODEL_PROVIDER_CONFIGS[defaultsProvider];
  const model = normalizeString(overrides.model, defaults.model);

  return {
    id: normalizeString(overrides.id, createLanguageModelConfigId(defaultsProvider)),
    name: normalizeString(overrides.name, model),
    model,
    temperature: normalizeNumber(overrides.temperature, defaults.temperature, 0, 2),
    maxTokens: Math.floor(normalizeNumber(overrides.maxTokens, defaults.maxTokens, 1, 128000)),
    enabled:
      typeof overrides.enabled === "boolean"
        ? overrides.enabled
        : defaults.enabled,
  };
}

export const createLanguageModelProviderConfig = createLanguageModelModelConfig;

export function createDefaultLanguageModelProviderCard(
  presetType: LanguageModelProvider,
): LanguageModelProviderCard {
  const conn = DEFAULT_LANGUAGE_MODEL_PROVIDER_CONNECTION[presetType];
  const meta = LANGUAGE_MODEL_PROVIDER_META[presetType];
  const defaultModel = createLanguageModelModelConfig(presetType);
  return {
    id: createLanguageModelProviderCardId("preset", presetType),
    kind: "preset",
    presetType,
    name: meta.label,
    apiKey: conn.apiKey,
    baseUrl: conn.baseUrl,
    apiFormat: conn.apiFormat,
    selectedModelId: defaultModel.id,
    models: [defaultModel],
  };
}

export function createCustomLanguageModelProviderCard(): LanguageModelProviderCard {
  const defaultModel = createLanguageModelModelConfig(undefined, {
    name: "Default Model",
    model: "",
  }, "openai");
  return {
    id: createLanguageModelProviderCardId("custom"),
    kind: "custom",
    name: "Untitled Provider",
    apiKey: "",
    baseUrl: "",
    apiFormat: "openai",
    selectedModelId: defaultModel.id,
    models: [defaultModel],
  };
}

function normalizeLanguageModelProviderCard(
  source: Partial<LanguageModelProviderCard> | LegacyProviderSettings | Record<string, unknown> | undefined,
  fallbackPresetType?: LanguageModelProvider,
): LanguageModelProviderCard {
  const src = source && typeof source === "object" ? source : {};
  const explicitPresetType = isKnownProvider((src as LanguageModelProviderCard).presetType)
    ? (src as LanguageModelProviderCard).presetType
    : undefined;
  const isLegacyThirdPartyProvider =
    explicitPresetType === "anthropic-third-party" || fallbackPresetType === "anthropic-third-party";
  const presetType = isLegacyThirdPartyProvider ? undefined : explicitPresetType ?? fallbackPresetType;
  const kind: LanguageModelProviderCard["kind"] =
    !isLegacyThirdPartyProvider && (presetType || (src as LanguageModelProviderCard).kind === "preset")
      ? "preset"
      : "custom";
  const defaultApiFormat = isLegacyThirdPartyProvider
    ? DEFAULT_LANGUAGE_MODEL_PROVIDER_CONNECTION["anthropic-third-party"].apiFormat
    : kind === "preset" && presetType
      ? DEFAULT_LANGUAGE_MODEL_PROVIDER_CONNECTION[presetType].apiFormat
      : "openai";
  const apiFormat = normalizeApiFormat(
    (src as LegacyProviderSettings).apiFormat,
    defaultApiFormat,
  );
  const defaultsProvider = getDefaultsProvider(
    explicitPresetType ?? fallbackPresetType,
    apiFormat,
  );
  const defaults = kind === "preset" && presetType
    ? createDefaultLanguageModelProviderCard(presetType)
    : createCustomLanguageModelProviderCard();
  const legacyFlat = !Array.isArray((src as LegacyProviderSettings).models)
    && typeof (src as LegacyProviderSettings).model === "string";
  const legacyFirstModel = legacyFlat
    ? src
    : (Array.isArray((src as LegacyProviderSettings).models)
      ? (src as LegacyProviderSettings).models?.[0]
      : undefined) || {};
  const sourceModels = Array.isArray((src as LegacyProviderSettings).models)
    ? (src as LegacyProviderSettings).models || []
    : legacyFlat
      ? [src as Partial<LanguageModelModelConfig>]
      : [];
  const models = sourceModels.length > 0
    ? sourceModels.map((item, index) => createLanguageModelModelConfig(
      presetType ?? defaultsProvider,
      {
        id: item.id || (
          isLegacyThirdPartyProvider
            ? getLegacyThirdPartyModelId(index)
            : undefined
        ),
        ...item,
      },
      apiFormat,
    ))
    : defaults.models;
  const selectedModelId = normalizeString(
    (src as LegacyProviderSettings).selectedModelId,
    models[0]?.id || defaults.selectedModelId,
  );
  const baseUrl = normalizeString(
    (src as LegacyProviderSettings).baseUrl,
    normalizeString((legacyFirstModel as LegacyProviderSettings)?.baseUrl, defaults.baseUrl),
  ).replace(/\/$/, "");
  const apiKey = normalizeString(
    (src as LegacyProviderSettings).apiKey,
    normalizeString((legacyFirstModel as LegacyProviderSettings)?.apiKey, defaults.apiKey),
  );
  const apiKeyConfigured =
    typeof (src as LegacyProviderSettings).apiKeyConfigured === "boolean"
      ? (src as LegacyProviderSettings).apiKeyConfigured
      : typeof (legacyFirstModel as LegacyProviderSettings)?.apiKeyConfigured === "boolean"
        ? (legacyFirstModel as LegacyProviderSettings).apiKeyConfigured
        : undefined;

  return {
    id: normalizeString(
      (src as LanguageModelProviderCard).id,
      kind === "preset" && presetType
        ? createLanguageModelProviderCardId("preset", presetType)
        : isLegacyThirdPartyProvider
          ? getLegacyThirdPartyProviderId()
          : createLanguageModelProviderCardId("custom"),
    ),
    kind,
    ...(kind === "preset" && presetType ? { presetType } : {}),
    name: normalizeString(
      (src as LanguageModelProviderCard).name,
      defaults.name,
    ),
    apiKey,
    ...(apiKeyConfigured !== undefined ? { apiKeyConfigured } : {}),
    baseUrl,
    apiFormat,
    selectedModelId:
      selectedModelId && models.some((item) => item.id === selectedModelId)
        ? selectedModelId
        : models[0]?.id || defaults.selectedModelId,
    models,
  };
}

export function createDefaultLanguageModelSettings(): LanguageModelSettings {
  return {
    providers: LANGUAGE_MODEL_PROVIDER_ORDER.map((provider) =>
      createDefaultLanguageModelProviderCard(provider),
    ),
  };
}

export function normalizeLanguageModelSettings(
  settings?: Partial<LanguageModelSettings> | { providers?: Record<string, LegacyProviderSettings> },
): LanguageModelSettings {
  const sourceProviders = Array.isArray(settings?.providers) ? settings.providers : [];
  const legacyProviders =
    !Array.isArray(settings?.providers) && settings?.providers && typeof settings.providers === "object"
      ? settings.providers
      : {};

  const presets = LANGUAGE_MODEL_PROVIDER_ORDER.map((presetType) => {
    const arrayMatch = sourceProviders.find((item) => item?.presetType === presetType);
    const legacyMatch = legacyProviders[presetType];
    return normalizeLanguageModelProviderCard(arrayMatch ?? legacyMatch, presetType);
  });

  const legacyThirdParty =
    sourceProviders.find((item) => item?.presetType === "anthropic-third-party")
    ?? legacyProviders["anthropic-third-party"];
  const customs = sourceProviders
    .filter((item) => item && (item.kind === "custom" || item.presetType === "anthropic-third-party"))
    .map((item) => normalizeLanguageModelProviderCard(item))
    .concat(
      legacyThirdParty && !sourceProviders.some((item) => item?.presetType === "anthropic-third-party")
        ? [normalizeLanguageModelProviderCard(legacyThirdParty, "anthropic-third-party")]
        : [],
    )
    .filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);

  return {
    providers: presets.concat(customs).map((provider, index, list) => {
      if (provider.kind === "custom" && list.some((item, candidateIndex) => candidateIndex < index && item.id === provider.id)) {
        return {
          ...provider,
          id: createLanguageModelProviderCardId("custom"),
        };
      }
      return provider;
    }),
  };
}

export function getLanguageModelProviderCardById(
  settings: LanguageModelSettings,
  providerId: string,
): LanguageModelProviderCard | undefined {
  return settings.providers.find((provider) => provider.id === providerId);
}

export function getEnabledLanguageModelOptions(settings: LanguageModelSettings): LanguageModelOption[] {
  return settings.providers.flatMap((provider) => {
    const providerName = getProviderName(provider);
    const apiKeyConfigured = Boolean(provider.apiKeyConfigured ?? provider.apiKey);
    if (!apiKeyConfigured) {
      return [];
    }
    return provider.models
      .filter((model) => model.enabled)
      .map((model) => ({
        providerId: provider.id,
        providerName,
        modelId: model.id,
        label: `${providerName} · ${model.name || model.model}`,
        model: model.model,
        value: `${provider.id}:${model.id}`,
      }));
  });
}

export function resolveProviderConfig(
  providerSettings: LanguageModelProviderCard,
  modelConfig: LanguageModelModelConfig,
): LanguageModelProviderConfig {
  return {
    ...modelConfig,
    providerId: providerSettings.id,
    providerName: getProviderName(providerSettings),
    kind: providerSettings.kind,
    presetType: providerSettings.presetType,
    apiKey: providerSettings.apiKey,
    apiKeyConfigured: providerSettings.apiKeyConfigured,
    baseUrl: providerSettings.baseUrl,
    apiFormat: providerSettings.apiFormat,
  };
}
