import { cn } from '@/lib/utils';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadStatus } from '../ImageUploadQueue';
import { useUploadProgress } from './useUploadProgress';
import { CircleXIcon, RefreshCwIcon } from 'lucide-react';

export interface UploadListItem {
  id: string;
  fileName: string;
  status: UploadStatus;
  originalSize: number;
  compressedSize?: number;
}

export interface UploadListDialogProps {
  items: UploadListItem[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  className?: string;
  pillClassName?: string;
  dialogClassName?: string;
  onLoadingChange?: (hasUploading: boolean) => void;
}

const statusLabels: Record<UploadStatus, string> = {
  compressing: 'Compressing',
  uploading: 'Uploading',
  success: 'Uploaded',
  failed: 'Failed',
  validating: 'Validating',
};

export const UploadListDialog: React.FC<UploadListDialogProps> = (
  {
    items = [],
    onRetry = () => {},
    onRemove = () => {},
    className = '',
    pillClassName = '',
    dialogClassName = '',
    onLoadingChange = () => {},
  }: UploadListDialogProps
) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [minimized, setMinimized] = useState(false);

  const ranges = useMemo(() => ({
    ready:      { max: [1, 8] as const },
    compress:   { max: [15, 30] as const, step: [3, 8] as const },
    upload:     { max: [70, 80] as const, step: [2, 10] as const },
    validating: { max: [94, 98] as const, step: [2, 5] as const },
    intervalMs: [200, 1000] as const,
  }), []);

  const { progressMap, avgPercent, failedCount, hasFailed, hasUploading } = useUploadProgress(items, ranges);

  // if hasUploading, alert when user goes to another page
  useEffect(() => {
    onLoadingChange?.(hasUploading);
  }, [hasUploading]);
  
  const hide = items.length === 0;

  const handleRetryAll = () => {
    items.forEach(item => {
      if (item.status === 'failed') {
        onRetry(item.id);
      }
    });
  };

  // Outside click handler to minimize dialog
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setMinimized(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-expand when compressing starts
  useEffect(() => {
    if (items.some(i => i.status === 'compressing')) {
      setMinimized(false);
    }
  }, [items]);

  if (hide) return null;

  // Aggregates
  const label = hasFailed ? `${failedCount} Failed` : `${avgPercent}%`;
  const bgColor = hasFailed ? '#FF746C' : '#4CAF50';

  return (
    <>
      {/* Minimized pill */}
      <AnimatePresence>
        {minimized && (
          <motion.button
            key="pill"
            className={`flex items-center rounded-full shadow-lg z-50 overflow-hidden ${className} ${pillClassName}`}
            style={{ backgroundColor: bgColor }}
            onClick={() => setMinimized(false)}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="relative w-24 h-8 flex items-center justify-center text-white">
              <div
                className="absolute left-0 top-0 h-full"
                style={{
                  width: `${avgPercent}%`,
                  backgroundColor: 'rgba(255,255,255,0.3)',
                  transition: 'width 0.5s',
                }}
              />
              <span className="z-10 text-sm font-medium">{label}</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Full dialog */}
      <AnimatePresence>
        {!minimized && (
          <motion.div
            className={`flex items-end justify-end pointer-events-none z-50 ${className} ${dialogClassName}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <motion.div
              ref={dialogRef}
              className="bg-white rounded-2xl shadow-xl w-96 p-6 pointer-events-auto border border-gray-200"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  {items.filter(i => i.status !== 'success').length > 0
                    ? `${items.filter(i => i.status !== 'success').length} Uploading`
                    : 'Files Uploaded'}
                </h2>
                {hasFailed && (
                  <button
                    onClick={handleRetryAll}
                    disabled={!hasFailed}
                    className={cn(
                      hasFailed
                        ? 'text-blue-600 hover:underline'
                        : 'text-gray-400 cursor-not-allowed',
                      'text-sm focus:outline-none'
                    )}
                  >
                    Retry All
                  </button>
                )}
              </div>
              <ul className="space-y-4 max-h-72 overflow-y-auto">
                {items.length === 0 ? (
                  <li className="text-center text-gray-500">
                    No uploads in progress.
                  </li>
                ) : (
                  items.map(item => (
                    <li key={item.id} className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm">{item.fileName}</span>
                        <div className="flex items-center gap-1">
                          {item.status === 'failed' && (
                            <button
                              onClick={() => onRetry(item.id)}
                              className="focus:outline-none ml-3 text-sm"
                            >
                              <RefreshCwIcon className="w-4 h-4" />
                            </button>
                          )}
                          {(item.status === 'compressing' || item.status === 'failed') && (
                            <button
                              onClick={() => onRemove(item.id)}
                              className="focus:outline-none ml-2 text-sm"
                            >
                              <CircleXIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            item.status === 'failed'
                              ? 'bg-[#FF746C]'
                              : item.status === 'success'
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                          } transition-all duration-500`}
                          style={{ width: `${progressMap[item.id] ?? 0}%` }}
                        />
                      </div>
                      <div className="flex items-center text-sm text-gray-600 justify-between">
                        <span className="text-xs">
                          {statusLabels[item.status]}
                        </span>
                        <span className="text-xs">
                          {progressMap[item.id] ?? 0}%
                        </span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
