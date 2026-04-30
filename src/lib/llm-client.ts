'use client';

import { readCachedLanguageModelSettings } from "@/lib/language-model-settings-cache";
import { getEnabledLanguageModelOptions, type LanguageModelOption } from "@/lib/language-models";
import type { LanguageModelSettings } from "@/types";

const MINDMAP_PROMPT_PREFIX = `你是一个中文思维导图整理助手。
请基于给定转录内容提炼思维导图，只返回严格 JSON，不要输出 markdown、解释、代码围栏。
返回结构必须是：{"text":"根节点","children":[{"text":"一级主题","children":[{"text":"关键点"}]}]}。
要求：
1. 根节点使用播客标题或主题总标题。
2. 一级主题控制在 3 到 6 个。
3. 每个一级主题下生成 2 到 5 个关键点。
4. 所有节点都使用简体中文，文案简洁，避免句号结尾。
5. 不要生成空 children 字段，除非确实没有下级节点。`;

const MAX_TRANSCRIPT_CHARS = 18000;

function getProviderConfig(settings: LanguageModelSettings, providerId: string): Record<string, any> {
  const providers = settings.providers || {};
  return (providers as Record<string, any>)[providerId] || {};
}

function resolveApiFormat(providerId: string): string {
  if (providerId === "claude") return "anthropic";
  if (providerId === "anthropic-third-party") return "anthropic";
  return "openai";
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  prompt: string,
  temperature: number,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: 4096,
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`LLM 请求失败 (${res.status}): ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function callAnthropic(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  prompt: string,
  temperature: number,
  signal?: AbortSignal,
): Promise<string> {
  // Claude API 不支持浏览器 CORS，需要通过 serverless 代理
  const res = await fetch("/api/llm/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerId: "claude",
      baseUrl,
      apiKey,
      modelId,
      prompt,
      temperature,
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Claude 请求失败 (${res.status}): ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text || data?.text || "";
}

async function callGemini(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  prompt: string,
  temperature: number,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/models/${modelId}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: 4096 },
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini 请求失败 (${res.status}): ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export interface LLMCallOptions {
  timeoutMs?: number;
  temperatureCap?: number;
  signal?: AbortSignal;
}

export async function requestLanguageModelText(
  providerId: string,
  modelId: string,
  prompt: string,
  options: LLMCallOptions = {},
): Promise<{ text: string; model: string; modelId: string; providerName: string }> {
  const settings = readCachedLanguageModelSettings();
  if (!settings) throw new Error("未配置语言模型，请在设置中添加");
  const providerConfig = getProviderConfig(settings, providerId);
  const apiKey = providerConfig.apiKey as string;
  const baseUrl = (providerConfig.baseUrl as string) || "";
  const apiFormat = resolveApiFormat(providerId);
  const temperature = Math.min(options.temperatureCap ?? 0.7, 1.0);

  if (!apiKey) throw new Error(`未配置 ${providerId} 的 API Key`);

  let text: string;
  if (apiFormat === "anthropic") {
    text = await callAnthropic(baseUrl, apiKey, modelId, prompt, temperature, options.signal);
  } else if (providerId === "gemini") {
    text = await callGemini(baseUrl, apiKey, modelId, prompt, temperature, options.signal);
  } else {
    text = await callOpenAICompatible(baseUrl, apiKey, modelId, prompt, temperature, options.signal);
  }

  const providerMeta = (settings.providers as Record<string, any>)?.[providerId];
  return {
    text,
    model: providerMeta?.models?.find((m: any) => m.id === modelId)?.name || modelId,
    modelId,
    providerName: providerId,
  };
}

export function getAvailableProviders(): LanguageModelOption[] {
  const settings = readCachedLanguageModelSettings();
  if (!settings) return [];
  return getEnabledLanguageModelOptions(settings);
}

export function buildMindMapPrompt(title: string, transcript: string): string {
  const clipped = transcript.slice(0, MAX_TRANSCRIPT_CHARS);
  const hint = transcript.length > MAX_TRANSCRIPT_CHARS
    ? "\n注意：以下转录内容已截断，请优先抽取高密度信息。"
    : "";
  return `${MINDMAP_PROMPT_PREFIX}${hint}\n\n标题：${title || "未命名转录"}\n\n转录内容：\n${clipped}`;
}

export function tryParseJsonBlock(text: string): any {
  // 去除 markdown 代码围栏
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
  // 找第一个 { 到最后一个 }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("未找到有效的 JSON 结构");
  }
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonStr);
}
