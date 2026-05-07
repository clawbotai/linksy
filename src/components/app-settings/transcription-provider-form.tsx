"use client";

import * as React from "react";
import { Check, Eye, EyeOff, Loader2, Trash2, Zap, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TranscriptionApiFormat, TranscriptionProviderCard } from "@/types";
import { TRANSCRIPTION_PROVIDER_META } from "@/lib/transcription-providers";

interface TranscriptionProviderFormProps {
  provider: TranscriptionProviderCard;
  isDirty: boolean;
  isSaving: boolean;
  isTesting: boolean;
  testResult?: { success: boolean; message: string };
  onUpdate: (updates: Partial<TranscriptionProviderCard>) => void;
  onSave: () => void;
  onTest: () => void;
  onDelete: () => void;
}

export function TranscriptionProviderForm({
  provider,
  isDirty,
  isSaving,
  isTesting,
  testResult,
  onUpdate,
  onSave,
  onTest,
  onDelete,
}: TranscriptionProviderFormProps) {
  const [showApiKey, setShowApiKey] = React.useState(false);

  const isPreset = provider.kind === "preset";
  const meta = provider.presetType ? TRANSCRIPTION_PROVIDER_META[provider.presetType] : null;
  const apiKeyPlaceholder = meta?.apiKeyPlaceholder ?? "sk-...";
  const capabilityLabel = meta?.capabilityLabel ?? "";

  return (
    <div className="space-y-4">
      {/* Provider name */}
      <div className="space-y-2">
        <label className="text-xs font-medium">名称</label>
        <Input
          value={provider.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={meta?.label ?? "自定义供应商"}
          disabled={isPreset}
        />
      </div>

      {/* 能力标签 */}
      {capabilityLabel && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {capabilityLabel}
        </div>
      )}

      {/* apiFormat（自定义供应商可选） */}
      {!isPreset && (
        <div className="space-y-2">
          <label className="text-xs font-medium">转录协议</label>
          <select
            value={provider.apiFormat}
            onChange={(e) => onUpdate({ apiFormat: e.target.value as TranscriptionApiFormat })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="openai-whisper">OpenAI Whisper（同步，推荐短音频）</option>
            <option value="dashscope">DashScope（异步，长音频友好）</option>
            <option value="gemini">Google Gemini（同步，推荐短音频）</option>
          </select>
        </div>
      )}

      {/* API Key */}
      <div className="space-y-2">
        <label className="text-xs font-medium">API Key</label>
        <div className="relative">
          <Input
            type={showApiKey ? "text" : "password"}
            value={provider.apiKey}
            onChange={(e) => onUpdate({ apiKey: e.target.value })}
            placeholder={apiKeyPlaceholder}
            className="pr-16"
            autoComplete="off"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {provider.apiKey && (
              <button
                type="button"
                onClick={() => onUpdate({ apiKey: "" })}
                className="p-1 text-muted-foreground transition-colors hover:text-foreground"
                title="清除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Base URL */}
      <div className="space-y-2">
        <label className="text-xs font-medium">Base URL</label>
        <Input
          value={provider.baseUrl}
          onChange={(e) => onUpdate({ baseUrl: e.target.value })}
          placeholder={meta?.defaultBaseUrl ?? "https://api.example.com/v1"}
        />
      </div>

      {/* Model Name */}
      <div className="space-y-2">
        <label className="text-xs font-medium">模型名称</label>
        <Input
          value={provider.modelName}
          onChange={(e) => onUpdate({ modelName: e.target.value })}
          placeholder={meta?.defaultModelName ?? "model-name"}
          list={meta ? `model-suggestions-${provider.id}` : undefined}
        />
        {meta && (
          <datalist id={`model-suggestions-${provider.id}`}>
            {meta.modelSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>

      {/* DashScope-specific: enableITN */}
      {provider.presetType === "dashscope" && (
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={provider.enableITN ?? false}
            onChange={(e) => onUpdate({ enableITN: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-muted-foreground">启用逆文本正则化 (enableITN)</span>
        </label>
      )}

      {/* Enabled toggle */}
      <label className="flex items-center gap-2.5 text-sm">
        <button
          type="button"
          role="switch"
          aria-checked={provider.enabled}
          onClick={() => onUpdate({ enabled: !provider.enabled })}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
            provider.enabled ? "bg-primary" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform",
              provider.enabled ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>
        <Power className={cn("h-4 w-4", provider.enabled ? "text-primary" : "text-muted-foreground")} />
        <span className={cn("text-muted-foreground", provider.enabled && "text-foreground font-medium")}>
          {provider.enabled ? "已启用" : "已禁用"}
        </span>
      </label>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-border/50 pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={onTest}
          disabled={isTesting || !provider.apiKey.trim()}
        >
          {isTesting ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              测试中...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-3.5 w-3.5" />
              测试连接
            </>
          )}
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Check className="mr-2 h-3.5 w-3.5" />
              保存
            </>
          )}
        </Button>
        {testResult && (
          <span
            className={cn(
              "text-xs",
              testResult.success ? "text-green-600 dark:text-green-400" : "text-destructive",
            )}
          >
            {testResult.message}
          </span>
        )}
        {!isPreset && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            删除
          </Button>
        )}
      </div>
    </div>
  );
}
