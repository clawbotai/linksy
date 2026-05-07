import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertSafePublicUrl } from "../_lib/podcast-resolver.js";
import { DEFAULT_DASHSCOPE_BASE_URL, buildDashScopeHint } from "../_lib/dashscope.js";
import { DEFAULT_WHISPER_BASE_URL, buildWhisperHint } from "../_lib/whisper.js";
import { DEFAULT_GEMINI_BASE_URL } from "../_lib/gemini.js";

function getDefaultBaseUrl(apiFormat: string | undefined): string {
  if (apiFormat === "openai-whisper") return DEFAULT_WHISPER_BASE_URL;
  if (apiFormat === "gemini") return DEFAULT_GEMINI_BASE_URL;
  return DEFAULT_DASHSCOPE_BASE_URL;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { apiKey, baseUrl, apiFormat } = req.body;
    if (!apiKey) return res.status(200).json({ success: false, message: "API Key 不能为空" });

    const url = (baseUrl || getDefaultBaseUrl(apiFormat)).replace(/\/$/, "");
    await assertSafePublicUrl(url);

    // 根据 apiFormat 选择不同的测试方式
    if (apiFormat === "dashscope") {
      return await testDashScope(apiKey, url, res);
    }
    if (apiFormat === "openai-whisper") {
      return await testWhisper(apiKey, url, res);
    }
    if (apiFormat === "gemini") {
      return await testGemini(apiKey, url, res);
    }

    // 未知 apiFormat，尝试 DashScope
    return await testDashScope(apiKey, url, res);
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: `连接失败: ${error instanceof Error ? error.message : "未知错误"}`,
    });
  }
}

async function testDashScope(apiKey: string, url: string, res: VercelResponse) {
  // P1: 用不存在的 taskId 查询，404 即视为鉴权通过，不消耗 token
  const response = await fetch(`${url}/tasks/linksy_connection_test_probe`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
  });

  if (response.status === 401 || response.status === 403) {
    return res.status(200).json({ success: false, message: "API Key 无效" });
  }
  // 404 说明鉴权通过但任务不存在（符合预期）
  if (response.status === 404 || response.ok) {
    return res.status(200).json({ success: true, message: "API Key 验证通过" });
  }
  if (response.status === 400) {
    const body = await response.json().catch(() => ({}));
    const code = String(body?.code || "");
    if (code.includes("InvalidApiKey") || code.includes("Forbidden")) {
      return res.status(200).json({ success: false, message: "API Key 无效" });
    }
    return res.status(200).json({ success: true, message: "API Key 验证通过" });
  }

  return res.status(200).json({ success: false, message: `连接失败 (${response.status})` });
}

async function testWhisper(apiKey: string, url: string, res: VercelResponse) {
  // Whisper 连接测试：用合法的极小 WAV 文件（16-bit PCM, 1Hz, 1 sample）
  const sampleRate = 1;
  const numSamples = 1;
  const wavHeader = new Uint8Array(44);
  const wavView = new DataView(wavHeader.buffer);
  // RIFF header
  wavView.setUint32(0, 0x52494646, false); // "RIFF"
  wavView.setUint32(4, 36 + numSamples * 2, true); // file size - 8
  wavView.setUint32(8, 0x57415645, false); // "WAVE"
  // fmt chunk
  wavView.setUint32(12, 0x666d7420, false); // "fmt "
  wavView.setUint32(16, 16, true); // chunk size
  wavView.setUint16(20, 1, true); // PCM
  wavView.setUint16(22, 1, true); // mono
  wavView.setUint32(24, sampleRate, true); // sample rate
  wavView.setUint32(28, sampleRate * 2, true); // byte rate
  wavView.setUint16(32, 2, true); // block align
  wavView.setUint16(34, 16, true); // bits per sample
  // data chunk
  wavView.setUint32(36, 0x64617461, false); // "data"
  wavView.setUint32(40, numSamples * 2, true); // data size
  const tinyAudio = new Uint8Array(44 + numSamples * 2);
  tinyAudio.set(wavHeader, 0);
  // 1 sample of silence (0x0000)
  tinyAudio[44] = 0x00;
  tinyAudio[45] = 0x00;
  const formData = new FormData();
  formData.append("file", new Blob([tinyAudio], { type: "audio/mpeg" }), "test.mp3");
  formData.append("model", "whisper-1");
  formData.append("response_format", "json");

  const response = await fetch(`${url}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (response.status === 401 || response.status === 403) {
    return res.status(200).json({ success: false, message: "API Key 无效" });
  }
  if (response.status === 404) {
    const hint = buildWhisperHint(url);
    return res.status(200).json({ success: false, message: "Whisper 端点不存在" + hint });
  }
  if (response.status === 400) {
    const body = await response.json().catch(() => ({}));
    // 400 可能是模型名错误，但鉴权通过
    const msg = body?.error?.message || body?.message || "";
    if (msg.includes("model") || msg.includes("audio")) {
      return res.status(200).json({ success: true, message: "连接验证通过（模型名需确认）" });
    }
    return res.status(200).json({ success: false, message: msg || "请求参数错误" });
  }
  if (response.ok) return res.status(200).json({ success: true, message: "连接验证通过" });

  return res.status(200).json({ success: false, message: `连接失败 (${response.status})` });
}

async function testGemini(apiKey: string, url: string, res: VercelResponse) {
  // Gemini 连接测试：API Key 放 header 避免日志泄露
  const response = await fetch(
    `${url}/models/gemini-2.5-flash:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "test" }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    },
  );

  if (response.status === 400 || response.status === 403) {
    const body = await response.json().catch(() => ({}));
    const msg = body?.error?.message || body?.message || "";
    if (msg.includes("API key") || msg.includes("invalid")) {
      return res.status(200).json({ success: false, message: "API Key 无效" });
    }
    // 其他 400 可能是模型名问题
    if (response.status === 400) {
      return res.status(200).json({ success: true, message: "API Key 验证通过（请确认模型名）" });
    }
    return res.status(200).json({ success: false, message: msg || "连接失败" });
  }
  if (response.ok) return res.status(200).json({ success: true, message: "连接验证通过" });

  return res.status(200).json({ success: false, message: `连接失败 (${response.status})` });
}
