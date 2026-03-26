/**
 * 批量处理逻辑
 * 包含分块策略、并发控制、重试机制
 */

import { callAI, AIResponse, CategoryResult, NegativeKeyword } from '../ai/openrouter';
import { SYSTEM_PROMPT } from '../prompts/system';

// 重新导出类型供其他模块使用
export type { AIResponse, CategoryResult, NegativeKeyword };

// 分块配置
export const CHUNK_CONFIG = {
  MAX_ROWS_PER_CHUNK: 20, // 每块最大行数
  MAX_OUTPUT_TOKENS: 4096, // 输出 token 上限
  ESTIMATED_OUTPUT_PER_ROW: 150, // 每行预估输出 token
  SAFETY_MARGIN: 0.7, // 安全边际系数
};

// 重试配置
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 1000, // 基础延迟 1 秒
  MAX_DELAY: 10000, // 最大延迟 10 秒
};

// 批量处理配置
export const BATCH_CONFIG = {
  CHUNKS_PER_REQUEST: 5, // 每次 API 请求处理的分块数
  CONCURRENCY: 3, // 并发数
};

// 分块结果
export interface ChunkResult {
  chunkIndex: number;
  success: boolean;
  result?: AIResponse;
  error?: string;
}

// 处理进度
export interface ProcessProgress {
  currentChunk: number;
  totalChunks: number;
  processedRows: number;
  totalRows: number;
  percentage: number;
}

/**
 * 创建分块
 */
export function createChunks(rows: string[]): string[][] {
  const chunks: string[][] = [];
  let currentChunk: string[] = [];
  let currentOutputTokens = 0;

  for (const row of rows) {
    const estimatedOutput = CHUNK_CONFIG.ESTIMATED_OUTPUT_PER_ROW;

    // 检查是否需要开始新块
    if (
      currentChunk.length >= CHUNK_CONFIG.MAX_ROWS_PER_CHUNK ||
      (currentOutputTokens + estimatedOutput) >
        CHUNK_CONFIG.MAX_OUTPUT_TOKENS * CHUNK_CONFIG.SAFETY_MARGIN
    ) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = [row];
      currentOutputTokens = estimatedOutput;
    } else {
      currentChunk.push(row);
      currentOutputTokens += estimatedOutput;
    }
  }

  // 处理最后一块
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('429') ||
    message.includes('rate') ||
    message.includes('timeout') ||
    message.includes('50') ||
    message.includes('network') ||
    message.includes('econnreset')
  );
}

/**
 * 带重试的 AI 调用
 */
async function callAIWithRetry(
  content: string,
  attempt: number = 0
): Promise<AIResponse> {
  try {
    const result = await callAI(SYSTEM_PROMPT, content);
    return result;
  } catch (error) {
    const err = error as Error;

    // 检查是否可重试
    if (attempt < RETRY_CONFIG.MAX_ATTEMPTS - 1 && isRetryableError(err)) {
      // 指数退避
      const delay = Math.min(
        RETRY_CONFIG.BASE_DELAY * Math.pow(2, attempt),
        RETRY_CONFIG.MAX_DELAY
      );
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
      await sleep(delay);
      return callAIWithRetry(content, attempt + 1);
    }

    throw error;
  }
}

/**
 * 处理单个分块
 */
export async function processChunk(
  chunk: string[],
  chunkIndex: number
): Promise<ChunkResult> {
  try {
    const content = chunk.join('\n');
    const result = await callAIWithRetry(content);

    return {
      chunkIndex,
      success: true,
      result,
    };
  } catch (error) {
    return {
      chunkIndex,
      success: false,
      error: error instanceof Error ? error.message : '处理失败',
    };
  }
}

/**
 * 并发处理多个分块
 */
export async function processChunksBatch(
  chunks: string[][],
  startIndex: number,
  onProgress?: (progress: ProcessProgress) => void
): Promise<ChunkResult[]> {
  const results: ChunkResult[] = [];

  // 分批并发处理
  for (let i = 0; i < chunks.length; i += BATCH_CONFIG.CONCURRENCY) {
    const batch = chunks.slice(i, i + BATCH_CONFIG.CONCURRENCY);
    const batchPromises = batch.map((chunk, batchIndex) =>
      processChunk(chunk, startIndex + i + batchIndex)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // 更新进度
    if (onProgress) {
      const processedCount = results.length;
      onProgress({
        currentChunk: processedCount,
        totalChunks: chunks.length,
        processedRows: results.reduce(
          (sum, r) => sum + (r.success ? r.result?.categories.length || 0 : 0),
          0
        ),
        totalRows: chunks.reduce((sum, c) => sum + c.length, 0),
        percentage: (processedCount / chunks.length) * 100,
      });
    }
  }

  return results;
}

/**
 * 创建降级结果（当处理失败时）
 */
export function createFallbackResult(chunk: string[]): AIResponse {
  return {
    categories: chunk.map((text) => ({
      category: '其他' as const,
      confidence: 0,
      reason: '分析失败，请手动检查',
      originalText: text,
    })),
    negativeKeywords: [],
  };
}