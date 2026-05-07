export const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";

/**
 * 启发式判断 baseUrl 是否指向 DashScope 协议端点
 * 用于错误提示时追加引导文案，不做阻断校验
 */
export function looksLikeDashScopeUrl(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    if (/dashscope/i.test(u.hostname)) return true;
    if (/\/api\/v\d+\/?$/.test(u.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * 如果 baseUrl 不像 DashScope，追加引导提示
 */
export function buildDashScopeHint(baseUrl: string): string {
  if (looksLikeDashScopeUrl(baseUrl)) return "";
  return `\n\n提示：当前 baseUrl "${baseUrl}" 可能不是 DashScope 协议端点。本应用 ASR 仅支持 DashScope 协议（阿里云原生：${DEFAULT_DASHSCOPE_BASE_URL}）。请到「设置 → 在线转录供应商」修改。`;
}
