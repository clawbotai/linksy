import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertSafePublicUrl } from "../../_lib/podcast-resolver.js";
import { DEFAULT_DASHSCOPE_BASE_URL, buildDashScopeHint } from "../../_lib/dashscope.js";
import { safeFetchJson } from "../../_lib/safe-fetch.js";

const TASK_ID_RE = /^[A-Za-z0-9._-]+$/;

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
        timestamp: `[${formatDashScopeTimestamp(index * 1000)} --> ${formatDashScopeTimestamp((index + 1) * 1000)}]`,
        text,
      });
    });
  }

  return {
    transcript,
    segments,
    wordCount: transcript.replace(/\s/g, "").length,
    language: "unknown",
  };
}

async function handleDashScopeStatus(
  taskId: string,
  apiKey: string,
  baseUrl: string,
  res: VercelResponse,
) {
  try {
    const queryRes = await fetch(`${baseUrl}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
    });

    if (!queryRes.ok) {
      let message = `DashScope 查询失败 (${queryRes.status})`;
      if (queryRes.status === 404 || queryRes.status === 400) {
        message += buildDashScopeHint(baseUrl);
      }
      return res.status(queryRes.status).json({ status: "error", message });
    }

    const queryPayload = await queryRes.json();
    const taskStatus = String(queryPayload?.output?.task_status || "").toUpperCase();
    const code = queryPayload?.output?.code || queryPayload?.code;
    const message = queryPayload?.output?.message || queryPayload?.message;

    if (code) {
      return res.status(200).json({ status: "error", message: message || "转录失败" });
    }

    if (taskStatus === "FAILED") {
      return res.status(200).json({ status: "error", message: message || "转录失败" });
    }

    if (taskStatus === "CANCELED") {
      return res.status(200).json({ status: "canceled" });
    }

    if (taskStatus === "SUCCEEDED") {
      const transcriptionUrl = queryPayload?.output?.result?.transcription_url;
      if (!transcriptionUrl) {
        return res.status(200).json({ status: "error", message: "转录完成但未返回结果地址" });
      }

      // P0: SSRF 防护 — transcription_url 也需要校验，防恶意 DashScope 任务
      try {
        await assertSafePublicUrl(transcriptionUrl);
      } catch {
        return res.status(200).json({ status: "error", message: "转录结果地址不安全" });
      }

      const resultPayload = await safeFetchJson(transcriptionUrl, {
        timeoutMs: 60_000,
        maxBytes: 16 * 1024 * 1024,
      });
      const result = buildResultFromPayload(resultPayload);
      return res.status(200).json({ status: "completed", result });
    }

    return res.status(200).json({ status: "running" });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "查询任务状态异常";
    return res.status(500).json({ status: "error", message: errMessage });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  const taskId = req.query.id as string;
  if (!taskId) {
    return res.status(400).json({ status: "error", message: "缺少任务 ID" });
  }
  if (!TASK_ID_RE.test(taskId)) {
    return res.status(400).json({ status: "error", message: "任务 ID 格式无效" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "缺少或无效的 Authorization header" });
  }
  const apiKey = authHeader.slice(7).trim();
  if (!apiKey) {
    return res.status(401).json({ status: "error", message: "API Key 不能为空" });
  }

  const baseUrl = ((req.query.baseUrl as string) || DEFAULT_DASHSCOPE_BASE_URL).replace(/\/$/, "");
  try {
    await assertSafePublicUrl(baseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "无效的 baseUrl";
    return res.status(400).json({ status: "error", message });
  }
  return handleDashScopeStatus(taskId, apiKey, baseUrl, res);
}
