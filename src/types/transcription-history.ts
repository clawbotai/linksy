import type { TranscribeSegment } from './index';
import type { MindMapDocument, MindMapGeneratorInfo } from './mindmap';
import type { ExportStateMap } from './export';

export interface TranscriptionRecord {
  id: string;
  taskId: string;
  title: string;
  status: 'idle' | 'fetching_info' | 'downloading_audio' | 'converting' | 'transcribing' | 'completed' | 'error';
  progress: number | null;
  audioUrl?: string;
  segments: TranscribeSegment[];
  transcript?: string;
  wordCount?: number;
  savedPath?: string;
  transcriptionElapsedMs?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  language?: string;
  duration?: number;
  mindmapStatus?: 'idle' | 'generating' | 'ready' | 'error';
  mindmapUpdatedAt?: Date;
  mindmapPath?: string;
  mindmapError?: string;
  mindmapGenerator?: MindMapGeneratorInfo;
  mindmapDocument?: MindMapDocument;
  pointExtractionStatus?: 'idle' | 'generating' | 'ready' | 'error';
  pointExtractionUpdatedAt?: Date;
  pointExtractionError?: string;
  contentGenerationStatus?: 'idle' | 'generating' | 'ready' | 'error';
  contentGenerationUpdatedAt?: Date;
  contentGenerationError?: string;
  exportState?: ExportStateMap;
}

export interface TranscriptionHistoryState {
  records: TranscriptionRecord[];
  lastUpdated: Date;
}
