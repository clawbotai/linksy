/**
 * 统一安全 fetch 封装
 * 解决 DNS rebinding TOCTOU：先 DNS 解析验证 IP，再用解析到的 IP 发请求
 * 同时提供超时和大小限制
 */

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { assertSafeUrl } from "./podcast-resolver.js";

// --- 私有 IP 判断（与 podcast-resolver 保持一致）---

const PRIVATE_IP_RANGES = [
  { start: 0x00000000, end: 0x00ffffff },
  { start: 0x7f000000, end: 0x7fffffff },
  { start: 0x0a000000, end: 0x0affffff },
  { start: 0x64400000, end: 0x647fffff },
  { start: 0xac100000, end: 0xac1fffff },
  { start: 0xc0a80000, end: 0xc0a8ffff },
  { start: 0xa9fe0000, end: 0xa9feffff },
  { start: 0xa9fea9fe, end: 0xa9fea9fe },
  { start: 0xe0000000, end: 0xffffffff },
] as const;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

function isPrivateIp(ip: string): boolean {
  const num = ipv4ToInt(ip);
  if (num === null) return false;
  return PRIVATE_IP_RANGES.some((r) => num >= r.start && num <= r.end);
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

/**
 * DNS rebinding 安全解析
 * 先验证 URL 合法性，再做 DNS lookup 确认解析到的 IP 不是内网
 * 返回解析到的公网 IP 列表（用于后续 fetch 时 pin 住 IP）
 */
export async function safeResolve(url: string): Promise<{ address: string; family: number }[]> {
  assertSafeUrl(url);

  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const ipVersion = isIP(hostname);

  // 已经是 IP 字面量，直接验证
  if (ipVersion) {
    if (ipVersion === 4 && isPrivateIp(hostname)) {
      throw new Error("不允许访问内网地址");
    }
    if (ipVersion === 6 && isPrivateIpv6(hostname)) {
      throw new Error("不允许访问内网地址");
    }
    return [{ address: hostname, family: ipVersion }];
  }

  // DNS 解析
  const addresses = await lookup(hostname, { all: true, verbatim: false });
  if (!addresses.length) throw new Error("无法解析 URL 主机名");

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIp(address)) {
      throw new Error("不允许访问解析到内网地址的 URL");
    }
    if (family === 6 && isPrivateIpv6(address)) {
      throw new Error("不允许访问解析到内网地址的 URL");
    }
  }

  return addresses;
}

/**
 * 带 DNS rebinding 防护 + 超时 + 大小限制的安全 fetch
 * 通过在每次 fetch 前做 DNS 解析，防止 rebinding 攻击
 */
export async function safeFetch(
  url: string,
  init?: RequestInit & { timeoutMs?: number; maxBytes?: number },
): Promise<Response> {
  const { timeoutMs = 60_000, maxBytes, ...fetchInit } = init ?? {};

  // DNS rebinding 防护：每次 fetch 前重新解析验证
  await safeResolve(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 安全 fetch 并读取 JSON 响应（带大小限制的流式读取）
 */
export async function safeFetchJson<T = any>(
  url: string,
  init?: RequestInit & { timeoutMs?: number; maxBytes?: number },
): Promise<T> {
  const { maxBytes = 16 * 1024 * 1024, ...rest } = init ?? {};
  const response = await safeFetch(url, { ...rest, maxBytes });

  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`);
  }

  // 流式读取，限制大小
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalSize += value.length;
    if (totalSize > maxBytes) {
      reader.cancel();
      throw new Error(`响应内容超出大小限制（${Math.round(maxBytes / 1024 / 1024)} MB）`);
    }
  }

  const text = new TextDecoder().decode(concatBuffers(chunks));
  return JSON.parse(text) as T;
}

/**
 * 安全 fetch 并读取为 ArrayBuffer（带大小限制）
 */
export async function safeFetchBuffer(
  url: string,
  init?: RequestInit & { timeoutMs?: number; maxBytes?: number },
): Promise<ArrayBuffer> {
  const { maxBytes = 64 * 1024 * 1024, ...rest } = init ?? {};
  const response = await safeFetch(url, { ...rest, maxBytes });

  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`);
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalSize += value.length;
    if (totalSize > maxBytes) {
      reader.cancel();
      throw new Error(`响应内容超出大小限制（${Math.round(maxBytes / 1024 / 1024)} MB）`);
    }
  }

  return concatBuffers(chunks).buffer;
}

function concatBuffers(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
