import { memo } from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  label?: string;
  showPercentage?: boolean;
  height?: 'sm' | 'md' | 'lg';
}

function ProgressBar({
  progress,
  label,
  showPercentage = true,
  height = 'md',
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const heightMap = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className="w-full space-y-2">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {label && (
            <span className="font-medium text-foreground/80">{label}</span>
          )}
          {showPercentage && (
            <span className="font-semibold tabular-nums text-primary">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      <div
        className={`relative w-full overflow-hidden rounded-full border border-white/20 bg-white/40 backdrop-blur-md shadow-inner ${heightMap[height]}`}
      >
        {/* 玻璃拟态轨道高光 */}
        <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/30 to-transparent" />

        {/* 液态进度填充 */}
        <motion.div
          className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-primary via-primary/90 to-secondary"
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* 液态高光层 */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-transparent" />

          {/* 液态波纹动画 */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute -top-1/2 h-[200%] w-20 -skew-x-12 bg-white/30 blur-sm"
              animate={{
                x: ['-100%', '400%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>

          {/* 底部阴影增加立体感 */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-full bg-black/10" />
        </motion.div>
      </div>
    </div>
  );
}

export default memo(ProgressBar);
