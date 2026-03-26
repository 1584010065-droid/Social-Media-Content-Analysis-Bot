"use client";

import { useState, useRef, useEffect } from "react";

// 类型定义
interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  analysis?: AnalysisResult;
}

interface CategoryResult {
  category: "成分派" | "包装派" | "效果派" | "价格派" | "其他";
  confidence: number;
  reason: string;
}

interface NegativeKeyword {
  keyword: string;
  count: number;
  examples: string[];
}

interface AnalysisResult {
  categories: CategoryResult[];
  summary: {
    total: number;
    categoryDistribution: Record<string, number>;
  };
  negativeKeywords: NegativeKeyword[];
}

// 分类颜色映射
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  "成分派": { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  "包装派": { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
  "效果派": { bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
  "价格派": { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  "其他": { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" }
};

// 建议示例
const suggestions = [
  { icon: "📊", text: "分析护肤品评论：成分安全、包装精美、效果明显、价格合理" },
  { icon: "🔍", text: "提取负面反馈：太贵、没效果、过敏、味道难闻、质地油腻" },
  { icon: "📈", text: "批量分析社媒数据，自动归类用户关注点" }
];

// 示例数据
const sampleData = `这个面霜成分很天然，没有添加剂
包装太精美了，送人很有面子
用了两周，美白效果明显
价格有点贵，但是值得
成分表很干净，敏感肌也能用
瓶子设计很好看，摆在桌上很高级
性价比很高，活动买的很划算
用了过敏，皮肤发红发痒
完全没效果，浪费钱
太贵了，学生党买不起`;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
      throw new Error("分析请求失败");
    }

    return response.json();
  };

  const handleSend = async (content: string) => {
    if (!content.trim()) return;

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
        content: "抱歉，分析过程中出现错误，请稍后重试。"
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestionText: string) => {
    if (suggestionText.includes("批量分析")) {
      setInputValue(sampleData);
    } else {
      handleSend(suggestionText);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputValue("");
  };

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
          </div>
        ) : (
          <div className="py-6 space-y-6 max-w-4xl mx-auto">
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
                          {/* 分类统计 */}
                          <div className="bg-white rounded-xl shadow-sm border border-[#EAEAEA] overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#EAEAEA] bg-gray-50">
                              <h4 className="text-sm font-semibold text-[#333333]">📊 分类统计</h4>
                            </div>
                            <div className="p-5">
                              <div className="grid grid-cols-5 gap-3 mb-4">
                                {Object.entries(message.analysis.summary.categoryDistribution).map(([cat, count]) => {
                                  const colors = categoryColors[cat];
                                  const percentage = message.analysis!.summary.total > 0 
                                    ? Math.round((count / message.analysis!.summary.total) * 100) 
                                    : 0;
                                  return (
                                    <div key={cat} className={`${colors.bg} ${colors.border} border rounded-lg p-3 text-center`}>
                                      <div className={`text-lg font-bold ${colors.text}`}>{count}</div>
                                      <div className={`text-xs ${colors.text} mt-1`}>{cat}</div>
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
                            <div className="divide-y divide-[#EAEAEA]">
                              {message.analysis.categories.slice(0, 5).map((cat, idx) => {
                                const colors = categoryColors[cat.category];
                                return (
                                  <div key={idx} className="px-5 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className={`px-2 py-1 text-xs font-medium rounded-lg ${colors.bg} ${colors.text}`}>
                                        {cat.category}
                                      </span>
                                      <span className="text-xs text-[#888888]">{cat.reason}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-blue-500 rounded-full"
                                          style={{ width: `${cat.confidence}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-[#888888] w-10 text-right">{cat.confidence}%</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {message.analysis.categories.length > 5 && (
                                <div className="px-5 py-2 text-center text-xs text-[#888888]">
                                  ...还有 {message.analysis.categories.length - 5} 条数据
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 负面关键词 */}
                          <div className="bg-white rounded-xl shadow-sm border border-[#EAEAEA] overflow-hidden">
                            <div className="px-5 py-3 border-b border-[#EAEAEA] bg-gray-50">
                              <h4 className="text-sm font-semibold text-[#333333]">⚠️ 负面吐槽 Top 3</h4>
                            </div>
                            <div className="divide-y divide-[#EAEAEA]">
                              {message.analysis.negativeKeywords.map((kw, idx) => (
                                <div key={idx} className="px-5 py-4">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="flex items-center justify-center w-6 h-6 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                                      {idx + 1}
                                    </span>
                                    <span className="text-base font-semibold text-[#333333]">{kw.keyword}</span>
                                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded-full">
                                      出现 {kw.count} 次
                                    </span>
                                  </div>
                                  <div className="ml-9 space-y-1">
                                    {kw.examples.map((example, i) => (
                                      <p key={i} className="text-xs text-[#888888] bg-gray-50 px-3 py-2 rounded-lg">
                                        &ldquo;{example}&rdquo;
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              ))}
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
            支持批量分析，每行输入一条评论
          </p>
        </div>
      </footer>
    </div>
  );
}
