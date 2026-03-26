import { NextRequest, NextResponse } from "next/server";

// 分类类型
interface CategoryResult {
  category: "成分派" | "包装派" | "效果派" | "价格派" | "其他";
  confidence: number; // 置信度 0-100
  reason: string; // 分类理由
}

// 负面关键词
interface NegativeKeyword {
  keyword: string;
  count: number;
  examples: string[]; // 示例评论
}

// 分析结果
interface AnalysisResponse {
  categories: CategoryResult[]; // 各条评论的分类结果
  summary: {
    total: number;
    categoryDistribution: Record<string, number>;
  };
  negativeKeywords: NegativeKeyword[]; // Top 3 负面关键词
}

// 模拟分析函数
function mockAnalyzeContent(content: string): AnalysisResponse {
  // 模拟分类逻辑
  const categories: CategoryResult[] = [];
  const lines = content.split(/\n/).filter(line => line.trim());
  
  const categoryKeywords: Record<string, string[]> = {
    "成分派": ["成分", "配方", "原料", "天然", "化学", "添加剂", "精华", "维生素", "胶原蛋白"],
    "包装派": ["包装", "外观", "设计", "瓶子", "盒子", "颜值", "好看", "精美", "质感"],
    "效果派": ["效果", "好用", "有效", "吸收", "保湿", "美白", "祛痘", "滋润", "改善"],
    "价格派": ["价格", "贵", "便宜", "性价比", "划算", "值得", "优惠", "活动", "折扣"]
  };

  lines.forEach((line, index) => {
    let bestCategory: CategoryResult["category"] = "其他";
    let maxScore = 0;
    let reason = "";

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.reduce((acc, keyword) => {
        return acc + (line.includes(keyword) ? 1 : 0);
      }, 0);
      
      if (score > maxScore) {
        maxScore = score;
        bestCategory = cat as CategoryResult["category"];
        reason = `检测到关键词: ${keywords.filter(k => line.includes(k)).join(", ")}`;
      }
    }

    if (maxScore === 0) {
      // 随机分配一个分类（模拟）
      const randomCats: CategoryResult["category"][] = ["成分派", "包装派", "效果派", "价格派"];
      bestCategory = randomCats[Math.floor(Math.random() * randomCats.length)];
      reason = "基于语义分析归类";
    }

    categories.push({
      category: bestCategory,
      confidence: Math.min(60 + maxScore * 15 + Math.floor(Math.random() * 20), 98),
      reason
    });
  });

  // 统计分布
  const categoryDistribution: Record<string, number> = {
    "成分派": 0,
    "包装派": 0,
    "效果派": 0,
    "价格派": 0,
    "其他": 0
  };
  categories.forEach(c => {
    categoryDistribution[c.category]++;
  });

  // 模拟负面关键词提取
  const negativeKeywords: NegativeKeyword[] = [
    {
      keyword: "太贵",
      count: Math.floor(Math.random() * 20) + 5,
      examples: [
        "价格太贵了，性价比不高",
        "虽然好用但是太贵",
        "太贵了，买不起"
      ]
    },
    {
      keyword: "没效果",
      count: Math.floor(Math.random() * 15) + 3,
      examples: [
        "用了很久都没效果",
        "完全没效果，浪费钱",
        "效果不明显"
      ]
    },
    {
      keyword: "过敏",
      count: Math.floor(Math.random() * 10) + 2,
      examples: [
        "用了过敏，皮肤发红",
        "敏感肌慎用，会过敏",
        "过敏了，不敢再用"
      ]
    }
  ].sort((a, b) => b.count - a.count);

  return {
    categories,
    summary: {
      total: lines.length,
      categoryDistribution
    },
    negativeKeywords
  };
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

    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    const result = mockAnalyzeContent(content);

    return NextResponse.json(result);
  } catch (error) {
    console.error("分析失败:", error);
    return NextResponse.json(
      { error: "分析过程中出现错误" },
      { status: 500 }
    );
  }
}
