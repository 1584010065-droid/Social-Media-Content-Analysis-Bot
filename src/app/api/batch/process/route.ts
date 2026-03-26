import { NextRequest, NextResponse } from 'next/server';
import {
  processChunksBatch,
  ChunkResult,
  BATCH_CONFIG,
} from '@/lib/batch/processor';

// 请求体类型
interface ProcessRequest {
  chunks: string[]; // 分块数据（每块是换行分隔的评论）
  startIndex: number; // 开始处理的分块索引
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

    // 将字符串分块转换回数组
    const chunkArrays = batchChunks.map((chunk) =>
      chunk.split('\n').filter((line) => line.trim())
    );

    // 处理分块
    const results = await processChunksBatch(chunkArrays, startIndex);

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