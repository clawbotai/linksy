import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 20 * 60 * 1000; // 20 分钟

function formatDashScopeTimestamp(ms: number): string {
  const totalMs = Math.max(0, ms);
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
    const text = String(item.text || "").trim();
    if (text) parts.push(text);
    if (Array.isArray(item.sentences)) {
      for (const sentence of item.sentences) {
        const st = String(sentence.text || "").trim();
        if (!st) continue;
        const begin = sentence.begin_time ?? sentence.sentence_begin_time ?? 0;
        const end = sentence.end_time ?? sentence.sentence_end_time ?? begin;
        segments.push({
          timestamp: `[${formatDashScopeTimestamp(begin)} --> ${formatDashScopeTimestamp(end)}]`,
          text: st,
        });
      }
    }
  }

  const transcript = parts.join("\n").trim();
  if (!segments.length && transcript) {
    transcript.split("\n").forEach((line, i) => {
      const t = line.trim();
      if (t) segments.push({ timestamp: `[00:00:${String(i).padStart(2, "0")}.000 --> 00:00:${String(i + 1).padStart(2, "0")}.000]`, text: t });
    });
  }
  return { transcript, segments };
}

function writeSse(res: VercelResponse, data: any) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export const config = { maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const dashScopeTaskId = req.query.dashScopeTaskId as string;
  const apiKey = req.query.apiKey as string;
  const baseUrl = ((req.query.baseUrl as string) || DEFAULT_QWEN_BASE_URL).replace(/\/$/, "");
  const title = (req.query.title as string) || "未知标题";
  const audioUrl = (req.query.audioUrl as string) || "";

  if (!dashScopeTaskId || !apiKey) {
    return res.status(400).json({ success: false, error: "缺少必要参数" });
  }

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.write("retry: 3000\n\n");

  const taskId = req.query.id as string;
  const startedAt = Date.now();
  let progress = 20;
  let heartbeat: ReturnType<typeof setInterval>;

  try {
    heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 10000);

    while (Date.now() - startedAt < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const queryRes = await fetch(`${baseUrl}/tasks/${dashScopeTaskId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
      });

      if (!queryRes.ok) {
        writeSse(res, { success: true, data: { id: taskId, status: "error", error: `DashScope 查询失败 (${queryRes.status})` } });
        break;
      }

      const queryPayload = await queryRes.json();
      const status = String(queryPayload?.output?.task_status || "").toUpperCase();
      const code = queryPayload?.output?.code || queryPayload?.code;
      const message = queryPayload?.output?.message || queryPayload?.message;

      if (code) {
        writeSse(res, { success: true, data: { id: taskId, status: "error", error: `DashScope 错误: ${message}` } });
        break;
      }

      if (status === "FAILED" || status === "CANCELED") {
        writeSse(res, { success: true, data: { id: taskId, status: "error", error: message || "转录失败" } });
        break;
      }

      if (status === "SUCCEEDED") {
        const transcriptionUrl = queryPayload?.output?.result?.transcription_url;
        if (!transcriptionUrl) {
          writeSse(res, { success: true, data: { id: taskId, status: "error", error: "转录完成但未返回结果" } });
          break;
        }

        const resultRes = await fetch(transcriptionUrl);
        if (!resultRes.ok) {
          writeSse(res, { success: true, data: { id: taskId, status: "error", error: "下载转录结果失败" } });
          break;
        }

        const resultPayload = await resultRes.json();
        const result = buildResultFromPayload(resultPayload);
        const wordCount = result.transcript.replace(/\s/g, "").length;

        writeSse(res, {
          success: true,
          data: {
            id: taskId,
            taskId,
            title,
            status: "completed",
            progress: 100,
            segments: result.segments,
            transcript: result.transcript,
            wordCount,
            audioUrl,
            language: "zh",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
        break;
      }

      // RUNNING — 更新进度
      progress = Math.min(progress + 5, 85);
      writeSse(res, {
        success: true,
        data: {
          id: taskId,
          taskId,
          title,
          status: "transcribing",
          progress,
          segments: [],
          audioUrl,
        },
      });
    }

    if (Date.now() - startedAt >= TIMEOUT_MS) {
      writeSse(res, { success: true, data: { id: taskId, status: "error", error: "转录超时（20分钟）" } });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "转录异常";
    writeSse(res, { success: true, data: { id: taskId, status: "error", error: message } });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}
