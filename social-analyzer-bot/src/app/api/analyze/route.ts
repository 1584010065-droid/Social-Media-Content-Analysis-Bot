import { NextRequest, NextResponse } from "next/server";

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

const categoryKeywords: Record<string, string[]> = {
  "成分派": ["成分", "配方", "原料", "天然", "化学", "添加剂", "精华", "维生素", "胶原蛋白", "玻尿酸", "烟酰胺", "护肤", "温和", "刺激", "安全", "检测", "合格", "有机", "草本", "纯天然", "成分表", "配方表", "原料好"],
  "包装派": ["包装", "外观", "设计", "瓶子", "盒子", "颜值", "好看", "精美", "质感", "高大上", "上档次", "颜值高", "外观设计", "瓶身", "外包装", "精美", "漂亮", "好看"],
  "效果派": ["效果", "好用", "有效", "吸收", "保湿", "美白", "祛痘", "滋润", "改善", "明显", "明显效果", "见效", "好用", "喜欢", "推荐", "回购", "皮肤变好", "改善肌肤", "效果明显"],
  "价格派": ["价格", "贵", "便宜", "性价比", "划算", "值得", "优惠", "活动", "折扣", "省钱", "实惠", "物美价廉", "太贵", "便宜", "性价比高", "价格合理", "划算", "值", "超值", "搞活动"]
};

const negativeKeywords = [
  "太贵", "贵", "没效果", "无效", "过敏", "刺激", "难闻", "油腻", "干", "搓泥",
  "假货", "假", "不值", "亏", "失望", "鸡肋", "鸡肋", "没用", "废物", "烂脸",
  "后悔", "不要买", "骗子", "虚假宣传", "欺骗", "垃圾", "烂", "差", "糟糕"
];

function classifyContent(lines: string[]): CategoryResult[] {
  const results: CategoryResult[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let bestCategory: CategoryResult["category"] = "其他";
    let maxScore = 0;
    let matchedKeywords: string[] = [];
    let reason = "";

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.reduce((acc, keyword) => {
        const regex = new RegExp(keyword, 'gi');
        const matches = trimmedLine.match(regex);
        return acc + (matches ? matches.length : 0);
      }, 0);

      if (score > 0) {
        const foundKeywords = keywords.filter(k => trimmedLine.includes(k));
        if (score > maxScore) {
          maxScore = score;
          bestCategory = cat as CategoryResult["category"];
          matchedKeywords = foundKeywords;
        }
      }
    }

    if (maxScore > 0) {
      reason = `检测到关键词: ${matchedKeywords.join(", ")}`;
    } else {
      reason = "无法明确归类到特定类别";
    }

    const confidence = Math.min(50 + maxScore * 15, 98);

    results.push({
      category: bestCategory,
      confidence,
      reason,
      originalText: trimmedLine
    });
  }

  return results;
}

function extractNegativeKeywords(lines: string[]): NegativeKeyword[] {
  const keywordMap: Map<string, { count: number; examples: string[] }> = new Map();

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    for (const keyword of negativeKeywords) {
      if (trimmedLine.includes(keyword)) {
        const existing = keywordMap.get(keyword);
        if (existing) {
          existing.count++;
          if (existing.examples.length < 3 && !existing.examples.includes(trimmedLine)) {
            existing.examples.push(trimmedLine);
          }
        } else {
          keywordMap.set(keyword, {
            count: 1,
            examples: [trimmedLine]
          });
        }
      }
    }
  }

  const sortedKeywords = Array.from(keywordMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([keyword, data]) => ({
      keyword,
      count: data.count,
      examples: data.examples
    }));

  return sortedKeywords;
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

    const lines = content.split(/\n/).filter(line => line.trim());

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "未检测到有效的评论内容，请输入至少一条评论" },
        { status: 400 }
      );
    }

    const categories = classifyContent(lines);
    const extractedNegativeKeywords = extractNegativeKeywords(lines);

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

    const result: AnalysisResponse = {
      categories,
      summary: {
        total: lines.length,
        categoryDistribution
      },
      negativeKeywords: extractedNegativeKeywords
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("分析失败:", error);
    return NextResponse.json(
      { error: "分析过程中出现错误，请稍后重试" },
      { status: 500 }
    );
  }
}
