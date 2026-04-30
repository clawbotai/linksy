'use client';

import { useEffect, useRef, useState } from "react";
import { saveTranscriptionMindMap } from "@/lib/mindmap";
import type { MindMapDocument } from "@/types/mindmap";
import type { TranscriptionRecord } from "@/types/transcription-history";
import { buildMindMapPath, sanitizeFileName, type OverlayFrame, type SelectedNodeInfo, type ToastType } from "./shared";

interface UseSimpleMindMapInstanceParams {
  record: TranscriptionRecord;
  editMode: boolean;
  fullscreen: boolean;
  overlayFrame: OverlayFrame | null;
  portalReady: boolean;
  mindMapDocument: MindMapDocument | null;
  setMindMapDocument: (document: MindMapDocument) => void;
  onRecordPatch: (patch: Partial<TranscriptionRecord>) => void;
  onRequireEditMode: () => void;
  showToast: (message: string, type: ToastType) => void;
}

export function useSimpleMindMapInstance({
  record,
  editMode,
  fullscreen,
  overlayFrame,
  portalReady,
  mindMapDocument,
  setMindMapDocument,
  onRecordPatch,
  onRequireEditMode,
  showToast,
}: UseSimpleMindMapInstanceParams) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mindMapRef = useRef<any>(null);
  const selectedNodeUidRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnsavedChangesRef = useRef(false);
  const remountPendingSaveRef = useRef(false);
  const programmaticUpdateRef = useRef(false);
  const activeRecordIdRef = useRef<string>(record.id);

  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);

  const syncSelectedNodePosition = () => {
    if (!mindMapRef.current || !selectedNodeUidRef.current || !viewportRef.current) {
      setSelectedNode(null);
      return;
    }

    const node = mindMapRef.current.renderer?.findNodeByUid?.(selectedNodeUidRef.current);
    if (!node) {
      setSelectedNode(null);
      return;
    }

    const rect = node.getRect?.();
    const viewportRect = viewportRef.current.getBoundingClientRect();
    if (!rect) {
      setSelectedNode(null);
      return;
    }

    setSelectedNode({
      uid: node.getData("uid"),
      text: node.getData("text") || "未命名节点",
      left: rect.left - viewportRect.left + rect.width / 2,
      top: rect.top - viewportRect.top,
      isRoot: Boolean(node.isRoot),
    });
  };

  const clearPendingSave = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  };

  const destroyMindMap = (options?: { preserveDirty?: boolean }) => {
    clearPendingSave();
    if (!options?.preserveDirty) {
      hasUnsavedChangesRef.current = false;
      remountPendingSaveRef.current = false;
    }
    if (mindMapRef.current) {
      mindMapRef.current.destroy();
      mindMapRef.current = null;
    }
    selectedNodeUidRef.current = null;
    setSelectedNode(null);
    setSaving(false);
  };

  const saveMindMapNow = async () => {
    if (!mindMapRef.current || programmaticUpdateRef.current || !hasUnsavedChangesRef.current) {
      return;
    }

    const requestRecordId = record.id;
    clearPendingSave();
    setSaving(true);
    try {
      const nextDocument = mindMapRef.current.getData(true) as MindMapDocument;
      const saved = await saveTranscriptionMindMap(record.id, nextDocument);
      if (activeRecordIdRef.current !== requestRecordId) {
        return;
      }
      hasUnsavedChangesRef.current = false;
      programmaticUpdateRef.current = true;
      setMindMapDocument(saved);
      programmaticUpdateRef.current = false;
      onRecordPatch({
        mindmapStatus: "ready",
        mindmapUpdatedAt: new Date(),
        mindmapPath: buildMindMapPath(record.savedPath),
        mindmapError: undefined,
      });
    } catch (error) {
      if (activeRecordIdRef.current === requestRecordId) {
        showToast(error instanceof Error ? error.message : "保存思维导图失败", "error");
      }
    } finally {
      if (activeRecordIdRef.current === requestRecordId) {
        setSaving(false);
      }
    }
  };

  const scheduleSave = () => {
    if (!mindMapRef.current || programmaticUpdateRef.current || !editMode) {
      return;
    }

    hasUnsavedChangesRef.current = true;
    clearPendingSave();
    saveTimerRef.current = setTimeout(() => {
      void saveMindMapNow();
    }, 600);
  };

  const applyDocumentToMindMap = (nextDocument: MindMapDocument) => {
    if (!mindMapRef.current) return;
    programmaticUpdateRef.current = true;
    mindMapRef.current.setFullData(nextDocument);
    mindMapRef.current.setMode(editMode ? "edit" : "readonly");
    if (!nextDocument.view) {
      mindMapRef.current.view.fit();
    }
    programmaticUpdateRef.current = false;
    requestAnimationFrame(() => {
      syncSelectedNodePosition();
    });
  };

  const initMindMap = async (nextDocument: MindMapDocument) => {
    if (!canvasRef.current) return;

    const [{ default: MindMap }, { default: Drag }, { default: ExportPlugin }] = await Promise.all([
      import("simple-mind-map"),
      import("simple-mind-map/src/plugins/Drag.js"),
      import("simple-mind-map/src/plugins/Export.js"),
    ]);
    if (activeRecordIdRef.current !== record.id) {
      return;
    }

    MindMap.usePlugin(Drag);
    MindMap.usePlugin(ExportPlugin);
    const MindMapCtor: any = MindMap;

    if (mindMapRef.current) {
      applyDocumentToMindMap(nextDocument);
      return;
    }

    const instance = new MindMapCtor({
      el: canvasRef.current,
      data: nextDocument.root,
      layout: nextDocument.layout || "logicalStructure",
      theme: nextDocument.theme?.template || "default",
      themeConfig: nextDocument.theme?.config || {},
      viewData: nextDocument.view,
      fit: false,
      readonly: !editMode,
      mousewheelAction: "zoom",
      minZoomRatio: 30,
      maxZoomRatio: 300,
    });

    instance.on("data_change", () => {
      if (!programmaticUpdateRef.current) {
        scheduleSave();
      }
    });

    instance.on("view_data_change", () => {
      syncSelectedNodePosition();
    });

    instance.on("node_active", (node: any) => {
      selectedNodeUidRef.current = node?.getData?.("uid") || null;
      syncSelectedNodePosition();
    });

    instance.on("draw_click", () => {
      selectedNodeUidRef.current = null;
      setSelectedNode(null);
    });

    instance.on("node_tree_render_end", () => {
      syncSelectedNodePosition();
    });

    instance.on("scale", () => {
      syncSelectedNodePosition();
    });

    instance.on("translate", () => {
      syncSelectedNodePosition();
    });

    mindMapRef.current = instance;
    applyDocumentToMindMap(nextDocument);

    if (remountPendingSaveRef.current) {
      hasUnsavedChangesRef.current = true;
      remountPendingSaveRef.current = false;
      if (editMode) {
        clearPendingSave();
        saveTimerRef.current = setTimeout(() => {
          void saveMindMapNow();
        }, 600);
      }
    }
  };

  const remountMindMap = () => {
    if (!mindMapRef.current) {
      return;
    }

    const snapshot = mindMapRef.current.getData(true) as MindMapDocument;
    const hadUnsavedChanges = hasUnsavedChangesRef.current;
    remountPendingSaveRef.current = hadUnsavedChanges;
    destroyMindMap({ preserveDirty: hadUnsavedChanges });
    setMindMapDocument(snapshot);
  };

  const withSelectedNode = (callback: (node: any) => void, allowRoot = true) => {
    if (!mindMapRef.current || !selectedNodeUidRef.current) return;
    const node = mindMapRef.current.renderer?.findNodeByUid?.(selectedNodeUidRef.current);
    if (!node || (!allowRoot && node.isRoot)) return;
    callback(node);
  };

  const handleDownload = async () => {
    if (!mindMapRef.current) return;
    try {
      await mindMapRef.current.export("png", true, sanitizeFileName(`${record.title}-思维导图`));
      showToast("已开始下载 PNG", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "下载失败", "error");
    }
  };

  const handleRenameNode = () => {
    withSelectedNode((node) => {
      mindMapRef.current.setMode("edit");
      onRequireEditMode();
      requestAnimationFrame(() => {
        mindMapRef.current.renderer?.textEdit?.show?.({ node });
      });
    });
  };

  const handleAddChildNode = () => {
    withSelectedNode((node) => {
      mindMapRef.current.setMode("edit");
      onRequireEditMode();
      mindMapRef.current.execCommand("INSERT_CHILD_NODE", true, [node]);
    });
  };

  const handleAddSiblingNode = () => {
    withSelectedNode((node) => {
      mindMapRef.current.setMode("edit");
      onRequireEditMode();
      mindMapRef.current.execCommand("INSERT_NODE", true, [node]);
    }, false);
  };

  const handleDeleteNode = () => {
    withSelectedNode((node) => {
      mindMapRef.current.setMode("edit");
      onRequireEditMode();
      mindMapRef.current.execCommand("REMOVE_NODE", [node]);
      selectedNodeUidRef.current = null;
      setSelectedNode(null);
    }, false);
  };

  const handleZoomOut = () => {
    mindMapRef.current?.view?.narrow?.();
  };

  const handleZoomIn = () => {
    mindMapRef.current?.view?.enlarge?.();
  };

  const handleResetZoom = () => {
    mindMapRef.current?.view?.reset?.();
  };

  useEffect(() => {
    activeRecordIdRef.current = record.id;
    return () => {
      activeRecordIdRef.current = "";
    };
  }, [record.id]);

  useEffect(() => {
    if (mindMapDocument && canvasRef.current && portalReady) {
      void initMindMap(mindMapDocument);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mindMapDocument, portalReady]);

  useEffect(() => {
    if (!mindMapRef.current) return;
    mindMapRef.current.setMode(editMode ? "edit" : "readonly");
    if (!editMode) {
      void saveMindMapNow();
    }
  }, [editMode]);

  useEffect(() => {
    remountMindMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  useEffect(() => {
    requestAnimationFrame(() => {
      mindMapRef.current?.resize?.();
      syncSelectedNodePosition();
    });
  }, [fullscreen, overlayFrame?.width, overlayFrame?.height]);

  useEffect(() => {
    const handleResize = () => {
      syncSelectedNodePosition();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => () => {
    clearPendingSave();
  }, []);

  return {
    viewportRef,
    canvasRef,
    saving,
    selectedNode,
    destroyMindMap,
    handleDownload,
    handleRenameNode,
    handleAddChildNode,
    handleAddSiblingNode,
    handleDeleteNode,
    handleZoomOut,
    handleZoomIn,
    handleResetZoom,
  };
}
