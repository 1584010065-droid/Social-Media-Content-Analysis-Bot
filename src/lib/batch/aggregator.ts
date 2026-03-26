/**
 * 结果聚合工具
 * 合并多个分块的处理结果
 */

import {
  CategoryResult,
  NegativeComplaint,
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
    dimensionDistribution: Record<string, number>;
    sentimentDistribution: Record<string, number>;
  };
  negativeComplaints: NegativeComplaint[];
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
  const dimensionDistribution: Record<string, number> = {
    成分派: 0,
    包装派: 0,
    效果派: 0,
    价格派: 0,
    其他: 0,
  };
  const sentimentDistribution: Record<string, number> = {
    正向: 0,
    中性: 0,
    负向: 0,
  };

  // 负面吐槽点合并映射
  const complaintMap = new Map<string, NegativeComplaint>();

  // 失败的分块索引
  const failedChunks: number[] = [];

  for (const chunkResult of chunkResults) {
    if (!chunkResult.success) {
      failedChunks.push(chunkResult.chunkIndex);
      // 使用降级结果
      const chunk = allChunks[chunkResult.chunkIndex];
      const fallback = createFallbackResult(chunk.lines, chunk.lineNumbers);
      processAIResponse(fallback, allCategories, dimensionDistribution, sentimentDistribution, complaintMap);
    } else if (chunkResult.result) {
      processAIResponse(
        chunkResult.result,
        allCategories,
        dimensionDistribution,
        sentimentDistribution,
        complaintMap
      );
    }
  }

  // 排序并截取 Top 10 负面吐槽点
  const negativeComplaints = Array.from(complaintMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    categories: allCategories,
    summary: {
      total: allCategories.length,
      dimensionDistribution,
      sentimentDistribution,
    },
    negativeComplaints,
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
  const dimensionDistribution: Record<string, number> = {
    成分派: 0,
    包装派: 0,
    效果派: 0,
    价格派: 0,
    其他: 0,
  };
  const sentimentDistribution: Record<string, number> = {
    正向: 0,
    中性: 0,
    负向: 0,
  };

  // 负面吐槽点合并映射
  const complaintMap = new Map<string, NegativeComplaint>();

  // 失败的分块索引
  const failedChunks: number[] = [];

  for (const chunkResult of chunkResults) {
    if (!chunkResult.success) {
      failedChunks.push(chunkResult.chunkIndex);
      // 使用降级结果
      const fallback = createFallbackResult(allChunks[chunkResult.chunkIndex]);
      processAIResponse(fallback, allCategories, dimensionDistribution, sentimentDistribution, complaintMap);
    } else if (chunkResult.result) {
      processAIResponse(
        chunkResult.result,
        allCategories,
        dimensionDistribution,
        sentimentDistribution,
        complaintMap
      );
    }
  }

  // 排序并截取 Top 10 负面吐槽点
  const negativeComplaints = Array.from(complaintMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    categories: allCategories,
    summary: {
      total: allCategories.length,
      dimensionDistribution,
      sentimentDistribution,
    },
    negativeComplaints,
    failedChunks,
  };
}

/**
 * 处理单个 AI 响应，合并到结果中
 */
function processAIResponse(
  response: AIResponse,
  categories: CategoryResult[],
  dimensionDist: Record<string, number>,
  sentimentDist: Record<string, number>,
  complaintMap: Map<string, NegativeComplaint>
): void {
  // 处理分类
  for (const cat of response.categories) {
    categories.push(cat);

    // 统计维度分布
    if (dimensionDist[cat.dimension] !== undefined) {
      dimensionDist[cat.dimension]++;
    } else {
      dimensionDist['其他']++;
    }

    // 统计情感分布
    if (sentimentDist[cat.sentiment] !== undefined) {
      sentimentDist[cat.sentiment]++;
    } else {
      sentimentDist['中性']++;
    }
  }

  // 处理负面吐槽点
  for (const complaint of response.negativeComplaints) {
    const key = `${complaint.dimension}:${complaint.complaint}`;
    if (complaintMap.has(key)) {
      const existing = complaintMap.get(key)!;
      existing.count += complaint.count;
      existing.examples.push(...complaint.examples);
    } else {
      complaintMap.set(key, {
        dimension: complaint.dimension,
        complaint: complaint.complaint,
        count: complaint.count,
        examples: [...complaint.examples],
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
  const dimensionDistribution = { ...existing.summary.dimensionDistribution };
  const sentimentDistribution = { ...existing.summary.sentimentDistribution };
  const complaintMap = new Map<string, NegativeComplaint>();

  // 将现有负面吐槽点加入映射
  for (const complaint of existing.negativeComplaints) {
    const key = `${complaint.dimension}:${complaint.complaint}`;
    complaintMap.set(key, {
      dimension: complaint.dimension,
      complaint: complaint.complaint,
      count: complaint.count,
      examples: [...complaint.examples],
    });
  }

  const failedChunks = [...existing.failedChunks];

  for (const chunkResult of newChunkResults) {
    if (!chunkResult.success) {
      failedChunks.push(chunkResult.chunkIndex);
      const fallback = createFallbackResult(newChunks[chunkResult.chunkIndex]);
      processAIResponse(fallback, allCategories, dimensionDistribution, sentimentDistribution, complaintMap);
    } else if (chunkResult.result) {
      processAIResponse(
        chunkResult.result,
        allCategories,
        dimensionDistribution,
        sentimentDistribution,
        complaintMap
      );
    }
  }

  const negativeComplaints = Array.from(complaintMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    categories: allCategories,
    summary: {
      total: allCategories.length,
      dimensionDistribution,
      sentimentDistribution,
    },
    negativeComplaints,
    failedChunks,
  };
}