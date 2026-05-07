import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertSafePublicUrl, resolvePodcastAudio } from "./_lib/podcast-resolver.js";
import { DEFAULT_DASHSCOPE_BASE_URL, buildDashScopeHint } from "./_lib/dashscope.js";

// --- DashScope 提交 ---

async function submitDashScopeJob(
  audioUrl: string,
  apiKey: string,
  baseUrl: string,
  modelName?: string,
  enableITN?: boolean,
): Promise<string> {
  const res = await fetch(`${baseUrl}/services/audio/asr/transcription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: modelName || "qwen3-asr-flash-filetrans",
      input: { file_url: audioUrl },
      parameters: { channel_id: [0], enable_itn: enableITN ?? true, enable_words: true },
    }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    let msg = payload?.output?.message || payload?.message || `DashScope 提交失败 (${res.status})`;
    if (res.status === 404 || res.status === 400) {
      msg += buildDashScopeHint(baseUrl);
    }
    throw new Error(msg);
  }

  const payload = await res.json();
  const taskId = payload?.output?.task_id;
  if (!taskId) throw new Error(payload?.message || "DashScope 任务提交失败");
  return taskId;
}

// --- API 路由 ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({ success: true, data: [] });
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};

      const url: string = body.url;
      const apiKey: string = body.apiKey || body.onlineASRConfig?.apiKey;
      const baseUrl: string = (body.baseUrl || body.onlineASRConfig?.baseUrl || DEFAULT_DASHSCOPE_BASE_URL).replace(/\/$/, "");
      const modelName: string | undefined = body.modelName || body.onlineASRConfig?.modelName;
      const enableITN: boolean | undefined = typeof body.enableITN === "boolean"
        ? body.enableITN
        : typeof body.onlineASRConfig?.enableITN === "boolean"
          ? body.onlineASRConfig.enableITN
          : undefined;

      if (!url) return res.status(400).json({ success: false, error: "缺少播客链接" });
      if (!apiKey) return res.status(400).json({ success: false, error: "缺少 DashScope API Key" });
      await assertSafePublicUrl(baseUrl);

      const episode = await resolvePodcastAudio(url);
      const dashScopeTaskId = await submitDashScopeJob(episode.audioUrl, apiKey, baseUrl, modelName, enableITN);

      const taskId = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

      return res.status(200).json({
        success: true,
        data: {
          taskId,
          dashScopeTaskId,
          title: episode.title,
          audioUrl: episode.audioUrl,
          source: episode.source,
          duration: episode.duration,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "转录启动失败";
      return res.status(500).json({ success: false, error: message });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
