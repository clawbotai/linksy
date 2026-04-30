"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { LocalRuntimeInstallProgress } from "@/types";
import type { NormalizedWhisperStatus } from "@/lib/whisper-status";
import { MANUAL_INSTALL_COMMANDS, REQUIREMENT_LABELS } from "@/components/app-settings/shared";
import type { RuntimeChecklistItem } from "@/components/app-settings/whisper-panel-shared";

interface WhisperRuntimeSectionProps {
  helperConnected: boolean;
  platformLabel: string;
  runtimeChecklist: RuntimeChecklistItem[];
  status: NormalizedWhisperStatus | null;
  installComponentsCount: number;
  installingRuntime: boolean;
  showManualCommands: boolean;
  installProgress: LocalRuntimeInstallProgress | null;
  onInstallRuntime: () => void;
  onToggleManualCommands: () => void;
}

export function WhisperRuntimeSection({
  helperConnected,
  platformLabel,
  runtimeChecklist,
  status,
  installComponentsCount,
  installingRuntime,
  showManualCommands,
  installProgress,
  onInstallRuntime,
  onToggleManualCommands,
}: WhisperRuntimeSectionProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm shadow-primary/5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">本机 helper</span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                helperConnected ? "bg-green-500" : "bg-red-500",
              )}
            />
            <span className="text-sm text-muted-foreground">
              {helperConnected ? `已连接 · ${platformLabel}` : "未连接"}
            </span>
          </div>
        </div>

        {!helperConnected && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              需要先在当前电脑上启动本机 helper，设置页才能检测和安装本地转录依赖。
            </p>
            <div className="rounded-xl bg-muted/60 px-3 py-3 text-xs text-muted-foreground">
              在用户电脑本机运行：<code>npm run helper</code>
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-border/50 pt-4">
          <div>
            <h4 className="text-sm font-medium">本地转录环境清单</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              本地转录优先复用你电脑上已有的组件。缺失时可一键安装 `Homebrew`、
              `whisper.cpp` 与 `ffmpeg`，模型仍单独下载。
            </p>
          </div>

          <div className="grid gap-3">
            {runtimeChecklist.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-background/70 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="mt-1 break-all text-xs text-muted-foreground">{item.detail}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      item.installed ? "bg-green-500" : "bg-red-500",
                    )}
                  />
                  <span className="text-xs text-muted-foreground">{item.stateLabel}</span>
                </div>
              </div>
            ))}
          </div>

          {status?.isLegacyPayload && (
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-sm font-medium">检测信息来自旧版 helper</p>
              <p className="mt-1 text-xs text-muted-foreground">
                当前 helper 仍使用旧状态结构，Whisper / ffmpeg 是否可用会继续按实际结果判断；
                如果想看到更完整的 Homebrew 与来源信息，重启 helper 后再打开此页面即可。
              </p>
            </div>
          )}

          {!!status?.missingRequirements?.length && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-sm font-medium text-foreground">当前本地转录环境未完成</p>
              <p className="mt-1 text-xs text-muted-foreground">
                缺失项：
                {status.missingRequirements
                  .map((item) => REQUIREMENT_LABELS[item] || item)
                  .join("、")}
                。补齐后即可使用本地 Whisper 转录。
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={onInstallRuntime}
                  disabled={
                    !helperConnected ||
                    !status.autoInstallSupported ||
                    !installComponentsCount ||
                    installingRuntime
                  }
                >
                  {installingRuntime ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在安装组件...
                    </>
                  ) : (
                    "一键安装所需组件"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={onToggleManualCommands}>
                  {showManualCommands ? "隐藏手动安装命令" : "查看手动安装命令"}
                </Button>
              </div>
            </div>
          )}

          {showManualCommands && (
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-sm font-medium">手动安装命令</p>
              <p className="mt-1 text-xs text-muted-foreground">
                如果一键安装失败，可在系统终端依次运行以下命令。
              </p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-card px-3 py-3 text-xs text-muted-foreground">
                <code>{MANUAL_INSTALL_COMMANDS}</code>
              </pre>
            </div>
          )}

          {installProgress && installProgress.status !== "idle" && (
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">一键安装进度</p>
                  <p className="mt-1 text-xs text-muted-foreground">{installProgress.message}</p>
                </div>
                <span className="text-xs text-muted-foreground">{installProgress.progress}%</span>
              </div>
              <Progress value={installProgress.progress} max={100} className="mt-3" />
              {!!installProgress.logsTail.length && (
                <pre className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-card px-3 py-3 text-xs text-muted-foreground">
                  <code>{installProgress.logsTail.join("\n")}</code>
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
