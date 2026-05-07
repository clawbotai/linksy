import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolvePodcastAudio, assertSafePublicUrl } from "../_lib/podcast-resolver.js";
import { DEFAULT_WHISPER_BASE_URL, downloadAudio, submitWhisperJob } from "../_lib/whisper.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const body = req.body || {};
    const url: string = body.url;
    const apiKey: string = body.apiKey;
    const baseUrl: string = (body.baseUrl || DEFAULT_WHISPER_BASE_URL).replace(/\/$/, "");
    const modelName: string = body.modelName || "whisper-1";

    if (!url) return res.status(400).json({ success: false, error: "缺少播客链接" });
    if (!apiKey) return res.status(400).json({ success: false, error: "缺少 Whisper API Key" });
    await assertSafePublicUrl(baseUrl);

    // 1. 解析播客 URL
    const episode = await resolvePodcastAudio(url);

    // 2. 下载音频（带大小检查 + SSRF 防护）
    const { buffer, extension } = await downloadAudio(episode.audioUrl, assertSafePublicUrl);

    // 3. 提交给 Whisper 接口
    const result = await submitWhisperJob(buffer, `audio.${extension}`, apiKey, baseUrl, modelName);

    // 4. 同步返回完整结果
    const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return res.status(200).json({
      success: true,
      data: {
        taskId,
        title: episode.title,
        audioUrl: episode.audioUrl,
        source: episode.source,
        duration: episode.duration,
        done: true,
        result,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Whisper 转录失败";
    const status = message.includes("超出") ? 422 : 500;
    return res.status(status).json({ success: false, error: message });
  }
}
