import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { providerId, baseUrl, apiKey, modelId } = req.body;
    if (!apiKey) return res.status(200).json({ success: false, message: "API Key 不能为空" });

    const url = (baseUrl || "").replace(/\/$/, "");
    if (!url) return res.status(200).json({ success: false, message: "Base URL 不能为空" });

    let testUrl = url;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let body: string;

    if (providerId === "claude" || providerId === "anthropic-third-party") {
      testUrl = `${url}/messages`;
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      body = JSON.stringify({
        model: modelId || "claude-sonnet-4-5-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "hi" }],
      });
    } else if (providerId === "gemini") {
      testUrl = `${url}/models/${modelId || "gemini-2.5-flash"}:generateContent?key=${apiKey}`;
      body = JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] });
    } else {
      // OpenAI 兼容
      testUrl = `${url}/chat/completions`;
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = JSON.stringify({
        model: modelId || "gpt-4.1-mini",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 10,
      });
    }

    const response = await fetch(testUrl, { method: "POST", headers, body });

    if (response.status === 401 || response.status === 403) {
      return res.status(200).json({ success: false, message: "API Key 无效" });
    }
    if (response.ok) return res.status(200).json({ success: true, message: "连接测试通过" });

    const errBody = await response.text();
    return res.status(200).json({ success: false, message: `测试失败 (${response.status}): ${errBody.slice(0, 200)}` });
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: `连接失败: ${error instanceof Error ? error.message : "未知错误"}`,
    });
  }
}
