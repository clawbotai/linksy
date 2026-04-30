'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Clock, Copy, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardHeader } from '@/components/ui/card';
import { FlowLoader } from '@/components/ui/flow-loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranscriptionMindMap } from '@/components/transcription-mindmap';
import type { TranscribeSegment } from '@/types';
import type { TranscriptionRecord } from '@/types/transcription-history';
import { formatWhisperTimestamp } from '@/lib/utils';

type DetailTabValue = 'transcript' | 'mindmap';

interface TranscriptionDetailTabsProps {
  connected: boolean;
  isActive: boolean;
  liveRecord: TranscriptionRecord;
  onScrollToBottomReady: (fn: () => void) => void;
  onRecordPatch: (patch: Partial<TranscriptionRecord>) => void;
  segments: TranscribeSegment[];
  status: string;
  statusText: Record<string, string>;
}

function ReservedPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-1 items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 px-6 py-10 text-center">
      <div className="max-w-md space-y-2">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function TranscriptTabPanel({
  connected,
  isActive,
  liveRecord,
  onScrollToBottomReady,
  segments,
  status,
  statusText,
}: TranscriptionDetailTabsProps) {
  const [copied, setCopied] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 向父组件注册 scrollToBottom，使 SSE onmessage 可主动触发滚动
  useEffect(() => {
    const scrollToBottom = () => {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    };
    onScrollToBottomReady(scrollToBottom);
  }, [onScrollToBottomReady]);

  // 当 segments 或 transcript 变化时自动滚动到底部
  useEffect(() => {
    if (segments.length > 0 || liveRecord.transcript) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [segments.length, liveRecord.transcript]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(event.target as Node)) {
        setCopyMenuOpen(false);
      }
    };

    if (copyMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [copyMenuOpen]);

  const handleCopy = async (withTimestamp: boolean) => {
    const textToCopy = segments.length > 0
      ? segments
          .map((seg) => withTimestamp ? `[${seg.timestamp}] ${seg.text}` : seg.text)
          .join('\n')
      : liveRecord.transcript || '';

    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setCopyMenuOpen(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {segments.length} 片段
          </Badge>
          {isActive && connected && (
            <span className="flex items-center gap-1.5 text-xs text-blue-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
              实时更新中
            </span>
          )}
        </div>

        {(segments.length > 0 || liveRecord.transcript) && (
          <div className="relative shrink-0" ref={copyMenuRef}>
            <button
              onClick={() => setCopyMenuOpen((prev) => !prev)}
              className="flex items-center gap-0.5 rounded-md border border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="复制选项"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span>复制</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {copyMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-popover py-1 shadow-lg">
                <button
                  onClick={() => handleCopy(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>纯文本</span>
                </button>
                <button
                  onClick={() => handleCopy(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>带时间戳</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex h-full min-h-0 flex-1 flex-col">
        {segments.length > 0 ? (
          <div
            ref={scrollRef}
            className="h-full flex-1 space-y-0 overflow-y-auto scroll-smooth pr-2"
          >
            {segments.map((seg, idx) => (
              <div
                key={idx}
                className="flex items-baseline gap-4 border-b border-border/30 py-2.5 last:border-b-0"
              >
                <span className="w-11 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatWhisperTimestamp(seg.timestamp)}
                </span>
                <span className="flex-1 text-sm leading-relaxed">{seg.text}</span>
              </div>
            ))}

            {isActive && (
              <div className="flex items-center gap-3 py-3">
                <span className="w-11 shrink-0" />
                <FlowLoader size="sm" />
                <span className="text-xs text-muted-foreground">转录中…</span>
              </div>
            )}
          </div>
        ) : liveRecord.transcript ? (
          <div
            ref={scrollRef}
            className="h-full flex-1 overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-relaxed"
          >
            {liveRecord.transcript}
          </div>
        ) : (
          <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            {isActive ? (
              <>
                <FlowLoader size="md" />
                <p className="text-sm">
                  {statusText[status] ?? '处理中'}，转录内容将实时出现…
                </p>
              </>
            ) : (
              <p className="text-sm">暂无转录内容</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MindmapTabPanel({
  liveRecord,
  onRecordPatch,
}: Pick<TranscriptionDetailTabsProps, 'liveRecord' | 'onRecordPatch'>) {
  return <TranscriptionMindMap record={liveRecord} onRecordPatch={onRecordPatch} />;
}

export function TranscriptionDetailTabs(props: TranscriptionDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<DetailTabValue>('transcript');

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as DetailTabValue)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <CardHeader className="shrink-0 pb-3">
        <TabsList className="grid h-auto w-fit grid-cols-2">
          <TabsTrigger value="transcript">转录逐字稿</TabsTrigger>
          <TabsTrigger value="mindmap">思维导图</TabsTrigger>
        </TabsList>
      </CardHeader>

      <CardContent className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0 px-4 pb-4 lg:px-6 lg:pb-6">
        <TabsContent value="transcript" className="mt-0 flex h-full min-h-0 flex-1 flex-col border-0 bg-transparent p-0 data-[state=inactive]:hidden">
          <TranscriptTabPanel {...props} />
        </TabsContent>

        <TabsContent value="mindmap" className="mt-0 flex h-full min-h-0 flex-1 flex-col border-0 bg-transparent p-0 data-[state=inactive]:hidden">
          <MindmapTabPanel liveRecord={props.liveRecord} onRecordPatch={props.onRecordPatch} />
        </TabsContent>
      </CardContent>
    </Tabs>
  );
}
