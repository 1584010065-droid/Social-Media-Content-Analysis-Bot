"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import CSVUploader from "@/components/CSVUploader";
import ProcessProgress from "@/components/ProcessProgress";
import { aggregateResultsWithLineNumbers, AggregatedResult } from "@/lib/batch/aggregator";
import { ChunkResult, ChunkWithLineNumbers } from "@/lib/batch/processor";
import { exportResult } from "@/lib/utils/export";

// 类型定义
interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  analysis?: AnalysisResult;
}

interface SubDimension {
  dimension: "成分派" | "包装派" | "效果派" | "价格派" | "其他";
  sentiment: "正向" | "中性" | "负向";
}

interface CategoryResult {
  lineNumber: number;
  dimension: "成分派" | "包装派" | "效果派" | "价格派" | "其他";
  sentiment: "正向" | "中性" | "负向";
  subDimensions: SubDimension[];
  confidence: number;
  reason: string;
  originalText: string;
}

interface NegativeComplaint {
  dimension: "成分问题" | "包装问题" | "效果问题" | "价格问题" | "笼统负面" | "其他问题";
  complaint: string;
  count: number;
  examples: string[];
}

interface AnalysisResult {
  categories: CategoryResult[];
  summary: {
    total: number;
    dimensionDistribution: Record<string, number>;
    sentimentDistribution: Record<string, number>;
  };
  negativeComplaints: NegativeComplaint[];
  failedChunks?: number[];
}

// 分类颜色映射
const categoryColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  "成分派": { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", icon: "🧪" },
  "包装派": { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200", icon: "🎁" },
  "效果派": { bg: "bg-green-50", text: "text-green-600", border: "border-green-200", icon: "✨" },
  "价格派": { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", icon: "💰" },
  "其他": { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", icon: "📝" }
};

// 情感颜色映射
const sentimentColors: Record<string, { bg: string; text: string }> = {
  "正向": { bg: "bg-green-50", text: "text-green-600" },
  "中性": { bg: "bg-gray-50", text: "text-gray-600" },
  "负向": { bg: "bg-red-50", text: "text-red-600" }
};

// 建议示例
const suggestions = [
  { icon: "📊", text: "分析护肤品评论：成分安全、包装精美、效果明显、价格合理" },
  { icon: "🔍", text: "提取负面反馈：太贵、没效果、过敏、味道难闻、质地油腻" },
  { icon: "📁", text: "上传 CSV 文件批量分析（支持 500-10000 行数据）" }
];

// 示例数据
const sampleData = `这个面霜成分很天然，没有添加剂，敏感肌也能用
包装太精美了，送人很有面子，瓶子设计很好看
用了两周，美白效果明显，皮肤变好了很多
价格有点贵，但是值得，性价比还可以
成分表很干净，没有香精和防腐剂
瓶子设计很好看，摆在桌上很高级，颜值很高
性价比很高，活动买的很划算，超值
用了过敏，皮肤发红发痒，太刺激了
完全没效果，浪费钱，没效果
太贵了，学生党买不起，价格不合理
保湿效果很好，吸收很快，推荐购买
味道难闻，质地太油腻了，不喜欢
假货，不要买，被骗了
温和不刺激，成分很安全，用着放心`;

// 分块数据类型（新格式）
interface ChunkData {
  lines: string[];
  lineNumbers: number[];
  content: string;
}

// 批量处理状态
interface BatchState {
  isProcessing: boolean;
  chunks: ChunkData[];
  currentIndex: number;
  totalChunks: number;
  totalRows: number;
  results: ChunkResult[];
  startTime: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [batchState, setBatchState] = useState<BatchState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // 调用API分析
  const analyzeContent = async (content: string): Promise<AnalysisResult> => {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "未知错误" }));
      throw new Error(errorData.error || "分析请求失败");
    }

    return response.json();
  };

  const handleSend = async (content: string) => {
    if (!content.trim()) return;

    setShowUploader(false);
    const userMessage: Message = {
      id: generateId(),
      type: "user",
      content
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const analysis = await analyzeContent(content);

      const botMessage: Message = {
        id: generateId(),
        type: "bot",
        content: `已完成对 ${analysis.summary.total} 条社媒内容的分析，以下是分析结果：`,
        analysis
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: generateId(),
        type: "bot",
        content: error instanceof Error ? error.message : "抱歉，分析过程中出现错误，请稍后重试。"
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // CSV 上传成功回调
  const handleCSVUpload = async (data: {
    totalRows: number;
    totalChunks: number;
    chunks: ChunkData[];
    commentColumnName?: string;
  }) => {
    setShowUploader(false);

    // 添加用户消息
    const columnInfo = data.commentColumnName
      ? `（自动识别评论列：${data.commentColumnName}）`
      : '';
    const userMessage: Message = {
      id: generateId(),
      type: "user",
      content: `上传了 CSV 文件，共 ${data.totalRows} 条数据，分为 ${data.totalChunks} 个批次处理${columnInfo}`
    };
    setMessages([userMessage]);

    // 初始化批量处理状态
    setBatchState({
      isProcessing: true,
      chunks: data.chunks,
      currentIndex: 0,
      totalChunks: data.totalChunks,
      totalRows: data.totalRows,
      results: [],
      startTime: Date.now()
    });
  };

  // 批量处理循环
  useEffect(() => {
    if (!batchState || !batchState.isProcessing) return;

    const processNextBatch = async () => {
      try {
        const remainingChunks = batchState.chunks.slice(batchState.currentIndex);

        if (remainingChunks.length === 0) {
          // 全部处理完成，聚合结果
          const chunkWithLineNumbers: ChunkWithLineNumbers[] = batchState.chunks.map(c => ({
            lines: c.lines,
            lineNumbers: c.lineNumbers,
          }));
          const aggregated = aggregateResultsWithLineNumbers(
            batchState.results,
            chunkWithLineNumbers
          );

          const botMessage: Message = {
            id: generateId(),
            type: "bot",
            content: `已完成对 ${batchState.totalRows} 条社媒内容的分析，以下是分析结果：${aggregated.failedChunks.length > 0 ? `（有 ${aggregated.failedChunks.length} 个分块处理失败）` : ''}`,
            analysis: aggregated
          };
          setMessages(prev => [...prev, botMessage]);
          setBatchState(null);
          return;
        }

        // 处理下一批
        const response = await fetch("/api/batch/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chunks: remainingChunks,
            startIndex: batchState.currentIndex
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "处理失败");
        }

        // 更新状态
        setBatchState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentIndex: result.nextIndex,
            results: [...prev.results, ...result.results]
          };
        });
      } catch (error) {
        console.error("批量处理错误:", error);
        const errorMessage: Message = {
          id: generateId(),
          type: "bot",
          content: error instanceof Error ? error.message : "批量处理失败，请重新上传文件"
        };
        setMessages(prev => [...prev, errorMessage]);
        setBatchState(null);
      }
    };

    processNextBatch();
  }, [batchState]);

  const handleSuggestionClick = (suggestionText: string) => {
    if (suggestionText.includes("CSV")) {
      setShowUploader(true);
    } else if (suggestionText.includes("批量分析")) {
      setInputValue(sampleData);
    } else {
      handleSend(suggestionText);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputValue("");
    setShowUploader(false);
    setBatchState(null);
  };

  // 导出结果
  const handleExport = (format: 'csv' | 'json') => {
    const lastAnalysis = messages.filter(m => m.analysis).pop()?.analysis;
    if (lastAnalysis) {
      exportResult(lastAnalysis as any, format);
    }
  };

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // 搜索结果（使用 useMemo 缓存，带防抖效果）
  const searchResults = useMemo(() => {
    const lastAnalysis = messages.filter(m => m.analysis).pop()?.analysis;
    if (!lastAnalysis || !searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase().trim();
    const isLineNumberSearch = /^\d+$/.test(query);
    const lineNumber = isLineNumberSearch ? parseInt(query, 10) : null;

    return lastAnalysis.categories.filter((cat) => {
      if (isLineNumberSearch) {
        // 按行号搜索
        return cat.lineNumber === lineNumber;
      }
      // 按内容搜索
      return (
        cat.originalText.toLowerCase().includes(query) ||
        cat.dimension.toLowerCase().includes(query) ||
        cat.sentiment.toLowerCase().includes(query) ||
        cat.reason.toLowerCase().includes(query)
      );
    }).slice(0, 100); // 限制结果数量
  }, [messages, searchQuery]);

  // 清除搜索
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setShowSearch(false);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#F8F8F9]">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#EAEAEA]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-base font-semibold text-[#333333]">社媒内容分析 Bot</span>
        </div>
        <button
          onClick={handleNewChat}
          className="px-4 py-2 text-sm text-[#333333] border border-[#EAEAEA] rounded-full hover:bg-gray-50 transition-all"
        >
          + 新对话
        </button>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-[10%]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20">
            <div className="w-16 h-16 mb-8 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[#333333] mb-2">社媒内容智能分析</h2>
            <p className="text-sm text-[#888888] mb-8 text-center max-w-md">
              自动归类社媒内容为「成分派」「包装派」「效果派」「价格派」，并提取负面吐槽关键词
            </p>

            {/* CSV 上传区域 */}
            {showUploader ? (
              <div className="w-full max-w-2xl">
                <CSVUploader
                  onUpload={handleCSVUpload}
                  onError={(error) => {
                    setMessages([{
                      id: generateId(),
                      type: "bot",
                      content: error
                    }]);
                    setShowUploader(false);
                  }}
                />
                <button
                  onClick={() => setShowUploader(false)}
                  className="mt-4 text-sm text-gray-500 hover:text-gray-700"
                >
                  取消上传
                </button>
              </div>
            ) : (
              <div className="w-full max-w-2xl space-y-3">
                {suggestions.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(item.text)}
                    className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-[#EAEAEA] text-left hover:shadow-md hover:border-blue-300 transition-all"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-sm text-[#333333]">{item.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 space-y-6 max-w-4xl mx-auto">
            {/* 批量处理进度 */}
            {batchState && batchState.isProcessing && (
              <ProcessProgress
                current={batchState.currentIndex}
                total={batchState.totalChunks}
                processedRows={batchState.results.reduce((sum, r) => sum + (r.success ? r.result?.categories.length || 0 : 0), 0)}
                totalRows={batchState.totalRows}
                startTime={batchState.startTime}
              />
            )}

            {messages.map((message) => (
              <div key={message.id}>
                {message.type === "user" ? (
                  <div className="flex justify-end mb-4">
                    <div className="max-w-[80%] bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-3 shadow-sm border border-[#EAEAEA]">
                        <p className="text-sm text-[#333333] leading-relaxed">{message.content}</p>
                      </div>

                      {message.analysis && (
                        <div className="mt-4 space-y-4">
                          {/* 导出按钮 */}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => handleExport('csv')}
                              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              📥 导出 CSV
                            </button>
                            <button
                              onClick={() => handleExport('json')}
                              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              📥 导出 JSON
                            </button>
                            <button
                              onClick={() => setShowSearch(!showSearch)}
                              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              🔍 搜索
                            </button>
                          </div>

                          {/* 搜索框 */}
                          {showSearch && (
                            <div className="bg-white rounded-xl shadow-sm border border-[#EAEAEA] overflow-hidden">
                              <div className="p-4">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="输入行号、关键词或评论内容搜索..."
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                  <button
                                    onClick={clearSearch}
                                    className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700"
                                  >
                                    清除
                                  </button>
                                </div>
                                {searchQuery.trim() && (
                                  <div className="mt-3 text-sm text-gray-600">
                                    找到 <span className="font-medium text-blue-600">{searchResults.length}</span> 条匹配结果
                                    {searchResults.length >= 100 && (
                                      <span className="text-gray-400">（仅显示前 100 条）</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {searchQuery.trim() && searchResults.length > 0 && (
                                <div className="border-t border-gray-100 max-h-64 overflow-y-auto">
                                  {searchResults.map((cat, idx) => {
                                    const dimColors = categoryColors[cat.dimension];
                                    const sentColors = sentimentColors[cat.sentiment];
                                    return (
                                      <div key={idx} className="px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                                            行 {cat.lineNumber}
                                          </span>
                                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${dimColors.bg} ${dimColors.text}`}>
                                            {cat.dimension}
                                          </span>
                                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${sentColors.bg} ${sentColors.text}`}>
                                            {cat.sentiment}
                                          </span>
                                          <span className="text-xs text-gray-400">
                                            {cat.confidence}%
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-700 line-clamp-2">{cat.originalText}</p>
                                        {cat.reason && (
                                          <p className="text-xs text-gray-500 mt-1">{cat.reason}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {searchQuery.trim() && searchResults.length === 0 && (
                                <div className="px-4 py-6 text-center text-sm text-gray-500 border-t border-gray-100">
                                  未找到匹配结果
                                </div>
                              )}
                            </div>
                          )}

                          {/* 分类统计 */}
                          <div className="bg-white rounded-xl shadow-sm border border-[#EAEAEA] overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#EAEAEA] bg-gray-50">
                              <h4 className="text-sm font-semibold text-[#333333]">📊 维度分布</h4>
                            </div>
                            <div className="p-5">
                              <div className="grid grid-cols-5 gap-3 mb-4">
                                {Object.entries(message.analysis.summary.dimensionDistribution).map(([dim, count]) => {
                                  const colors = categoryColors[dim];
                                  const percentage = message.analysis!.summary.total > 0
                                    ? Math.round((count / message.analysis!.summary.total) * 100)
                                    : 0;
                                  return (
                                    <div key={dim} className={`${colors.bg} ${colors.border} border rounded-lg p-3 text-center`}>
                                      <div className={`text-lg font-bold ${colors.text}`}>{count}</div>
                                      <div className={`text-xs ${colors.text} mt-1`}>{dim}</div>
                                      <div className="text-xs text-gray-400 mt-1">{percentage}%</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* 情感分布统计 */}
                          <div className="bg-white rounded-xl shadow-sm border border-[#EAEAEA] overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#EAEAEA] bg-gray-50">
                              <h4 className="text-sm font-semibold text-[#333333]">💭 情感分布</h4>
                            </div>
                            <div className="p-5">
                              <div className="grid grid-cols-3 gap-3">
                                {Object.entries(message.analysis.summary.sentimentDistribution).map(([sent, count]) => {
                                  const colors = sentimentColors[sent];
                                  const percentage = message.analysis!.summary.total > 0
                                    ? Math.round((count / message.analysis!.summary.total) * 100)
                                    : 0;
                                  return (
                                    <div key={sent} className={`${colors.bg} border rounded-lg p-3 text-center`}>
                                      <div className={`text-lg font-bold ${colors.text}`}>{count}</div>
                                      <div className={`text-xs ${colors.text} mt-1`}>{sent}</div>
                                      <div className="text-xs text-gray-400 mt-1">{percentage}%</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* 详细分类结果 */}
                          <div className="bg-white rounded-xl shadow-sm border border-[#EAEAEA] overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#EAEAEA] bg-gray-50">
                              <h4 className="text-sm font-semibold text-[#333333]">📝 详细分类</h4>
                            </div>
                            <div className="divide-y divide-[#EAEAEA] max-h-80 overflow-y-auto">
                              {message.analysis.categories.slice(0, 10).map((cat, idx) => {
                                const dimColors = categoryColors[cat.dimension];
                                const sentColors = sentimentColors[cat.sentiment];
                                return (
                                  <div key={idx} className="px-5 py-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded flex-shrink-0">
                                          {cat.lineNumber || '-'}
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-lg ${dimColors.bg} ${dimColors.text} flex-shrink-0`}>
                                          {cat.dimension}
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-lg ${sentColors.bg} ${sentColors.text} flex-shrink-0`}>
                                          {cat.sentiment}
                                        </span>
                                        {cat.subDimensions && cat.subDimensions.length > 0 && (
                                          <span className="text-xs text-gray-400 truncate">
                                            ({cat.subDimensions.map(s => `${s.dimension}:${s.sentiment}`).join(', ')})
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${cat.confidence}%` }}
                                          />
                                        </div>
                                        <span className="text-xs text-[#888888] w-10 text-right">{cat.confidence}%</span>
                                      </div>
                                    </div>
                                    {cat.reason && (
                                      <p className="text-xs text-[#888888] mt-1 ml-6 truncate">{cat.reason}</p>
                                    )}
                                  </div>
                                );
                              })}
                              {message.analysis.categories.length > 10 && (
                                <div className="px-5 py-2 text-center text-xs text-[#888888]">
                                  ...还有 {message.analysis.categories.length - 10} 条数据，请导出查看完整结果
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 负面吐槽点 */}
                          <div className="bg-white rounded-xl shadow-sm border border-[#EAEAEA] overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#EAEAEA] bg-gray-50">
                              <h4 className="text-sm font-semibold text-[#333333]">⚠️ 负面吐槽 Top {message.analysis.negativeComplaints.length}</h4>
                            </div>
                            <div className="divide-y divide-[#EAEAEA]">
                              {message.analysis.negativeComplaints.map((complaint, idx) => (
                                <div key={idx} className="px-5 py-4">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="flex items-center justify-center w-6 h-6 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                                      {idx + 1}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                      {complaint.dimension}
                                    </span>
                                    <span className="text-base font-semibold text-[#333333]">{complaint.complaint}</span>
                                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded-full">
                                      出现 {complaint.count} 次
                                    </span>
                                  </div>
                                  <div className="ml-9 space-y-1">
                                    {complaint.examples.map((example, i) => (
                                      <p key={i} className="text-xs text-[#888888] bg-gray-50 px-3 py-2 rounded-lg">
                                        &ldquo;{example}&rdquo;
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {message.analysis.negativeComplaints.length === 0 && (
                                <div className="px-5 py-4 text-center text-sm text-gray-500">
                                  暂无负面吐槽
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-3 shadow-sm border border-[#EAEAEA]">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* 底部输入区 */}
      <footer className="px-4 sm:px-6 lg:px-[10%] py-4 bg-white border-t border-[#EAEAEA]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-[#EAEAEA] px-4 py-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(inputValue);
                }
              }}
              placeholder="输入社媒评论内容，每行一条..."
              className="flex-1 bg-transparent text-sm text-[#333333] placeholder-[#888888] outline-none resize-none min-h-[24px] max-h-[120px]"
              rows={1}
              style={{ height: "auto" }}
            />
            <button
              onClick={() => setShowUploader(true)}
              className="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0"
              title="上传 CSV 文件"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </button>
            <button
              onClick={() => handleSend(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-[#888888] mt-2 text-center">
            支持批量分析，每行输入一条评论，或点击左侧按钮上传 CSV 文件
          </p>
        </div>
      </footer>
    </div>
  );
}