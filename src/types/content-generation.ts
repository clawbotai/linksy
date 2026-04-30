export type ContentPointType = 'theme' | 'viral' | 'controversial' | 'quote';

export interface GeneratedPoint {
  id: string;
  type: ContentPointType;
  text: string;
  sourceText?: string;
  sourceTimestamp?: string;
  selected?: boolean;
}

export interface PointExtractionResult {
  theme?: string;
  points: GeneratedPoint[];
  updatedAt: string;
}

export type ContentPlatform = 'redbook' | 'twitter';

export interface GeneratedContentDraft {
  id: string;
  platform: ContentPlatform;
  title?: string;
  content: string;
  tweets?: string[];
  tags?: string[];
  sourcePointIds: string[];
  version: number;
  editedByUser: boolean;
  status: 'ready' | 'error' | 'stale';
  createdAt: string;
  updatedAt: string;
}

export interface ContentDraftCollection {
  drafts: Partial<Record<ContentPlatform, GeneratedContentDraft>>;
  updatedAt: string;
}
