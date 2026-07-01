import { useCallback, useRef, useState, type DragEvent, type ChangeEvent, type ReactNode } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  /** 文件选择回调（非受控模式：选中文件时触发，父组件自行管理文件列表） */
  onFilesSelected?: (files: File[]) => void;
  /** 已上传文件列表（受控模式） */
  files?: File[];
  /** 文件变化回调（受控模式） */
  onFilesChange?: (files: File[]) => void;
  /** 是否允许多文件 */
  multiple?: boolean;
  /** 最大文件数（试用版限制） */
  maxFiles?: number;
  /** 接受的文件类型 */
  accept?: string;
  /** 描述文字 */
  description?: string;
  /** 提示文字 */
  hint?: string;
  /** 自定义图标 */
  icon?: ReactNode;
  /** 当前文件数（用于试用版限制提示） */
  currentCount?: number;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 文件上传拖拽区组件
 * 支持点击选择和拖拽上传，玻璃拟态风格
 * 支持两种模式：
 * - 非受控：onFilesSelected 回调，父组件自行管理
 * - 受控：files + onFilesChange
 */
export default function FileUploadZone({
  onFilesSelected,
  files: controlledFiles,
  onFilesChange,
  multiple = true,
  maxFiles,
  accept = '.pdf,application/pdf',
  description,
  hint = '支持拖拽上传，或点击选择文件',
  icon,
  currentCount,
  disabled = false,
}: FileUploadZone) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [internalFiles, setInternalFiles] = useState<File[]>([]);

  const files = controlledFiles ?? internalFiles;
  const count = currentCount ?? files.length;

  const validateAndAddFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles || newFiles.length === 0) return;

      const pdfFiles = Array.from(newFiles).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      );

      if (pdfFiles.length === 0) {
        return;
      }

      let result: File[];
      if (multiple) {
        result = [...files, ...pdfFiles];
        if (maxFiles && result.length > maxFiles) {
          result = result.slice(0, maxFiles);
        }
      } else {
        result = [pdfFiles[0]];
      }

      if (onFilesChange) {
        onFilesChange(result);
      } else if (onFilesSelected) {
        onFilesSelected(result);
      } else {
        setInternalFiles(result);
      }
    },
    [files, multiple, maxFiles, onFilesChange, onFilesSelected],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      validateAndAddFiles(e.dataTransfer.files);
    },
    [disabled, validateAndAddFiles],
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      validateAndAddFiles(e.target.files);
      e.target.value = '';
    },
    [validateAndAddFiles],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const next = files.filter((_, i) => i !== index);
      if (onFilesChange) {
        onFilesChange(next);
      } else {
        setInternalFiles(next);
      }
    },
    [files, onFilesChange],
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full space-y-4">
      {/* 拖拽上传区 */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative overflow-hidden rounded-2xl border border-border/50',
          'bg-white/40 backdrop-blur-xl',
          'transition-all duration-300 ease-out',
          'cursor-pointer select-none',
          isDragging && 'border-primary/60 bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10',
          disabled && 'opacity-60 cursor-not-allowed',
          !disabled && !isDragging && 'hover:border-primary/40 hover:bg-white/60',
        )}
      >
        {/* 背景装饰光斑 */}
        <div
          className={cn(
            'pointer-events-none absolute -top-1/2 -left-1/2 w-full h-full',
            'bg-gradient-to-br from-primary/20 via-transparent to-secondary/20',
            'blur-3xl opacity-40 transition-opacity duration-500',
            isDragging ? 'opacity-70' : 'opacity-40',
          )}
        />

        <div className="relative z-10 flex flex-col items-center justify-center px-6 py-10 md:py-14">
          <div
            className={cn(
              'mb-4 flex items-center justify-center',
              'w-16 h-16 md:w-20 md:h-20 rounded-2xl',
              'bg-gradient-to-br from-primary/15 to-secondary/15',
              'backdrop-blur-sm border border-white/40',
              'transition-all duration-300',
              isDragging && 'scale-110 from-primary/25 to-secondary/25',
            )}
          >
            {icon ?? (
              <UploadCloud
                className={cn(
                  'w-8 h-8 md:w-10 md:h-10 text-primary transition-all duration-300',
                  isDragging && 'scale-110',
                )}
              />
            )}
          </div>

          <p className="text-base md:text-lg font-semibold text-foreground mb-1">
            {description ?? (multiple ? '拖拽 PDF 文件到此处' : '拖拽 PDF 文件到此处')}
          </p>
          <p className="text-sm text-muted-foreground mb-4">{hint}</p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) inputRef.current?.click();
            }}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-medium',
              'bg-primary text-primary-foreground',
              'shadow-md shadow-primary/20',
              'transition-all duration-200',
              'hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5',
              'active:translate-y-0 active:shadow-sm',
              disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
            )}
          >
            选择文件
          </button>

          {maxFiles && (
            <p className="mt-3 text-xs text-muted-foreground">
              最多上传 {maxFiles} 个文件（当前 {count}/{maxFiles}）
            </p>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* 已上传文件列表（受控模式下显示） */}
      {files.length > 0 && onFilesChange && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}-${file.size}`}
              className={cn(
                'group flex items-center gap-3 px-4 py-3 rounded-xl',
                'bg-white/50 backdrop-blur-md border border-border/40',
                'transition-all duration-200',
                'hover:bg-white/70 hover:border-border/60',
              )}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
                  className={cn(
                    'shrink-0 p-1.5 rounded-lg',
                    'text-muted-foreground hover:text-destructive',
                    'hover:bg-destructive/10',
                    'transition-all duration-200',
                    'opacity-60 group-hover:opacity-100',
                  )}
                  aria-label="移除文件"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
