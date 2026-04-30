"use client";

import type {
  LocalRuntimeRequirement,
  RuntimeExecutableSource,
  WhisperStatus,
} from "@/types";

export interface NormalizedWhisperStatus extends WhisperStatus {
  isLegacyPayload: boolean;
}

type WhisperStatusPayload = Partial<WhisperStatus>;

const RUNTIME_SOURCES = new Set<RuntimeExecutableSource>(["configured", "detected", "missing"]);
const RUNTIME_REQUIREMENTS = new Set<LocalRuntimeRequirement>([
  "homebrew",
  "whisper",
  "ffmpeg",
  "model",
]);

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isRuntimeSource(value: unknown): value is RuntimeExecutableSource {
  return typeof value === "string" && RUNTIME_SOURCES.has(value as RuntimeExecutableSource);
}

function normalizeSource(
  value: unknown,
  installed: boolean,
  configuredPath: string,
  effectivePath: string,
): RuntimeExecutableSource {
  if (isRuntimeSource(value)) {
    return value;
  }

  if (!installed) {
    return "missing";
  }

  if (configuredPath || effectivePath) {
    return "configured";
  }

  return "detected";
}

function normalizeMissingRequirements(
  value: unknown,
  payload: WhisperStatusPayload,
  platform: string,
): LocalRuntimeRequirement[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is LocalRuntimeRequirement =>
        typeof item === "string" && RUNTIME_REQUIREMENTS.has(item as LocalRuntimeRequirement),
    );
  }

  const missing: LocalRuntimeRequirement[] = [];
  const whisperInstalled = asBoolean(payload.whisperInstalled);
  const ffmpegInstalled = asBoolean(payload.ffmpegInstalled);
  const modelInstalled = asBoolean(payload.modelInstalled);

  if (!whisperInstalled) {
    missing.push("whisper");
  }
  if (!ffmpegInstalled) {
    missing.push("ffmpeg");
  }
  if (!modelInstalled) {
    missing.push("model");
  }

  if (platform === "darwin" && !whisperInstalled && !ffmpegInstalled) {
    missing.unshift("homebrew");
  }

  return Array.from(new Set(missing));
}

export function normalizeWhisperStatus(payload: WhisperStatusPayload): NormalizedWhisperStatus {
  const platform = asString(payload.platform);
  const whisperPath = asString(payload.whisperPath);
  const ffmpegPath = asString(payload.ffmpegPath);
  const configuredWhisperPath = asString(payload.configuredWhisperPath) || whisperPath;
  const configuredFfmpegPath = asString(payload.configuredFfmpegPath) || ffmpegPath;
  const effectiveWhisperPath = asString(payload.effectiveWhisperPath) || whisperPath;
  const effectiveFfmpegPath = asString(payload.effectiveFfmpegPath) || ffmpegPath;
  const whisperInstalled = asBoolean(payload.whisperInstalled);
  const ffmpegInstalled = asBoolean(payload.ffmpegInstalled);
  const modelInstalled = asBoolean(payload.modelInstalled);
  const isLegacyPayload =
    typeof payload.homebrewInstalled !== "boolean" ||
    !Array.isArray(payload.missingRequirements) ||
    !isRuntimeSource(payload.whisperSource) ||
    !isRuntimeSource(payload.ffmpegSource);

  return {
    helperConnected: asBoolean(payload.helperConnected, true),
    homebrewInstalled:
      typeof payload.homebrewInstalled === "boolean"
        ? payload.homebrewInstalled
        : platform === "darwin" && (whisperInstalled || ffmpegInstalled),
    whisperInstalled,
    modelInstalled,
    ffmpegInstalled,
    autoInstallSupported:
      typeof payload.autoInstallSupported === "boolean"
        ? payload.autoInstallSupported
        : platform === "darwin",
    homebrewPath: asString(payload.homebrewPath),
    configuredWhisperPath,
    configuredFfmpegPath,
    effectiveWhisperPath,
    effectiveFfmpegPath,
    whisperSource: normalizeSource(
      payload.whisperSource,
      whisperInstalled,
      configuredWhisperPath,
      effectiveWhisperPath,
    ),
    ffmpegSource: normalizeSource(
      payload.ffmpegSource,
      ffmpegInstalled,
      configuredFfmpegPath,
      effectiveFfmpegPath,
    ),
    missingRequirements: normalizeMissingRequirements(payload.missingRequirements, payload, platform),
    whisperPath,
    modelPath: asString(payload.modelPath),
    modelName: asString(payload.modelName) || "small",
    modelSize: asString(payload.modelSize) || "0 B",
    ffmpegPath,
    platform,
    installMode: "mixed",
    isLegacyPayload,
  };
}
