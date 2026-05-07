/**
 * OpenAI Whisper 兼容协议适配器
 * 支持 mimo 网关、Groq、Fireworks 等第三方 Whisper 兼容服务
 */

export const DEFAULT_WHISPER_BASE_URL = "https://api.openai.com/v1";

/** 同步模型音频大小上限（24MB，与 OpenAI Whisper 官方限制一致） */
const SYNC_AUDIO_SIZE_LIMIT = 24 * 1024 * 1024;

/** 重定向最大跳数 */
const MAX_REDIRECTS = 5;

/** 下载音频超时（60s） */
const DOWNLOAD_TIMEOUT_MS = 60_000;

/**
 * 启发式判断 baseUrl 是否指向 OpenAI Whisper 兼容协议端点
 */
export function looksLikeWhisperUrl(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    if (/openai\.com/i.test(u.hostname)) return true;
    // 兼容 Groq、Fireworks、mimo 等第三方 Whisper 兼容服务
    if (/\/v\d+\/?$/.test(u.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function buildWhisperHint(baseUrl: string): string {
  if (looksLikeWhisperUrl(baseUrl)) return "";
  return `\n\n提示：当前 baseUrl "${baseUrl}" 可能不是 Whisper 协议端点。OpenAI Whisper 使用 ${DEFAULT_WHISPER_BASE_URL}。请到「设置 → 在线转录供应商」检查配置。`;
}

/**
 * 从 URL 或 Content-Type 推断音频扩展名
 */
function guessAudioExtension(url: string, contentType?: string): string {
  // 1. 从 URL 路径提取
  const urlExtMatch = url.match(/\.(\w+)(?:[?#]|$)/);
  if (urlExtMatch) {
    const ext = urlExtMatch[1].toLowerCase();
    if (["mp3", "m4a", "mp4", "aac", "wav", "flac", "ogg", "opus", "webm"].includes(ext)) {
      return ext;
    }
  }
  // 2. 从 Content-Type 推断
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes("mp3") || ct.includes("mpeg")) return "mp3";
    if (ct.includes("m4a") || ct.includes("mp4")) return "m4a";
    if (ct.includes("wav")) return "wav";
    if (ct.includes("ogg")) return "ogg";
    if (ct.includes("webm")) return "webm";
    if (ct.includes("aac")) return "aac";
    if (ct.includes("flac")) return "flac";
  }
  return "mp3";
}

/**
 * 安全下载音频（带 SSRF 检查 + 重定向防护 + 大小限制）
 */
export async function downloadAudio(
  audioUrl: string,
  assertSafeUrl: (url: string) => void | Promise<void>,
): Promise<{ buffer: ArrayBuffer; contentType: string; extension: string }> {
  let currentUrl = audioUrl;
  let redirectCount = 0;

  while (redirectCount <= MAX_REDIRECTS) {
    await assertSafeUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    const response = await fetch(currentUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "audio/*, */*",
      },
      redirect: "manual",
    });
    clearTimeout(timeout);

    // 处理重定向（每次跳转都重新校验 SSRF）
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("重定向缺少 Location header");
      currentUrl = new URL(location, currentUrl).toString();
      redirectCount++;
      // 循环顶部的 assertSafeUrl(currentUrl) 会再次校验
      continue;
    }

    if (!response.ok) {
      throw new Error(`下载音频失败 (${response.status})`);
    }

    const contentType = response.headers.get("content-type") || "";
    const contentLength = response.headers.get("content-length");

    // 流式读取，累计检查大小
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new Error("无法读取音频流");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.length;
      if (totalSize > SYNC_AUDIO_SIZE_LIMIT) {
        reader.cancel();
        throw new Error(
          `音频约 ${Math.round(totalSize / 1024 / 1024)} MB，超出 Whisper 同步协议处理上限（${Math.round(SYNC_AUDIO_SIZE_LIMIT / 1024 / 1024)} MB）。建议切换至 DashScope（异步无超时）。`,
        );
      }
    }

    // 合并 buffer
    const buffer = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    const extension = guessAudioExtension(audioUrl, contentType);
    return { buffer: buffer.buffer, contentType, extension };
  }

  throw new Error(`重定向次数超过上限（${MAX_REDIRECTS} 次）`);
}

/**
 * 发送 multipart 请求给 Whisper 兼容接口
 */
export async function submitWhisperJob(
  audioBuffer: ArrayBuffer,
  filename: string,
  apiKey: string,
  baseUrl: string,
  modelName: string,
): Promise<{ transcript: string; segments: Array<{ timestamp: string; text: string }>; wordCount: number; language: string }> {
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer]), filename);
  formData.append("model", modelName);
  formData.append("response_format", "verbose_json");

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    let msg = payload?.error?.message || payload?.error || payload?.message || `Whisper 转录失败 (${res.status})`;
    if (res.status === 404 || res.status === 400) {
      msg += buildWhisperHint(baseUrl);
    }
    throw new Error(msg);
  }

  // 流式读取响应，限制大小防止 OOM
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取 Whisper 响应流");
  const maxSize = 32 * 1024 * 1024; // 32MB
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalSize += value.length;
    if (totalSize > maxSize) {
      reader.cancel();
      throw new Error(`Whisper 响应体超出大小限制（${Math.round(maxSize / 1024 / 1024)} MB）`);
    }
  }
  const text = new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  const payload = JSON.parse(text);
  return buildWhisperResult(payload);
}

/**
 * 将 Whisper verbose_json 响应转为项目标准格式
 */
export function buildWhisperResult(
  payload: any,
): { transcript: string; segments: Array<{ timestamp: string; text: string }>; wordCount: number; language: string } {
  const text = String(payload?.text || "");
  const language = payload?.language || "zh";

  const segments: Array<{ timestamp: string; text: string }> = [];

  if (Array.isArray(payload?.segments)) {
    for (const seg of payload.segments) {
      const segText = (seg.text || "").trim();
      if (!segText) continue;
      const begin = formatWhisperTimestamp(seg.start ?? 0);
      const end = formatWhisperTimestamp(seg.end ?? seg.start ?? 0);
      segments.push({ timestamp: `[${begin} --> ${end}]`, text: segText });
    }
  }

  const transcript = text.trim();
  const wordCount = transcript.replace(/\s/g, "").length;

  return { transcript, segments, wordCount, language };
}

/**
 * Whisper 时间戳：浮点秒 → [hh:mm:ss.SSS]
 */
function formatWhisperTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(Number(seconds) * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}
