/**
 * 提示词导出
 * 主方案：SYSTEM_PROMPT（主维度 + 子维度情感）
 * 备份方案：backup_a, backup_c
 */

export { SYSTEM_PROMPT } from './system';
export { SYSTEM_PROMPT_BACKUP_A } from './backup/backup_a_split_records';
export { SYSTEM_PROMPT_BACKUP_C } from './backup/backup_c_multi_dimension';

/**
 * 方案对比说明：
 *
 * 【主方案B】主维度 + 子维度情感
 * - 优点：有主次之分，结构清晰，符合用户阅读习惯
 * - 适用：需要区分核心关注点和次要关注点的场景
 * - 示例：{ dimension: "效果派", sentiment: "正向", subDimensions: [{ dimension: "价格派", sentiment: "负向" }] }
 *
 * 【备份方案A】拆分记录
 * - 优点：完整表达，不丢失信息，后端聚合灵活
 * - 适用：需要独立统计每个维度情感的场景
 * - 示例：输出两条记录，每条独立的维度和情感
 *
 * 【备份方案C】多维度各自情感
 * - 优点：每个维度情感独立，同时有整体态度
 * - 适用：需要完整多维度视图的场景
 * - 示例：{ dimensions: [{ dimension: "价格派", sentiment: "负向" }, ...], overallSentiment: "正向" }
 */