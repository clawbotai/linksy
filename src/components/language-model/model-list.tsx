"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LanguageModelProviderCard, LanguageModelModelConfig } from "@/types";
import { ModelConfigCard } from "./model-config-card";

interface ModelListProps {
  provider: LanguageModelProviderCard;
  selectedModelId: string;
  expandedModelKeys: Record<string, boolean>;
  providerFeedback: Record<string, { success: boolean; message: string }>;
  modelSuggestions: string[];
  onAddModel: () => void;
  onSelectModel: (modelId: string) => void;
  onToggleExpand: (modelKey: string) => void;
  onDeleteModel: (modelId: string) => void;
  onUpdateConfig: (modelId: string, config: Partial<LanguageModelModelConfig>) => void;
  clampTemperature: (value: number) => number;
  clampMaxTokens: (value: number) => number;
}

export function ModelList({
  provider,
  selectedModelId,
  expandedModelKeys,
  providerFeedback,
  modelSuggestions,
  onAddModel,
  onSelectModel,
  onToggleExpand,
  onDeleteModel,
  onUpdateConfig,
  clampTemperature,
  clampMaxTokens,
}: ModelListProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h5 className="text-sm font-semibold">Models</h5>
          <p className="mt-1 text-xs text-muted-foreground">
            在同一个 Provider 下维护多个模型，支持单独启用和高级参数。
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={onAddModel}
          className="h-9 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Model
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 bg-background/30 p-3">
        {provider.models.map((model) => {
          const itemKey = `${provider.id}:${model.id}`;
          const itemResult = providerFeedback[itemKey];
          const isSelected = selectedModelId === model.id;
          const advancedOpen = Boolean(expandedModelKeys[itemKey]);

          return (
            <ModelConfigCard
              key={model.id}
              model={model}
              provider={provider}
              isSelected={isSelected}
              isExpanded={advancedOpen}
              testResult={itemResult}
              modelSuggestions={modelSuggestions}
              onSelect={() => onSelectModel(model.id)}
              onToggleExpand={() => onToggleExpand(itemKey)}
              onDelete={() => onDeleteModel(model.id)}
              onUpdateConfig={(config) => onUpdateConfig(model.id, config)}
              clampTemperature={clampTemperature}
              clampMaxTokens={clampMaxTokens}
            />
          );
        })}
      </div>
    </div>
  );
}
