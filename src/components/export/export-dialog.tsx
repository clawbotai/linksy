'use client';

import * as React from 'react';
import { ExternalLink, Loader2, NotebookPen, Send, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ToastManager } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { executeExport, fetchExportProviders, testExportProvider } from '@/lib/export-client';
import type { ExportProviderId, ExportProviderMeta } from '@/types';
import type { SettingsSection } from '@/components/whisper-settings';
import type { TranscriptionRecord } from '@/types/transcription-history';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: TranscriptionRecord;
  onRecordPatch: (patch: Partial<TranscriptionRecord>) => void;
  onOpenSettings: (section?: SettingsSection) => void;
}

function statusTone(status?: 'success' | 'failed') {
  if (status === 'success') {
    return 'bg-green-500/10 text-green-700 dark:text-green-300';
  }
  if (status === 'failed') {
    return 'bg-red-500/10 text-red-700 dark:text-red-300';
  }
  return 'bg-muted text-muted-foreground';
}

function providerIcon(providerId: ExportProviderId) {
  if (providerId === 'obsidian') {
    return <NotebookPen className="h-4 w-4" />;
  }
  return <Send className="h-4 w-4" />;
}

function formatExportedAt(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function ExportDialog({
  open,
  onOpenChange,
  record,
  onRecordPatch,
  onOpenSettings,
}: ExportDialogProps) {
  const [providers, setProviders] = React.useState<ExportProviderMeta[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeProviderId, setActiveProviderId] = React.useState<ExportProviderId>('ima');
  const [testingProviderId, setTestingProviderId] = React.useState<ExportProviderId | null>(null);
  const [exportingProviderId, setExportingProviderId] = React.useState<ExportProviderId | null>(null);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [testFeedback, setTestFeedback] = React.useState<Partial<Record<ExportProviderId, string>>>({});

  React.useEffect(() => {
    if (!open) {
      return;
    }

    let disposed = false;
    const loadProviders = async () => {
      setLoading(true);
      try {
        const nextProviders = await fetchExportProviders();
        if (disposed) {
          return;
        }
        setProviders(nextProviders);
        setActiveProviderId((prev) => (
          nextProviders.some((provider) => provider.id === prev)
            ? prev
            : (nextProviders[0]?.id ?? 'ima')
        ));
      } catch (error) {
        if (!disposed) {
          setToast({
            message: error instanceof Error ? error.message : '读取导出平台失败',
            type: 'error',
          });
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void loadProviders();

    return () => {
      disposed = true;
    };
  }, [open]);

  const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? null;
  const exportState = record.exportState?.[activeProviderId];
  const canExport = record.status === 'completed';

  const handleOpenSettings = () => {
    onOpenChange(false);
    onOpenSettings('export');
  };

  const handleTest = async (providerId: ExportProviderId) => {
    setTestingProviderId(providerId);
    setTestFeedback((prev) => ({ ...prev, [providerId]: '' }));

    try {
      const result = await testExportProvider(providerId);
      setTestFeedback((prev) => ({ ...prev, [providerId]: result.message }));
      setToast({ message: result.message, type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '测试导出连接失败';
      setTestFeedback((prev) => ({ ...prev, [providerId]: message }));
      setToast({ message, type: 'error' });
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleExport = async (providerId: ExportProviderId) => {
    setExportingProviderId(providerId);

    try {
      const result = await executeExport(record.id, { providerId });
      onRecordPatch({
        exportState: {
          ...(record.exportState || {}),
          [providerId]: {
            status: result.status,
            exportedAt: result.exportedAt,
            targetRef: result.targetRef,
            errorMessage: result.errorMessage,
          },
        },
      });
      setToast({ message: result.message || '导出成功', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败';
      onRecordPatch({
        exportState: {
          ...(record.exportState || {}),
          [providerId]: {
            status: 'failed',
            exportedAt: new Date().toISOString(),
            errorMessage: message,
          },
        },
      });
      setToast({ message, type: 'error' });
    } finally {
      setExportingProviderId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>导出转录</DialogTitle>
            <DialogDescription>
              将当前转录导出到外部笔记平台。第一版支持 IMA 与 Obsidian。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
              {providers.map((provider) => {
                const selected = provider.id === activeProviderId;
                const state = record.exportState?.[provider.id];

                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setActiveProviderId(provider.id)}
                    className={cn(
                      'w-full rounded-xl border px-3 py-3 text-left transition-all',
                      selected
                        ? 'border-primary bg-primary/8 shadow-sm shadow-primary/10'
                        : 'border-border/60 bg-background/75 hover:border-primary/35 hover:bg-accent/20',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {providerIcon(provider.id)}
                        {provider.name}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px]',
                          provider.configured
                            ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                        )}
                      >
                        {provider.configured ? '已配置' : '未配置'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{provider.description}</p>
                    {state && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={cn('rounded-full px-2 py-0.5', statusTone(state.status))}>
                          {state.status === 'success' ? '最近成功' : '最近失败'}
                        </span>
                        {state.exportedAt && (
                          <span className="text-muted-foreground">{formatExportedAt(state.exportedAt)}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-border/60 bg-card/70 p-4">
              {loading ? (
                <div className="flex min-h-[280px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeProvider ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-base font-semibold">
                      {providerIcon(activeProvider.id)}
                      <span>{activeProvider.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{activeProvider.description}</p>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-background/75 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          activeProvider.configured
                            ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                        )}
                      >
                        {activeProvider.configured ? '已完成配置' : '需要先配置'}
                      </span>
                      {exportState && (
                        <span className={cn('rounded-full px-2 py-0.5 text-xs', statusTone(exportState.status))}>
                          {exportState.status === 'success' ? '最近导出成功' : '最近导出失败'}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {activeProvider.id === 'ima' ? (
                        <>
                          <p>Client ID：{activeProvider.config.clientId || '未填写'}</p>
                          <p>Folder ID：{activeProvider.config.folderId || '默认位置'}</p>
                        </>
                      ) : (
                        <>
                          <p>Vault：{activeProvider.config.vaultPath || '未填写'}</p>
                          <p>目标目录：{activeProvider.config.targetFolder || 'Vault 根目录'}</p>
                          <p>CLI：{activeProvider.config.cliPath || 'PATH 中的 obsidian'}</p>
                        </>
                      )}

                      {exportState?.targetRef && (
                        <div className="flex items-center gap-2 break-all text-xs text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>{exportState.targetRef}</span>
                        </div>
                      )}

                      {exportState?.errorMessage && exportState.status === 'failed' && (
                        <p className="text-xs text-destructive">{exportState.errorMessage}</p>
                      )}

                      {testFeedback[activeProvider.id] && (
                        <p className="text-xs text-muted-foreground">{testFeedback[activeProvider.id]}</p>
                      )}
                    </div>
                  </div>

                  {!canExport && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                      当前转录尚未完成，完成后才可导出。
                    </div>
                  )}

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={handleOpenSettings}>
                      <Settings2 className="mr-2 h-4 w-4" />
                      打开导出设置
                    </Button>

                    {activeProvider.configured && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleTest(activeProvider.id)}
                        disabled={testingProviderId === activeProvider.id}
                      >
                        {testingProviderId === activeProvider.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            测试中
                          </>
                        ) : (
                          '测试连接'
                        )}
                      </Button>
                    )}

                    <Button
                      type="button"
                      onClick={() => void handleExport(activeProvider.id)}
                      disabled={!activeProvider.configured || !canExport || exportingProviderId === activeProvider.id}
                    >
                      {exportingProviderId === activeProvider.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          导出中
                        </>
                      ) : (
                        '立即导出'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                  暂无可用导出平台
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {toast && (
        <ToastManager
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
