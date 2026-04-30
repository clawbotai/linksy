'use client';

import { useEffect, useRef, useState } from "react";
import type { OverlayFrame } from "./shared";

interface UseMindMapOverlayParams {
  enabled: boolean;
}

export function useMindMapOverlay({ enabled }: UseMindMapOverlayParams) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [overlayFrame, setOverlayFrame] = useState<OverlayFrame | null>(null);

  const shouldRenderPortal = typeof document !== "undefined" && enabled && (fullscreen || Boolean(overlayFrame));

  const handleToggleFullscreen = () => {
    setFullscreen((prev) => !prev);
  };

  const resetOverlay = () => {
    setFullscreen(false);
    setOverlayFrame(null);
  };

  useEffect(() => {
    if (!fullscreen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullscreen]);

  useEffect(() => {
    const originalOverflow = window.document.body.style.overflow;
    if (fullscreen) {
      window.document.body.style.overflow = "hidden";
    }

    return () => {
      window.document.body.style.overflow = originalOverflow;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!enabled || fullscreen) {
      return;
    }

    const updateFrame = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setOverlayFrame({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    updateFrame();
    const frameId = window.requestAnimationFrame(updateFrame);
    const resizeObserver = typeof ResizeObserver !== "undefined" && anchorRef.current
      ? new ResizeObserver(() => updateFrame())
      : null;

    if (anchorRef.current && resizeObserver) {
      resizeObserver.observe(anchorRef.current);
    }

    window.addEventListener("resize", updateFrame);
    window.addEventListener("scroll", updateFrame, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateFrame);
      window.removeEventListener("scroll", updateFrame, true);
    };
  }, [enabled, fullscreen]);

  useEffect(() => {
    if (!enabled) {
      setOverlayFrame(null);
      setFullscreen(false);
    }
  }, [enabled]);

  return {
    anchorRef,
    fullscreen,
    overlayFrame,
    shouldRenderPortal,
    handleToggleFullscreen,
    resetOverlay,
  };
}
