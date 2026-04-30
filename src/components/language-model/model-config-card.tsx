"use client";

import * as React from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LanguageModelModelConfig, LanguageModelProviderCard } from "@/types";

interface ModelConfigCardProps {
  model: LanguageModelModelConfig;
  provider: LanguageModelProviderCard;
  isSelected: boolean;
  isExpanded: boolean;
  testResult?: { success: boolean; message: string };
  modelSuggestions: string[];
  onSelect: () => void;
  onToggleExpand: () => void;
  onDelete: () => void;
  onUpdateConfig: (config: Partial<LanguageModelModelConfig>) => void;
  clampTemperature: (value: number) => number;
  clampMaxTokens: (value: number) => number;
}

export function ModelConfigCard({
  model,
  provider,
  isSelected,
  isExpanded,
  testResult,
  modelSuggestions,
  onSelect,
  onToggleExpand,
  onDelete,
  onUpdateConfig,
  clampTemperature,
  clampMaxTokens,
}: ModelConfigCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all",
        isSelected
          ? "border-primary/25 bg-primary/[0.05]"
          : "border-border/60 bg-background/55",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={model.enabled ? "default" : "outline"} className="px-1.5 py-0 text-[10px]">
              {model.enabled ? "已启用" : "未启用"}
            </Badge>
            {testResult?.success && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                测试通过
              </Badge>
            )}
            {isSelected && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                当前编辑
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-muted-foreground">Display Name</label>
              <Input
                value={model.name}
                onChange={(event) =>
                  onUpdateConfig({ name: event.target.value })
                }
                placeholder="Display Name"
                className="h-10 rounded-xl bg-background/70"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-muted-foreground">Real Model ID</label>
              <Input
                list={`llm-model-suggestions-${provider.id}`}
                value={model.model}
                onChange={(event) =>
                  onUpdateConfig({ model: event.target.value })
                }
                placeholder="gpt-4.1-mini"
                className="h-10 rounded-xl bg-background/70"
              />
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onToggleExpand}
            className="rounded-xl px-2"
          >
            {isExpanded ? "收起高级" : "高级设置"}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={provider.models.length <= 1}
            onClick={onDelete}
            aria-label={`删除 ${model.name || model.model}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            onUpdateConfig({ enabled: !model.enabled })
          }
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
            model.enabled
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              model.enabled ? "bg-primary" : "bg-muted-foreground/50",
            )}
          />
          {model.enabled ? "已启用该模型" : "点击启用该模型"}
        </button>

        {testResult && (
          <p className={cn(
            "text-xs",
            testResult.success ? "text-primary" : "text-destructive",
          )}>
            {testResult.message}
          </p>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground">Temperature</label>
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={model.temperature}
              onChange={(event) =>
                onUpdateConfig({
                  temperature: clampTemperature(Number.parseFloat(event.target.value)),
                })
              }
              className="h-10 rounded-xl bg-background/70"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground">Max Tokens</label>
            <Input
              type="number"
              min={1}
              step={1}
              value={model.maxTokens}
              onChange={(event) =>
                onUpdateConfig({
                  maxTokens: clampMaxTokens(Number.parseInt(event.target.value, 10)),
                })
              }
              className="h-10 rounded-xl bg-background/70"
            />
          </div>
        </div>
      )}

      <datalist id={`llm-model-suggestions-${provider.id}`}>
        {modelSuggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </div>
  );
}
