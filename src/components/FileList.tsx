import { useState, useCallback } from 'react';
import { FileText, Trash2, GripVertical, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface IFileItem {
  id: string;
  name: string;
  size: number;
  pages: number;
  file: File;
}

interface FileListProps {
  files: IFileItem[];
  onRemove: (id: string) => void;
  onReorder?: (files: IFileItem[]) => void;
  showDragHandle?: boolean;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FileList({
  files,
  onRemove,
  onReorder,
  showDragHandle = true,
  className,
}: FileListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (!showDragHandle || !onReorder) return;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, [showDragHandle, onReorder]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (!showDragHandle || !onReorder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }, [showDragHandle, onReorder, dragOverIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    if (!showDragHandle || !onReorder || dragIndex === null) return;
    e.preventDefault();

    const newFiles = [...files];
    const [draggedItem] = newFiles.splice(dragIndex, 1);
    newFiles.splice(dropIndex, 0, draggedItem);
    onReorder(newFiles);

    setDragIndex(null);
    setDragOverIndex(null);
  }, [showDragHandle, onReorder, dragIndex, files]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className={cn('w-full space-y-3', className)}>
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-foreground/80">
          已上传 <span className="font-semibold text-primary">{files.length}</span> 个文件
        </h3>
        {files.length > 1 && showDragHandle && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <GripVertical className="w-3 h-3" />
            拖拽调整顺序
          </p>
        )}
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {files.map((item, index) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl border p-3',
                'bg-card/60 backdrop-blur-sm border-border/40',
                'hover:border-primary/30 hover:bg-card/80',
                'transition-all duration-200',
                showDragHandle && onReorder && 'cursor-grab active:cursor-grabbing',
                dragIndex === index && 'opacity-50 scale-[0.98]',
                dragOverIndex === index && dragIndex !== null && dragIndex !== index && (
                  dragOverIndex > dragIndex
                    ? 'border-b-2 border-b-primary pb-[10px]'
                    : 'border-t-2 border-t-primary pt-[10px]'
                )
              )}
              draggable={showDragHandle && !!onReorder}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              {showDragHandle && onReorder && (
                <div className="flex-shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                  <GripVertical className="w-4 h-4" />
                </div>
              )}

              <div className="flex-shrink-0 w-10 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate" title={item.name}>
                  {item.name}
                </p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <File className="w-3 h-3" />
                    {formatFileSize(item.size)}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {item.pages} 页
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className={cn(
                  'flex-shrink-0 p-2 rounded-lg',
                  'text-muted-foreground hover:text-destructive',
                  'hover:bg-destructive/10',
                  'transition-all duration-200',
                  'opacity-0 group-hover:opacity-100 focus:opacity-100'
                )}
                aria-label={`删除 ${item.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
