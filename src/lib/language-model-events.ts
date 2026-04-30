"use client";

export const LANGUAGE_MODEL_SETTINGS_CHANGED_EVENT = "memoflow:language-model-settings-changed";

export function emitLanguageModelSettingsChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(LANGUAGE_MODEL_SETTINGS_CHANGED_EVENT));
}
