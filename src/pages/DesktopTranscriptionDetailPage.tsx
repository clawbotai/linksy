'use client';

import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import TranscriptionDetail from "@/components/transcription-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowLoader } from "@/components/ui/flow-loader";
import { helperRequest } from "@/lib/local-helper-client";
import {
  getCachedTranscriptionRecord,
  mergeCachedTranscriptionHistory,
} from "@/lib/transcription-browser-cache";
import type { TranscriptionRecord } from "@/types/transcription-history";
import type { WebShellContext } from "@/components/WebAppShell";
import { PageScene } from "@/components/PageScene";

export function DesktopTranscriptionDetailPage() {
  const { id = "" } = useParams();
  const { openSettings } = useOutletContext<WebShellContext>();
  const [record, setRecord] = useState<TranscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const loadRecord = async () => {
      try {
        const result = await helperRequest<{
          success: boolean;
          data: TranscriptionRecord;
        }>(`/transcriptions/${id}`);

        if (result.success) {
          const merged = mergeCachedTranscriptionHistory([result.data]);
          setRecord(merged.find((item) => item.id === id) ?? result.data);
        } else {
          setRecord(getCachedTranscriptionRecord(id));
        }
      } catch (error) {
        console.error("加载转录详情失败:", error);
        setRecord(getCachedTranscriptionRecord(id));
      } finally {
        setLoading(false);
      }
    };

    loadRecord();
  }, [id]);

  return (
    <PageScene
      containerClassName="max-w-none"
      contentClassName="h-[calc(100vh-44px)] max-h-[calc(100vh-44px)] overflow-y-auto xl:overflow-hidden px-5 py-5"
    >
      <div className="h-full min-h-0">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>{record?.title ?? "转录任务信息"}</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:overflow-hidden">
            {loading ? (
              <div className="flex min-h-[320px] flex-1 items-center justify-center">
                <div className="text-center">
                  <FlowLoader size="md" />
                  <p className="mt-2 text-muted-foreground">正在加载转录详情...</p>
                </div>
              </div>
            ) : record ? (
              <TranscriptionDetail record={record} onOpenSettings={openSettings} />
            ) : (
              <div className="flex min-h-[320px] flex-1 items-center justify-center">
                <div className="text-center">
                  <h2 className="mb-2 text-xl font-semibold">转录记录不存在</h2>
                  <p className="text-muted-foreground">
                    当前实例未命中记录，且浏览器缓存中也没有该条详情。
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageScene>
  );
}
