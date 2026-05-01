'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowLoader } from "@/components/ui/flow-loader";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToastManager } from "@/components/ui/toast";
import { useTranscriptionConfig, getActiveTranscriptionProvider } from "@/hooks/use-transcription-config";
import { getTranscriptionProviderName } from "@/lib/transcription-providers";

import { deleteTranscriptionRecord, listTranscriptionRecords, saveTranscriptionRecord } from "@/lib/db";
import { COMPLETION_TOAST_DURATION_MS, buildCompletionMessage } from "@/lib/utils";
import type { TranscribeSegment } from "@/types";
import type { WebShellContext } from "@/components/WebAppShell";
import type { TranscriptionRecord } from "@/types/transcription-history";
import { DesktopTranscriptionCard } from "@/components/DesktopTranscriptionCard";
import { PageScene } from "@/components/PageScene";

type PodcastAudioInfo = {
  audioUrl: string;
  wordCount: number;
  language: string;
};

const STATUS_STAGE_MAP: Record<string, string> = {
  idle: "准备中...",
  fetching_info: "正在获取播客信息...",
  downloading_audio: "正在下载音频文件...",
  converting: "正在转换音频格式...",
  transcribing: "正在转录中...",
  completed: "转录完成",
  error: "转录失败",
};

function formatTimestamp(ts: string): string {
  const match = ts.match(/\[(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return "00:00";
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseInt(match[3], 10);
  const totalMinutes = hours * 60 + minutes;
  return `${String(totalMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function WebPodcastPage() {
  const { config } = useTranscriptionConfig();
  const activeProvider = getActiveTranscriptionProvider();
  const { openSettings } = useOutletContext<WebShellContext>();
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    duration?: number;
  } | null>(null);
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);
  const [podcastUrl, setPodcastUrl] = useState("");
  const [podcastTranscript, setPodcastTranscript] = useState("");
  const [podcastAudioInfo, setPodcastAudioInfo] = useState<PodcastAudioInfo | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [transcribeStage, setTranscribeStage] = useState("");
  const [transcribeStatus, setTranscribeStatus] = useState("");
  const [liveSegments, setLiveSegments] = useState<TranscribeSegment[]>([]);
  const [transcribeProgress, setTranscribeProgress] = useState<number | null>(null);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const [finalSegments, setFinalSegments] = useState<TranscribeSegment[]>([]);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const transcribeAbortRef = useRef<AbortController | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);
  const transcribeFinishedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLoading = taskId !== null;

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const records = await listTranscriptionRecords();
        setTranscriptionHistory(records);
      } catch (error) {
        console.error("获取转录历史失败:", error);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      void listTranscriptionRecords().then(setTranscriptionHistory).catch(console.error);
    }
  }, [isLoading]);

  useEffect(() => {
    if (scrollRef.current && liveSegments.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveSegments]);

  const cancelActiveRequest = useCallback(() => {
    transcribeAbortRef.current?.abort();
    transcribeAbortRef.current = null;
  }, []);

  const resetActiveTaskState = useCallback(() => {
    transcribeFinishedRef.current = true;
    activeTaskIdRef.current = null;
    cancelActiveRequest();
    setTaskId(null);
    setPodcastTranscript("");
    setPodcastAudioInfo(null);
    setLiveSegments([]);
    setTranscribeProgress(null);
    setTranscribeStage("");
    setTranscribeStatus("");
    setEpisodeTitle("");
    setSavedPath("");
    setFinalSegments([]);
  }, [cancelActiveRequest]);

  useEffect(() => {
    return () => {
      transcribeFinishedRef.current = true;
      activeTaskIdRef.current = null;
      cancelActiveRequest();
    };
  }, [cancelActiveRequest]);

  const handlePodcastTranscribe = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!podcastUrl.trim() || isLoading) return;

      const normalizedPodcastUrl = podcastUrl.trim();

      setPodcastTranscript("");
      setPodcastAudioInfo(null);
      setLiveSegments([]);
      setTranscribeProgress(null);
      setTranscribeStage("");
      setTranscribeStatus("");
      setEpisodeTitle("");
      setSavedPath("");
      setFinalSegments([]);
      setCompletionNotice(null);
      transcribeFinishedRef.current = false;
      activeTaskIdRef.current = null;
      cancelActiveRequest();

      try {
        // Web 版只支持在线 ASR，检查 API Key
        if (!activeProvider?.apiKey?.trim()) {
          openSettings("transcription");
          setToast({
            message: `已为你打开「转录」设置；请先填写${activeProvider ? getTranscriptionProviderName(activeProvider) : "ASR"} API Key，再重新点击转录。`,
            type: "error",
            duration: 6000,
          });
          return;
        }

        const controller = new AbortController();
        transcribeAbortRef.current = controller;
        const newTaskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        transcribeFinishedRef.current = false;
        activeTaskIdRef.current = newTaskId;
        setTaskId(newTaskId);
        setTranscribeStage(STATUS_STAGE_MAP.fetching_info);
        setTranscribeStatus("fetching_info");

        // 通过 Vercel Serverless API 提交转录任务
        const submitRes = await fetch("/api/transcriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: normalizedPodcastUrl,
            apiKey: activeProvider!.apiKey,
            baseUrl: activeProvider!.baseUrl,
            modelName: activeProvider!.modelName,
            enableITN: activeProvider!.enableITN,
          }),
          signal: controller.signal,
        });

        if (!submitRes.ok) {
          const errBody = await submitRes.json().catch(() => null);
          throw new Error(errBody?.error || `提交转录任务失败 (${submitRes.status})`);
        }

        const submitData = await submitRes.json();
        if (!submitData.success) {
          throw new Error(submitData.error || "提交转录任务失败");
        }

        const { dashScopeTaskId, title: episodeTitleFromApi, audioUrl: audioUrlFromApi, duration: durationFromApi } = submitData.data;
        if (activeTaskIdRef.current !== newTaskId) return;

        setEpisodeTitle(episodeTitleFromApi || "");
        setPodcastAudioInfo({ audioUrl: audioUrlFromApi, wordCount: 0, language: "zh" });
        setTranscribeStage("正在转录中...");
        setTranscribeStatus("transcribing");
        setTranscribeProgress(20);

        // 轮询 DashScope 任务状态
        const pollBaseUrl = (activeProvider!.baseUrl || "https://dashscope.aliyuncs.com/api/v1").replace(/\/$/, "");
        let progress = 20;

        const pollResult = await new Promise<{ transcript: string; segments: Array<{ timestamp: string; text: string }>; wordCount: number; language: string }>((resolve, reject) => {
          const intervalId = setInterval(async () => {
            try {
              if (controller.signal.aborted) {
                clearInterval(intervalId);
                reject(new DOMException("Aborted", "AbortError"));
                return;
              }

              const statusUrl = `/api/transcriptions/${encodeURIComponent(dashScopeTaskId)}/status?baseUrl=${encodeURIComponent(pollBaseUrl)}`;
              const statusRes = await fetch(statusUrl, {
                headers: { Authorization: `Bearer ${activeProvider!.apiKey}` },
                signal: controller.signal,
              });

              if (!statusRes.ok) {
                clearInterval(intervalId);
                const errBody = await statusRes.json().catch(() => null);
                reject(new Error(errBody?.message || `查询任务状态失败 (${statusRes.status})`));
                return;
              }

              const statusData = await statusRes.json();

              if (statusData.status === "running") {
                if (activeTaskIdRef.current !== newTaskId) {
                  clearInterval(intervalId);
                  return;
                }
                progress = Math.min(85, progress + 5);
                setTranscribeProgress(progress);
                setTranscribeStage(STATUS_STAGE_MAP.transcribing);
              } else if (statusData.status === "completed") {
                clearInterval(intervalId);
                resolve(statusData.result);
              } else if (statusData.status === "error") {
                clearInterval(intervalId);
                reject(new Error(statusData.message || "转录失败"));
              } else if (statusData.status === "canceled") {
                clearInterval(intervalId);
                reject(new Error("转录任务已取消"));
              }
            } catch (err) {
              if (err instanceof DOMException && err.name === "AbortError") {
                clearInterval(intervalId);
                reject(err);
              }
              // For other fetch errors during polling, just let the next interval retry
            }
          }, 3000);

          // Listen for abort to clear interval
          controller.signal.addEventListener("abort", () => {
            clearInterval(intervalId);
            reject(new DOMException("Aborted", "AbortError"));
          });
        });

        if (activeTaskIdRef.current !== newTaskId) return;

        transcribeFinishedRef.current = true;
        activeTaskIdRef.current = null;
        setPodcastTranscript(pollResult.transcript);
        setPodcastAudioInfo({
          audioUrl: audioUrlFromApi,
          wordCount: pollResult.wordCount,
          language: pollResult.language,
        });
        setFinalSegments(pollResult.segments);
        setLiveSegments(pollResult.segments);

        const record: TranscriptionRecord = {
          id: newTaskId,
          taskId: newTaskId,
          title: episodeTitleFromApi || "未知标题",
          status: "completed",
          progress: 100,
          segments: pollResult.segments,
          transcript: pollResult.transcript,
          wordCount: pollResult.wordCount,
          audioUrl: audioUrlFromApi,
          language: pollResult.language,
          duration: durationFromApi,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await saveTranscriptionRecord(record);
        setTranscriptionHistory((prev) => [record, ...prev.filter((r) => r.id !== newTaskId)]);

        setTaskId(null);
        setTranscribeProgress(null);
        transcribeAbortRef.current = null;
        setCompletionNotice(buildCompletionMessage());
        setToast({ message: "转录完成", type: "success", duration: COMPLETION_TOAST_DURATION_MS });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        console.error("Podcast transcription error:", error);
        setToast({ message: error instanceof Error ? error.message : "网络错误，请检查连接", type: "error" });
        transcribeFinishedRef.current = true;
        activeTaskIdRef.current = null;
        transcribeAbortRef.current = null;
        setTaskId(null);
      }
    },
    [cancelActiveRequest, activeProvider, config.activeEngine, isLoading, openSettings, podcastUrl],
  );

  const handleRecordDeleted = useCallback(
    async (recordId: string) => {
      await deleteTranscriptionRecord(recordId);
      setTranscriptionHistory((prev) => prev.filter((r) => r.id !== recordId));
      if (taskId === recordId || activeTaskIdRef.current === recordId) {
        resetActiveTaskState();
        setToast({ message: "转录任务已删除", type: "info" });
      }
    },
    [resetActiveTaskState, taskId],
  );

  const getButtonLabel = () => {
    if (!isLoading) return "开始转录";
    switch (transcribeStatus) {
      case "fetching_info": return "获取信息中...";
      case "downloading_audio": return "下载音频中...";
      case "converting": return "转换格式中...";
      case "transcribing": return "转录中...";
      default: return "处理中...";
    }
  };

  return (
    <PageScene>
      <div className="space-y-10">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8">
          <div className="relative z-10">
            <h1 className="text-3xl font-semibold tracking-tight">播客转录</h1>
            <p className="mt-2 text-muted-foreground text-base">粘贴音频直链、Apple Podcasts 单集或 RSS 链接，自动转录为文字</p>
          </div>
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
        </div>

        {toast && (
          <ToastManager message={toast.message} type={toast.type} duration={toast.duration} onClose={() => setToast(null)} />
        )}

        <Card className="relative z-[1] overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/20">
            <div>
              <CardTitle className="text-lg font-semibold">开始转录</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">优先使用音频直链；Apple Podcasts 与 RSS 会尝试自动解析音频地址</p>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handlePodcastTranscribe} className="space-y-5">
              <div>
                <label htmlFor="podcast-url" className="mb-2.5 block text-sm font-medium">
                  播客链接或音频直链
                </label>
                <div className="flex gap-2.5">
                  <Input
                    id="podcast-url"
                    type="text"
                    placeholder="粘贴音频直链、Apple Podcasts 单集或 RSS 链接"
                    value={podcastUrl}
                    onChange={(e) => setPodcastUrl(e.target.value)}
                    className="flex-1 h-11 text-base"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    className="h-11 px-6 bg-gradient-to-r from-primary to-primary-light transition-all hover:from-primary hover:to-primary-light hover:shadow-md hover:shadow-primary/20 font-medium"
                    disabled={isLoading || !podcastUrl.trim()}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <FlowLoader size="sm" />
                        {getButtonLabel()}
                      </span>
                    ) : (
                      <span>开始转录</span>
                    )}
                  </Button>
                </div>
                <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
                  通过服务端代理调用 ASR 在线转录，支持音频直链、Apple Podcasts 单集、小宇宙及 RSS 链接。
                </p>
              </div>
            </form>

            {completionNotice && (
              <div className="mt-5 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-300">
                {completionNotice}
              </div>
            )}

            {isLoading && (
              <div className="mt-8 space-y-5">
                <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-4">
                  <div className="relative">
                    <FlowLoader size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{transcribeStage}</span>
                    {episodeTitle && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">{episodeTitle}</p>
                    )}
                  </div>
                </div>

                {transcribeStatus === "transcribing" && transcribeProgress !== null && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                      <span>转录进度</span>
                      <span className="text-primary">{transcribeProgress}%</span>
                    </div>
                    <Progress value={transcribeProgress} className="h-2" />
                  </div>
                )}

                {liveSegments.length > 0 && (
                  <div ref={scrollRef} className="max-h-[500px] overflow-y-auto rounded-xl border border-border/50 bg-muted/30 p-4">
                    <div className="space-y-3">
                      {liveSegments.map((segment, index) => (
                        <div key={index} className="flex items-baseline gap-6 border-b border-border/30 pb-3 last:border-b-0 last:pb-0">
                          <span className="w-14 shrink-0 font-mono text-sm tabular-nums text-primary font-medium">
                            {formatTimestamp(segment.timestamp)}
                          </span>
                          <span className="text-base leading-relaxed">{segment.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isLoading && (podcastTranscript || podcastAudioInfo) && (
              <div className="mt-8 space-y-5">
                {podcastAudioInfo && (
                  <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border/40 bg-muted/20">
                      <CardTitle className="flex items-center justify-between">
                        <span className="text-lg font-semibold">{episodeTitle || "音频信息"}</span>
                        <div className="flex gap-2">
                          <Badge variant="secondary" className="font-medium">{podcastAudioInfo.language}</Badge>
                          <Badge variant="outline" className="font-medium">{podcastAudioInfo.wordCount} 字</Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                      <div className="space-y-4">
                        <div className="rounded-xl bg-muted/40 p-5">
                          <audio controls className="w-full rounded-lg">
                            <source src={podcastAudioInfo.audioUrl} type="audio/mpeg" />
                            您的浏览器不支持音频元素。
                          </audio>
                        </div>
                        {savedPath && (
                          <p className="text-xs text-muted-foreground font-mono bg-muted/30 inline-block px-3 py-1.5 rounded-lg">
                            {savedPath}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {podcastTranscript && (
                  <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border/40 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold">转录内容</CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(podcastTranscript);
                            setToast({ message: "已复制到剪贴板", type: "success" });
                          }}
                          className="font-medium"
                        >
                          复制全文
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5">
                      <Tabs defaultValue="timestamped" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                          <TabsTrigger value="timestamped" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium">逐字稿</TabsTrigger>
                          <TabsTrigger value="plain" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium">纯文本</TabsTrigger>
                        </TabsList>
                        <TabsContent value="timestamped" className="mt-5">
                          <div className="space-y-3">
                            {finalSegments.length > 0 ? (
                              finalSegments.map((segment, index) => (
                                <div key={index} className="flex items-baseline gap-6 border-b border-border/30 pb-3 last:border-b-0 last:pb-0">
                                  <span className="w-14 shrink-0 font-mono text-sm tabular-nums text-primary font-medium">
                                    {formatTimestamp(segment.timestamp)}
                                  </span>
                                  <span className="text-base leading-relaxed">{segment.text}</span>
                                </div>
                              ))
                            ) : (
                              <div className="whitespace-pre-wrap text-base leading-relaxed">{podcastTranscript}</div>
                            )}
                          </div>
                        </TabsContent>
                        <TabsContent value="plain" className="mt-5">
                          <div className="whitespace-pre-wrap text-base leading-relaxed">{podcastTranscript}</div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/20">
            <CardTitle className="text-lg font-semibold">转录历史</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {historyLoading ? (
              <div className="flex h-32 items-center justify-center">
                <FlowLoader size="md" />
              </div>
            ) : transcriptionHistory.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {transcriptionHistory.map((record) => (
                  <DesktopTranscriptionCard key={record.id} record={record} onDeleted={handleRecordDeleted} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">暂无转录历史</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageScene>
  );
}
