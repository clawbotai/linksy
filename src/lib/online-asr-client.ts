import type { OnlineASRConfig, TranscribeSegment } from "@/types";

const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;

export type DashScopeSubmitResult = {
  taskId: string;
};

export type DashScopeTranscriptionResult = {
  transcript: string;
  segments: TranscribeSegment[];
  wordCount: number;
  language: string;
};

export type DashScopeProgressUpdate = {
  status: "transcribing";
  progress: number;
};

function getBaseUrl(config: Pick<OnlineASRConfig, "baseUrl">): string {
  return (config.baseUrl || DEFAULT_QWEN_BASE_URL).replace(/\/$/, "");
}

function buildAuthHeaders(config: Pick<OnlineASRConfig, "apiKey">): HeadersInit {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    "X-DashScope-Async": "enable",
  };
}

function formatDashScopeTimestamp(ms: number): string {
  const totalMs = Math.max(0, Number(ms) || 0);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms2 = totalMs % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms2).padStart(3, "0")}`;
}

function getDashScopeMessage(payload: any, fallback: string): string {
  return payload?.output?.message || payload?.message || payload?.error || fallback;
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function explainBrowserFetchError(action: string): Error {
  return new Error(
    `${action}失败。浏览器可能被目标服务的跨域策略拦截；纯前端模式下需要 ASR 服务允许浏览器直接调用。`,
  );
}

export async function testDashScopeConnection(config: OnlineASRConfig): Promise<{
  success: boolean;
  message: string;
}> {
  if (!config.apiKey.trim()) {
    return { success: false, message: "API Key 不能为空" };
  }

  try {
    const response = await fetch(`${getBaseUrl(config)}/tasks/linksy_connection_test`, {
      headers: buildAuthHeaders(config),
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: "API Key 无效" };
    }

    if (response.status === 404 || response.status === 400) {
      return { success: true, message: "浏览器直连可用" };
    }

    if (response.ok) {
      return { success: true, message: "浏览器直连可用" };
    }

    return { success: false, message: `连接失败 (${response.status})` };
  } catch {
    return { success: false, message: "浏览器无法直连 DashScope，可能被 CORS 拦截" };
  }
}

export async function submitDashScopeTranscriptionJob(
  audioUrl: string,
  config: OnlineASRConfig,
  signal?: AbortSignal,
): Promise<DashScopeSubmitResult> {
  let response: Response;

  try {
    response = await fetch(`${getBaseUrl(config)}/services/audio/asr/transcription`, {
      method: "POST",
      headers: buildAuthHeaders(config),
      signal,
      body: JSON.stringify({
        model: config.modelName || "qwen3-asr-flash-filetrans",
        input: { file_url: audioUrl },
        parameters: {
          channel_id: [0],
          enable_itn: config.enableITN,
          enable_words: true,
        },
      }),
    });
  } catch {
    throw explainBrowserFetchError("提交转录任务");
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    throw new Error(getDashScopeMessage(payload, `DashScope 提交失败 (${response.status})`));
  }

  const taskId = payload?.output?.task_id;
  if (!taskId) {
    throw new Error(getDashScopeMessage(payload, "DashScope 未返回任务 ID"));
  }

  return { taskId };
}

function buildResultFromPayload(payload: any): DashScopeTranscriptionResult {
  const items = Array.isArray(payload) ? payload : payload?.transcripts || payload?.output?.results || [];
  const segments: TranscribeSegment[] = [];
  const parts: string[] = [];

  for (const item of items) {
    const text = String(item?.text || "").trim();
    if (text) parts.push(text);

    if (Array.isArray(item?.sentences)) {
      for (const sentence of item.sentences) {
        const sentenceText = String(sentence?.text || "").trim();
        if (!sentenceText) continue;

        const begin = sentence.begin_time ?? sentence.sentence_begin_time ?? 0;
        const end = sentence.end_time ?? sentence.sentence_end_time ?? begin;
        segments.push({
          timestamp: `[${formatDashScopeTimestamp(begin)} --> ${formatDashScopeTimestamp(end)}]`,
          text: sentenceText,
        });
      }
    }
  }

  const transcript = parts.join("\n").trim();
  if (!segments.length && transcript) {
    transcript.split("\n").forEach((line, index) => {
      const text = line.trim();
      if (!text) return;

      segments.push({
        timestamp: `[00:00:${String(index).padStart(2, "0")}.000 --> 00:00:${String(index + 1).padStart(2, "0")}.000]`,
        text,
      });
    });
  }

  return {
    transcript,
    segments,
    wordCount: transcript.replace(/\s/g, "").length,
    language: "zh",
  };
}

async function fetchDashScopeResult(transcriptionUrl: string, signal?: AbortSignal) {
  let response: Response;

  try {
    response = await fetch(transcriptionUrl, { signal });
  } catch {
    throw explainBrowserFetchError("下载转录结果");
  }

  if (!response.ok) {
    throw new Error(`下载转录结果失败 (${response.status})`);
  }

  return buildResultFromPayload(await response.json());
}

export async function waitForDashScopeTranscription(
  dashScopeTaskId: string,
  config: OnlineASRConfig,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    onProgress?: (update: DashScopeProgressUpdate) => void;
  } = {},
): Promise<DashScopeTranscriptionResult> {
  const startedAt = Date.now();
  let progress = 20;

  while (Date.now() - startedAt < (options.timeoutMs ?? DEFAULT_TIMEOUT_MS)) {
    if (options.signal?.aborted) {
      throw new DOMException("转录已取消", "AbortError");
    }

    await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));

    let response: Response;
    try {
      response = await fetch(`${getBaseUrl(config)}/tasks/${dashScopeTaskId}`, {
        headers: buildAuthHeaders(config),
        signal: options.signal,
      });
    } catch {
      throw explainBrowserFetchError("查询转录任务");
    }

    const payload = await safeJson(response);
    if (!response.ok) {
      throw new Error(getDashScopeMessage(payload, `DashScope 查询失败 (${response.status})`));
    }

    const code = payload?.output?.code || payload?.code;
    const message = payload?.output?.message || payload?.message;
    if (code) {
      throw new Error(`DashScope 错误: ${message || code}`);
    }

    const status = String(payload?.output?.task_status || "").toUpperCase();
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(message || "转录失败");
    }

    if (status === "SUCCEEDED") {
      const transcriptionUrl = payload?.output?.result?.transcription_url;
      if (!transcriptionUrl) {
        throw new Error("转录完成但未返回结果地址");
      }

      return fetchDashScopeResult(transcriptionUrl, options.signal);
    }

    progress = Math.min(progress + 5, 85);
    options.onProgress?.({ status: "transcribing", progress });
  }

  throw new Error("转录超时");
}
