'use client';

import type { TranscriptionRecord } from '@/types/transcription-history';

const CACHE_KEY = 'linksy-transcription-history-cache';
const CACHE_RECORD_LIMIT = 100;

function normalizeRecord(record: TranscriptionRecord): TranscriptionRecord {
  return {
    ...record,
    segments: Array.isArray(record.segments) ? record.segments : [],
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    mindmapUpdatedAt: record.mindmapUpdatedAt ? new Date(record.mindmapUpdatedAt) : undefined,
    pointExtractionUpdatedAt: record.pointExtractionUpdatedAt
      ? new Date(record.pointExtractionUpdatedAt)
      : undefined,
    contentGenerationUpdatedAt: record.contentGenerationUpdatedAt
      ? new Date(record.contentGenerationUpdatedAt)
      : undefined,
  };
}

function mergeRecords(records: TranscriptionRecord[]): TranscriptionRecord[] {
  const map = new Map<string, TranscriptionRecord>();

  for (const record of records) {
    const normalized = normalizeRecord(record);
    const existing = map.get(normalized.id);

    if (!existing || normalized.updatedAt.getTime() >= existing.updatedAt.getTime()) {
      map.set(normalized.id, normalized);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}

function toCachedRecord(record: TranscriptionRecord): TranscriptionRecord {
  return {
    id: record.id,
    taskId: record.taskId,
    title: record.title,
    status: record.status,
    progress: record.progress,
    audioUrl: record.audioUrl,
    wordCount: record.wordCount,
    savedPath: record.savedPath,
    transcriptionElapsedMs: record.transcriptionElapsedMs,
    error: record.error,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    language: record.language,
    duration: record.duration,
    mindmapStatus: record.mindmapStatus,
    mindmapUpdatedAt: record.mindmapUpdatedAt,
    mindmapPath: record.mindmapPath,
    mindmapError: record.mindmapError,
    mindmapGenerator: record.mindmapGenerator,
    pointExtractionStatus: record.pointExtractionStatus,
    pointExtractionUpdatedAt: record.pointExtractionUpdatedAt,
    pointExtractionError: record.pointExtractionError,
    contentGenerationStatus: record.contentGenerationStatus,
    contentGenerationUpdatedAt: record.contentGenerationUpdatedAt,
    contentGenerationError: record.contentGenerationError,
    exportState: record.exportState,
    segments: [],
    transcript: undefined,
  };
}

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  );
}

function createStorageCandidate(records: TranscriptionRecord[], limit: number): TranscriptionRecord[] {
  return records.slice(0, limit).map(toCachedRecord);
}

function persistHistory(records: TranscriptionRecord[]): void {
  const candidates = [
    createStorageCandidate(records, CACHE_RECORD_LIMIT),
    createStorageCandidate(records, 50),
    createStorageCandidate(records, 20),
    createStorageCandidate(records, 10),
  ];

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(candidate));
      return;
    } catch (error) {
      lastError = error;
      if (!isQuotaExceededError(error)) {
        console.error('写入转录缓存失败:', error);
        return;
      }
    }
  }

  if (lastError) {
    console.warn('转录缓存已超过浏览器配额，已跳过本次持久化。');
  }
}

export function readCachedTranscriptionHistory(): TranscriptionRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as TranscriptionRecord[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return mergeRecords(parsed.map(normalizeRecord).map(toCachedRecord));
  } catch {
    return [];
  }
}

export function writeCachedTranscriptionHistory(records: TranscriptionRecord[]): TranscriptionRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const merged = mergeRecords(records);
  persistHistory(merged);
  return merged;
}

export function mergeCachedTranscriptionHistory(records: TranscriptionRecord[]): TranscriptionRecord[] {
  return writeCachedTranscriptionHistory([
    ...readCachedTranscriptionHistory(),
    ...records,
  ]);
}

export function upsertCachedTranscriptionRecord(record: TranscriptionRecord): TranscriptionRecord[] {
  return mergeCachedTranscriptionHistory([record]);
}

export function removeCachedTranscriptionRecord(id: string): TranscriptionRecord[] {
  const next = readCachedTranscriptionHistory().filter((record) => record.id !== id);
  if (typeof window !== 'undefined') {
    persistHistory(next);
  }
  return next;
}

export function getCachedTranscriptionRecord(id: string): TranscriptionRecord | null {
  return readCachedTranscriptionHistory().find((record) => record.id === id) ?? null;
}
