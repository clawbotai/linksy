'use client';

import { helperRequest } from '@/lib/local-helper-client';
import type {
  ApiResponse,
  ExportConfigResponse,
  ExportExecutionRequest,
  ExportExecutionResult,
  ExportProviderConfigMap,
  ExportProviderConfigSaveResponse,
  ExportProviderId,
  ExportProviderMeta,
  ExportProviderTestRequestMap,
  ExportProviderTestResult,
} from '@/types';

export async function fetchExportProviders(): Promise<ExportProviderMeta[]> {
  const response = await helperRequest<ApiResponse<{ providers: ExportProviderMeta[] }>>('/export/providers');
  if (!response.success || !response.data?.providers) {
    throw new Error(response.error || '读取导出平台失败');
  }
  return response.data.providers;
}

export async function fetchExportConfig(): Promise<ExportConfigResponse> {
  const response = await helperRequest<ApiResponse<ExportConfigResponse>>('/export/config');
  if (!response.success || !response.data?.providers) {
    throw new Error(response.error || '读取导出配置失败');
  }
  return response.data;
}

export async function saveExportProviderConfig<T extends ExportProviderId>(
  providerId: T,
  payload: Partial<ExportProviderConfigMap[T]> & Record<string, unknown>,
): Promise<ExportProviderConfigSaveResponse> {
  const response = await helperRequest<ApiResponse<ExportProviderConfigSaveResponse>>(
    `/export/config/${providerId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!response.success || !response.data?.config) {
    throw new Error(response.error || '保存导出配置失败');
  }

  return response.data;
}

export async function testExportProvider<T extends ExportProviderId>(
  providerId: T,
  payload: Partial<ExportProviderTestRequestMap[T]> & Record<string, unknown> = {},
): Promise<ExportProviderTestResult> {
  const response = await helperRequest<ApiResponse<ExportProviderTestResult>>(
    `/export/config/${providerId}/test`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || '测试导出连接失败');
  }

  return response.data;
}

export async function executeExport(
  transcriptionId: string,
  payload: ExportExecutionRequest,
): Promise<ExportExecutionResult> {
  const response = await helperRequest<ApiResponse<ExportExecutionResult>>(
    `/transcriptions/${transcriptionId}/export`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || '执行导出失败');
  }

  return response.data;
}
