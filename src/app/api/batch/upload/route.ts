import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, validateCSVFile } from '@/lib/utils/csv';
import { createChunks, CHUNK_CONFIG } from '@/lib/batch/processor';

// 最大行数限制
const MAX_ROWS = 10000;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '请上传 CSV 文件' }, { status: 400 });
    }

    // 验证文件
    const validation = validateCSVFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 读取文件内容
    const text = await file.text();

    // 解析 CSV（自动检测评论列）
    const { headers, rows, totalRows, commentColumnIndex, commentColumnName } = parseCSV(text);

    if (totalRows === 0) {
      return NextResponse.json({ error: 'CSV 文件为空或没有有效的评论数据' }, { status: 400 });
    }

    if (totalRows > MAX_ROWS) {
      return NextResponse.json(
        { error: `CSV 行数超过 ${MAX_ROWS} 行限制，当前有 ${totalRows} 行` },
        { status: 400 }
      );
    }

    // 创建分块
    const chunks = createChunks(rows);

    // 返回分块信息
    return NextResponse.json({
      success: true,
      data: {
        headers,
        totalRows,
        totalChunks: chunks.length,
        rowsPerChunk: CHUNK_CONFIG.MAX_ROWS_PER_CHUNK,
        chunks: chunks.map((chunk) => chunk.join('\n')),
        commentColumnIndex,
        commentColumnName,
      },
    });
  } catch (error) {
    console.error('CSV 上传解析失败:', error);
    return NextResponse.json(
      { error: 'CSV 文件解析失败，请检查文件格式' },
      { status: 500 }
    );
  }
}