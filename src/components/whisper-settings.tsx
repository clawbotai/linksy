"use client";

import * as React from "react";
import { ExportIntegrationsPanel } from "@/components/app-settings/export-integrations-panel";
import { LanguageModelSettingsPanel } from "@/components/language-model-settings-panel";
import { GeneralSettingsPanel } from "@/components/app-settings/general-settings-panel";
import { SettingsSidebar } from "@/components/app-settings/settings-sidebar";
import type { SettingsSection as SettingsSectionType } from "@/components/app-settings/shared";
import { TranscriptionEnginePanel } from "@/components/app-settings/transcription-engine-panel";
import { WhisperPanel } from "@/components/app-settings/whisper-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WhisperSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SettingsSectionType;
}

export type { SettingsSectionType as SettingsSection };

export function AppSettingsDialog({
  open,
  onOpenChange,
  initialSection = "general",
}: WhisperSettingsProps) {
  const [activeSection, setActiveSection] = React.useState<SettingsSectionType>("general");

  React.useEffect(() => {
    if (open) {
      setActiveSection(initialSection);
    }
  }, [initialSection, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>管理应用偏好、语言模型和语音转录环境。</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[78vh] min-h-[560px] grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

          <div className="min-h-0 overflow-y-auto bg-background px-4 py-4 sm:px-5 sm:py-5">
            <GeneralSettingsPanel visible={activeSection === "general"} />
            <LanguageModelSettingsPanel visible={activeSection === "language-models"} />
            <TranscriptionEnginePanel visible={activeSection === "transcription"} />
            <ExportIntegrationsPanel visible={activeSection === "export"} />
            <WhisperPanel
              open={open}
              visible={activeSection === "whisper"}
              onClose={() => onOpenChange(false)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const WhisperSettings = AppSettingsDialog;
