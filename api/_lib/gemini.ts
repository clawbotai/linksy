/**
 * Google Gemini 语音转录适配器
 * 通过 Gemini multimodal generateContent API 进行音频转录
 * 注意：Gemini 不是原生 ASR，时间戳为模型推断，精度不如专业 ASR
 */

export const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** inline_data 大小上限（18MB，留 2MB margin 给 base64 膨胀） */
const INLINE_DATA_LIMIT = 18 * 1024 * 1024;

/** File API 轮询间隔（ms） */
const FILE_POLL_INTERVAL_MS = 2000;
/** File API 轮询超时（ms） */
const FILE_POLL_TIMEOUT_MS = 120_000;

function buildGeminiUploadBaseUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = parsed.pathname.replace(/\/v1(beta)?\/?$/i, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

/**
 * 从 URL 或 Content-Type 推断音频 MIME 类型
 */
export function guessAudioMime(url: string, contentType?: string): string {
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes("mp3") || ct.includes("mpeg")) return "audio/mpeg";
    if (ct.includes("m4a")) return "audio/mp4";
    if (ct.includes("mp4")) return "audio/mp4";
    if (ct.includes("wav")) return "audio/wav";
    if (ct.includes("ogg")) return "audio/ogg";
    if (ct.includes("webm")) return "audio/webm";
    if (ct.includes("aac")) return "audio/aac";
    if (ct.includes("flac")) return "audio/flac";
  }
  const ext = url.match(/\.(\w+)(?:[?#]|$)/)?.[1]?.toLowerCase();
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a" || ext === "mp4") return "audio/mp4";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "webm") return "audio/webm";
  if (ext === "aac") return "audio/aac";
  if (ext === "flac") return "audio/flac";
  return "audio/mpeg";
}

/**
 * 轮询 Gemini File API 等待文件状态变为 ACTIVE
 */
async function waitForFileActive(
  fileName: string,
  apiKey: string,
  baseUrl: string,
): Promise<void> {
  const parsed = new URL(baseUrl);
  parsed.pathname = parsed.pathname.replace(/\/v1(beta)?\/?$/i, "");
  parsed.search = "";
  parsed.hash = "";
  const fileApiBase = parsed.toString().replace(/\/$/, "");

  const deadline = Date.now() + FILE_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const statusRes = await fetch(
      `${fileApiBase}/v1beta/files/${encodeURIComponent(fileName)}?key=${encodeURIComponent(apiKey)}`,
    );
    if (statusRes.ok) {
      const info = await statusRes.json();
      if (info?.state === "ACTIVE") return;
      if (info?.state === "FAILED") {
        throw new Error("Gemini File API 文件处理失败");
      }
    }
    await new Promise((r) => setTimeout(r, FILE_POLL_INTERVAL_MS));
  }
  throw new Error("Gemini File API 文件处理超时，未达到 ACTIVE 状态");
}

/**
 * 上传文件到 Gemini File API
 */
async function uploadToGeminiFileApi(
  audioBuffer: ArrayBuffer,
  mimeType: string,
  apiKey: string,
  baseUrl: string,
): Promise<string> {
  // File API 上传（resumable upload protocol）
  const uploadBaseUrl = buildGeminiUploadBaseUrl(baseUrl);
  const initRes = await fetch(`${uploadBaseUrl}/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Header-Content-Length": String(audioBuffer.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "audio-upload" } }),
  });

  if (!initRes.ok) {
    const errBody = await initRes.text().catch(() => "");
    throw new Error(`Gemini File API 初始化失败 (${initRes.status}): ${errBody.slice(0, 200)}`);
  }

  const uploadUrl = initRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini File API 未返回上传 URL");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(audioBuffer.byteLength),
    },
    body: audioBuffer,
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text().catch(() => "");
    throw new Error(`Gemini File API 上传失败 (${uploadRes.status}): ${errBody.slice(0, 200)}`);
  }

  const fileInfo = await uploadRes.json();
  const fileUri = fileInfo?.file?.uri;
  if (!fileUri) throw new Error("Gemini File API 上传成功但未返回文件 URI");

  return fileUri;
}

/**
 * 发送转录请求给 Gemini
 */
export async function submitGeminiTranscription(
  audioBuffer: ArrayBuffer,
  audioUrl: string,
  apiKey: string,
  baseUrl: string,
  modelName: string,
  mimeType: string,
): Promise<{ transcript: string; segments: Array<{ timestamp: string; text: string }>; wordCount: number; language: string }> {
  let audioPart: Record<string, unknown>;

  if (audioBuffer.byteLength <= INLINE_DATA_LIMIT) {
    // inline_data（小文件，<18MB）
    const base64 = Buffer.from(audioBuffer).toString("base64");
    audioPart = {
      inlineData: {
        mimeType,
        data: base64,
      },
    };
  } else {
    // File API（大文件，18-30MB）
    const fileUri = await uploadToGeminiFileApi(audioBuffer, mimeType, apiKey, baseUrl);
    // P1: 轮询等待文件 ACTIVE 状态
    const fileName = fileUri.split("/files/")[1]?.split("?")[0];
    if (fileName) await waitForFileActive(fileName, apiKey, baseUrl);
    audioPart = {
      fileData: {
        mimeType,
        fileUri,
      },
    };
  }

  const prompt = "请逐字转录这段音频的全部内容，保持原始语言（中/英文原样保留）。要求：1) 完整转录，不要省略任何内容；2) 每句话前标注时间戳，格式为 [HH:MM:SS.mmm --> HH:MM:SS.mmm]；3) 每句话单独一行；4) 不要添加任何解释或总结。";

  // P1: API Key 放 header 而非 query string，避免日志泄露
  const generateUrl = `${baseUrl}/models/${encodeURIComponent(modelName)}:generateContent`;

  const genRes = await fetch(generateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            audioPart,
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!genRes.ok) {
    const errBody = await genRes.json().catch(() => null);
    const msg = errBody?.error?.message || errBody?.message || `Gemini 转录失败 (${genRes.status})`;
    throw new Error(`Gemini 转录失败：${msg}`);
  }

  const genPayload = await genRes.json();
  const text = genPayload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text.trim()) {
    throw new Error("Gemini 未返回转录结果，可能音频内容不被支持");
  }

  return buildGeminiResult(text);
}

/**
 * 解析 Gemini 文本输出为项目标准格式
 * 尝试提取 [HH:MM:SS.mmm --> HH:MM:SS.mmm] 格式的时间戳
 */
export function buildGeminiResult(
  text: string,
): { transcript: string; segments: Array<{ timestamp: string; text: string }>; wordCount: number; language: string } {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const segments: Array<{ timestamp: string; text: string }> = [];
  const textParts: string[] = [];

  const tsRegex = /\[(\d{2}:\d{2}:\d{2}[\.:]\d{1,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[\.:]\d{1,3})\]\s*(.*)/;

  let hasTimestamps = false;
  for (const line of lines) {
    const match = line.match(tsRegex);
    if (match) {
      hasTimestamps = true;
      const tsText = match[3]?.trim();
      if (tsText) {
        segments.push({
          timestamp: `[${match[1]} --> ${match[2]}]`,
          text: tsText,
        });
        textParts.push(tsText);
      }
    } else if (line) {
      textParts.push(line);
    }
  }

  const transcript = textParts.join("\n").trim();

  // 如果没有时间戳，用分段 fallback
  if (!hasTimestamps && transcript) {
    const fallbackSegments: Array<{ timestamp: string; text: string }> = [];
    transcript.split("\n").forEach((line, index) => {
      const lineText = line.trim();
      if (!lineText) return;
      fallbackSegments.push({
        timestamp: `[00:00:${String(index).padStart(2, "0")}.000 --> 00:00:${String(index + 1).padStart(2, "0")}.000]`,
        text: lineText,
      });
    });
    return {
      transcript,
      segments: fallbackSegments,
      wordCount: transcript.replace(/\s/g, "").length,
      language: "unknown",
    };
  }

  return {
    transcript,
    segments,
    wordCount: transcript.replace(/\s/g, "").length,
    language: "unknown",
  };
}
