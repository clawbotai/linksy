import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";

function formatDashScopeTimestamp(ms: number): string {
  const totalMs = Math.max(0, Number(ms) || 0);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms2 = totalMs % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms2).padStart(3, "0")}`;
}

function buildResultFromPayload(payload: any) {
  const items = Array.isArray(payload) ? payload : payload?.transcripts || payload?.output?.results || [];
  const segments: Array<{ timestamp: string; text: string }> = [];
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

function setCorsHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  // 1. 获取 taskId
  const taskId = req.query.id as string;
  if (!taskId) {
    return res.status(400).json({ status: "error", message: "缺少任务 ID" });
  }

  // 2. 获取 API Key
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "缺少或无效的 Authorization header" });
  }
  const apiKey = authHeader.slice(7).trim();
  if (!apiKey) {
    return res.status(401).json({ status: "error", message: "API Key 不能为空" });
  }

  // 3. 可选 baseUrl
  const baseUrl = ((req.query.baseUrl as string) || DEFAULT_QWEN_BASE_URL).replace(/\/$/, "");

  try {
    // 4. 查询 DashScope 任务状态
    const queryRes = await fetch(`${baseUrl}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
    });

    if (!queryRes.ok) {
      return res.status(queryRes.status).json({
        status: "error",
        message: `DashScope 查询失败 (${queryRes.status})`,
      });
    }

    const queryPayload = await queryRes.json();
    const taskStatus = String(queryPayload?.output?.task_status || "").toUpperCase();
    const code = queryPayload?.output?.code || queryPayload?.code;
    const message = queryPayload?.output?.message || queryPayload?.message;

    // 5. 解析响应
    // 错误码
    if (code) {
      return res.status(200).json({
        status: "error",
        message: message || "转录失败",
      });
    }

    // FAILED
    if (taskStatus === "FAILED") {
      return res.status(200).json({
        status: "error",
        message: message || "转录失败",
      });
    }

    // CANCELED
    if (taskStatus === "CANCELED") {
      return res.status(200).json({ status: "canceled" });
    }

    // SUCCEEDED
    if (taskStatus === "SUCCEEDED") {
      const transcriptionUrl = queryPayload?.output?.result?.transcription_url;
      if (!transcriptionUrl) {
        return res.status(200).json({
          status: "error",
          message: "转录完成但未返回结果地址",
        });
      }

      const resultRes = await fetch(transcriptionUrl);
      if (!resultRes.ok) {
        return res.status(200).json({
          status: "error",
          message: "下载转录结果失败",
        });
      }

      const resultPayload = await resultRes.json();
      const result = buildResultFromPayload(resultPayload);

      return res.status(200).json({
        status: "completed",
        result,
      });
    }

    // RUNNING 或其他状态
    return res.status(200).json({ status: "running" });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "查询任务状态异常";
    return res.status(500).json({ status: "error", message: errMessage });
  }
}
