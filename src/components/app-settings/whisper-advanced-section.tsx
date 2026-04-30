"use client";

import { ChevronDown, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WhisperConfig } from "@/types";
import type { WhisperModel } from "@/components/app-settings/whisper-panel-shared";

interface WhisperAdvancedSectionProps {
  showAdvanced: boolean;
  config: WhisperConfig;
  selectedModel: WhisperModel;
  helperConnected: boolean;
  isBusy: boolean;
  platform?: string;
  onToggleAdvanced: () => void;
  onResetProjectPaths: () => void;
  onConfigChange: (field: keyof WhisperConfig, value: string | number) => void;
}

export function WhisperAdvancedSection({
  showAdvanced,
  config,
  selectedModel,
  helperConnected,
  isBusy,
  platform,
  onToggleAdvanced,
  onResetProjectPaths,
  onConfigChange,
}: WhisperAdvancedSectionProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm shadow-primary/5">
      <div className="space-y-3">
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent/20"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>高级设置</span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              showAdvanced && "rotate-180",
            )}
          />
        </button>

        {showAdvanced && (
          <div className="grid gap-4 rounded-xl border border-border/60 bg-background/70 p-4">
            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                建议填写用户电脑上的绝对路径；Windows 与 macOS 都可手动配置。
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onResetProjectPaths}
                disabled={isBusy}
                className="w-full sm:w-auto"
              >
                使用当前项目默认目录
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">转录文件目录</label>
              <Input
                value={config.outputDir}
                onChange={(e) => onConfigChange("outputDir", e.target.value)}
                placeholder="/Users/you/Documents/MemoFlow Transcripts"
                disabled={!helperConnected}
              />
              <p className="text-xs text-muted-foreground">
                转录完成后，文件将保存到这个本机目录下，并按播客标题创建子目录。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">whisper.cpp 路径</label>
              <Input
                value={config.whisperPath}
                onChange={(e) => onConfigChange("whisperPath", e.target.value)}
                placeholder={
                  platform === "win32" ? "C:\\whisper\\whisper-cli.exe" : "/usr/local/bin/whisper-cli"
                }
                disabled={!helperConnected}
              />
              <p className="text-xs text-muted-foreground">
                支持绝对路径，或已经加入系统 PATH 的命令名。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">模型文件路径</label>
              <Input
                value={config.modelPath}
                onChange={(e) => onConfigChange("modelPath", e.target.value)}
                placeholder={`ggml-${selectedModel}.bin 的本机绝对路径`}
                disabled={!helperConnected}
              />
              <p className="text-xs text-muted-foreground">
                下载按钮会默认把模型放到 helper 管理目录，也可以手动改成本机其他路径。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">ffmpeg 路径</label>
              <Input
                value={config.ffmpegPath}
                onChange={(e) => onConfigChange("ffmpegPath", e.target.value)}
                placeholder="ffmpeg"
                disabled={!helperConnected}
              />
              <p className="text-xs text-muted-foreground">
                支持绝对路径，或已加入 PATH 的 `ffmpeg` 命令。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">转录线程数</label>
              <Input
                type="number"
                min={1}
                max={8}
                value={config.threads}
                onChange={(e) => onConfigChange("threads", parseInt(e.target.value, 10) || 1)}
                disabled={!helperConnected}
              />
              <p className="text-xs text-muted-foreground">
                helper 会自动限制到 1-8 线程，默认建议不超过 8。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
