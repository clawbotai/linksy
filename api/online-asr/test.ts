import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const TEST_MODEL = "qwen-plus";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { apiKey, baseUrl } = req.body;
    if (!apiKey) return res.status(200).json({ success: false, message: "API Key 不能为空" });

    const url = (baseUrl || DEFAULT_QWEN_BASE_URL).replace(/\/$/, "");
    const response = await fetch(`${url}/services/aigc/multimodal-generation/generation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TEST_MODEL,
        input: {
          messages: [
            { role: "system", content: [{ text: "" }] },
            { role: "user", content: [{ text: "test" }] },
          ],
        },
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return res.status(200).json({ success: false, message: "API Key 无效" });
    }
    if (response.status === 400) {
      const body = await response.json();
      if (body.code && !String(body.code).includes("InvalidApiKey")) {
        return res.status(200).json({ success: true, message: "API Key 验证通过" });
      }
      return res.status(200).json({ success: false, message: body.message || "验证失败" });
    }
    if (response.ok) return res.status(200).json({ success: true, message: "API Key 验证通过" });

    return res.status(200).json({ success: false, message: `连接失败 (${response.status})` });
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: `连接失败: ${error instanceof Error ? error.message : "未知错误"}`,
    });
  }
}
