'use client';

import React from "react";
import { createPortal } from "react-dom";
import { FlowLoader } from "@/components/ui/flow-loader";
import { cn } from "@/lib/utils";
import { MindMapGeneratePanel } from "@/components/transcription-mindmap/generate-panel";
import { MindMapViewport } from "@/components/transcription-mindmap/mindmap-viewport";
import { useTranscriptionMindMap } from "@/components/transcription-mindmap/use-transcription-mindmap";
import type { TranscriptionMindMapProps } from "@/components/transcription-mindmap/shared";

export function TranscriptionMindMap(props: TranscriptionMindMapProps) {
  const {
    anchorRef,
    viewportRef,
    canvasRef,
    providers,
    selectedProvider,
    loadingProviders,
    loadingDocument,
    generating,
    saving,
    editMode,
    fullscreen,
    overlayFrame,
    selectedNode,
    toast,
    isCompleted,
    hasMindMap,
    canGenerate,
    shouldRenderPortal,
    setSelectedProvider,
    dismissToast,
    handleGenerate,
    handleCopyOutline,
    handleDownload,
    handleToggleFullscreen,
    handleRenameNode,
    handleAddChildNode,
    handleAddSiblingNode,
    handleDeleteNode,
    handleZoomOut,
    handleZoomIn,
    handleResetZoom,
    handleToggleEditMode,
  } = useTranscriptionMindMap(props);

  if (!isCompleted) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/15 px-8 py-12 text-center">
        <div className="max-w-md space-y-3">
          <h3 className="text-base font-medium">转录完成后可生成思维导图</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            当前任务状态为 {props.record.status === "error" ? "失败" : "处理中"}，请等待转录完成后再生成可编辑脑图。
          </p>
        </div>
      </div>
    );
  }

  if (loadingDocument) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <FlowLoader size="md" />
        <p className="text-sm">正在加载思维导图...</p>
      </div>
    );
  }

  if (!hasMindMap) {
    return (
      <MindMapGeneratePanel
        providers={providers}
        selectedProvider={selectedProvider}
        loadingProviders={loadingProviders}
        canGenerate={canGenerate}
        generating={generating}
        record={props.record}
        toast={toast}
        onProviderChange={setSelectedProvider}
        onGenerate={handleGenerate}
        onDismissToast={dismissToast}
      />
    );
  }

  const viewportNode = (
    <MindMapViewport
      viewportRef={viewportRef}
      canvasRef={canvasRef}
      record={props.record}
      saving={saving}
      generating={generating}
      selectedProvider={selectedProvider}
      editMode={editMode}
      fullscreen={fullscreen}
      selectedNode={selectedNode}
      toast={toast}
      onCopyOutline={handleCopyOutline}
      onGenerate={handleGenerate}
      onRenameNode={handleRenameNode}
      onAddChildNode={handleAddChildNode}
      onAddSiblingNode={handleAddSiblingNode}
      onDeleteNode={handleDeleteNode}
      onDownload={handleDownload}
      onZoomOut={handleZoomOut}
      onZoomIn={handleZoomIn}
      onResetZoom={handleResetZoom}
      onToggleEditMode={handleToggleEditMode}
      onToggleFullscreen={handleToggleFullscreen}
      onDismissToast={dismissToast}
    />
  );

  return (
    <>
      <div
        ref={anchorRef}
        className={cn(
          "relative flex h-full min-h-0 flex-1",
          fullscreen && "pointer-events-none opacity-0",
        )}
      />

      {shouldRenderPortal && createPortal(
        <div className={cn("fixed inset-0", fullscreen ? "z-[120]" : "pointer-events-none z-[60]")}>
          {fullscreen && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(246,250,245,0.96),_rgba(238,244,236,0.98)_38%,_rgba(227,235,225,0.99)_100%)]" />
          )}
          <div
            className={cn(
              "absolute overflow-hidden",
              fullscreen ? "inset-0" : "pointer-events-auto",
            )}
            style={fullscreen ? undefined : {
              top: `${overlayFrame?.top ?? 0}px`,
              left: `${overlayFrame?.left ?? 0}px`,
              width: `${overlayFrame?.width ?? 0}px`,
              height: `${overlayFrame?.height ?? 0}px`,
            }}
          >
            {viewportNode}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
