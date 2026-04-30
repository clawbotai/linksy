'use client';

import { Outlet, useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AppSettingsDialog, type SettingsSection } from "@/components/whisper-settings";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { WebTopBar } from "@/components/WebTopBar";

export interface WebShellContext {
  openSettings: (section?: SettingsSection) => void;
}

export function WebAppShell() {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");

  const openSettings = useCallback((section: SettingsSection = "general") => {
    setSettingsSection(section);
    setSettingsOpen(true);
  }, []);

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-background">
        <WebTopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
        <DesktopSidebar
          open={sidebarOpen}
          onOpenSettings={() => navigate("/settings?section=general")}
        />
        <main
          className={cn(
            "flex-1 overflow-auto overscroll-none pt-11 transition-[margin] duration-300 ease-out",
            sidebarOpen ? "md:ml-60" : "md:ml-0",
          )}
        >
          <Outlet context={{ openSettings } satisfies WebShellContext} />
        </main>
      </div>
      <AppSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialSection={settingsSection}
      />
    </>
  );
}
