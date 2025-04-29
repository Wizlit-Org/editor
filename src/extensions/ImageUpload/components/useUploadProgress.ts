import { useState, useEffect, useRef } from 'react';
import { UploadListItem } from './UploadListDialog';

export interface ProgressRanges {
  ready: { max: readonly [number, number] };
  compress: { max: readonly [number, number]; step: readonly [number, number] };
  upload: { max: readonly [number, number]; step: readonly [number, number] };
  validating: { max: readonly [number, number]; step: readonly [number, number] };
  intervalMs: readonly [number, number];
}

function randIn([min, max]: readonly [number, number]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function useUploadProgress(
  items: UploadListItem[],
  ranges: ProgressRanges
): {
  progressMap: Record<string, number>;
  avgPercent: number;
  failedCount: number;
  hasFailed: boolean;
} {
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const intervals = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Generic runner for phases that just ramp from a floor up to a max
  function runPhase(
    id: string,
    floor: number,
    phase: { max: readonly [number, number]; step: readonly [number, number] }
  ) {
    // ensure we start at least at `floor`
    setProgressMap(m => ({ ...m, [id]: Math.max(m[id] ?? 0, floor) }));
    intervals.current[id] = setInterval(() => {
      setProgressMap(m => {
        const curr = m[id] ?? 0;
        const next = Math.min(randIn(phase.max), curr + randIn(phase.step));
        if (next >= phase.max[1]) {
          clearInterval(intervals.current[id]);
          delete intervals.current[id];
        }
        return { ...m, [id]: next };
      });
    }, randIn(ranges.intervalMs));
  }
  
  // Initialize & cleanup on items change
  useEffect(() => {
    setProgressMap(old => {
      const next: Record<string, number> = {};
      items.forEach(i => { next[i.id] = old[i.id] ?? 0; });
      return next;
    });
    Object.keys(intervals.current).forEach(id => {
      if (!items.some(i => i.id === id)) {
        clearInterval(intervals.current[id]);
        delete intervals.current[id];
      }
    });
  }, [items]);

  // Drive each item through its current status
  useEffect(() => {
    items.forEach(item => {
      const { id, status } = item;
      // clear any existing ticker
      if (intervals.current[id]) {
        clearInterval(intervals.current[id]);
        delete intervals.current[id];
      }

      switch (status) {
        case 'compressing':
          const start = randIn(ranges.ready.max);
          setProgressMap(m => ({ ...m, [id]: start }));
          runPhase(id, start, ranges.compress);
          break;
        case 'uploading':
          runPhase(id, ranges.compress.max[1], ranges.upload);
          break;
        case 'validating':
          runPhase(id, ranges.upload.max[1], ranges.validating);
          break;
        case 'success':
          setProgressMap(m => ({ ...m, [id]: 100 }));
          break;
        // failed → no change
      }
    });

    return () => {
      Object.values(intervals.current).forEach(clearInterval);
    };
  }, [items, ranges]);

  // Aggregates
  const total = items.length;
  const sum = items.reduce((acc, i) => acc + (progressMap[i.id] ?? 0), 0);
  const avgPercent = total > 0 ? Math.round(sum / total) : 0;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const hasFailed = failedCount > 0;

  return { progressMap, avgPercent, failedCount, hasFailed };
}