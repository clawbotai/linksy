"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LocalRuntimeInstallProgress, WhisperConfig, WhisperStatus } from "@/types";
import {
  createHelperEventSource,
  helperRequest,
  isHelperUnavailableError,
} from "@/lib/local-helper-client";
import { emitLocalRuntimeStatusChanged } from "@/lib/local-runtime-events";
import {
  normalizeWhisperStatus,
  type NormalizedWhisperStatus,
} from "@/lib/whisper-status";
import { getInstallComponents } from "@/components/app-settings/shared";
import {
  buildRuntimeChecklist,
  getPlatformLabel,
  INITIAL_WHISPER_CONFIG,
  type DownloadProgress,
  type WhisperModel,
} from "@/components/app-settings/whisper-panel-shared";
import { WhisperAdvancedSection } from "@/components/app-settings/whisper-advanced-section";
import { WhisperModelSection } from "@/components/app-settings/whisper-model-section";
import { WhisperRuntimeSection } from "@/components/app-settings/whisper-runtime-section";

interface WhisperPanelProps {
  open: boolean;
  visible: boolean;
  onClose: () => void;
}

export function WhisperPanel({ open, visible, onClose }: WhisperPanelProps) {
  const [helperConnected, setHelperConnected] = React.useState(false);
  const [status, setStatus] = React.useState<NormalizedWhisperStatus | null>(null);
  const [config, setConfig] = React.useState<WhisperConfig>(INITIAL_WHISPER_CONFIG);
  const [defaultConfig, setDefaultConfig] = React.useState<WhisperConfig | null>(null);
  const [selectedModel, setSelectedModel] = React.useState<WhisperModel>("small");
  const [downloading, setDownloading] = React.useState(false);
  const [downloadProgress, setDownloadProgress] = React.useState<DownloadProgress | null>(null);
  const [installProgress, setInstallProgress] =
    React.useState<LocalRuntimeInstallProgress | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showManualCommands, setShowManualCommands] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const downloadEsRef = React.useRef<EventSource | null>(null);
  const installEsRef = React.useRef<EventSource | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [healthResult, configResult, statusResult] = await Promise.all([
        helperRequest<{ success: boolean; data: { helperConnected: boolean } }>("/health"),
        helperRequest<{ success: boolean; data: WhisperConfig }>("/config"),
        helperRequest<{ success: boolean; data: WhisperStatus }>("/whisper/status"),
      ]);

      if (healthResult.success) {
        setHelperConnected(healthResult.data.helperConnected);
      }

      if (configResult.success) {
        setConfig(configResult.data);
        setSelectedModel((configResult.data.modelName as WhisperModel) || "small");
        setDefaultConfig((prev) => prev ?? configResult.data);
      }

      if (statusResult.success) {
        setStatus(normalizeWhisperStatus(statusResult.data));
        emitLocalRuntimeStatusChanged();
      }
    } catch (err) {
      setHelperConnected(false);
      setStatus(null);
      if (isHelperUnavailableError(err)) {
        setError("未检测到本机 helper 服务，请先在电脑上启动 `npm run helper`。");
      } else {
        setError("加载本机环境状态失败，请重试");
      }
      console.error("加载 helper 状态失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  React.useEffect(() => {
    return () => {
      downloadEsRef.current?.close();
      installEsRef.current?.close();
    };
  }, []);

  React.useEffect(() => {
    if (!open) {
      installEsRef.current?.close();
      installEsRef.current = null;
      return;
    }

    installEsRef.current?.close();
    const es = createHelperEventSource("/local-runtime/install-progress");
    installEsRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LocalRuntimeInstallProgress;
        setInstallProgress(data);

        if (data.status === "succeeded" || data.status === "failed") {
          loadData();
        }
      } catch (err) {
        console.error("解析本地安装进度失败:", err);
      }
    };

    es.onerror = () => {
      es.close();
      if (installEsRef.current === es) {
        installEsRef.current = null;
      }
    };

    return () => {
      es.close();
      if (installEsRef.current === es) {
        installEsRef.current = null;
      }
    };
  }, [loadData, open]);

  const startDownloadTracking = React.useCallback(() => {
    downloadEsRef.current?.close();

    const es = createHelperEventSource("/whisper/model/download-progress");
    downloadEsRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DownloadProgress;
        setDownloadProgress(data);

        if (data.status === "completed") {
          setDownloading(false);
          es.close();
          downloadEsRef.current = null;
          loadData();
        } else if (data.status === "error") {
          setDownloading(false);
          setError(data.error || "下载失败");
          es.close();
          downloadEsRef.current = null;
        }
      } catch (err) {
        console.error("解析进度数据失败:", err);
      }
    };

    es.onerror = () => {
      setDownloading(false);
      es.close();
      downloadEsRef.current = null;
    };
  }, [loadData]);

  const handleDownloadModel = async () => {
    setError(null);
    setDownloading(true);
    setDownloadProgress(null);

    try {
      await helperRequest<{ success: boolean }>("/whisper/model/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelName: selectedModel }),
      });

      startDownloadTracking();
    } catch (err) {
      setDownloading(false);
      setError(err instanceof Error ? err.message : "启动下载失败");
    }
  };

  const handleInstallRuntime = async () => {
    const components = getInstallComponents(status);
    if (!components.length) {
      return;
    }

    setError(null);

    try {
      await helperRequest<{ success: boolean }>("/local-runtime/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ components }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动本地依赖安装失败");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const result = await helperRequest<{ success: boolean; data: WhisperConfig }>("/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (result.success) {
        setConfig(result.data);
      }
      await loadData();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存配置失败");
    } finally {
      setSaving(false);
    }
  };

  const handleModelSelect = (modelId: WhisperModel) => {
    setSelectedModel(modelId);
    setConfig((prev) => ({
      ...prev,
      modelName: modelId,
      modelPath: prev.modelPath.replace(/ggml-\w+\.bin$/, `ggml-${modelId}.bin`),
    }));
  };

  const handleConfigChange = (field: keyof WhisperConfig, value: string | number) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetProjectPaths = () => {
    if (!defaultConfig) return;
    setConfig({
      ...defaultConfig,
      modelName: selectedModel,
      modelPath: defaultConfig.modelPath.replace(/ggml-\w+\.bin$/i, `ggml-${selectedModel}.bin`),
    });
  };

  const modelExists = status?.modelName === selectedModel && status?.modelInstalled;
  const installingRuntime = installProgress?.status === "running";
  const installComponents = getInstallComponents(status);
  const isBusy = downloading || saving || installingRuntime;
  const platformLabel = getPlatformLabel(status?.platform);
  const runtimeChecklist = buildRuntimeChecklist(status);

  return (
    <section aria-hidden={!visible} className={cn("space-y-5", !visible && "hidden")}>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold">Whisper 设置</h3>
        <p className="text-sm text-muted-foreground">
          连接本机 helper，读取当前电脑上的 Whisper/ffmpeg/模型配置。
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border/60 bg-card/70 py-14">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <WhisperRuntimeSection
            helperConnected={helperConnected}
            platformLabel={platformLabel}
            runtimeChecklist={runtimeChecklist}
            status={status}
            installComponentsCount={installComponents.length}
            installingRuntime={installingRuntime}
            showManualCommands={showManualCommands}
            installProgress={installProgress}
            onInstallRuntime={handleInstallRuntime}
            onToggleManualCommands={() => setShowManualCommands((prev) => !prev)}
          />

          <WhisperModelSection
            selectedModel={selectedModel}
            modelExists={!!modelExists}
            downloading={downloading}
            isBusy={isBusy}
            helperConnected={helperConnected}
            whisperInstalled={!!status?.whisperInstalled}
            downloadProgress={downloadProgress}
            onModelSelect={handleModelSelect}
            onDownloadModel={handleDownloadModel}
          />

          <WhisperAdvancedSection
            showAdvanced={showAdvanced}
            config={config}
            selectedModel={selectedModel}
            helperConnected={helperConnected}
            isBusy={isBusy}
            platform={status?.platform}
            onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
            onResetProjectPaths={handleResetProjectPaths}
            onConfigChange={handleConfigChange}
          />

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={saving || isBusy}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving || loading || !helperConnected}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存 Whisper 配置"
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
