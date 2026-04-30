"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2, NotebookPen, Save, TestTubeDiagonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fetchExportConfig,
  saveExportProviderConfig,
  testExportProvider,
} from "@/lib/export-client";
import type { ExportConfigResponse } from "@/types";

interface ExportIntegrationsPanelProps {
  visible: boolean;
}

type ProviderFeedback = {
  success: boolean;
  message: string;
} | null;

const INITIAL_CONFIG: ExportConfigResponse = {
  providers: {
    ima: {
      clientId: "",
      apiKeyConfigured: false,
      folderId: "",
      updatedAt: null,
      configured: false,
    },
    obsidian: {
      cliPath: "",
      vaultPath: "",
      targetFolder: "",
      updatedAt: null,
      configured: false,
    },
  },
};

function FeedbackText({ feedback }: { feedback: ProviderFeedback }) {
  if (!feedback) {
    return null;
  }

  return (
    <span
      className={cn(
        "text-xs",
        feedback.success ? "text-green-600 dark:text-green-400" : "text-destructive",
      )}
    >
      {feedback.message}
    </span>
  );
}

function UpdatedAtText({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-xs text-muted-foreground">尚未保存</span>;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return <span className="text-xs text-muted-foreground">最近更新：{value}</span>;
  }

  return (
    <span className="text-xs text-muted-foreground">
      最近更新：{date.toLocaleString()}
    </span>
  );
}

export function ExportIntegrationsPanel({ visible }: ExportIntegrationsPanelProps) {
  const [config, setConfig] = React.useState<ExportConfigResponse>(INITIAL_CONFIG);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [savingProviderId, setSavingProviderId] = React.useState<"ima" | "obsidian" | null>(null);
  const [testingProviderId, setTestingProviderId] = React.useState<"ima" | "obsidian" | null>(null);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [imaApiKeyInput, setImaApiKeyInput] = React.useState("");
  const [feedback, setFeedback] = React.useState<Record<"ima" | "obsidian", ProviderFeedback>>({
    ima: null,
    obsidian: null,
  });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const next = await fetchExportConfig();
      setConfig(next);
      setImaApiKeyInput("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "读取导出配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (visible) {
      void loadData();
    }
  }, [loadData, visible]);

  const handleSaveIma = async () => {
    setSavingProviderId("ima");
    setFeedback((prev) => ({ ...prev, ima: null }));

    try {
      const result = await saveExportProviderConfig("ima", {
        clientId: config.providers.ima.clientId,
        folderId: config.providers.ima.folderId,
        ...(imaApiKeyInput ? { apiKey: imaApiKeyInput } : {}),
      });
      setConfig((prev) => ({
        providers: {
          ...prev.providers,
          ima: result.config as ExportConfigResponse["providers"]["ima"],
        },
      }));
      setImaApiKeyInput("");
      setFeedback((prev) => ({
        ...prev,
        ima: { success: true, message: "IMA 配置已保存" },
      }));
    } catch (error) {
      setFeedback((prev) => ({
        ...prev,
        ima: { success: false, message: error instanceof Error ? error.message : "保存 IMA 配置失败" },
      }));
    } finally {
      setSavingProviderId(null);
    }
  };

  const handleSaveObsidian = async () => {
    setSavingProviderId("obsidian");
    setFeedback((prev) => ({ ...prev, obsidian: null }));

    try {
      const result = await saveExportProviderConfig("obsidian", config.providers.obsidian);
      setConfig((prev) => ({
        providers: {
          ...prev.providers,
          obsidian: result.config as ExportConfigResponse["providers"]["obsidian"],
        },
      }));
      setFeedback((prev) => ({
        ...prev,
        obsidian: { success: true, message: "Obsidian 配置已保存" },
      }));
    } catch (error) {
      setFeedback((prev) => ({
        ...prev,
        obsidian: { success: false, message: error instanceof Error ? error.message : "保存 Obsidian 配置失败" },
      }));
    } finally {
      setSavingProviderId(null);
    }
  };

  const handleTest = async (providerId: "ima" | "obsidian") => {
    setTestingProviderId(providerId);
    setFeedback((prev) => ({ ...prev, [providerId]: null }));

    try {
      const result = await testExportProvider(
        providerId,
        providerId === "ima"
          ? {
              clientId: config.providers.ima.clientId,
              folderId: config.providers.ima.folderId,
              ...(imaApiKeyInput ? { apiKey: imaApiKeyInput } : {}),
            }
          : {
              cliPath: config.providers.obsidian.cliPath,
              vaultPath: config.providers.obsidian.vaultPath,
              targetFolder: config.providers.obsidian.targetFolder,
            },
      );
      setFeedback((prev) => ({
        ...prev,
        [providerId]: { success: result.success, message: result.message },
      }));
    } catch (error) {
      setFeedback((prev) => ({
        ...prev,
        [providerId]: { success: false, message: error instanceof Error ? error.message : "测试失败" },
      }));
    } finally {
      setTestingProviderId(null);
    }
  };

  return (
    <section aria-hidden={!visible} className={cn("space-y-5", !visible && "hidden")}>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold">导出集成</h3>
        <p className="text-sm text-muted-foreground">
          管理 MemoFlow 的外部导出目标。当前支持 IMA 笔记与 Obsidian CLI。
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border/60 bg-card/70 py-14">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          {loadError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm shadow-primary/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium">IMA 笔记</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  使用 IMA OpenAPI 导出 Markdown 笔记。
                </p>
              </div>
              <div className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                config.providers.ima.configured
                  ? "bg-green-500/10 text-green-700 dark:text-green-300"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}>
                {config.providers.ima.configured ? "已配置" : "未配置"}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Client ID</label>
                <Input
                  value={config.providers.ima.clientId}
                  onChange={(event) => setConfig((prev) => ({
                    providers: {
                      ...prev.providers,
                      ima: {
                        ...prev.providers.ima,
                        clientId: event.target.value,
                      },
                    },
                  }))}
                  placeholder="输入 IMA Client ID"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">API Key</label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={imaApiKeyInput}
                    onChange={(event) => setImaApiKeyInput(event.target.value)}
                    placeholder={config.providers.ima.apiKeyConfigured ? "已保存 API Key，如需更新请重新输入" : "输入 IMA API Key"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Folder ID（可选）</label>
                <Input
                  value={config.providers.ima.folderId}
                  onChange={(event) => setConfig((prev) => ({
                    providers: {
                      ...prev.providers,
                      ima: {
                        ...prev.providers.ima,
                        folderId: event.target.value,
                      },
                    },
                  }))}
                  placeholder="留空则使用默认位置"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
              <UpdatedAtText value={config.providers.ima.updatedAt} />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleTest("ima")}
                  disabled={testingProviderId === "ima"}
                >
                  {testingProviderId === "ima" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      测试中
                    </>
                  ) : (
                    <>
                      <TestTubeDiagonal className="mr-2 h-4 w-4" />
                      测试连接
                    </>
                  )}
                </Button>
                <Button type="button" onClick={() => void handleSaveIma()} disabled={savingProviderId === "ima"}>
                  {savingProviderId === "ima" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      保存
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="mt-2">
              <FeedbackText feedback={feedback.ima} />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm shadow-primary/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium">Obsidian</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  通过本机 Obsidian CLI 将笔记写入指定 Vault。
                </p>
              </div>
              <div className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                config.providers.obsidian.configured
                  ? "bg-green-500/10 text-green-700 dark:text-green-300"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}>
                {config.providers.obsidian.configured ? "已配置" : "未配置"}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">CLI 路径（可选）</label>
                <Input
                  value={config.providers.obsidian.cliPath}
                  onChange={(event) => setConfig((prev) => ({
                    providers: {
                      ...prev.providers,
                      obsidian: {
                        ...prev.providers.obsidian,
                        cliPath: event.target.value,
                      },
                    },
                  }))}
                  placeholder="留空则使用 PATH 中的 obsidian"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Vault 路径</label>
                <Input
                  value={config.providers.obsidian.vaultPath}
                  onChange={(event) => setConfig((prev) => ({
                    providers: {
                      ...prev.providers,
                      obsidian: {
                        ...prev.providers.obsidian,
                        vaultPath: event.target.value,
                      },
                    },
                  }))}
                  placeholder="/Users/you/Documents/MyVault"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">目标目录（可选）</label>
                <Input
                  value={config.providers.obsidian.targetFolder}
                  onChange={(event) => setConfig((prev) => ({
                    providers: {
                      ...prev.providers,
                      obsidian: {
                        ...prev.providers.obsidian,
                        targetFolder: event.target.value,
                      },
                    },
                  }))}
                  placeholder="例如 Podcasts/MemoFlow"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
              <UpdatedAtText value={config.providers.obsidian.updatedAt} />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleTest("obsidian")}
                  disabled={testingProviderId === "obsidian"}
                >
                  {testingProviderId === "obsidian" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      测试中
                    </>
                  ) : (
                    <>
                      <NotebookPen className="mr-2 h-4 w-4" />
                      测试连接
                    </>
                  )}
                </Button>
                <Button type="button" onClick={() => void handleSaveObsidian()} disabled={savingProviderId === "obsidian"}>
                  {savingProviderId === "obsidian" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      保存
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="mt-2">
              <FeedbackText feedback={feedback.obsidian} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
