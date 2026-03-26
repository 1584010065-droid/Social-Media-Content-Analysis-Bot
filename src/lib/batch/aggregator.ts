/**
 * 结果聚合工具
 * 合并多个分块的处理结果
 */

import {
  CategoryResult,
  NegativeKeyword,
  AIResponse,
  ChunkResult,
  ChunkWithLineNumbers,
  createFallbackResult,
} from './processor';

// 聚合结果类型
export interface AggregatedResult {
  categories: CategoryResult[];
  summary: {
    total: number;
    categoryDistribution: Record<string, number>;
  };
  negativeKeywords: NegativeKeyword[];
  failedChunks: number[];
}

/**
 * 聚合所有分块结果（带行号版本）
 */
export function aggregateResultsWithLineNumbers(
  chunkResults: ChunkResult[],
  allChunks: ChunkWithLineNumbers[]
): AggregatedResult {
  const allCategories: CategoryResult[] = [];
  const categoryDistribution: Record<string, number> = {
    成分派: 0,
    包装派: 0,
    效果派: 0,
    价格派: 0,
    其他: 0,
  };

  // 负面关键词合并映射
  const keywordMap = new Map<string, { count: number; examples: string[] }>();

  // 失败的分块索引
  const failedChunks: number[] = [];

  for (const chunkResult of chunkResults) {
    if (!chunkResult.success) {
      failedChunks.push(chunkResult.chunkIndex);
      // 使用降级结果
      const chunk = allChunks[chunkResult.chunkIndex];
      const fallback = createFallbackResult(chunk.lines, chunk.lineNumbers);
      processAIResponse(fallback, allCategories, categoryDistribution, keywordMap);
    } else if (chunkResult.result) {
      processAIResponse(
        chunkResult.result,
        allCategories,
        categoryDistribution,
        keywordMap
      );
    }
  }

  // 排序并截取 Top 10 负面关键词
  const negativeKeywords = Array.from(keywordMap.entries())
    .map(([keyword, data]) => ({
      keyword,
      count: data.count,
      examples: [...new Set(data.examples)].slice(0, 3), // 去重并限制数量
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // 返回 Top 10

  return {
    categories: allCategories,
    summary: {
      total: allCategories.length,
      categoryDistribution,
    },
    negativeKeywords,
    failedChunks,
  };
}

/**
 * 聚合所有分块结果（兼容旧格式）
 */
export function aggregateResults(
  chunkResults: ChunkResult[],
  allChunks: string[][]
): AggregatedResult {
  const allCategories: CategoryResult[] = [];
  const categoryDistribution: Record<string, number> = {
    成分派: 0,
    包装派: 0,
    效果派: 0,
    价格派: 0,
    其他: 0,
  };

  // 负面关键词合并映射
  const keywordMap = new Map<string, { count: number; examples: string[] }>();

  // 失败的分块索引
  const failedChunks: number[] = [];

  for (const chunkResult of chunkResults) {
    if (!chunkResult.success) {
      failedChunks.push(chunkResult.chunkIndex);
      // 使用降级结果
      const fallback = createFallbackResult(allChunks[chunkResult.chunkIndex]);
      processAIResponse(fallback, allCategories, categoryDistribution, keywordMap);
    } else if (chunkResult.result) {
      processAIResponse(
        chunkResult.result,
        allCategories,
        categoryDistribution,
        keywordMap
      );
    }
  }

  // 排序并截取 Top 10 负面关键词
  const negativeKeywords = Array.from(keywordMap.entries())
    .map(([keyword, data]) => ({
      keyword,
      count: data.count,
      examples: [...new Set(data.examples)].slice(0, 3), // 去重并限制数量
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // 返回 Top 10

  return {
    categories: allCategories,
    summary: {
      total: allCategories.length,
      categoryDistribution,
    },
    negativeKeywords,
    failedChunks,
  };
}

/**
 * 处理单个 AI 响应，合并到结果中
 */
function processAIResponse(
  response: AIResponse,
  categories: CategoryResult[],
  distribution: Record<string, number>,
  keywordMap: Map<string, { count: number; examples: string[] }>
): void {
  // 处理分类
  for (const cat of response.categories) {
    categories.push(cat);

    const category = cat.category as keyof typeof distribution;
    if (distribution[category] !== undefined) {
      distribution[category]++;
    } else {
      distribution['其他']++;
    }
  }

  // 处理负面关键词
  for (const kw of response.negativeKeywords) {
    if (keywordMap.has(kw.keyword)) {
      const existing = keywordMap.get(kw.keyword)!;
      existing.count += kw.count;
      existing.examples.push(...kw.examples);
    } else {
      keywordMap.set(kw.keyword, {
        count: kw.count,
        examples: [...kw.examples],
      });
    }
  }
}

/**
 * 合并部分结果（用于增量更新）
 */
export function mergePartialResults(
  existing: AggregatedResult,
  newChunkResults: ChunkResult[],
  newChunks: string[][]
): AggregatedResult {
  const allCategories = [...existing.categories];
  const categoryDistribution = { ...existing.summary.categoryDistribution };
  const keywordMap = new Map<string, { count: number; examples: string[] }>();

  // 将现有负面关键词加入映射
  for (const kw of existing.negativeKeywords) {
    keywordMap.set(kw.keyword, {
      count: kw.count,
      examples: [...kw.examples],
    });
  }

  const failedChunks = [...existing.failedChunks];

  for (const chunkResult of newChunkResults) {
    if (!chunkResult.success) {
      failedChunks.push(chunkResult.chunkIndex);
      const fallback = createFallbackResult(newChunks[chunkResult.chunkIndex]);
      processAIResponse(fallback, allCategories, categoryDistribution, keywordMap);
    } else if (chunkResult.result) {
      processAIResponse(
        chunkResult.result,
        allCategories,
        categoryDistribution,
        keywordMap
      );
    }
  }

  const negativeKeywords = Array.from(keywordMap.entries())
    .map(([keyword, data]) => ({
      keyword,
      count: data.count,
      examples: [...new Set(data.examples)].slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    categories: allCategories,
    summary: {
      total: allCategories.length,
      categoryDistribution,
    },
    negativeKeywords,
    failedChunks,
  };
}