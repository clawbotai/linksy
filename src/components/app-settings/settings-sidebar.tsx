"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/components/app-settings/shared";

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <aside className="border-b border-border/60 bg-muted/20 p-3 md:border-b-0 md:border-r">
      <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        {SETTINGS_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
            className={cn(
              "flex min-w-[160px] items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all md:min-w-0",
              activeSection === section.id
                ? "border-primary/30 bg-background shadow-sm shadow-primary/10"
                : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-background/70 hover:text-foreground",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                activeSection === section.id
                  ? "bg-primary/12 text-primary"
                  : "bg-background/80 text-muted-foreground",
              )}
            >
              {section.icon}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{section.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{section.description}</div>
            </div>
          </button>
        ))}
      </nav>
    </aside>
  );
}
