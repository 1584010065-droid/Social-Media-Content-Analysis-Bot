/**
 * CSV 解析工具
 * 支持标准 CSV 格式，正确处理中文字符和引号
 */

export interface ParsedCSV {
  headers: string[];
  rows: string[];
  totalRows: number;
}

/**
 * 解析 CSV 文件内容
 * @param text CSV 文件文本内容
 * @param commentColumn 评论所在的列名或列索引（默认取第一列）
 */
export function parseCSV(
  text: string,
  commentColumn?: string | number
): ParsedCSV {
  // 处理 BOM 头
  const cleanText = text.replace(/^\uFEFF/, '');

  // 按行分割
  const lines = cleanText.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  // 解析第一行作为表头
  const headers = parseCSVLine(lines[0]);

  // 确定评论列索引
  let commentIndex = 0;
  if (typeof commentColumn === 'string') {
    const idx = headers.findIndex(
      (h) => h.toLowerCase() === commentColumn.toLowerCase()
    );
    if (idx !== -1) {
      commentIndex = idx;
    }
  } else if (typeof commentColumn === 'number') {
    commentIndex = commentColumn;
  }

  // 解析数据行
  const rows: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length > commentIndex) {
      const comment = values[commentIndex].trim();
      if (comment) {
        rows.push(comment);
      }
    }
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

/**
 * 解析 CSV 单行
 * 正确处理引号包裹的字段
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // 检查是否是转义的引号
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * 验证 CSV 文件
 */
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
  // 检查文件类型
  const validTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
  const isCSV = file.name.endsWith('.csv') || validTypes.includes(file.type);

  if (!isCSV) {
    return { valid: false, error: '请上传 CSV 格式的文件' };
  }

  // 检查文件大小（5MB 限制）
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '文件大小超过 5MB 限制' };
  }

  return { valid: true };
}

/**
 * 估算 token 数量
 * 中文约 2 tokens/字，英文约 0.25 tokens/字
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 2 + otherChars * 0.25);
}