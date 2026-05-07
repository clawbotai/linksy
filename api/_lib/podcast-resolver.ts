import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parseStringPromise } from "xml2js";

// --- 类型 ---

export type ResolvedPodcastAudio = {
  title: string;
  audioUrl: string;
  source: "direct-audio" | "apple-podcasts" | "rss" | "webpage" | "xiaoyuzhou";
  duration?: number;
};

// --- URL 安全校验 ---

const PRIVATE_IP_RANGES = [
  { start: 0x00000000, end: 0x00ffffff }, // 0.0.0.0/8
  { start: 0x7f000000, end: 0x7fffffff }, // 127.0.0.0/8
  { start: 0x0a000000, end: 0x0affffff }, // 10.0.0.0/8
  { start: 0x64400000, end: 0x647fffff }, // 100.64.0.0/10
  { start: 0xac100000, end: 0xac1fffff }, // 172.16.0.0/12
  { start: 0xc0a80000, end: 0xc0a8ffff }, // 192.168.0.0/16
  { start: 0xa9fe0000, end: 0xa9feffff }, // 169.254.0.0/16
  { start: 0xa9fea9fe, end: 0xa9fea9fe }, // 169.254.169.254
  { start: 0xe0000000, end: 0xffffffff }, // multicast/reserved
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
  return result >>> 0;
}

function isPrivateIp(ip: string): boolean {
  const num = ipv4ToInt(ip);
  if (num === null) return false;
  return PRIVATE_IP_RANGES.some((r) => num >= r.start && num <= r.end);
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function assertPublicHostname(hostname: string): void {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    throw new Error("不允许访问本地地址");
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4 && isPrivateIp(normalized)) {
    throw new Error("不允许访问内网地址");
  }
  if (ipVersion === 6 && isPrivateIpv6(normalized)) {
    throw new Error("不允许访问内网地址");
  }
}

export function assertSafeUrl(input: string): void {
  const parsed = parseUrl(input);
  if (!parsed) throw new Error("无效的 URL");

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("不支持的协议，仅允许 http 和 https");
  }

  assertPublicHostname(parsed.hostname);
}

export async function assertSafePublicUrl(input: string): Promise<void> {
  const parsed = parseUrl(input);
  if (!parsed) throw new Error("无效的 URL");

  assertSafeUrl(input);

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const ipVersion = isIP(hostname);
  if (ipVersion) return;

  const addresses = await lookup(hostname, { all: true, verbatim: false });
  if (!addresses.length) throw new Error("无法解析 URL 主机名");
  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIp(address)) {
      throw new Error("不允许访问解析到内网地址的 URL");
    }
    if (family === 6 && isPrivateIpv6(address)) {
      throw new Error("不允许访问解析到内网地址的 URL");
    }
  }
}

// --- 通用工具 ---

const AUDIO_EXTENSION_RE = /\.(mp3|m4a|mp4|aac|wav|flac|ogg|opus)(?:[?#].*)?$/i;

export function parseUrl(input: string): URL | null {
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
  await assertSafePublicUrl(url);
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

// --- RSS 解析 ---

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
  return node?.$?.[attr] || "";
}

async function parseRssAudioServerSide(xml: string, feedUrl: string): Promise<ResolvedPodcastAudio> {
  let result: any;
  try {
    result = await parseStringPromise(xml, { explicitArray: true, mergeAttrs: false });
  } catch {
    throw new Error("RSS 内容格式无效");
  }

  const channel = result?.rss?.channel?.[0];
  const atomFeed = result?.feed;

  let firstItem: any;
  let channelTitle = "";

  if (channel) {
    firstItem = channel.item?.[0];
    channelTitle = getXmlText(channel.title);
  } else if (atomFeed) {
    firstItem = atomFeed.entry?.[0];
    channelTitle = getXmlText(atomFeed.title);
  }

  if (!firstItem) {
    throw new Error("RSS 中没有找到播客单集");
  }

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

// --- 通用网页解析 ---

async function resolveWebpagePodcast(url: string): Promise<ResolvedPodcastAudio> {
  const html = await fetchText(url);

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

export async function resolvePodcastAudio(input: string): Promise<ResolvedPodcastAudio> {
  const value = input.trim();
  if (!value) throw new Error("请输入播客链接或音频直链");

  const parsed = parseUrl(value);
  if (!parsed) throw new Error("请输入完整的 URL");

  await assertSafePublicUrl(value);

  let result: ResolvedPodcastAudio;

  if (isLikelyAudioUrl(value)) {
    result = {
      title: decodeURIComponent(parsed.pathname.split("/").pop() || "未命名音频"),
      audioUrl: value,
      source: "direct-audio",
    };
  } else if (isApplePodcastUrl(parsed)) {
    result = await resolveApplePodcastUrl(parsed);
  } else if (isXiaoyuzhouUrl(parsed)) {
    result = await resolveXiaoyuzhouUrl(value);
  } else if (isLikelyRssUrl(value)) {
    result = await resolveRssFeed(value);
  } else {
    result = await resolveWebpagePodcast(value);
  }

  // 出口处统一校验 audioUrl 的安全性，防止恶意 RSS/网页注入内网地址
  await assertSafePublicUrl(result.audioUrl);

  return result;
}
