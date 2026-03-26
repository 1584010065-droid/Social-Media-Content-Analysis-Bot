import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai/openrouter";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";

interface CategoryResult {
  category: "成分派" | "包装派" | "效果派" | "价格派" | "其他";
  confidence: number;
  reason: string;
  originalText: string;
}

interface NegativeKeyword {
  keyword: string;
  count: number;
  examples: string[];
}

interface AnalysisResponse {
  categories: CategoryResult[];
  summary: {
    total: number;
    categoryDistribution: Record<string, number>;
  };
  negativeKeywords: NegativeKeyword[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "请提供有效的社媒内容" },
        { status: 400 }
      );
    }

    const lines = content.split(/\n/).filter((line) => line.trim());

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "未检测到有效的评论内容，请输入至少一条评论" },
        { status: 400 }
      );
    }

    // 调用 AI 分析
    const aiResult = await callAI(SYSTEM_PROMPT, content);

    // 构建分类分布统计
    const categoryDistribution: Record<string, number> = {
      成分派: 0,
      包装派: 0,
      效果派: 0,
      价格派: 0,
      其他: 0,
    };

    const categories: CategoryResult[] = aiResult.categories.map((cat) => {
      const category = cat.category as CategoryResult["category"];
      if (categoryDistribution.hasOwnProperty(category)) {
        categoryDistribution[category]++;
      } else {
        categoryDistribution["其他"]++;
      }
      return {
        category: category === "成分派" || category === "包装派" ||
                  category === "效果派" || category === "价格派"
                  ? category
                  : "其他",
        confidence: cat.confidence,
        reason: cat.reason,
        originalText: cat.originalText,
      };
    });

    const result: AnalysisResponse = {
      categories,
      summary: {
        total: lines.length,
        categoryDistribution,
      },
      negativeKeywords: aiResult.negativeKeywords as NegativeKeyword[],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("分析失败:", error);
    const errorMessage =
      error instanceof Error ? error.message : "分析过程中出现错误，请稍后重试";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}