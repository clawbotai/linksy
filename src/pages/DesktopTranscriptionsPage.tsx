'use client';

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowLoader } from "@/components/ui/flow-loader";
import { History as HistoryIcon } from "lucide-react";
import { deleteTranscriptionRecord, listTranscriptionRecords } from "@/lib/db";
import type { TranscriptionRecord } from "@/types/transcription-history";
import { DesktopTranscriptionCard } from "@/components/DesktopTranscriptionCard";
import { PageScene } from "@/components/PageScene";

export function DesktopTranscriptionsPage() {
  const [records, setRecords] = useState<TranscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const items = await listTranscriptionRecords();
      setRecords(items);
    } catch (error) {
      console.error("加载转录历史失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords(true);
  }, [loadRecords]);

  useEffect(() => {
    const handleFocus = () => loadRecords(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") loadRecords(false);
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadRecords]);

  return (
    <PageScene>
      <div className="space-y-10">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8">
          <div className="relative z-10">
            <h1 className="text-3xl font-semibold tracking-tight">我的转录</h1>
            <p className="mt-2 text-muted-foreground text-base">查看和管理您的转录历史</p>
          </div>
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/20">
            <CardTitle className="text-lg font-semibold">转录历史</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <FlowLoader size="md" />
              </div>
            ) : records.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {records.map((record) => (
                  <DesktopTranscriptionCard
                    key={record.id}
                    record={record}
                    onDeleted={async (recordId) => {
                      await deleteTranscriptionRecord(recordId);
                      setRecords((prev) => prev.filter((r) => r.id !== recordId));
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                  <HistoryIcon className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">暂无转录记录</p>
                <p className="text-muted-foreground text-sm mt-1">开始您的第一次播客转录吧</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageScene>
  );
}
