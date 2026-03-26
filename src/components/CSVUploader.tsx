'use client';

import { useCallback, useState, useRef } from 'react';

// 分块数据类型
interface ChunkData {
  lines: string[];
  lineNumbers: number[];
  content: string;
}

interface CSVUploaderProps {
  onUpload: (data: {
    totalRows: number;
    totalChunks: number;
    chunks: ChunkData[];
    commentColumnName?: string;
  }) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export default function CSVUploader({
  onUpload,
  onError,
  disabled = false,
}: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/batch/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          onError(result.error || '上传失败');
          return;
        }

        onUpload({
          totalRows: result.data.totalRows,
          totalChunks: result.data.totalChunks,
          chunks: result.data.chunks,
          commentColumnName: result.data.commentColumnName,
        });
      } catch (error) {
        onError('上传失败，请检查网络连接');
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload, onError]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) {
        handleUpload(file);
      } else {
        onError('请上传 CSV 格式的文件');
      }
    },
    [disabled, handleUpload, onError]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
      // 重置 input 以允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleUpload]
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
        transition-all duration-200
        ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">正在解析 CSV 文件...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full">
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              拖拽 CSV 文件到此处，或点击上传
            </p>
            <p className="text-xs text-gray-500 mt-1">
              支持最多 10,000 行数据，文件大小不超过 5MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}