"use client";

import * as React from "react";
import { Loader2, Plus, Save, Check, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProviderSidebar } from "./provider-sidebar";
import { ProviderConnectionForm } from "./provider-connection-form";
import { ModelList } from "./model-list";
import { useLanguageModelSettings } from "@/hooks/use-language-model-settings";
import { createDefaultLanguageModelSettings, getProviderName, getProviderModelSuggestions } from "@/lib/language-models";
import type { LanguageModelProviderCard, LanguageModelTestResult } from "@/types";
import { cn } from "@/lib/utils";
import { ProviderIdentity } from "./provider-sidebar";

function clampTemperature(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.7;
  }
  return Math.max(0, Math.min(2, value));
}

function clampMaxTokens(value: number): number {
  if (!Number.isFinite(value)) {
    return 4096;
  }
  return Math.max(1, Math.min(128000, Math.floor(value)));
}

function getModelKey(providerId: string, modelId: string) {
  return `${providerId}:${modelId}`;
}

interface ProviderPanelHeaderProps {
  provider: LanguageModelProviderCard;
  providerDirty: boolean;
}

function ProviderPanelHeader({ provider, providerDirty }: ProviderPanelHeaderProps) {
  const enabledCount = provider.models.filter((model) => model.enabled).length;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 px-5 py-5">
      <div className="min-w-0">
        <ProviderIdentity provider={provider} active />
        <p className="mt-3 text-sm text-muted-foreground">
          当前供应商的连接信息与模型列表都在右侧维护，切换左侧供应商不会丢失本地未保存状态。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {providerDirty && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            未保存
          </Badge>
        )}
        {enabledCount > 0 && (
          <Badge variant="secondary" className="px-2 py-0 text-[10px]">
            {enabledCount} 已启用
          </Badge>
        )}
      </div>
    </div>
  );
}

interface ProviderPanelFooterProps {
  selectedModel: LanguageModelProviderCard["models"][number] | undefined;
  hasUsableApiKey: boolean;
  testingModelKey: string | undefined | null;
  selectedKey: string;
  savingProviderId: string | undefined | null;
  providerId: string;
  providerName: string;
  onTest: () => Promise<LanguageModelTestResult>;
  onSave: () => Promise<void>;
  setProviderFeedback: React.Dispatch<React.SetStateAction<Record<string, LanguageModelTestResult>>>;
}

function ProviderPanelFooter({
  selectedModel,
  hasUsableApiKey,
  testingModelKey,
  selectedKey,
  savingProviderId,
  providerId,
  providerName,
  onTest,
  onSave,
  setProviderFeedback,
}: ProviderPanelFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-2">
      <div className="text-xs text-muted-foreground">
        {selectedModel
          ? `测试将使用当前选中的模型：${selectedModel.name || selectedModel.model || "未命名模型"}`
          : "请先添加模型"}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!selectedModel || !hasUsableApiKey || testingModelKey === selectedKey}
          onClick={async () => {
            if (!selectedModel) {
              return;
            }
            try {
              const result = await onTest();
              setProviderFeedback((prev) => {
                const updated = { ...prev };
                updated[selectedKey] = result;
                return updated;
              });
            } catch (error) {
              setProviderFeedback((prev) => {
                const updated = { ...prev };
                updated[selectedKey] = {
                  success: false,
                  message: error instanceof Error ? error.message : "测试失败",
                  providerId,
                  providerName,
                  modelId: selectedModel.id,
                };
                return updated;
              });
            }
          }}
        >
          {testingModelKey === selectedKey ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              测试中
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              测试连接
            </>
          )}
        </Button>

        <Button
          type="button"
          disabled={savingProviderId === providerId}
          onClick={async () => {
            try {
              await onSave();
              if (selectedModel) {
                setProviderFeedback((prev) => {
                  const updated = { ...prev };
                  updated[selectedKey] = {
                    success: true,
                    message: "设置已保存",
                    providerId,
                    providerName,
                    modelId: selectedModel.id,
                  };
                  return updated;
                });
              }
            } catch (error) {
              if (selectedModel) {
                setProviderFeedback((prev) => {
                  const updated = { ...prev };
                  updated[selectedKey] = {
                    success: false,
                    message: error instanceof Error ? error.message : "保存失败",
                    providerId,
                    providerName,
                    modelId: selectedModel.id,
                  };
                  return updated;
                });
              }
            }
          }}
        >
          {savingProviderId === providerId ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              保存
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface LanguageModelPanelProps {
  visible: boolean;
}

export function LanguageModelPanel({ visible }: LanguageModelPanelProps) {
  const {
    settings,
    loaded,
    loading,
    loadError,
    savingProviderId,
    testingModelKey,
    dirtyProviderIds,
    reload,
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
  } = useLanguageModelSettings();
  const [activeProviderId, setActiveProviderId] = React.useState<string>("");
  const [showApiKey, setShowApiKey] = React.useState<Record<string, boolean>>({});
  const [providerFeedback, setProviderFeedback] = React.useState<Record<string, LanguageModelTestResult>>({});
  const [expandedModelKeys, setExpandedModelKeys] = React.useState<Record<string, boolean>>({});
  const fallbackSettings = React.useMemo(() => createDefaultLanguageModelSettings(), []);

  React.useEffect(() => {
    if (visible && !loaded && !loading) {
      void reload();
    }
  }, [loaded, loading, reload, visible]);

  React.useEffect(() => {
    if (loaded && !activeProviderId) {
      setActiveProviderId(settings.providers[0]?.id ?? fallbackSettings.providers[0]?.id ?? "");
    }
  }, [loaded, activeProviderId, settings.providers, fallbackSettings.providers]);

  React.useEffect(() => {
    if (!activeProviderId) {
      return;
    }
    if (!settings.providers.some((provider) => provider.id === activeProviderId)) {
      setActiveProviderId(settings.providers[0]?.id ?? "");
    }
  }, [activeProviderId, settings.providers]);

  const handleAddProvider = () => {
    const nextId = addProvider();
    setActiveProviderId(nextId);
  };

  const handleRemoveProvider = (providerId: string) => {
    const index = settings.providers.findIndex((provider) => provider.id === providerId);
    const fallbackId =
      settings.providers[index + 1]?.id
      ?? settings.providers[index - 1]?.id
      ?? settings.providers[0]?.id
      ?? "";
    removeProvider(providerId);
    setActiveProviderId(fallbackId === providerId ? "" : fallbackId);
  };

  const activeProvider = settings.providers.find((provider) => provider.id === activeProviderId) ?? settings.providers[0];

  if (!loaded && loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-[15px] font-semibold">模型供应商</h3>
          <p className="text-sm text-muted-foreground">
            左侧选择供应商，右侧维护当前供应商的连接信息与模型配置。
          </p>
        </div>

        <Button type="button" variant="outline" onClick={handleAddProvider} className="rounded-xl px-3.5">
          <Plus className="mr-2 h-4 w-4" />
          添加
        </Button>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-destructive">读取语言模型设置失败</div>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void reload()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              重试
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <ProviderSidebar
        providers={settings.providers}
        activeProviderId={activeProviderId}
        dirtyProviderIds={dirtyProviderIds}
        onProviderSelect={setActiveProviderId}
        onRemoveProvider={handleRemoveProvider}
      />

      {activeProvider ? (
        (() => {
          const provider = activeProvider;
          const providerName = getProviderName(provider);
          const selectedModelId = provider.models.some((item) => item.id === provider.selectedModelId)
            ? provider.selectedModelId
            : provider.models[0]?.id;
          const selectedModel = provider.models.find((item) => item.id === selectedModelId) ?? provider.models[0];
          const providerDirty = dirtyProviderIds.has(provider.id);
          const hasSavedApiKey = provider.apiKeyConfigured === true;
          const hasUsableApiKey = Boolean(hasSavedApiKey || provider.apiKey.trim());
          const selectedKey = selectedModel ? getModelKey(provider.id, selectedModel.id) : "";
          const activeFeedback =
            providerFeedback[selectedKey]
            || (selectedModel ? getTestResult(provider.id, selectedModel.id) : undefined);
          const modelSuggestions = getProviderModelSuggestions(provider);

          return (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/85">
              <ProviderPanelHeader
                provider={provider}
                providerDirty={providerDirty}
              />

              <div className="space-y-6 px-5 py-5">
                <ProviderConnectionForm
                  provider={provider}
                  hasSavedApiKey={hasSavedApiKey}
                  hasUsableApiKey={hasUsableApiKey}
                  showApiKey={showApiKey[provider.id] ?? false}
                  onToggleApiKeyVisibility={() =>
                    setShowApiKey((prev) => ({
                      ...prev,
                      [provider.id]: !prev[provider.id],
                    }))
                  }
                  onUpdateConnection={(connection) =>
                    updateProviderConnection(provider.id, connection)
                  }
                  onClearApiKey={() =>
                    updateProviderConnection(provider.id, {
                      apiKey: "",
                      apiKeyConfigured: false,
                    })
                  }
                />

                <ModelList
                  provider={provider}
                  selectedModelId={selectedModelId}
                  expandedModelKeys={expandedModelKeys}
                  providerFeedback={providerFeedback}
                  modelSuggestions={modelSuggestions}
                  onAddModel={() => addProviderModel(provider.id)}
                  onSelectModel={(modelId) => setSelectedProviderModel(provider.id, modelId)}
                  onToggleExpand={(modelKey) =>
                    setExpandedModelKeys((prev) => ({
                      ...prev,
                      [modelKey]: !prev[modelKey],
                    }))
                  }
                  onDeleteModel={(modelId) => removeProviderModel(provider.id, modelId)}
                  onUpdateConfig={(modelId, config) =>
                    updateProviderConfig(provider.id, modelId, config)
                  }
                  clampTemperature={clampTemperature}
                  clampMaxTokens={clampMaxTokens}
                />

                <ProviderPanelFooter
                  selectedModel={selectedModel}
                  hasUsableApiKey={hasUsableApiKey}
                  testingModelKey={testingModelKey}
                  selectedKey={selectedKey}
                  savingProviderId={savingProviderId}
                  providerId={provider.id}
                  providerName={providerName}
                  onTest={() => testProviderConfig(provider.id, selectedModel.id)}
                  onSave={() => saveProviderConfig(provider.id)}
                  setProviderFeedback={setProviderFeedback}
                />

                {!hasUsableApiKey && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-xs text-amber-200">
                    当前 Provider 尚未配置可用 API Key，测试和运行时不会出现在模型选择列表中。
                  </div>
                )}

                {activeFeedback && (
                  <div
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm",
                      activeFeedback.success
                        ? "border-primary/25 bg-primary/[0.08] text-primary"
                        : "border-destructive/25 bg-destructive/5 text-destructive",
                    )}
                  >
                    {activeFeedback.message}
                  </div>
                )}
              </div>
            </div>
          );
        })()
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card/85 p-8 text-sm text-muted-foreground">
          暂无可配置的供应商。
        </div>
      )}
      </div>
    </div>
  );
}
