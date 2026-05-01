import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseStringPromise } from "xml2js";

const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";

// --- 类型 ---

type ResolvedPodcastAudio = {
  title: string;
  audioUrl: string;
  source: "direct-audio" | "apple-podcasts" | "rss" | "webpage" | "xiaoyuzhou";
  duration?: number;
};

// --- URL 安全校验 ---

const PRIVATE_IP_RANGES = [
  // 127.0.0.0/8
  { start: 0x7f000000, end: 0x7fffffff },
  // 10.0.0.0/8
  { start: 0x0a000000, end: 0x0affffff },
  // 172.16.0.0/12
  { start: 0xac100000, end: 0xac1fffff },
  // 192.168.0.0/16
  { start: 0xc0a80000, end: 0xc0a8ffff },
  // 169.254.169.254 (cloud metadata)
  { start: 0xa9fea9fe, end: 0xa9fea9fe },
] as const;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0; // unsigned 32-bit
}

function isPrivateIp(ip: string): boolean {
  const num = ipv4ToInt(ip);
  if (num === null) return false;
  return PRIVATE_IP_RANGES.some((r) => num >= r.start && num <= r.end);
}

function assertSafeUrl(input: string): void {
  const parsed = parseUrl(input);
  if (!parsed) throw new Error("无效的 URL");

  // 只允许 http / https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("不支持的协议，仅允许 http 和 https");
  }

  const hostname = parsed.hostname.toLowerCase();

  // 阻止 localhost
  if (hostname === "localhost") {
    throw new Error("不允许访问本地地址");
  }

  // 阻止 IPv6 loopback
  // URL 会将 IPv6 解析为 [::1] 形式，hostname 不含方括号
  if (hostname === "::1" || hostname === "0:0:0:0:0:0:0:1") {
    throw new Error("不允许访问本地地址");
  }

  // 如果 hostname 是 IPv4 格式，检查内网范围
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) && isPrivateIp(hostname)) {
    throw new Error("不允许访问内网地址");
  }
}

// --- 通用工具 ---

const AUDIO_EXTENSION_RE = /\.(mp3|m4a|mp4|aac|wav|flac|ogg|opus)(?:[?#].*)?$/i;

function parseUrl(input: string): URL | null {
  try {
    return new URL(input.trim());
  } catch {
    return null;
  }
}

function isLikelyAudioUrl(url: string): boolean {
  return AUDIO_EXTENSION_RE.test(url.trim());
}

function isLikelyRssUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  return /\.(xml|rss)(?:[?#].*)?$/i.test(parsed.pathname) || parsed.pathname.toLowerCase().includes("feed");
}

function isApplePodcastUrl(url: URL): boolean {
  return url.hostname === "podcasts.apple.com" && /\/id(\d+)/i.test(url.pathname);
}

function isXiaoyuzhouUrl(url: URL): boolean {
  return (
    (url.hostname === "www.xiaoyuzhoufm.com" || url.hostname === "xiaoyuzhoufm.com") &&
    !!extractXiaoyuzhouEpisodeId(url.pathname)
  );
}

function extractXiaoyuzhouEpisodeId(urlOrPath: string): string {
  const match = urlOrPath.match(/episode\/([a-f0-9]+)/i);
  return match ? match[1] : "";
}

async function fetchText(url: string): Promise<string> {
  assertSafeUrl(url);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`读取链接失败 (${response.status})`);
  }
  return response.text();
}

// --- RSS 解析 (xml2js, Node.js 兼容) ---

function getXmlText(node: any): string {
  if (typeof node === "string") return node.trim();
  if (Array.isArray(node)) return getXmlText(node[0]);
  if (typeof node === "object" && node !== null) {
    if (typeof node._ === "string") return node._.trim();
  }
  return "";
}

function getXmlAttr(node: any, attr: string): string {
  if (!node || typeof node !== "object") return "";
  // xml2js puts attributes in $ object
  return node?.$?.[attr] || "";
}

async function parseRssAudioServerSide(xml: string, feedUrl: string): Promise<ResolvedPodcastAudio> {
  let result: any;
  try {
    result = await parseStringPromise(xml, { explicitArray: true, mergeAttrs: false });
  } catch {
    throw new Error("RSS 内容格式无效");
  }

  // Handle both RSS and Atom feeds
  const channel = result?.rss?.channel?.[0];
  const atomFeed = result?.feed;

  let firstItem: any;
  let channelTitle = "";

  if (channel) {
    // RSS format
    firstItem = channel.item?.[0];
    channelTitle = getXmlText(channel.title);
  } else if (atomFeed) {
    // Atom format
    firstItem = atomFeed.entry?.[0];
    channelTitle = getXmlText(atomFeed.title);
  }

  if (!firstItem) {
    throw new Error("RSS 中没有找到播客单集");
  }

  // Try to find audio URL from various common RSS patterns
  let audioUrl = "";

  // 1. <enclosure url="...">
  const enclosures = firstItem.enclosure;
  if (Array.isArray(enclosures)) {
    for (const enc of enclosures) {
      const url = getXmlAttr(enc, "url");
      if (url) {
        audioUrl = url;
        break;
      }
    }
  }

  // 2. <media:content url="...">
  if (!audioUrl) {
    const mediaContent = firstItem["media:content"];
    if (Array.isArray(mediaContent)) {
      for (const mc of mediaContent) {
        const url = getXmlAttr(mc, "url");
        if (url) {
          audioUrl = url;
          break;
        }
      }
    }
  }

  // 3. Atom <link rel="enclosure" href="...">
  if (!audioUrl && Array.isArray(firstItem.link)) {
    for (const link of firstItem.link) {
      const rel = getXmlAttr(link, "rel");
      const href = getXmlAttr(link, "href");
      const type = getXmlAttr(link, "type");
      if ((rel === "enclosure" || (type && type.startsWith("audio/"))) && href) {
        audioUrl = href;
        break;
      }
    }
  }

  if (!audioUrl) {
    throw new Error("RSS 中没有找到音频地址");
  }

  const itemTitle = getXmlText(firstItem.title);

  return {
    title: itemTitle || channelTitle || "未命名播客",
    audioUrl: new URL(audioUrl.trim(), feedUrl).toString(),
    source: "rss",
  };
}

async function resolveRssFeed(url: string): Promise<ResolvedPodcastAudio> {
  const xml = await fetchText(url);
  return parseRssAudioServerSide(xml, url);
}

// --- Apple Podcasts ---

async function resolveApplePodcastUrl(url: URL): Promise<ResolvedPodcastAudio> {
  const collectionId = url.pathname.match(/\/id(\d+)/i)?.[1];
  const trackId = url.searchParams.get("i");

  if (!collectionId || !trackId) {
    throw new Error("请粘贴 Apple Podcasts 的单集链接（需包含单集 ID 参数 i=xxx）");
  }

  const lookupUrl = new URL("https://itunes.apple.com/lookup");
  lookupUrl.searchParams.set("id", collectionId);
  lookupUrl.searchParams.set("media", "podcast");
  lookupUrl.searchParams.set("entity", "podcastEpisode");
  lookupUrl.searchParams.set("limit", "200");

  const response = await fetch(lookupUrl);
  if (!response.ok) {
    throw new Error(`Apple Podcasts 查询失败 (${response.status})`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const episode = results.find((item: any) => String(item.trackId) === trackId);
  const audioUrl = episode?.episodeUrl;

  if (!audioUrl) {
    throw new Error("没有从 Apple Podcasts 找到该单集音频");
  }

  return {
    title: episode.trackName || "未命名播客",
    audioUrl,
    duration: episode.trackTimeMillis ? Math.floor(Number(episode.trackTimeMillis) / 1000) : undefined,
    source: "apple-podcasts",
  };
}

// --- 小宇宙 ---

async function fetchFromXiaoyuzhouApi(episodeId: string): Promise<ResolvedPodcastAudio | null> {
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
    });
    if (!res.ok) return null;
    const data = await res.json();
    const audioUrl = data?.data?.enclosure?.url || data?.enclosure?.url || data?.mediaUrl || "";
    if (!audioUrl) return null;
    return {
      title: data?.data?.title || "未知标题",
      audioUrl,
      duration: data?.data?.duration ? Math.floor(data.data.duration) : undefined,
      source: "xiaoyuzhou",
    };
  } catch {
    return null;
  }
}

async function fetchFromXiaoyuzhouPage(episodeId: string): Promise<ResolvedPodcastAudio | null> {
  try {
    const html = await fetchText(`https://www.xiaoyuzhoufm.com/episode/${episodeId}`);
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const episode = nextData?.props?.pageProps?.episode || nextData?.props?.pageProps?.data?.episode;
        const audioUrl = episode?.enclosure?.url || episode?.mediaUrl || "";
        if (audioUrl) {
          return {
            title: episode.title || "未知标题",
            audioUrl,
            duration: episode.duration,
            source: "xiaoyuzhou",
          };
        }
      } catch {}
    }
    const ogAudio = html.match(/<meta\s+property="og:audio"\s+content="([^"]+)"/);
    if (ogAudio) {
      const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
      return {
        title: titleMatch?.[1] || "未知标题",
        audioUrl: ogAudio[1],
        source: "xiaoyuzhou",
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveXiaoyuzhouUrl(url: string): Promise<ResolvedPodcastAudio> {
  const episodeId = extractXiaoyuzhouEpisodeId(url);
  if (!episodeId) throw new Error("无效的小宇宙链接");

  const fromApi = await fetchFromXiaoyuzhouApi(episodeId);
  if (fromApi) return fromApi;

  const fromPage = await fetchFromXiaoyuzhouPage(episodeId);
  if (fromPage) return fromPage;

  throw new Error("无法获取小宇宙播客音频链接");
}

// --- 通用网页解析 (正则, Node.js 兼容) ---

async function resolveWebpagePodcast(url: string): Promise<ResolvedPodcastAudio> {
  const html = await fetchText(url);

  // Try og:audio meta tag
  const ogAudioMatch = html.match(/<meta\s+[^>]*property=["']og:audio["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:audio["']/i);
  if (ogAudioMatch) {
    const ogTitleMatch = html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const titleFromTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return {
      title: ogTitleMatch?.[1] || titleFromTag?.[1]?.trim() || "未命名播客",
      audioUrl: new URL(ogAudioMatch[1], url).toString(),
      source: "webpage",
    };
  }

  // Try <audio> tag
  const audioSrcMatch = html.match(/<audio[^>]*\ssrc=["']([^"']+)["']/i)
    || html.match(/<audio[^>]*>[\s\S]*?<source[^>]*\ssrc=["']([^"']+)["']/i);
  if (audioSrcMatch) {
    const titleFromTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return {
      title: titleFromTag?.[1]?.trim() || "未命名播客",
      audioUrl: new URL(audioSrcMatch[1], url).toString(),
      source: "webpage",
    };
  }

  // Try to find RSS link in the page and follow it
  const rssLinkMatch = html.match(
    /<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i,
  ) || html.match(
    /<link[^>]*href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/i,
  ) || html.match(
    /<link[^>]*type=["']application\/atom\+xml["'][^>]*href=["']([^"']+)["']/i,
  );

  if (rssLinkMatch) {
    const rssUrl = new URL(rssLinkMatch[1], url).toString();
    const resolved = await resolveRssFeed(rssUrl);
    return { ...resolved, source: "webpage" };
  }

  throw new Error("无法从该页面解析音频地址，请使用 RSS 链接或音频直链");
}

// --- 统一解析入口 ---

async function resolvePodcastAudio(input: string): Promise<ResolvedPodcastAudio> {
  const value = input.trim();
  if (!value) throw new Error("请输入播客链接或音频直链");

  const parsed = parseUrl(value);
  if (!parsed) throw new Error("请输入完整的 URL");

  // SSRF 防护：校验用户输入的原始 URL
  assertSafeUrl(value);

  // 1. Direct audio URL
  if (isLikelyAudioUrl(value)) {
    return {
      title: decodeURIComponent(parsed.pathname.split("/").pop() || "未命名音频"),
      audioUrl: value,
      source: "direct-audio",
    };
  }

  // 2. Apple Podcasts
  if (isApplePodcastUrl(parsed)) {
    return resolveApplePodcastUrl(parsed);
  }

  // 3. 小宇宙
  if (isXiaoyuzhouUrl(parsed)) {
    return resolveXiaoyuzhouUrl(value);
  }

  // 4. RSS feed
  if (isLikelyRssUrl(value)) {
    return resolveRssFeed(value);
  }

  // 5. Generic webpage
  return resolveWebpagePodcast(value);
}

// --- DashScope 提交 ---

async function submitDashScopeJob(audioUrl: string, apiKey: string, baseUrl: string): Promise<string> {
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

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const msg = payload?.output?.message || payload?.message || `DashScope 提交失败 (${res.status})`;
    throw new Error(msg);
  }

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
      const body = req.body || {};

      // 支持两种请求格式:
      // 1. { url, apiKey, baseUrl }
      // 2. { url, onlineASRConfig: { apiKey, baseUrl } }
      const url: string = body.url;
      const apiKey: string = body.apiKey || body.onlineASRConfig?.apiKey;
      const baseUrl: string = (body.baseUrl || body.onlineASRConfig?.baseUrl || DEFAULT_QWEN_BASE_URL).replace(/\/$/, "");

      if (!url) return res.status(400).json({ success: false, error: "缺少播客链接" });
      if (!apiKey) return res.status(400).json({ success: false, error: "缺少 DashScope API Key" });

      // 服务端解析播客链接
      const episode = await resolvePodcastAudio(url);

      // 提交 DashScope ASR 任务
      const dashScopeTaskId = await submitDashScopeJob(episode.audioUrl, apiKey, baseUrl);

      const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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
