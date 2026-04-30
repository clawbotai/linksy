"use client";

import { Check, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { MODEL_OPTIONS, formatFileSize } from "@/components/app-settings/shared";
import type {
  DownloadProgress,
  WhisperModel,
} from "@/components/app-settings/whisper-panel-shared";

interface WhisperModelSectionProps {
  selectedModel: WhisperModel;
  modelExists: boolean;
  downloading: boolean;
  isBusy: boolean;
  helperConnected: boolean;
  whisperInstalled: boolean;
  downloadProgress: DownloadProgress | null;
  onModelSelect: (modelId: WhisperModel) => void;
  onDownloadModel: () => void;
}

export function WhisperModelSection({
  selectedModel,
  modelExists,
  downloading,
  isBusy,
  helperConnected,
  whisperInstalled,
  downloadProgress,
  onModelSelect,
  onDownloadModel,
}: WhisperModelSectionProps) {
  const downloadButtonContent = downloading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      下载中...
    </>
  ) : modelExists ? (
    <>
      <Download className="mr-2 h-4 w-4" />
      重新下载
    </>
  ) : (
    <>
      <Download className="mr-2 h-4 w-4" />
      下载模型
    </>
  );

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm shadow-primary/5">
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium">选择模型</h4>
          <p className="mt-1 text-sm text-muted-foreground">Small 更快，Medium 识别质量更高。</p>
        </div>

        <div className="grid gap-2.5">
          {MODEL_OPTIONS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => onModelSelect(model.id)}
              className={cn(
                "relative flex items-center justify-between rounded-xl border p-3.5 text-left transition-all",
                selectedModel === model.id
                  ? "border-primary bg-primary/8 shadow-sm shadow-primary/10"
                  : "border-border/60 bg-background/80 hover:border-primary/35 hover:bg-accent/20",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2",
                    selectedModel === model.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30",
                  )}
                >
                  {selectedModel === model.id && <Check className="h-2.5 w-2.5" />}
                </div>
                <div>
                  <div className="font-medium">{model.name}</div>
                  <div className="text-xs text-muted-foreground">{model.description}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{model.size}</div>
            </button>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          {downloading && downloadProgress ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  正在下载 {downloadProgress.modelName} 模型...
                </span>
                <span className="font-medium">{downloadProgress.percent?.toFixed(1)}%</span>
              </div>
              <Progress value={downloadProgress.percent || 0} max={100} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatFileSize(downloadProgress.downloaded)}</span>
                <span>{formatFileSize(downloadProgress.total)}</span>
              </div>
            </div>
          ) : (
            <Button
              onClick={onDownloadModel}
              disabled={isBusy || !helperConnected}
              className="w-full sm:w-auto"
              variant={modelExists && whisperInstalled ? "outline" : "default"}
            >
              {downloadButtonContent}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
