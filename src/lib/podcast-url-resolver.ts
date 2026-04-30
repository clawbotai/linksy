export type ResolvedPodcastAudio = {
  title: string;
  audioUrl: string;
  source: "direct-audio" | "apple-podcasts" | "rss" | "webpage";
  duration?: number;
};

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

function getTextContent(parent: Element, selector: string): string {
  return parent.querySelector(selector)?.textContent?.trim() ?? "";
}

function resolveXmlUrl(value: string, baseUrl: string): string {
  return new URL(value.trim(), baseUrl).toString();
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  let response: Response;

  try {
    response = await fetch(url, { signal });
  } catch (error) {
    throw new Error(
      error instanceof TypeError
        ? "浏览器无法跨域读取该页面，请改用 RSS 链接或音频直链"
        : error instanceof Error
          ? error.message
          : "读取链接失败",
    );
  }

  if (!response.ok) {
    throw new Error(`读取链接失败 (${response.status})`);
  }

  return response.text();
}

function parseRssAudio(xml: string, feedUrl: string): ResolvedPodcastAudio {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("RSS 内容格式无效");
  }

  const firstItem = doc.querySelector("item, entry");
  if (!firstItem) {
    throw new Error("RSS 中没有找到播客单集");
  }

  const enclosure =
    firstItem.querySelector("enclosure[url]") ??
    firstItem.querySelector("link[rel='enclosure'][href]") ??
    firstItem.querySelector("link[type^='audio/'][href]");
  const mediaContent = firstItem.querySelector("media\\:content[url], content[url]");

  const audioUrl =
    enclosure?.getAttribute("url") ??
    enclosure?.getAttribute("href") ??
    mediaContent?.getAttribute("url") ??
    getTextContent(firstItem, "media\\:content, content");

  if (!audioUrl) {
    throw new Error("RSS 中没有找到音频地址");
  }

  return {
    title: getTextContent(firstItem, "title") || getTextContent(doc.documentElement, "channel > title") || "未命名播客",
    audioUrl: resolveXmlUrl(audioUrl, feedUrl),
    source: "rss",
  };
}

async function resolveRssFeed(url: string, signal?: AbortSignal): Promise<ResolvedPodcastAudio> {
  const xml = await fetchText(url, signal);
  return parseRssAudio(xml, url);
}

async function resolveApplePodcastUrl(url: URL, signal?: AbortSignal): Promise<ResolvedPodcastAudio> {
  const collectionId = url.pathname.match(/\/id(\d+)/i)?.[1];
  const trackId = url.searchParams.get("i");

  if (!collectionId || !trackId) {
    throw new Error("请粘贴 Apple Podcasts 的单集链接，不是节目主页链接");
  }

  const lookupUrl = new URL("https://itunes.apple.com/lookup");
  lookupUrl.searchParams.set("id", collectionId);
  lookupUrl.searchParams.set("media", "podcast");
  lookupUrl.searchParams.set("entity", "podcastEpisode");
  lookupUrl.searchParams.set("limit", "200");

  let response: Response;
  try {
    response = await fetch(lookupUrl, { signal });
  } catch {
    throw new Error("浏览器无法读取 Apple Podcasts 信息，请改用 RSS 链接或音频直链");
  }

  if (!response.ok) {
    throw new Error(`Apple Podcasts 查询失败 (${response.status})`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const episode = results.find((item: any) => String(item.trackId) === trackId);
  const audioUrl = episode?.episodeUrl;

  if (!audioUrl) {
    throw new Error("没有从 Apple Podcasts 找到该单集音频，请改用 RSS 链接或音频直链");
  }

  return {
    title: episode.trackName || "未命名播客",
    audioUrl,
    duration: episode.trackTimeMillis ? Math.floor(Number(episode.trackTimeMillis) / 1000) : undefined,
    source: "apple-podcasts",
  };
}

async function resolveWebpagePodcast(url: string, signal?: AbortSignal): Promise<ResolvedPodcastAudio> {
  const html = await fetchText(url, signal);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const audio =
    doc.querySelector("meta[property='og:audio'][content]")?.getAttribute("content") ??
    doc.querySelector("audio source[src], audio[src]")?.getAttribute("src");

  if (audio) {
    return {
      title:
        doc.querySelector("meta[property='og:title'][content]")?.getAttribute("content") ??
        doc.title ??
        "未命名播客",
      audioUrl: new URL(audio, url).toString(),
      source: "webpage",
    };
  }

  const rssLink = doc.querySelector(
    "link[rel='alternate'][type*='rss'][href], link[rel='alternate'][type*='xml'][href], link[type='application/rss+xml'][href]",
  )?.getAttribute("href");

  if (!rssLink) {
    throw new Error("无法从该页面解析音频地址，请粘贴 RSS 链接或音频直链");
  }

  const resolved = await resolveRssFeed(new URL(rssLink, url).toString(), signal);
  return { ...resolved, source: "webpage" };
}

export async function resolvePodcastAudio(
  input: string,
  signal?: AbortSignal,
): Promise<ResolvedPodcastAudio> {
  const value = input.trim();
  if (!value) {
    throw new Error("请输入播客链接或音频直链");
  }

  const parsed = parseUrl(value);
  if (!parsed) {
    throw new Error("请输入完整的 URL");
  }

  if (isLikelyAudioUrl(value)) {
    return {
      title: decodeURIComponent(parsed.pathname.split("/").pop() || "未命名音频"),
      audioUrl: value,
      source: "direct-audio",
    };
  }

  if (isApplePodcastUrl(parsed)) {
    return resolveApplePodcastUrl(parsed, signal);
  }

  if (isLikelyRssUrl(value)) {
    return resolveRssFeed(value, signal);
  }

  return resolveWebpagePodcast(value, signal);
}
