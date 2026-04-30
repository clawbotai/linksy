import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatElapsedMilliseconds(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) {
    return '不到 1 秒';
  }
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  if (totalSeconds < 1) {
    return '不到 1 秒';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}小时`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}分`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}秒`);
  }

  return parts.join('');
}

export const COMPLETION_TOAST_DURATION_MS = 5000;

export function buildCompletionMessage(elapsedMs?: number | null): string {
  const elapsedText = elapsedMs != null
    ? `，用时 ${formatElapsedMilliseconds(elapsedMs)}`
    : '';
  return `转录完成${elapsedText}`;
}

/** 将 whisper timestamp（HH:MM:SS 格式）格式化为 MM:SS */
export function formatWhisperTimestamp(ts: string): string {
  const match = ts.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return '00:00';
  const totalMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  return `${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
