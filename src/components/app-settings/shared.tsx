"use client";

import * as React from "react";
import {
  BookUp,
  Mic,
  Monitor,
  Moon,
  Settings,
  Sun,
  Zap,
} from "lucide-react";

export type SettingsSection = "general" | "language-models" | "transcription" | "export";

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
