'use client';

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToastManager } from "@/components/ui/toast";
import { useTranscriptionConfig } from "@/hooks/use-transcription-config";
import { LanguageModelSettingsPanel } from "@/components/language-model-settings-panel";
import { Database, Mic, Settings, Trash2 } from "lucide-react";
import { PageScene } from "@/components/PageScene";
import { clearTranscriptionRecords, listTranscriptionRecords } from "@/lib/db";

type SettingsTab = "general" | "transcription" | "language-models";

export function WebSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = (searchParams.get("section") || "general") as SettingsTab;
  const { config, updateOnlineASRConfig } = useTranscriptionConfig();
  const [recordCount, setRecordCount] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    duration?: number;
  } | null>(null);

  useEffect(() => {
    void listTranscriptionRecords().then((records) => setRecordCount(records.length));
  }, []);

  const clearAll = async () => {
    const confirmed = window.confirm("确认清空当前浏览器里的所有转录记录？");
    if (!confirmed) return;
    setClearing(true);
    await clearTranscriptionRecords();
    setRecordCount(0);
    setClearing(false);
  };

  return (
    <PageScene>
      <div className="space-y-6">
        {toast && (
          <ToastManager message={toast.message} type={toast.type} duration={toast.duration} onClose={() => setToast(null)} />
        )}

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8">
          <h1 className="text-3xl font-semibold tracking-tight">设置</h1>
          <p className="mt-2 text-muted-foreground">管理转录引擎、语言模型和浏览器缓存</p>
        </div>

        <Tabs value={section} onValueChange={(v) => setSearchParams({ section: v })}>
          <TabsList className="grid w-fit grid-cols-3">
            <TabsTrigger value="general">
              <Settings className="mr-2 h-4 w-4" />
              通用
            </TabsTrigger>
            <TabsTrigger value="transcription">
              <Mic className="mr-2 h-4 w-4" />
              转录
            </TabsTrigger>
            <TabsTrigger value="language-models">
              <Settings className="mr-2 h-4 w-4" />
              语言模型
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  浏览器缓存
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/25 px-4 py-3 text-sm">
                  当前浏览器 IndexedDB 中共有 <span className="font-semibold">{recordCount}</span> 条转录记录。
                </div>
                <Button type="button" variant="destructive" disabled={clearing || recordCount === 0} onClick={clearAll}>
                  <Trash2 className="h-4 w-4" />
                  {clearing ? "清空中" : "清空全部记录"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcription" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>千问 ASR 在线转录</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Web 版使用千问 ASR 进行在线转录。请配置 DashScope API Key。
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input
                    type="password"
                    value={config.onlineASR.apiKey}
                    onChange={(e) => updateOnlineASRConfig({ apiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base URL</label>
                  <Input
                    value={config.onlineASR.baseUrl}
                    onChange={(e) => updateOnlineASRConfig({ baseUrl: e.target.value })}
                    placeholder="https://dashscope.aliyuncs.com/api/v1"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="language-models" className="mt-6">
            <LanguageModelSettingsPanel visible={section === "language-models"} />
          </TabsContent>
        </Tabs>
      </div>
    </PageScene>
  );
}
