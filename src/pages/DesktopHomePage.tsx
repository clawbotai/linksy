'use client';

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileSearch, History, Library, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowLoader } from "@/components/ui/flow-loader";
import { listTranscriptionRecords } from "@/lib/db";
import type { TranscriptionRecord } from "@/types/transcription-history";
import { DesktopTranscriptionCard } from "@/components/DesktopTranscriptionCard";
import { PageScene } from "@/components/PageScene";

export function DesktopHomePage() {
  const [recentRecords, setRecentRecords] = useState<TranscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const handleRecordDeleted = useCallback((recordId: string) => {
    setRecentRecords((prev) => prev.filter((record) => record.id !== recordId));
  }, []);

  useEffect(() => {
    const loadRecent = async () => {
      try {
        const records = await listTranscriptionRecords();
        setRecentRecords(records.slice(0, 3));
      } catch (error) {
        console.error("获取最近转录失败:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecent();
  }, []);

  const features = [
    {
      icon: <Mic className="w-5 h-5" />,
      title: "播客转录",
      description: "支持部分播客平台单集链接转录",
      href: "/podcast",
      available: true,
    },
    {
      icon: <History className="w-5 h-5" />,
      title: "转录历史",
      description: "查看和管理所有转录记录",
      href: "/transcriptions",
      available: true,
    },
    {
      icon: <FileSearch className="w-5 h-5" />,
      title: "内容解析",
      description: "智能分析播客内容，提取关键信息",
      href: "#",
      available: false,
    },
    {
      icon: <Library className="w-5 h-5" />,
      title: "知识库",
      description: "整理和管理你的播客知识体系",
      href: "#",
      available: false,
    },
  ];

  return (
    <PageScene>
      <div className="space-y-10">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8">
          <div className="relative z-10">
            <h1 className="text-3xl font-semibold tracking-tight">欢迎使用 Linksy</h1>
            <p className="mt-2 text-muted-foreground text-base">Turn any link into reusable knowledge</p>
          </div>
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div>
          <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">快速入口</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map((feature) => {
              const content = (
                <Card
                  key={feature.title}
                  className={`group relative overflow-hidden transition-all duration-200 ${
                    feature.available ? "cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 card-lift" : "opacity-60"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="flex items-start gap-4 p-5">
                    <div className="shrink-0 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 p-2.5 text-primary shadow-sm shadow-primary/10 group-hover:shadow-md group-hover:shadow-primary/15 transition-shadow">
                      {feature.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{feature.title}</h3>
                        {!feature.available && (
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            即将推出
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );

              if (feature.available) {
                return (
                  <Link key={feature.title} to={feature.href} className="block">
                    {content}
                  </Link>
                );
              }

              return <div key={feature.title}>{content}</div>;
            })}
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">最近转录</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">快速访问您的转录记录</p>
              </div>
              {recentRecords.length > 0 && (
                <Link
                  to="/transcriptions"
                  className="text-sm text-primary font-medium transition-colors hover:text-primary-light hover:underline"
                >
                  查看全部 →
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {loading ? (
              <div className="flex h-24 items-center justify-center">
                <FlowLoader size="md" />
              </div>
            ) : recentRecords.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentRecords.map((record) => (
                  <DesktopTranscriptionCard
                    key={record.id}
                    record={record}
                    onDeleted={handleRecordDeleted}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                  <Mic className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">还没有转录记录</p>
                <p className="text-muted-foreground text-sm mt-1">开始您的第一次播客转录吧</p>
                <Link to="/podcast" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-light hover:underline">
                  开始第一次转录
                  <Mic className="h-4 w-4" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageScene>
  );
}
