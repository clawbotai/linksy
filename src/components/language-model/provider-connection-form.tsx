"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LanguageModelProviderCard } from "@/types";
import { getProviderApiKeyPlaceholder } from "@/lib/language-models";
import { ProviderIdentity } from "./provider-sidebar";

interface ProviderConnectionFormProps {
  provider: LanguageModelProviderCard;
  hasSavedApiKey: boolean;
  hasUsableApiKey: boolean;
  showApiKey: boolean;
  onToggleApiKeyVisibility: () => void;
  onUpdateConnection: (connection: Partial<Pick<LanguageModelProviderCard, "name" | "baseUrl" | "apiKey" | "apiKeyConfigured" | "apiFormat">>) => void;
  onClearApiKey: () => void;
}

export function ProviderConnectionForm({
  provider,
  hasSavedApiKey,
  hasUsableApiKey,
  showApiKey,
  onToggleApiKeyVisibility,
  onUpdateConnection,
  onClearApiKey,
}: ProviderConnectionFormProps) {
  return (
    <div className="grid gap-5">
      <div className="space-y-2">
        <label className="text-xs font-medium">Provider Name</label>
        <Input
          value={provider.name}
          onChange={(event) =>
            onUpdateConnection({ name: event.target.value })
          }
          placeholder="My Provider"
          className="h-10 rounded-xl bg-background/55"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">API Base URL</label>
        <Input
          value={provider.baseUrl}
          onChange={(event) =>
            onUpdateConnection({ baseUrl: event.target.value })
          }
          placeholder="https://api.example.com/v1"
          className="h-10 rounded-xl bg-background/55"
        />
      </div>

      {provider.kind === "custom" && (
        <div className="space-y-2">
          <label className="text-xs font-medium">API Format</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={provider.apiFormat === "openai" ? "default" : "outline"}
              className="h-10 rounded-xl"
              onClick={() => onUpdateConnection({ apiFormat: "openai" })}
            >
              OpenAI Compatible
            </Button>
            <Button
              type="button"
              variant={provider.apiFormat === "anthropic" ? "default" : "outline"}
              className="h-10 rounded-xl"
              onClick={() => onUpdateConnection({ apiFormat: "anthropic" })}
            >
              Anthropic Compatible
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-medium">API Key</label>
          {hasSavedApiKey && !provider.apiKey && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              已保存
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showApiKey ? "text" : "password"}
              value={provider.apiKey}
              onChange={(event) =>
                onUpdateConnection({ apiKey: event.target.value })
              }
              placeholder={
                hasSavedApiKey && !provider.apiKey
                  ? "已保存 API Key，如需更换请重新输入"
                  : getProviderApiKeyPlaceholder(provider)
              }
              className="h-10 rounded-xl bg-background/55 pr-11"
            />
            <button
              type="button"
              onClick={onToggleApiKeyVisibility}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {hasSavedApiKey && (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl px-3"
              onClick={onClearApiKey}
            >
              清除
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
