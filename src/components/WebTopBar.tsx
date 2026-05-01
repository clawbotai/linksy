'use client';

import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface WebTopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function WebTopBar({ sidebarOpen, onToggleSidebar }: WebTopBarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-11 border-b border-border/40">
      <div className="relative flex h-full items-center glass">
        <div
          className={cn(
            "absolute inset-y-0 left-0 bg-card/80 transition-[width] duration-300 ease-out",
            sidebarOpen ? "w-64" : "w-0",
          )}
        />

        <div className="relative z-10 flex h-full items-center gap-3 pl-4 transition-[padding] duration-300 ease-out">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "收起边栏" : "展开边栏"}
            aria-pressed={sidebarOpen}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-background/80 transition-all hover:bg-muted hover:border-primary/30 hover:shadow-sm"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
          {!sidebarOpen && (
            <div className="hidden md:block">
              <Logo size="sm" showText={false} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
