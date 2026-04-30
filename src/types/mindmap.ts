export interface MindMapNodeData {
  text: string;
  expand?: boolean;
  isActive?: boolean;
  uid?: string;
}

export interface MindMapNode {
  data: MindMapNodeData;
  children?: MindMapNode[];
}

export interface MindMapThemeConfig {
  template?: string;
  config?: Record<string, unknown>;
}

export interface MindMapViewTransform {
  scaleX: number;
  scaleY: number;
  shear: number;
  rotate: number;
  translateX: number;
  translateY: number;
  originX: number;
  originY: number;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface MindMapViewState {
  scale: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
}

export interface MindMapView {
  transform: MindMapViewTransform;
  state: MindMapViewState;
}

export interface MindMapDocument {
  layout: string;
  root: MindMapNode;
  theme?: MindMapThemeConfig;
  view?: MindMapView;
  config?: Record<string, unknown>;
}

export interface MindMapGeneratorInfo {
  providerId: string;
  providerName?: string;
  modelId?: string;
  model: string;
}
