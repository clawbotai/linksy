"use client";

export const TRANSCRIPTION_PROVIDER_SETTINGS_CHANGED_EVENT =
  "linksy:transcription-provider-settings-changed";

export function emitTranscriptionProviderSettingsChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(TRANSCRIPTION_PROVIDER_SETTINGS_CHANGED_EVENT));
}
