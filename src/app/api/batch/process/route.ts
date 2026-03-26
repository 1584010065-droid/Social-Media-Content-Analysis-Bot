import { NextRequest, NextResponse } from 'next/server';
import {
  processChunksBatchWithLineNumbers,
  processChunksBatch,
  ChunkResult,
  BATCH_CONFIG,
  ChunkWithLineNumbers,
} from '@/lib/batch/processor';

// 请求体类型
interface ChunkData {
  lines: string[];
  lineNumbers: number[];
  content: string; // 兼容旧格式
}

// 请求体类型
interface ProcessRequest {
  chunks: (ChunkData | string)[]; // 支持新格式和旧格式
  startIndex: number;
}

// 响应类型
interface ProcessResponse {
  success: boolean;
  processedCount: number;
  totalChunks: number;
  hasMore: boolean;
  nextIndex: number;
  results: ChunkResult[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json();
    const { chunks, startIndex } = body;

    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json({ error: '无效的分块数据' }, { status: 400 });
    }

    // 取出一批要处理的分块（控制在时间限制内）
    const batchChunks = chunks.slice(0, BATCH_CONFIG.CHUNKS_PER_REQUEST);
    const remainingChunks = chunks.slice(BATCH_CONFIG.CHUNKS_PER_REQUEST);

    // 判断是否是新格式（带行号）
    const isNewFormat = batchChunks.length > 0 && typeof batchChunks[0] === 'object' && 'lineNumbers' in batchChunks[0];

    let results: ChunkResult[];

    if (isNewFormat) {
      // 新格式：带行号的分块
      const chunkDataArray = (batchChunks as ChunkData[]).map((chunk) => ({
        lines: chunk.lines,
        lineNumbers: chunk.lineNumbers,
      })) as ChunkWithLineNumbers[];

      results = await processChunksBatchWithLineNumbers(chunkDataArray, startIndex);
    } else {
      // 兼容旧格式
      const chunkArrays = (batchChunks as string[]).map((chunk) =>
        chunk.split('\n').filter((line) => line.trim())
      );

      results = await processChunksBatch(chunkArrays, startIndex);
    }

    // 返回结果
    const response: ProcessResponse = {
      success: true,
      processedCount: batchChunks.length,
      totalChunks: chunks.length,
      hasMore: remainingChunks.length > 0,
      nextIndex: startIndex + batchChunks.length,
      results,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('批量处理失败:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '批量处理失败，请稍后重试',
      },
      { status: 500 }
    );
  }
}