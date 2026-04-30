import type { MindMapDocument } from "@/types/mindmap";
import type { TranscriptionRecord } from "@/types/transcription-history";

export type ToastType = "success" | "error" | "info";

export interface ProviderOption {
  providerId: string;
  providerName: string;
  modelId: string;
  label: string;
  model: string;
  value: string;
}

export interface SelectedNodeInfo {
  uid: string;
  text: string;
  left: number;
  top: number;
  isRoot: boolean;
}

export interface OverlayFrame {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TranscriptionMindMapProps {
  record: TranscriptionRecord;
  onRecordPatch: (patch: Partial<TranscriptionRecord>) => void;
}

export function sanitizeFileName(input: string): string {
  return (input || "思维导图")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .trim() || "思维导图";
}

export function serializeOutline(node: MindMapDocument["root"], depth = 0): string[] {
  const prefix = depth === 0 ? "" : `${"  ".repeat(Math.max(0, depth - 1))}- `;
  const lines = [`${prefix}${node.data.text}`];
  const children = Array.isArray(node.children) ? node.children : [];
  children.forEach((child) => {
    lines.push(...serializeOutline(child, depth + 1));
  });
  return lines;
}

export function buildMindMapPath(savedPath?: string): string | undefined {
  if (!savedPath) return undefined;
  return `${savedPath.replace(/[\\/]$/, "")}/思维导图.json`;
}

export const topToolbarButtonClass =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium tracking-[0.01em] text-foreground/82 transition-all duration-200 hover:bg-white/90 hover:text-foreground hover:shadow-[0_8px_18px_rgba(21,42,26,0.07)] disabled:cursor-not-allowed disabled:opacity-45";

export const bottomToolbarButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-[15px] border border-transparent bg-transparent text-foreground/72 transition-all duration-200 hover:-translate-y-0.5 hover:border-border/45 hover:bg-white/92 hover:text-foreground hover:shadow-[0_10px_22px_rgba(24,40,26,0.08)]";
