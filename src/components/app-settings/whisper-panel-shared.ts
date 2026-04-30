import type { NormalizedWhisperStatus } from "@/lib/whisper-status";
import type { WhisperConfig } from "@/types";
import { getExecutableSourceLabel } from "@/components/app-settings/shared";

export type WhisperModel = "small" | "medium";

export interface DownloadProgress {
  status: "idle" | "downloading" | "completed" | "error";
  downloaded: number;
  total: number;
  modelName: string;
  percent?: number;
  error?: string;
}

export interface RuntimeChecklistItem {
  id: string;
  label: string;
  installed: boolean;
  detail: string;
  stateLabel: string;
}

export const INITIAL_WHISPER_CONFIG: WhisperConfig = {
  whisperPath: "",
  modelPath: "",
  modelName: "small",
  threads: 4,
  outputDir: "",
  ffmpegPath: "",
};

export function getPlatformLabel(platform?: string | null): string {
  if (platform === "win32") {
    return "Windows";
  }
  if (platform === "darwin") {
    return "macOS";
  }
  return platform ?? "本机";
}

export function buildRuntimeChecklist(
  status: NormalizedWhisperStatus | null,
): RuntimeChecklistItem[] {
  if (!status) {
    return [];
  }

  return [
    {
      id: "homebrew",
      label: "Homebrew",
      installed: status.homebrewInstalled,
      detail: status.isLegacyPayload
        ? "当前 helper 未返回 Homebrew 的精确检测信息；重启 helper 后会刷新。"
        : status.homebrewInstalled
          ? status.homebrewPath || "已检测到 Homebrew"
          : "缺少 Homebrew，一键安装将先安装它",
      stateLabel: status.isLegacyPayload
        ? "旧版 helper"
        : status.homebrewInstalled
          ? "已检测到"
          : "缺失",
    },
    {
      id: "whisper",
      label: "whisper.cpp",
      installed: status.whisperInstalled,
      detail: status.whisperInstalled
        ? status.effectiveWhisperPath || status.whisperPath
        : "未检测到可用的 whisper 可执行文件",
      stateLabel: getExecutableSourceLabel(status.whisperSource),
    },
    {
      id: "ffmpeg",
      label: "ffmpeg",
      installed: status.ffmpegInstalled,
      detail: status.ffmpegInstalled
        ? status.effectiveFfmpegPath || status.ffmpegPath
        : "未检测到可用的 ffmpeg，可先用一键安装补齐",
      stateLabel: getExecutableSourceLabel(status.ffmpegSource),
    },
    {
      id: "model",
      label: "模型文件",
      installed: status.modelInstalled,
      detail: status.modelInstalled
        ? `${status.modelName} · ${status.modelSize}`
        : "模型仍需单独下载，本页下方保留独立下载按钮",
      stateLabel: status.modelInstalled ? "已下载" : "缺失",
    },
  ];
}
