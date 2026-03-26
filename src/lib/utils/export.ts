/**
 * 导出工具
 * 支持 CSV 和 JSON 格式导出
 */

import { AggregatedResult } from '../batch/aggregator';

/**
 * 导出为 CSV 格式
 */
export function exportToCSV(result: AggregatedResult): string {
  const headers = ['行号', '原文', '分类', '置信度', '理由'];
  const rows: string[][] = [];

  // 添加分类结果
  for (const cat of result.categories) {
    rows.push([
      cat.lineNumber?.toString() || '0',
      escapeCSVField(cat.originalText),
      cat.category,
      cat.confidence.toString(),
      escapeCSVField(cat.reason),
    ]);
  }

  // 添加空行分隔
  rows.push([]);

  // 添加统计摘要
  rows.push(['=== 统计摘要 ===', '', '', '', '']);
  rows.push(['总评论数', result.summary.total.toString(), '', '', '']);
  rows.push(['成分派', result.summary.categoryDistribution['成分派'].toString(), '', '', '']);
  rows.push(['包装派', result.summary.categoryDistribution['包装派'].toString(), '', '', '']);
  rows.push(['效果派', result.summary.categoryDistribution['效果派'].toString(), '', '', '']);
  rows.push(['价格派', result.summary.categoryDistribution['价格派'].toString(), '', '', '']);
  rows.push(['其他', result.summary.categoryDistribution['其他'].toString(), '', '', '']);

  // 添加空行分隔
  rows.push([]);

  // 添加负面关键词
  rows.push(['=== 负面关键词 Top 10 ===', '', '', '', '']);
  rows.push(['关键词', '出现次数', '示例1', '示例2', '示例3', '']);
  for (const kw of result.negativeKeywords) {
    rows.push([
      kw.keyword,
      kw.count.toString(),
      escapeCSVField(kw.examples[0] || ''),
      escapeCSVField(kw.examples[1] || ''),
      escapeCSVField(kw.examples[2] || ''),
    ]);
  }

  // 组装 CSV
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  // 添加 BOM 以支持中文
  return '\uFEFF' + csvContent;
}

/**
 * 转义 CSV 字段
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

/**
 * 导出为 JSON 格式
 */
export function exportToJSON(result: AggregatedResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * 下载文件
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * 导出分析结果
 */
export function exportResult(
  result: AggregatedResult,
  format: 'csv' | 'json',
  filenamePrefix: string = 'analysis'
): void {
  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const content = exportToCSV(result);
    downloadFile(content, `${filenamePrefix}_${timestamp}.csv`, 'text/csv;charset=utf-8');
  } else {
    const content = exportToJSON(result);
    downloadFile(content, `${filenamePrefix}_${timestamp}.json`, 'application/json');
  }
}