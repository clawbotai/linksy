'use client';

import type { MindMapDocument } from "@/types/mindmap";
import type { TranscriptionRecord } from "@/types/transcription-history";
import {
  requestLanguageModelText,
  buildMindMapPrompt,
  tryParseJsonBlock,
} from "@/lib/llm-client";

function createDefaultView() {
  return {
    transform: {
      scaleX: 1, scaleY: 1, shear: 0, rotate: 0,
      translateX: 0, translateY: 0, originX: 0, originY: 0,
      a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
    },
    state: { scale: 1, x: 0, y: 0, sx: 0, sy: 0 },
  };
}

function normalizeNode(input: any, fallbackText = "未命名节点") {
  const text = String(input?.data?.text ?? input?.text ?? fallbackText).trim() || fallbackText;
  const childrenSource = Array.isArray(input?.children) ? input.children : [];
  return {
    data: {
      ...(input?.data && typeof input.data === "object" ? input.data : {}),
      text,
      expand: input?.data?.expand !== false,
    },
    children: childrenSource.map((child: any, index: number) => normalizeNode(child, `节点 ${index + 1}`)),
  };
}

export function normalizeMindMapDocument(input: any, fallbackTitle = "思维导图"): MindMapDocument {
  const rootSource = input?.root || input;
  return {
    layout: typeof input?.layout === "string" && input.layout.trim() ? input.layout : "logicalStructure",
    root: normalizeNode(rootSource, fallbackTitle),
    theme: {
      template: input?.theme?.template || "default",
      config: input?.theme?.config && typeof input.theme.config === "object" ? input.theme.config : {},
    },
    view: input?.view && typeof input.view === "object" ? input.view : createDefaultView(),
    config: input?.config && typeof input.config === "object" ? input.config : {},
  };
}

export async function generateMindMapFromRecord(
  record: TranscriptionRecord,
  providerId: string,
  modelId: string,
): Promise<{ document: MindMapDocument; generator: { providerId: string; providerName: string; modelId: string; model: string } }> {
  const transcript = record.transcript || record.segments.map((s) => s.text).join("\n");
  if (!transcript.trim()) throw new Error("转录内容为空，无法生成思维导图");

  const prompt = buildMindMapPrompt(record.title, transcript);
  const result = await requestLanguageModelText(providerId, modelId, prompt, {
    timeoutMs: 120000,
    temperatureCap: 0.6,
  });

  if (!result.text.trim()) throw new Error("模型未返回有效内容");

  const parsed = tryParseJsonBlock(result.text);
  const document = normalizeMindMapDocument(parsed, record.title || "思维导图");
  return {
    document,
    generator: {
      providerId: result.providerName,
      providerName: result.providerName,
      modelId: result.modelId,
      model: result.model,
    },
  };
}

export function getMindMapFromRecord(record: TranscriptionRecord): MindMapDocument | null {
  return record.mindmapDocument ?? null;
}

export interface MindMapResponse {
  document: MindMapDocument;
}

export interface GenerateMindMapRequest {
  providerId: string;
  modelId: string;
}

// 兼容旧接口 — 从 IndexedDB 记录读取
export async function fetchTranscriptionMindMap(_id: string): Promise<MindMapDocument> {
  // 由 useTranscriptionMindMap 直接从 record.mindmapDocument 读取
  throw new Error("请使用 getMindMapFromRecord 从 IndexedDB 读取");
}

// 兼容旧接口 — 使用前端 LLM 生成
export async function generateTranscriptionMindMap(
  _id: string,
  _payload: GenerateMindMapRequest,
): Promise<MindMapDocument> {
  // 由 useTranscriptionMindMap 调用 generateMindMapFromRecord
  throw new Error("请使用 generateMindMapFromRecord 直接调用 LLM");
}

// 兼容旧接口 — 保存到 record
export async function saveTranscriptionMindMap(
  _id: string,
  _document: MindMapDocument,
): Promise<MindMapDocument> {
  // 由 useTranscriptionMindMap 通过 onRecordPatch 保存
  throw new Error("请通过 onRecordPatch 保存到 IndexedDB");
}
