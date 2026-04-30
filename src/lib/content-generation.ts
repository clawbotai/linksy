'use client';

import { helperRequest } from '@/lib/local-helper-client';
import type {
  ApiResponse,
  ContentDraftCollection,
  ContentPlatform,
  PointExtractionResult,
} from '@/types';

export interface GenerateContentPointsRequest {
  providerId: string;
  modelId: string;
  platform?: ContentPlatform;
}

export interface GenerateContentDraftRequest {
  providerId: string;
  modelId: string;
  platform: ContentPlatform;
  selectedPointIds: string[];
}

export async function fetchContentPoints(id: string): Promise<PointExtractionResult> {
  const response = await helperRequest<ApiResponse<{ result: PointExtractionResult }>>(
    `/transcriptions/${id}/content-points`,
  );
  if (!response.success || !response.data?.result) {
    throw new Error(response.error || '读取观点失败');
  }
  return response.data.result;
}

export async function generateContentPoints(
  id: string,
  payload: GenerateContentPointsRequest,
): Promise<PointExtractionResult> {
  const response = await helperRequest<ApiResponse<{ result: PointExtractionResult }>>(
    `/transcriptions/${id}/content-points/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!response.success || !response.data?.result) {
    throw new Error(response.error || '提炼观点失败');
  }
  return response.data.result;
}

export async function fetchContentDrafts(id: string): Promise<ContentDraftCollection> {
  const response = await helperRequest<ApiResponse<{ drafts: ContentDraftCollection['drafts'] }>>(
    `/transcriptions/${id}/content`,
  );
  if (!response.success || !response.data?.drafts) {
    throw new Error(response.error || '读取内容草稿失败');
  }
  return {
    drafts: response.data.drafts,
    updatedAt: new Date().toISOString(),
  };
}

export async function generateContentDraft(
  id: string,
  payload: GenerateContentDraftRequest,
) {
  const response = await helperRequest<ApiResponse<{ draft: ContentDraftCollection['drafts'][ContentPlatform] }>>(
    `/transcriptions/${id}/content/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!response.success || !response.data?.draft) {
    throw new Error(response.error || '生成内容失败');
  }
  return response.data.draft;
}
