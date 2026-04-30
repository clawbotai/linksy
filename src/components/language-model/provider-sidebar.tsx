import * as React from "react";
import { Bot, BrainCircuit, Hexagon, Orbit, Sparkles, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LanguageModelProvider, LanguageModelProviderCard } from "@/types";
import { cn } from "@/lib/utils";
import { getProviderName } from "@/lib/language-models";

const PROVIDER_ICONS: Record<LanguageModelProvider, React.ComponentType<{ className?: string }>> = {
  openai: Sparkles,
  claude: Bot,
  "anthropic-third-party": Bot,
  gemini: Orbit,
  qwen: Zap,
  zhipu: BrainCircuit,
};

const PROVIDER_ACCENTS: Record<LanguageModelProvider, string> = {
  openai: "from-primary/20 to-primary/5 text-primary",
  claude: "from-amber-400/20 to-amber-500/5 text-amber-300",
  "anthropic-third-party": "from-orange-400/20 to-orange-500/5 text-orange-300",
  gemini: "from-cyan-400/20 to-cyan-500/5 text-cyan-300",
  qwen: "from-violet-400/25 to-violet-500/5 text-violet-300",
  zhipu: "from-sky-400/20 to-sky-500/5 text-sky-300",
};

interface ProviderIdentityProps {
  provider: LanguageModelProviderCard;
  active: boolean;
}

export function ProviderIdentity({ provider, active }: ProviderIdentityProps) {
  const Icon = provider.presetType ? PROVIDER_ICONS[provider.presetType] : Hexagon;
  const accent = provider.presetType
    ? PROVIDER_ACCENTS[provider.presetType]
    : "from-muted/80 to-background text-muted-foreground";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-gradient-to-br",
          accent,
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">{getProviderName(provider)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {provider.models.length} {provider.models.length > 1 ? "models" : "model"}
        </div>
      </div>
    </div>
  );
}

interface ProviderSidebarItemProps {
  provider: LanguageModelProviderCard;
  isActive: boolean;
  isDirty: boolean;
  onClick: () => void;
  onRemove?: () => void;
}

export function ProviderSidebarItem({ provider, isActive, isDirty, onClick, onRemove }: ProviderSidebarItemProps) {
  const enabledCount = provider.models.filter((model) => model.enabled).length;

  return (
    <div
      className={cn(
        "group relative w-full rounded-xl border transition-all",
        isActive
          ? "border-primary/25 bg-primary/[0.06]"
          : "border-border/60 bg-background/45 hover:border-border hover:bg-background/65",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full px-3 py-2.5 text-left"
      >
        <ProviderIdentity provider={provider} active={isActive} />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {provider.kind === "preset" ? "预置" : "自定义"}
          </Badge>
          {enabledCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {enabledCount} 已启用
            </Badge>
          )}
          {isDirty && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              未保存
            </Badge>
          )}
        </div>
      </button>

      {provider.kind === "custom" && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`删除 ${getProviderName(provider)}`}
          className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface ProviderSidebarProps {
  providers: LanguageModelProviderCard[];
  activeProviderId: string;
  dirtyProviderIds: Set<string>;
  onProviderSelect: (providerId: string) => void;
  onRemoveProvider: (providerId: string) => void;
}

export function ProviderSidebar({ providers, activeProviderId, dirtyProviderIds, onProviderSelect, onRemoveProvider }: ProviderSidebarProps) {
  return (
    <aside className="rounded-2xl border border-border/70 bg-card/85 p-3">
      <div className="border-b border-border/60 px-2 pb-3">
        <div className="text-sm font-semibold text-foreground">供应商列表</div>
        <p className="mt-1 text-xs text-muted-foreground">点击左侧供应商，在右侧查看和编辑其配置。</p>
      </div>

      <div className="mt-3 space-y-2">
        {providers.map((provider) => (
          <ProviderSidebarItem
            key={provider.id}
            provider={provider}
            isActive={provider.id === activeProviderId}
            isDirty={dirtyProviderIds.has(provider.id)}
            onClick={() => onProviderSelect(provider.id)}
            onRemove={provider.kind === "custom" ? () => onRemoveProvider(provider.id) : undefined}
          />
        ))}
      </div>
    </aside>
  );
}
