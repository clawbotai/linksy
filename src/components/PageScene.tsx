import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageSceneProps {
  children: ReactNode;
  containerClassName?: string;
  contentClassName?: string;
}

export function PageScene({
  children,
  containerClassName = "max-w-5xl",
  contentClassName,
}: PageSceneProps) {
  return (
    <div className="relative min-h-full bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute left-10 top-10 h-32 w-32 rotate-12 rounded-full bg-primary/10 blur-xl" />
        <div className="absolute right-20 top-40 h-24 w-24 -rotate-45 rounded-full bg-secondary/15 blur-lg" />
        <div className="absolute bottom-40 left-1/4 h-40 w-40 rotate-45 rounded-full bg-primary/5 blur-2xl" />
        <div className="absolute bottom-20 right-1/3 h-28 w-28 rotate-30 rounded-full bg-primary-light/10 blur-xl" />

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path
            d="M0,400 Q300,200 600,400 T1200,400"
            stroke="currentColor"
            strokeOpacity="0.05"
            strokeWidth="150"
            fill="none"
            className="text-primary"
          />
          <path
            d="M0,600 Q400,500 800,600 T1200,550"
            stroke="currentColor"
            strokeOpacity="0.05"
            strokeWidth="100"
            fill="none"
            className="text-secondary"
          />
        </svg>
      </div>

      <div
        className={cn(
          "relative z-10 mx-auto w-full px-6 py-8",
          containerClassName,
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
