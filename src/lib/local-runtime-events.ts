"use client";

export const LOCAL_RUNTIME_STATUS_CHANGED_EVENT = "memoflow:local-runtime-status-changed";

export function emitLocalRuntimeStatusChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(LOCAL_RUNTIME_STATUS_CHANGED_EVENT));
}
