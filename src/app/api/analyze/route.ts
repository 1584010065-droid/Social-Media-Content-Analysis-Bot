import { NextRequest, NextResponse } from "next/server";
import { callAI, CategoryResult, NegativeComplaint } from "@/lib/ai/openrouter";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";

interface AnalysisResponse {
  categories: CategoryResult[];
  summary: {
    total: number;
    dimensionDistribution: Record<string, number>;
    sentimentDistribution: Record<string, number>;
  };
  negativeComplaints: NegativeComplaint[];
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

    // 构建维度分布统计
    const dimensionDistribution: Record<string, number> = {
      成分派: 0,
      包装派: 0,
      效果派: 0,
      价格派: 0,
      其他: 0,
    };

    // 构建情感分布统计
    const sentimentDistribution: Record<string, number> = {
      正向: 0,
      中性: 0,
      负向: 0,
    };

    const categories: CategoryResult[] = aiResult.categories.map((cat) => {
      // 统计维度分布
      if (dimensionDistribution.hasOwnProperty(cat.dimension)) {
        dimensionDistribution[cat.dimension]++;
      } else {
        dimensionDistribution["其他"]++;
      }

      // 统计情感分布
      if (sentimentDistribution.hasOwnProperty(cat.sentiment)) {
        sentimentDistribution[cat.sentiment]++;
      } else {
        sentimentDistribution["中性"]++;
      }

      return cat;
    });

    const result: AnalysisResponse = {
      categories,
      summary: {
        total: lines.length,
        dimensionDistribution,
        sentimentDistribution,
      },
      negativeComplaints: aiResult.negativeComplaints,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("分析失败:", error);
    const errorMessage =
      error instanceof Error ? error.message : "分析过程中出现错误，请稍后重试";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}