'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TranscriptionDetailTabs } from '@/components/transcription-detail-tabs';
import { FlowLoader } from '@/components/ui/flow-loader';
import { ToastManager } from '@/components/ui/toast';
import type { TranscribeSegment } from '@/types';
import { TranscriptionRecord } from '@/types/transcription-history';
import { useTranscriptionConfig } from '@/hooks/use-transcription-config';
import type { SettingsSection } from '@/components/whisper-settings';
import {
  createHelperEventSource,
  helperRequest,
  isHelperUnavailableError,
} from '@/lib/local-helper-client';
import { upsertCachedTranscriptionRecord } from '@/lib/transcription-browser-cache';
import { COMPLETION_TOAST_DURATION_MS, buildCompletionMessage } from '@/lib/utils';

// scrollToBottom 回调类型：由 TranscriptTabPanel 在挂载后通过 onScrollRefReady 注册给父组件
type ScrollToBottomFn = () => void;

interface TranscriptionDetailProps {
  record: TranscriptionRecord;
  onOpenSettings: (section?: SettingsSection) => void;
}

const STATUS_TEXT: Record<string, string> = {
  idle: '待开始',
  fetching_info: '获取信息中',
  downloading_audio: '下载音频中',
  converting: '转换格式中',
  transcribing: '转录中',
  completed: '已完成',
  error: '出现错误',
};

const STATUS_COLOR: Record<string, string> = {
  completed: 'bg-green-500',
  transcribing: 'bg-blue-500',
  fetching_info: 'bg-yellow-500',
  downloading_audio: 'bg-yellow-500',
  converting: 'bg-yellow-500',
  error: 'bg-red-500',
};

const TranscriptionDetail: React.FC<TranscriptionDetailProps> = ({ record, onOpenSettings }) => {
  const { config } = useTranscriptionConfig();
  const [liveRecord, setLiveRecord] = useState<TranscriptionRecord>(record);
  const [connected, setConnected] = useState(false);
  const [retranscribing, setRetranscribing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    duration?: number;
  } | null>(null);
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);
  // scrollToBottom 由 TranscriptTabPanel 通过 onScrollToBottomReady 注册，父组件持有引用即可
  const scrollToBottomRef = useRef<ScrollToBottomFn | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);
  const previousStatusRef = useRef(record.status);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const closeEventSource = useCallback(() => {
    clearReconnectTimer();
    esRef.current?.close();
    esRef.current = null;
  }, [clearReconnectTimer]);

  const connectToLiveRecord = useCallback((ignoreTerminalSnapshot = false) => {
    if (doneRef.current) return;

    clearReconnectTimer();
    esRef.current?.close();

    const es = createHelperEventSource(`/transcriptions/${record.id}/live`);
    let hasSeenActiveUpdate = false;
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          success?: boolean;
          data?: TranscriptionRecord;
        };

        if (!payload.success || !payload.data) {
          return;
        }

        const nextRecord = payload.data;
        const previousStatus = previousStatusRef.current;
        const isTerminal = nextRecord.status === 'completed' || nextRecord.status === 'error';

        if (ignoreTerminalSnapshot && !hasSeenActiveUpdate && isTerminal) {
          return;
        }

        if (!isTerminal) {
          hasSeenActiveUpdate = true;
        }

        setLiveRecord(nextRecord);
        upsertCachedTranscriptionRecord(nextRecord);
        scrollToBottomRef.current?.();

        if (
          nextRecord.status === 'completed' &&
          previousStatus !== 'completed' &&
          previousStatus !== 'error'
        ) {
          const completionMessage = buildCompletionMessage(nextRecord.transcriptionElapsedMs);
          setCompletionNotice(completionMessage);
          setToast({
            message: completionMessage,
            type: 'success',
            duration: COMPLETION_TOAST_DURATION_MS,
          });
        }

        previousStatusRef.current = nextRecord.status;

        if (isTerminal) {
          doneRef.current = true;
          setConnected(false);
          if (esRef.current === es) {
            esRef.current = null;
          }
          es.close();
        }
      } catch (e) {
        console.error('SSE 解析失败:', e);
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();

      if (esRef.current === es) {
        esRef.current = null;
      }

      if (doneRef.current) {
        return;
      }

      clearReconnectTimer();
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!doneRef.current) {
          connectToLiveRecord(ignoreTerminalSnapshot);
        }
      }, 3000);
    };
  }, [clearReconnectTimer, record.id]);

  // 连接 SSE
  useEffect(() => {
    doneRef.current = false;
    previousStatusRef.current = record.status;
    setCompletionNotice(null);
    connectToLiveRecord();

    return () => {
      doneRef.current = true;
      setConnected(false);
      closeEventSource();
    };
  }, [closeEventSource, connectToLiveRecord]);

  // 重新转录
  const handleRetranscribe = useCallback(async () => {
    setRetranscribing(true);
    try {
      const result = await helperRequest<{ success: boolean; error?: string }>(
        `/transcriptions/${record.id}/retranscribe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
          engine: config.activeEngine,
          onlineASRConfig: config.onlineASR,
          }),
        },
      );
      if (!result.success) {
        console.error('重新转录失败:', result.error);
        setRetranscribing(false);
        return;
      }

      // 重置状态并切回统一的 SSE 重连逻辑
      doneRef.current = false;
      setConnected(false);
      closeEventSource();

      const nextStatus = config.activeEngine === 'qwen-asr' ? 'transcribing' : 'downloading_audio';
      const resetRecord: TranscriptionRecord = {
        ...liveRecord,
        status: nextStatus,
        progress: 0,
        segments: [],
        transcript: '',
        wordCount: undefined,
        language: undefined,
        error: undefined,
        mindmapStatus: 'idle',
        mindmapUpdatedAt: undefined,
        mindmapPath: undefined,
        mindmapError: undefined,
        mindmapGenerator: undefined,
        pointExtractionStatus: 'idle',
        pointExtractionUpdatedAt: undefined,
        pointExtractionError: undefined,
        contentGenerationStatus: 'idle',
        contentGenerationUpdatedAt: undefined,
        contentGenerationError: undefined,
        exportState: undefined,
        updatedAt: new Date(),
      };

      setLiveRecord(resetRecord);
      previousStatusRef.current = nextStatus;
      setCompletionNotice(null);
      upsertCachedTranscriptionRecord(resetRecord);

      connectToLiveRecord(true);
    } catch (error) {
      if (isHelperUnavailableError(error)) {
        console.error('本机 helper 未连接');
      }
      console.error('重新转录请求失败:', error);
    } finally {
      setRetranscribing(false);
    }
  }, [closeEventSource, config, connectToLiveRecord, liveRecord, record.id]);

  const status = liveRecord.status;
  const segments: TranscribeSegment[] = liveRecord.segments ?? [];
  const isActive = status !== 'completed' && status !== 'error';
  const canRetranscribe = (status === 'completed' || status === 'error') && !!record.audioUrl;

  // onScrollToBottomReady：由 TranscriptTabPanel 挂载后回调，注册其内部的 scrollToBottom 函数
  const handleScrollToBottomReady = useCallback((fn: ScrollToBottomFn) => {
    scrollToBottomRef.current = fn;
  }, []);

  const handleRecordPatch = useCallback((patch: Partial<TranscriptionRecord>) => {
    setLiveRecord((prev) => {
      const nextRecord: TranscriptionRecord = {
        ...prev,
        ...patch,
        updatedAt: new Date(),
      };
      upsertCachedTranscriptionRecord(nextRecord);
      return nextRecord;
    });
  }, []);

  return (
    <div className="flex min-h-0 flex-col gap-6 xl:h-full xl:flex-row">
      {/* ── 左侧：音源信息 ── */}
      <div className="flex w-full shrink-0 flex-col gap-4 xl:h-full xl:w-[340px] 2xl:w-[360px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>音频信息</span>
              <Badge
                className={`${STATUS_COLOR[status] ?? 'bg-gray-500'} text-white text-xs`}
              >
                {STATUS_TEXT[status] ?? status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 标题 */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">标题</p>
              <p className="text-sm font-medium leading-snug">{liveRecord.title}</p>
            </div>

            {/* 音频播放器 */}
            {liveRecord.audioUrl && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">音源</p>
                <div className="bg-muted/30 p-3 rounded-xl">
                  <audio controls className="w-full" preload="metadata">
                    <source src={liveRecord.audioUrl} type="audio/mpeg" />
                    您的浏览器不支持音频播放。
                  </audio>
                </div>
              </div>
            )}

            {/* 元信息 */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {liveRecord.wordCount != null && (
                <div>
                  <p className="text-xs text-muted-foreground">字数</p>
                  <p className="font-medium">{liveRecord.wordCount.toLocaleString()}</p>
                </div>
              )}
              {liveRecord.language && (
                <div>
                  <p className="text-xs text-muted-foreground">语言</p>
                  <p className="font-medium">{liveRecord.language}</p>
                </div>
              )}
              {liveRecord.duration != null && (
                <div>
                  <p className="text-xs text-muted-foreground">时长</p>
                  <p className="font-medium">{liveRecord.duration}s</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">片段数</p>
                <p className="font-medium">{segments.length}</p>
              </div>
            </div>

            {/* 进度条 */}
            {isActive && liveRecord.progress != null && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>转录进度</span>
                  <span>{liveRecord.progress}%</span>
                </div>
                <Progress value={liveRecord.progress} className="h-1.5" />
                {!connected && (
                  <div className="flex items-center gap-2 mt-2 text-yellow-600 text-xs">
                    <FlowLoader size="sm" />
                    <span>重新连接中...</span>
                  </div>
                )}
              </div>
            )}

            {completionNotice && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-700 dark:text-green-300">
                {completionNotice}
              </div>
            )}

            {/* 保存路径 */}
            {liveRecord.savedPath && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">保存路径</p>
                <p className="text-xs break-all text-muted-foreground/80 bg-muted/30 p-2 rounded-lg">
                  {liveRecord.savedPath}
                </p>
              </div>
            )}

            {/* 错误信息 */}
            {status === 'error' && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs p-3 rounded-lg">
                {liveRecord.error || '转录失败，请检查网络和音频链接后重试。'}
              </div>
            )}

            {/* 重新转录按钮 */}
            {canRetranscribe && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={retranscribing}
                onClick={handleRetranscribe}
              >
                {retranscribing ? (
                  <>
                    <FlowLoader size="sm" />
                    <span className="ml-2">正在发起重新转录…</span>
                  </>
                ) : (
                  '重新转录'
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 预留卡片 */}
        <Card className="flex-1 min-h-[120px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">扩展信息</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {status === 'completed' ? '可在此添加摘要、关键词等分析结果。' : '转录完成后在此展示更多信息。'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 右侧：逐字稿 ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Card className="flex min-h-[420px] flex-1 flex-col xl:min-h-0">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base">转录详情</CardTitle>
          </CardHeader>
          <TranscriptionDetailTabs
            connected={connected}
            isActive={isActive}
            liveRecord={liveRecord}
            onScrollToBottomReady={handleScrollToBottomReady}
            onRecordPatch={handleRecordPatch}
            segments={segments}
            status={status}
            statusText={STATUS_TEXT}
          />
        </Card>
      </div>

      {toast && (
        <ToastManager
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default TranscriptionDetail;
