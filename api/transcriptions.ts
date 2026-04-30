import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";

// --- 播客信息获取（复用 memo-flow/helper 逻辑）---

function extractXiaoyuzhouEpisodeId(url: string): string {
  const match = url.match(/episode\/([a-f0-9]+)/i);
  return match ? match[1] : "";
}

function detectPodcastSource(url: string): string {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname === "podcasts.apple.com") {
      if (!/\/id(\d+)/i.test(parsed.pathname)) return "apple-invalid";
      if (!parsed.searchParams.get("i")) return "apple-show";
      return /^\d+$/.test(parsed.searchParams.get("i")!) ? "apple-episode" : "apple-invalid";
    }
    if (
      (parsed.hostname === "www.xiaoyuzhoufm.com" || parsed.hostname === "xiaoyuzhoufm.com") &&
      extractXiaoyuzhouEpisodeId(parsed.pathname)
    ) {
      return "xiaoyuzhou";
    }
  } catch {}
  return extractXiaoyuzhouEpisodeId(url) ? "xiaoyuzhou" : "unsupported";
}

async function fetchFromOfficialApi(episodeId: string, signal?: AbortSignal) {
  try {
    const res = await fetch("https://api.xiaoyuzhoufm.com/v1/episode/get", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "okhttp/4.7.2",
        applicationid: "app.podcast.cosmos",
        "app-version": "1.6.0",
      },
      body: JSON.stringify({ eid: episodeId }),
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const audioUrl = data?.data?.enclosure?.url || data?.enclosure?.url || data?.mediaUrl || "";
    if (!audioUrl) return null;
    return {
      title: data?.data?.title || "未知标题",
      audioUrl,
      duration: data?.data?.duration ? Math.floor(data.data.duration) : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchFromPageHtml(episodeId: string, signal?: AbortSignal) {
  try {
    const res = await fetch(`https://www.xiaoyuzhoufm.com/episode/${episodeId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const episode = nextData?.props?.pageProps?.episode || nextData?.props?.pageProps?.data?.episode;
        const audioUrl = episode?.enclosure?.url || episode?.mediaUrl || "";
        if (audioUrl) return { title: episode.title || "未知标题", audioUrl, duration: episode.duration };
      } catch {}
    }
    const ogAudio = html.match(/<meta\s+property="og:audio"\s+content="([^"]+)"/);
    if (ogAudio) {
      const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
      return { title: titleMatch?.[1] || "未知标题", audioUrl: ogAudio[1] };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAppleEpisodeInfo(url: string, signal?: AbortSignal) {
  const parsed = new URL(url);
  const collectionMatch = parsed.pathname.match(/\/id(\d+)/i);
  const trackId = parsed.searchParams.get("i");
  if (!collectionMatch || !trackId) throw new Error("无效的 Apple Podcasts 链接");

  const lookupUrl = new URL("https://itunes.apple.com/lookup");
  lookupUrl.searchParams.set("id", collectionMatch[1]);
  lookupUrl.searchParams.set("media", "podcast");
  lookupUrl.searchParams.set("entity", "podcastEpisode");
  lookupUrl.searchParams.set("limit", "200");

  const res = await fetch(lookupUrl, { signal });
  if (!res.ok) throw new Error("无法获取 Apple Podcasts 信息");
  const data = await res.json();
  const results = data?.results || [];
  const episode = results.find((r: any) => String(r.trackId) === trackId);
  if (!episode?.episodeUrl) throw new Error("无法解析 Apple Podcasts 音频链接");
  return {
    title: episode.trackName || "未知标题",
    audioUrl: episode.episodeUrl,
    duration: episode.trackTimeMillis ? Math.floor(episode.trackTimeMillis / 1000) : undefined,
  };
}

async function fetchEpisodeInfo(url: string, signal?: AbortSignal) {
  const source = detectPodcastSource(url);
  if (source === "xiaoyuzhou") {
    const episodeId = extractXiaoyuzhouEpisodeId(url);
    const fromApi = await fetchFromOfficialApi(episodeId, signal);
    if (fromApi) return fromApi;
    const fromPage = await fetchFromPageHtml(episodeId, signal);
    if (fromPage) return fromPage;
    throw new Error("无法获取播客音频链接");
  }
  if (source === "apple-episode") return fetchAppleEpisodeInfo(url, signal);
  if (source === "apple-show") throw new Error("当前仅支持播客单集链接");
  if (source === "apple-invalid") throw new Error("无效的播客链接");
  throw new Error("不支持的播客平台");
}

// --- DashScope 提交 ---

async function submitDashScopeJob(audioUrl: string, apiKey: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/services/audio/asr/transcription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: "qwen3-asr-flash-filetrans",
      input: { file_url: audioUrl },
      parameters: { channel_id: [0], enable_itn: true, enable_words: true },
    }),
  });
  if (!res.ok) throw new Error(`DashScope 提交失败 (${res.status})`);
  const payload = await res.json();
  const taskId = payload?.output?.task_id;
  if (!taskId) throw new Error(payload?.message || "DashScope 任务提交失败");
  return taskId;
}

// --- API 路由 ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    // 前端使用 IndexedDB 管理历史，API 返回空列表
    return res.status(200).json({ success: true, data: [] });
  }

  if (req.method === "POST") {
    try {
      const { url, onlineASRConfig } = req.body;
      if (!url) return res.status(400).json({ success: false, error: "缺少播客链接" });

      const apiKey = onlineASRConfig?.apiKey;
      const baseUrl = (onlineASRConfig?.baseUrl || DEFAULT_QWEN_BASE_URL).replace(/\/$/, "");
      if (!apiKey) return res.status(400).json({ success: false, error: "缺少千问 ASR API Key" });

      // 获取播客信息
      const episode = await fetchEpisodeInfo(url);

      // 提交 DashScope 任务
      const dashScopeTaskId = await submitDashScopeJob(episode.audioUrl, apiKey, baseUrl);

      const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      return res.status(200).json({
        success: true,
        data: {
          taskId,
          dashScopeTaskId,
          title: episode.title,
          audioUrl: episode.audioUrl,
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
