export type ExportProviderId = 'ima' | 'obsidian';

export type ExportExecutionStatus = 'success' | 'failed';

export interface ExportProviderState {
  status: ExportExecutionStatus;
  exportedAt?: string;
  targetRef?: string;
  errorMessage?: string;
}

export type ExportStateMap = Partial<Record<ExportProviderId, ExportProviderState>>;

export interface ExportProviderConfigMap {
  ima: {
    clientId: string;
    apiKeyConfigured: boolean;
    folderId: string;
    updatedAt: string | null;
    configured: boolean;
  };
  obsidian: {
    cliPath: string;
    vaultPath: string;
    targetFolder: string;
    updatedAt: string | null;
    configured: boolean;
  };
}

export type ExportProviderMeta =
  | {
      id: 'ima';
      name: string;
      description: string;
      configured: boolean;
      supports: string[];
      config: ExportProviderConfigMap['ima'];
    }
  | {
      id: 'obsidian';
      name: string;
      description: string;
      configured: boolean;
      supports: string[];
      config: ExportProviderConfigMap['obsidian'];
    };

export interface ExportConfigResponse {
  providers: ExportProviderConfigMap;
}

export interface ExportProviderConfigSaveResponse {
  providerId: ExportProviderId;
  config: ExportProviderConfigMap[ExportProviderId];
}

export interface ExportExecutionRequest {
  providerId: ExportProviderId;
}

export interface ExportExecutionResult {
  providerId: ExportProviderId;
  status: ExportExecutionStatus;
  exportedAt: string;
  targetRef?: string;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ExportProviderTestResult {
  providerId: ExportProviderId;
  success: boolean;
  message: string;
}

export interface ExportProviderTestRequestMap {
  ima: {
    clientId?: string;
    apiKey?: string;
    folderId?: string;
  };
  obsidian: {
    cliPath?: string;
    vaultPath?: string;
    targetFolder?: string;
  };
}
