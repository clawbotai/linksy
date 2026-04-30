'use client';

declare global {
  interface Window {
    __MEMOFLOW_HELPER_ORIGIN__?: string;
  }
}

function resolveHelperOrigin(): string {
  if (typeof window !== 'undefined' && window.__MEMOFLOW_HELPER_ORIGIN__) {
    return window.__MEMOFLOW_HELPER_ORIGIN__;
  }

  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MEMOFLOW_HELPER_ORIGIN) {
    return process.env.NEXT_PUBLIC_MEMOFLOW_HELPER_ORIGIN;
  }

  return 'http://127.0.0.1:47392';
}

export const DEFAULT_HELPER_ORIGIN = resolveHelperOrigin();

export class HelperUnavailableError extends Error {
  constructor(message = '未检测到本机 helper 服务') {
    super(message);
    this.name = 'HelperUnavailableError';
  }
}

export class HelperRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HelperRequestError';
    this.status = status;
  }
}

function buildHelperUrl(path: string): string {
  const origin = resolveHelperOrigin();
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function helperRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildHelperUrl(path), init);
  } catch (error) {
    throw new HelperUnavailableError(
      error instanceof Error ? error.message : '无法连接本机 helper 服务',
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : `请求失败 (${response.status})`;
    throw new HelperRequestError(message, response.status);
  }

  return payload as T;
}

export function createHelperEventSource(path: string): EventSource {
  return new EventSource(buildHelperUrl(path));
}

export function isHelperUnavailableError(error: unknown): boolean {
  return error instanceof HelperUnavailableError;
}

export function isHelperRequestError(error: unknown): boolean {
  return error instanceof HelperRequestError;
}

export function getHelperUrl(path: string): string {
  return buildHelperUrl(path);
}
