'use client';

import React from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToastManager } from "@/components/ui/toast";
import type { TranscriptionRecord } from "@/types/transcription-history";
import type { ProviderOption, ToastType } from "./shared";

interface MindMapGeneratePanelProps {
  providers: ProviderOption[];
  selectedProvider: string;
  loadingProviders: boolean;
  canGenerate: boolean;
  generating: boolean;
  record: TranscriptionRecord;
  toast: { message: string; type: ToastType } | null;
  onProviderChange: (provider: string) => void;
  onGenerate: () => void | Promise<void>;
  onDismissToast: () => void;
}

export function MindMapGeneratePanel({
  providers,
  selectedProvider,
  loadingProviders,
  canGenerate,
  generating,
  record,
  toast,
  onProviderChange,
  onGenerate,
  onDismissToast,
}: MindMapGeneratePanelProps) {
  return (
    <div className="flex h-full flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-[320px] rounded-xl border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(249,251,247,0.92))] p-4 shadow-[0_16px_42px_rgba(20,40,20,0.07)] ring-1 ring-black/[0.03] backdrop-blur-xl">
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium tracking-[0.01em] text-foreground/88">模型</label>
            <div className="relative">
              <select
                className="h-10 w-full appearance-none rounded-lg border border-border/60 bg-white/82 px-3.5 pr-9 text-[13px] text-foreground/90 outline-none transition-all duration-200 focus:border-primary/35 focus:bg-white focus:shadow-[0_10px_24px_rgba(24,68,39,0.08)]"
                value={selectedProvider}
                onChange={(event) => onProviderChange(event.target.value)}
                disabled={loadingProviders || providers.length === 0}
              >
                {providers.length === 0 ? (
                  <option value="">暂无可用模型</option>
                ) : (
                  providers.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground/80">
                {loadingProviders ? (
                  <Loader2 className="h-[14px] w-[14px] animate-spin" />
                ) : (
                  <RefreshCcw className="h-[14px] w-[14px]" strokeWidth={1.8} />
                )}
              </div>
            </div>
          </div>

          <Button
            className="h-10 w-full rounded-lg bg-primary text-[14px] font-medium tracking-[0.01em] text-primary-foreground shadow-[0_14px_28px_rgba(24,68,39,0.14)] hover:bg-primary/92"
            disabled={!canGenerate}
            onClick={onGenerate}
          >
            {generating || record.mindmapStatus === "generating" ? (
              <>
                <Loader2 className="mr-1.5 h-[14px] w-[14px] animate-spin" />
                生成中...
              </>
            ) : (
              "生成 AI 脑图"
            )}
          </Button>

          {providers.length === 0 && (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              还没有可用的语言模型。请在设置中启用并保存至少一个已配置 API Key 的 Provider。
            </p>
          )}

          {record.mindmapError && (
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-[12px] text-destructive">
              {record.mindmapError}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <ToastManager
          message={toast.message}
          type={toast.type}
          onClose={onDismissToast}
        />
      )}
    </div>
  );
}
