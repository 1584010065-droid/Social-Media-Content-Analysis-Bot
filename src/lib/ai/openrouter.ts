const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.OPENROUTER_API_KEY || "";
const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-3-flash-preview";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// 子维度类型
export interface SubDimension {
  dimension: '成分派' | '包装派' | '效果派' | '价格派' | '其他';
  sentiment: '正向' | '中性' | '负向';
}

// 分类结果类型
export interface CategoryResult {
  lineNumber: number;  // CSV 文件中的行号（从 2 开始）
  dimension: '成分派' | '包装派' | '效果派' | '价格派' | '其他';
  sentiment: '正向' | '中性' | '负向';
  subDimensions: SubDimension[];
  confidence: number;
  reason: string;
  originalText: string;
}

// 负面吐槽点类型
export interface NegativeComplaint {
  dimension: '成分问题' | '包装问题' | '效果问题' | '价格问题' | '笼统负面' | '其他问题';
  complaint: string;
  count: number;
  examples: string[];
}

// AI 响应类型
export interface AIResponse {
  categories: CategoryResult[];
  negativeComplaints: NegativeComplaint[];
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
      categories: (parsed.categories || []).map((cat: any) => {
        // 验证主维度
        const validDimensions = ['成分派', '包装派', '效果派', '价格派', '其他'] as const;
        const dimension = validDimensions.includes(cat.dimension)
          ? cat.dimension as CategoryResult['dimension']
          : '其他';

        // 验证情感
        const validSentiments = ['正向', '中性', '负向'] as const;
        const sentiment = validSentiments.includes(cat.sentiment)
          ? cat.sentiment as CategoryResult['sentiment']
          : '中性';

        // 处理子维度
        const subDimensions: SubDimension[] = (cat.subDimensions || []).map((sub: any) => ({
          dimension: validDimensions.includes(sub.dimension)
            ? sub.dimension as SubDimension['dimension']
            : '其他',
          sentiment: validSentiments.includes(sub.sentiment)
            ? sub.sentiment as SubDimension['sentiment']
            : '中性'
        }));

        return {
          dimension,
          sentiment,
          subDimensions,
          confidence: Math.min(100, Math.max(0, Number(cat.confidence) || 50)),
          reason: cat.reason || "",
          originalText: cat.originalText || "",
          lineNumber: 0,
        };
      }),
      negativeComplaints: (parsed.negativeComplaints || []).map((item: any) => {
        // 验证吐槽维度
        const validComplaintDimensions = ['成分问题', '包装问题', '效果问题', '价格问题', '笼统负面', '其他问题'] as const;
        const dimension = validComplaintDimensions.includes(item.dimension)
          ? item.dimension as NegativeComplaint['dimension']
          : '其他问题';

        return {
          dimension,
          complaint: item.complaint || "",
          count: Number(item.count) || 1,
          examples: (item.examples || []).slice(0, 3)
        };
      }).slice(0, 3)
    };
  } catch (e) {
    throw new Error(`AI 返回内容解析失败: ${content.substring(0, 200)}`);
  }
}