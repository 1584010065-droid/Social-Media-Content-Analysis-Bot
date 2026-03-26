const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.OPENROUTER_API_KEY || "";
const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-3-flash-preview";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  categories: Array<{
    category: string;
    confidence: number;
    reason: string;
    originalText: string;
  }>;
  negativeKeywords: Array<{
    keyword: string;
    count: number;
    examples: string[];
  }>;
}

export async function callAI(
  systemPrompt: string,
  userMessage: string
): Promise<AIResponse> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ];

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
      "HTTP-Referer": "https://github.com/social-analyzer-bot",
      "X-Title": "Social Media Analyzer Bot"
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API 调用失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI 返回内容为空");
  }

  // 解析 AI 返回的 JSON
  return parseAIResponse(content);
}

function parseAIResponse(content: string): AIResponse {
  // 提取 JSON 内容
  let jsonStr = content;

  // 如果有 markdown 代码块，提取其中的 JSON
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // 验证并标准化返回格式
    return {
      categories: (parsed.categories || []).map((cat: any) => ({
        category: cat.category || "其他",
        confidence: Math.min(100, Math.max(0, Number(cat.confidence) || 50)),
        reason: cat.reason || "",
        originalText: cat.originalText || ""
      })),
      negativeKeywords: (parsed.negativeKeywords || []).map((kw: any) => ({
        keyword: kw.keyword || "",
        count: Number(kw.count) || 1,
        examples: (kw.examples || []).slice(0, 3)
      })).slice(0, 3)
    };
  } catch (e) {
    throw new Error(`AI 返回内容解析失败: ${content.substring(0, 200)}`);
  }
}