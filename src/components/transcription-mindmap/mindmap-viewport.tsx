'use client';

import React from "react";
import {
  Check,
  Copy,
  Download,
  Edit3,
  FileDown,
  Loader2,
  Maximize2,
  MinusCircle,
  PlusCircle,
  RefreshCcw,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ToastManager } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { TranscriptionRecord } from "@/types/transcription-history";
import {
  bottomToolbarButtonClass,
  topToolbarButtonClass,
  type SelectedNodeInfo,
  type ToastType,
} from "./shared";

interface MindMapViewportProps {
  viewportRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLDivElement>;
  record: TranscriptionRecord;
  saving: boolean;
  generating: boolean;
  selectedProvider: string;
  editMode: boolean;
  fullscreen: boolean;
  selectedNode: SelectedNodeInfo | null;
  toast: { message: string; type: ToastType } | null;
  onCopyOutline: () => void | Promise<void>;
  onGenerate: () => void | Promise<void>;
  onRenameNode: () => void;
  onAddChildNode: () => void;
  onAddSiblingNode: () => void;
  onDeleteNode: () => void;
  onDownload: () => void | Promise<void>;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
  onToggleEditMode: () => void;
  onToggleFullscreen: () => void;
  onDismissToast: () => void;
}

export function MindMapViewport({
  viewportRef,
  canvasRef,
  record,
  saving,
  generating,
  selectedProvider,
  editMode,
  fullscreen,
  selectedNode,
  toast,
  onCopyOutline,
  onGenerate,
  onRenameNode,
  onAddChildNode,
  onAddSiblingNode,
  onDeleteNode,
  onDownload,
  onZoomOut,
  onZoomIn,
  onResetZoom,
  onToggleEditMode,
  onToggleFullscreen,
  onDismissToast,
}: MindMapViewportProps) {
  return (
    <div
      ref={viewportRef}
      className={cn(
        "relative flex h-full min-h-0 w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(244,247,241,0.95)_45%,_rgba(238,244,236,0.98)_100%)]",
        fullscreen && "rounded-none shadow-[0_28px_80px_rgba(20,33,23,0.22)]",
      )}
    >
      <div className="absolute right-5 top-4 z-20 flex items-center gap-0.5 rounded-xl border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(251,252,249,0.72))] p-[3px] shadow-[0_14px_32px_rgba(26,44,30,0.1)] ring-1 ring-black/[0.04] backdrop-blur-2xl">
        <button type="button" onClick={onCopyOutline} className={topToolbarButtonClass}>
          <Copy className="h-[14px] w-[14px]" strokeWidth={1.85} />
          复制
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!selectedProvider || generating}
          className={cn(topToolbarButtonClass, "bg-foreground/[0.04] text-foreground")}
        >
          {generating ? (
            <Loader2 className="h-[14px] w-[14px] animate-spin" />
          ) : (
            <RefreshCcw className="h-[14px] w-[14px]" strokeWidth={1.85} />
          )}
          重新生成
        </button>
      </div>

      {(saving || record.mindmapUpdatedAt) && (
        <div className="absolute left-5 top-4 z-20 rounded-full border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(249,251,247,0.76))] px-2.5 py-1 text-[10px] font-medium tracking-[0.03em] text-muted-foreground shadow-[0_12px_28px_rgba(26,44,30,0.08)] ring-1 ring-black/[0.04] backdrop-blur-2xl">
          {saving ? <span className="text-primary">保存中</span> : <span>已保存</span>}
        </div>
      )}

      {selectedNode && editMode && (
        <div
          className="absolute z-30 -translate-x-1/2 -translate-y-full rounded-xl border border-border/60 bg-background/92 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.16)] backdrop-blur-md"
          style={{
            left: `${Math.max(96, Math.min(selectedNode.left, (viewportRef.current?.clientWidth || 0) - 96))}px`,
            top: `${Math.max(54, selectedNode.top - 14)}px`,
          }}
        >
          <div className="mb-2 max-w-[220px] truncate px-2 text-xs font-medium text-muted-foreground">
            {selectedNode.text}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="rounded-xl p-2 transition-colors hover:bg-muted" onClick={onRenameNode} title="重命名">
              <Type className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-xl p-2 transition-colors hover:bg-muted" onClick={onAddChildNode} title="添加子节点">
              <PlusCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-xl p-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              onClick={onAddSiblingNode}
              disabled={selectedNode.isRoot}
              title="添加同级节点"
            >
              <FileDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-xl p-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              onClick={onDeleteNode}
              disabled={selectedNode.isRoot}
              title="删除节点"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-0.5 rounded-xl border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(248,251,246,0.72))] p-1 shadow-[0_18px_42px_rgba(21,37,23,0.12)] ring-1 ring-black/[0.04] backdrop-blur-2xl">
        <button type="button" className={bottomToolbarButtonClass} onClick={onZoomOut} title="缩小">
          <ZoomOut className="h-4 w-4" strokeWidth={1.9} />
        </button>
        <button type="button" className={bottomToolbarButtonClass} onClick={onZoomIn} title="放大">
          <ZoomIn className="h-4 w-4" strokeWidth={1.9} />
        </button>
        <button type="button" className={bottomToolbarButtonClass} onClick={onResetZoom} title="恢复原尺寸">
          <MinusCircle className="h-4 w-4" strokeWidth={1.9} />
        </button>
        <span className="mx-0.5 h-5 w-px rounded-full bg-gradient-to-b from-transparent via-border/65 to-transparent" />
        <button type="button" className={bottomToolbarButtonClass} onClick={onDownload} title="下载 PNG">
          <Download className="h-4 w-4" strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className={cn(
            bottomToolbarButtonClass,
            editMode && "border-primary/15 bg-primary/[0.08] text-primary shadow-[0_10px_22px_rgba(24,68,39,0.1)]",
          )}
          onClick={onToggleEditMode}
          title={editMode ? "退出编辑" : "编辑"}
        >
          {editMode ? <Check className="h-4 w-4" strokeWidth={1.9} /> : <Edit3 className="h-4 w-4" strokeWidth={1.9} />}
        </button>
        <span className="mx-0.5 h-5 w-px rounded-full bg-gradient-to-b from-transparent via-border/65 to-transparent" />
        <button
          type="button"
          className={cn(bottomToolbarButtonClass, fullscreen && "border-foreground/10 bg-foreground/[0.045] text-foreground")}
          onClick={onToggleFullscreen}
          title={fullscreen ? "退出全屏" : "全屏"}
        >
          <Maximize2 className="h-4 w-4" strokeWidth={1.9} />
        </button>
      </div>

      {toast && (
        <ToastManager
          message={toast.message}
          type={toast.type}
          onClose={onDismissToast}
        />
      )}
    </div>
  );
}
