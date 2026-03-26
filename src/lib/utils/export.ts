/**
 * 导出工具
 * 支持 CSV 和 JSON 格式导出
 */

import { AggregatedResult } from '../batch/aggregator';

/**
 * 导出为 CSV 格式
 */
export function exportToCSV(result: AggregatedResult): string {
  const headers = ['行号', '原文', '维度', '情感', '子维度', '置信度', '理由'];
  const rows: string[][] = [];

  // 添加分类结果
  for (const cat of result.categories) {
    const subDimsStr = cat.subDimensions
      .map(s => `${s.dimension}(${s.sentiment})`)
      .join('; ');

    rows.push([
      cat.lineNumber?.toString() || '0',
      escapeCSVField(cat.originalText),
      cat.dimension,
      cat.sentiment,
      subDimsStr,
      cat.confidence.toString(),
      escapeCSVField(cat.reason),
    ]);
  }

  // 添加空行分隔
  rows.push([]);

  // 添加统计摘要
  rows.push(['=== 统计摘要 ===', '', '', '', '', '', '']);
  rows.push(['总评论数', result.summary.total.toString(), '', '', '', '', '']);
  rows.push(['', '', '', '', '', '', '']);
  rows.push(['维度分布:', '', '', '', '', '', '']);
  rows.push(['成分派', result.summary.dimensionDistribution['成分派'].toString(), '', '', '', '', '']);
  rows.push(['包装派', result.summary.dimensionDistribution['包装派'].toString(), '', '', '', '', '']);
  rows.push(['效果派', result.summary.dimensionDistribution['效果派'].toString(), '', '', '', '', '']);
  rows.push(['价格派', result.summary.dimensionDistribution['价格派'].toString(), '', '', '', '', '']);
  rows.push(['其他', result.summary.dimensionDistribution['其他'].toString(), '', '', '', '', '']);
  rows.push(['', '', '', '', '', '', '']);
  rows.push(['情感分布:', '', '', '', '', '', '']);
  rows.push(['正向', result.summary.sentimentDistribution['正向'].toString(), '', '', '', '', '']);
  rows.push(['中性', result.summary.sentimentDistribution['中性'].toString(), '', '', '', '', '']);
  rows.push(['负向', result.summary.sentimentDistribution['负向'].toString(), '', '', '', '', '']);

  // 添加空行分隔
  rows.push([]);

  // 添加负面吐槽点
  rows.push(['=== 负面吐槽点 Top 10 ===', '', '', '', '', '', '']);
  rows.push(['维度', '吐槽内容', '出现次数', '示例1', '示例2', '示例3', '']);
  for (const complaint of result.negativeComplaints) {
    rows.push([
      complaint.dimension,
      escapeCSVField(complaint.complaint),
      complaint.count.toString(),
      escapeCSVField(complaint.examples[0] || ''),
      escapeCSVField(complaint.examples[1] || ''),
      escapeCSVField(complaint.examples[2] || ''),
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