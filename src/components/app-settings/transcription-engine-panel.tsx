"use client";

import * as React from "react";
import { Globe, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranscriptionProviderSettings } from "@/hooks/use-transcription-provider-settings";
import { getTranscriptionProviderName } from "@/lib/transcription-providers";
import { TranscriptionProviderForm } from "@/components/app-settings/transcription-provider-form";

interface TranscriptionEnginePanelProps {
  visible: boolean;
}

export function TranscriptionEnginePanel({ visible }: TranscriptionEnginePanelProps) {
  const {
    settings: providerSettings,
    loaded: providersLoaded,
    saving,
    testing,
    dirtyProviderIds,
    addProvider,
    removeProvider,
    updateProvider,
    setActiveProvider,
    saveProvider,
    testConnection,
    getTestResult,
  } = useTranscriptionProviderSettings();

  if (!providersLoaded) {
    return (
      <section aria-hidden={!visible} className={cn("space-y-5", !visible && "hidden")}>
        <div className="flex items-center justify-center py-14">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  const activeProvider = providerSettings.providers.find(
    (p) => p.id === providerSettings.activeProviderId,
  );

  return (
    <section aria-hidden={!visible} className={cn("space-y-5", !visible && "hidden")}>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold">在线 ASR 供应商</h3>
        <p className="text-sm text-muted-foreground">
          管理语音识别供应商。选择预置供应商或添加自定义第三方 ASR 服务。
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm shadow-primary/5">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">供应商列表</h4>
          </div>

          {/* Provider tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {providerSettings.providers.map((provider) => {
              const isActive = provider.id === providerSettings.activeProviderId;
              const isDirty = dirtyProviderIds.has(provider.id);
              const name = getTranscriptionProviderName(provider);

              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setActiveProvider(provider.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all",
                    isActive
                      ? "border-primary bg-primary/8 text-primary font-medium"
                      : "border-border/60 bg-background/80 text-muted-foreground hover:border-primary/35",
                  )}
                >
                  {!provider.enabled && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  )}
                  {provider.enabled && isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  )}
                  {name}
                  {isDirty && (
                    <span className="ml-1 h-1.5 w-1.5 rounded-full bg-orange-500" />
                  )}
                </button>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-dashed"
              onClick={addProvider}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              添加
            </Button>
          </div>

          {/* Active provider form */}
          {activeProvider && (
            <TranscriptionProviderForm
              provider={activeProvider}
              isDirty={dirtyProviderIds.has(activeProvider.id)}
              isSaving={saving}
              isTesting={testing === activeProvider.id}
              testResult={getTestResult(activeProvider.id)}
              onUpdate={(updates) => updateProvider(activeProvider.id, updates)}
              onSave={() => saveProvider(activeProvider.id)}
              onTest={() => testConnection(activeProvider.id)}
              onDelete={() => removeProvider(activeProvider.id)}
            />
          )}
        </div>
      </div>

      {/* Current status */}
      <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm shadow-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">当前状态</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                activeProvider?.enabled && activeProvider?.apiKey
                  ? "bg-green-500"
                  : "bg-amber-500",
              )}
            />
            <span className="text-sm text-muted-foreground">
              {activeProvider
                ? `${getTranscriptionProviderName(activeProvider)} · ${activeProvider.apiKey ? "已配置" : "未配置 API Key"}`
                : "未选择供应商"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
