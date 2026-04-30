"use client";

import * as React from "react";
import { LanguageModelPanel } from "./language-model/provider-panel";
import { cn } from "@/lib/utils";

interface LanguageModelSettingsPanelProps {
  visible: boolean;
}

export function LanguageModelSettingsPanel({ visible }: LanguageModelSettingsPanelProps) {
  return (
    <section aria-hidden={!visible} className={cn("space-y-6", !visible && "hidden")}>
      <LanguageModelPanel visible={visible} />
    </section>
  );
}
