'use client';

import { useState, useMemo } from 'react';
import { AnalysisResult, ValidatedWorkout } from '@/lib/import/types';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MappingOverride } from './MappingOverride';

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '📋',
};

interface ImportPreviewProps {
  result: AnalysisResult;
  userId: string;
  userName: string;
  onComplete: (count: number) => void;
  onBack: () => void;
}

export function ImportPreview({ result: initialResult, userId, userName, onComplete, onBack }: ImportPreviewProps) {
  const [result, setResult] = useState(initialResult);
  const [importing, setImporting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [showMapping, setShowMapping] = useState(result.mapping.confidence < 0.6);
  const [excludedIndexes, setExcludedIndexes] = useState<Set<number>>(() => {
    const excluded = new Set<number>();
    result.workouts.forEach(w => {
      if (w.status === 'error' || w.isDuplicate) excluded.add(w.rowIndex);
    });
    return excluded;
  });

  // Re-compute exclusions when result changes from remap
  const handleResultUpdate = (newResult: AnalysisResult) => {
    setResult(newResult);
    const excluded = new Set<number>();
    newResult.workouts.forEach(w => {
      if (w.status === 'error' || w.isDuplicate) excluded.add(w.rowIndex);
    });
    setExcludedIndexes(excluded);
    setShowMapping(false); // collapse mapping after successful remap
  };

  const importable = useMemo(() =>
    result.workouts.filter(w => w.status !== 'error' && !excludedIndexes.has(w.rowIndex)),
    [result.workouts, excludedIndexes]
  );

  const errorWorkouts = result.workouts.filter(w => w.status === 'error');

  const toggleExclude = (idx: number) => {
    setExcludedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleImport = async () => {
    if (importable.length === 0) return;
    setImporting(true);

    try {
      const res = await fetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: result.sessionId,
          selectedIndexes: importable.map(w => w.rowIndex),
          userId,
          userName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Imported ${data.imported} workouts!`);
      onComplete(data.imported);
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // Summary by type
  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    importable.forEach(w => { counts[w.type] = (counts[w.type] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [importable]);

  const needsMappingReview = result.mapping.confidence < 0.85;

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          {importable.length > 0 ? `We found ${importable.length} workouts!` : 'No importable workouts'}
        </h2>
        <p className="text-muted-foreground">Review below, then confirm import.</p>
      </div>

      {/* Type summary chips */}
      {byType.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {byType.map(([type, count]) => (
            <span key={type} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
              {TYPE_EMOJI[type] || '📋'} {count} {type}{count > 1 ? 's' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Mapping override — forced open if low, toggle if medium */}
      {needsMappingReview && (
        <div>
          {result.mapping.confidence >= 0.6 && (
            <button
              onClick={() => setShowMapping(!showMapping)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2 hover:bg-yellow-500/10 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Review column mapping ({Math.round(result.mapping.confidence * 100)}% confidence)
              </span>
              {showMapping ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          {showMapping && (
            <MappingOverride
              result={result}
              userId={userId}
              onUpdated={handleResultUpdate}
            />
          )}
        </div>
      )}

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">{result.summary.valid} valid</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">{result.summary.warnings} warnings</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium">{result.summary.errors} errors</span>
        </div>
      </div>

      {/* Workout list */}
      <div className="rounded-2xl border divide-y max-h-[300px] overflow-y-auto">
        {result.workouts
          .filter(w => w.status !== 'error')
          .slice(0, 50)
          .map((w) => {
            const excluded = excludedIndexes.has(w.rowIndex);
            return (
              <div
                key={w.rowIndex}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  excluded ? 'opacity-40' : 'hover:bg-muted/50'
                )}
              >
                <button
                  onClick={() => w.status !== 'error' && toggleExclude(w.rowIndex)}
                  className={cn(
                    'h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                    excluded ? 'border-muted bg-muted' : 'border-red-500 bg-red-500'
                  )}
                >
                  {!excluded && <CheckCircle2 className="h-3 w-3 text-white" />}
                </button>
                <span className="text-base">{TYPE_EMOJI[w.type] || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{w.name}</p>
                  {w.warnings.length > 0 && (
                    <p className="text-[10px] text-yellow-600 dark:text-yellow-400 truncate">{w.warnings[0]}</p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(w.date), 'MMM d, yyyy')}
                  </p>
                  {w.duration && <p className="text-[10px] text-muted-foreground">{Math.round(w.duration)}min</p>}
                </div>
              </div>
            );
          })}
        {result.workouts.filter(w => w.status !== 'error').length > 50 && (
          <div className="px-4 py-2 text-xs text-muted-foreground text-center">
            + {result.workouts.filter(w => w.status !== 'error').length - 50} more
          </div>
        )}
      </div>

      {/* Errors expandable */}
      {errorWorkouts.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400"
          >
            <span>{errorWorkouts.length} row{errorWorkouts.length > 1 ? 's' : ''} couldn&apos;t be parsed</span>
            {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showErrors && (
            <div className="border-t border-red-500/20 px-4 py-2 space-y-1">
              {errorWorkouts.slice(0, 10).map((w) => (
                <p key={w.rowIndex} className="text-xs text-muted-foreground">
                  Row {w.rowIndex + 1}: {w.errors.join(', ')}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={importing}
          className="px-6 py-4 rounded-2xl border-2 border-border text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          ← Back
        </button>
        <button
          onClick={handleImport}
          disabled={importing || importable.length === 0}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300',
            importable.length > 0
              ? 'bg-red-600 text-white shadow-xl shadow-red-600/25 hover:shadow-2xl'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {importing
            ? <><Loader2 className="h-5 w-5 animate-spin" />Importing...</>
            : `Import ${importable.length} Workout${importable.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
