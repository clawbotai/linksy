"use client";

import * as React from "react";
import {
  BookUp,
  Globe,
  Mic,
  Monitor,
  Moon,
  Settings,
  Sun,
  Terminal,
  Zap,
} from "lucide-react";
import type {
  LocalRuntimeInstallableComponent,
  TranscriptionEngineType,
  WhisperStatus,
} from "@/types";
import type { NormalizedWhisperStatus } from "@/lib/whisper-status";

export type SettingsSection = "general" | "language-models" | "transcription" | "export" | "whisper";

export interface SettingsSectionItem {
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ReactNode;
}

export const SETTINGS_SECTIONS: SettingsSectionItem[] = [
  {
    id: "general",
    label: "通用",
    description: "主题外观",
    icon: <Settings className="h-4 w-4" />,
  },
  {
    id: "language-models",
    label: "语言模型",
    description: "文本大模型 Provider",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: "transcription",
    label: "转录",
    description: "语音识别引擎",
    icon: <Mic className="h-4 w-4" />,
  },
  {
    id: "export",
    label: "导出集成",
    description: "IMA 与 Obsidian",
    icon: <BookUp className="h-4 w-4" />,
  },
  {
    id: "whisper",
    label: "Whisper 设置",
    description: "本地转录环境",
    icon: <Terminal className="h-4 w-4" />,
  },
];

export const THEME_OPTIONS = [
  {
    id: "system" as const,
    label: "跟随系统",
    description: "自动匹配当前设备的浅色或深色外观",
    icon: Monitor,
  },
  {
    id: "light" as const,
    label: "浅色",
    description: "使用浅米色和森林绿的明亮界面",
    icon: Sun,
  },
  {
    id: "dark" as const,
    label: "深色",
    description: "使用低眩光的深色阅读界面",
    icon: Moon,
  },
];

export const MODEL_OPTIONS = [
  {
    id: "small" as const,
    name: "Small 模型",
    description: "速度快，适合日常使用",
    size: "~460 MB",
  },
  {
    id: "medium" as const,
    name: "Medium 模型",
    description: "质量更好，适合专业场景",
    size: "~1.5 GB",
  },
];

export const ENGINE_OPTIONS: Array<{
  id: TranscriptionEngineType;
  name: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: "local-whisper",
    name: "本地 Whisper",
    description: "使用本地 whisper.cpp 进行转录，无需网络",
    icon: <Terminal className="h-4 w-4" />,
  },
  {
    id: "qwen-asr",
    name: "千问 ASR",
    description: "使用阿里云千问 ASR 在线转录，速度快",
    icon: <Globe className="h-4 w-4" />,
  },
];

export const MANUAL_INSTALL_COMMANDS = [
  '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
  "brew install whisper-cpp",
  "brew install ffmpeg",
].join("\n");

export const REQUIREMENT_LABELS: Record<string, string> = {
  homebrew: "Homebrew",
  whisper: "whisper.cpp",
  ffmpeg: "ffmpeg",
  model: "模型文件",
};

export function getExecutableSourceLabel(source: WhisperStatus["whisperSource"]): string {
  switch (source) {
    case "configured":
      return "已使用用户手动配置";
    case "detected":
      return "已使用用户本机安装";
    default:
      return "缺失";
  }
}

export function getInstallComponents(
  status: NormalizedWhisperStatus | null,
): LocalRuntimeInstallableComponent[] {
  if (!status) {
    return [];
  }

  const ordered: LocalRuntimeInstallableComponent[] = ["homebrew", "whisper", "ffmpeg"];
  return ordered.filter((component) => status.missingRequirements?.includes(component));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
