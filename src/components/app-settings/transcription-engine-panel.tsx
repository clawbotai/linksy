"use client";

import * as React from "react";
import { Check, Eye, EyeOff, Globe, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { testDashScopeConnection } from "@/lib/online-asr-client";
import { cn } from "@/lib/utils";
import { useTranscriptionConfig } from "@/hooks/use-transcription-config";
import { ENGINE_OPTIONS } from "@/components/app-settings/shared";

interface TranscriptionEnginePanelProps {
  visible: boolean;
}

export function TranscriptionEnginePanel({ visible }: TranscriptionEnginePanelProps) {
  const { config, loaded, setActiveEngine, updateOnlineASRConfig } = useTranscriptionConfig();
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(
    null,
  );

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const data = await testDashScopeConnection(config.onlineASR);
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: "连接测试失败" });
    } finally {
      setTesting(false);
    }
  };

  if (!loaded) {
    return (
      <section aria-hidden={!visible} className={cn("space-y-5", !visible && "hidden")}>
        <div className="flex items-center justify-center py-14">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  return (
    <section aria-hidden={!visible} className={cn("space-y-5", !visible && "hidden")}>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold">转录引擎</h3>
        <p className="text-sm text-muted-foreground">
          选择语音识别引擎。本地 Whisper 无需网络但需要安装环境，在线模型只需 API Key。
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm shadow-primary/5">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">选择引擎</h4>
          <div className="grid gap-2.5">
            {ENGINE_OPTIONS.map((engineOpt) => {
              const selected = config.activeEngine === engineOpt.id;

              return (
                <button
                  key={engineOpt.id}
                  type="button"
                  onClick={() => setActiveEngine(engineOpt.id)}
                  className={cn(
                    "relative flex items-center justify-between rounded-xl border p-3.5 text-left transition-all",
                    selected
                      ? "border-primary bg-primary/8 shadow-sm shadow-primary/10"
                      : "border-border/60 bg-background/80 hover:border-primary/35 hover:bg-accent/20",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border",
                        selected
                          ? "border-primary/30 bg-primary/12 text-primary"
                          : "border-border/60 bg-card text-muted-foreground",
                      )}
                    >
                      {engineOpt.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{engineOpt.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {engineOpt.description}
                      </div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {config.activeEngine === "qwen-asr" && (
        <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm shadow-primary/5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">千问 ASR 配置</h4>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">API Key</label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={config.onlineASR.apiKey}
                  onChange={(e) => updateOnlineASRConfig({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                在{" "}
                <a
                  href="https://bailian.console.aliyun.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  阿里云百炼控制台
                </a>{" "}
                获取 DashScope API Key。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">模型</label>
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Qwen3-ASR-Flash-Filetrans</span>
                <span className="ml-auto text-xs text-muted-foreground">长音频转写</span>
              </div>
              <p className="text-xs text-muted-foreground">
                默认使用适合播客场景的长音频异步模型；Web 版会直接从浏览器提交任务并轮询结果。
              </p>
            </div>

            <div className="flex items-center gap-3 border-t border-border/50 pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !config.onlineASR.apiKey}
              >
                {testing ? (
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
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm shadow-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">当前引擎</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                config.activeEngine === "qwen-asr" && config.onlineASR.apiKey
                  ? "bg-green-500"
                  : config.activeEngine === "local-whisper"
                    ? "bg-green-500"
                    : "bg-amber-500",
              )}
            />
            <span className="text-sm text-muted-foreground">
              {config.activeEngine === "qwen-asr"
                ? config.onlineASR.apiKey
                  ? "千问 ASR · 已配置"
                  : "千问 ASR · 未配置 API Key"
                : "本地 Whisper"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
