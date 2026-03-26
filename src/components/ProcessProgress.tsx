'use client';

interface ProcessProgressProps {
  current: number;
  total: number;
  processedRows: number;
  totalRows: number;
  startTime: number;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
}

export default function ProcessProgress({
  current,
  total,
  processedRows,
  totalRows,
  startTime,
}: ProcessProgressProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;
  const elapsed = Date.now() - startTime;
  const estimatedTotal = progress > 0 ? elapsed / progress * 100 : 0;
  const remainingTime = Math.max(0, estimatedTotal - elapsed);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">处理进度</h3>
        <span className="text-xs text-gray-500">
          {Math.round(progress)}%
        </span>
      </div>

      {/* 进度条 */}
      <div className="relative">
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 详细信息 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">分块进度</span>
          <span className="font-medium text-gray-700">
            {current} / {total} 块
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">已处理行数</span>
          <span className="font-medium text-gray-700">
            {processedRows} / {totalRows} 行
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">已用时</span>
          <span className="font-medium text-gray-700">
            {formatTime(elapsed)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">预计剩余</span>
          <span className="font-medium text-gray-700">
            {progress > 5 ? formatTime(remainingTime) : '计算中...'}
          </span>
        </div>
      </div>

      {/* 提示 */}
      <p className="text-xs text-gray-400 text-center">
        处理过程中请勿关闭页面
      </p>
    </div>
  );
}