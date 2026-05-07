import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolvePodcastAudio, assertSafePublicUrl } from "../_lib/podcast-resolver.js";
import { DEFAULT_GEMINI_BASE_URL, submitGeminiTranscription, guessAudioMime } from "../_lib/gemini.js";
import { downloadAudio } from "../_lib/whisper.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const body = req.body || {};
    const url: string = body.url;
    const apiKey: string = body.apiKey;
    const baseUrl: string = (body.baseUrl || DEFAULT_GEMINI_BASE_URL).replace(/\/$/, "");
    const modelName: string = body.modelName || "gemini-2.5-pro";

    if (!url) return res.status(400).json({ success: false, error: "缺少播客链接" });
    if (!apiKey) return res.status(400).json({ success: false, error: "缺少 Gemini API Key" });
    await assertSafePublicUrl(baseUrl);

    // 1. 解析播客 URL
    const episode = await resolvePodcastAudio(url);

    // 2. 下载音频（带大小检查 + SSRF 防护）
    const { buffer, contentType } = await downloadAudio(episode.audioUrl, assertSafePublicUrl);

    // 3. 推断 MIME 类型
    const mime = guessGeminiAudioMime(episode.audioUrl, contentType);

    // 4. 提交给 Gemini
    const result = await submitGeminiTranscription(buffer, episode.audioUrl, apiKey, baseUrl, modelName, mime);

    // 5. 同步返回完整结果
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
    const message = error instanceof Error ? error.message : "Gemini 转录失败";
    const status = message.includes("超出") ? 422 : 500;
    return res.status(status).json({ success: false, error: message });
  }
}

function guessGeminiAudioMime(url: string, contentType?: string): string {
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes("mp3") || ct.includes("mpeg")) return "audio/mpeg";
    if (ct.includes("m4a") || ct.includes("mp4")) return "audio/mp4";
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
