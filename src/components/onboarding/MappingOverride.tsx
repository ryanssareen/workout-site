'use client';

import { useState } from 'react';
import { ColumnMapping, AnalysisResult } from '@/lib/import/types';
import { Loader2, AlertTriangle, Settings2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MappingOverrideProps {
  result: AnalysisResult;
  userId: string;
  onUpdated: (result: AnalysisResult) => void;
}

// Fields the user can remap
const MAPPING_FIELDS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'name', label: 'Workout Name', required: false },
  { key: 'type', label: 'Type', required: false },
  { key: 'duration', label: 'Duration', required: false },
  { key: 'distance', label: 'Distance', required: false },
  { key: 'description', label: 'Notes / Description', required: false },
  { key: 'heartRate', label: 'Heart Rate', required: false },
  { key: 'calories', label: 'Calories', required: false },
] as const;

type MappingFieldKey = typeof MAPPING_FIELDS[number]['key'];

function FieldSelect({
  label, value, headers, onChange, required,
}: {
  label: string; value: string | null; headers: string[];
  onChange: (v: string | null) => void; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={cn(
            'w-full appearance-none px-3 py-2.5 pr-8 rounded-xl border-2 text-sm font-medium',
            'bg-background transition-colors cursor-pointer',
            value
              ? 'border-red-500/40 text-foreground'
              : 'border-border text-muted-foreground'
          )}
        >
          <option value="">— Not mapped —</option>
          {headers.map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

export function MappingOverride({ result, userId, onUpdated }: MappingOverrideProps) {
  const [overrides, setOverrides] = useState<Partial<ColumnMapping>>({});
  const [distanceUnit, setDistanceUnit] = useState(result.mapping.distanceUnit);
  const [remapping, setRemapping] = useState(false);

  const currentMapping = { ...result.mapping, ...overrides };

  const setField = (key: MappingFieldKey, value: string | null) => {
    setOverrides(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = async () => {
    // Validate date is mapped
    const finalMapping = { ...overrides };
    if (distanceUnit !== result.mapping.distanceUnit) {
      (finalMapping as any).distanceUnit = distanceUnit;
    }

    if (!currentMapping.date && !finalMapping.date) {
      toast.error('Date column is required');
      return;
    }

    setRemapping(true);
    try {
      const res = await fetch('/api/import/remap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: result.sessionId,
          userId,
          mappingOverrides: finalMapping,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Re-mapped! ${data.summary.valid} valid workouts found.`);
      onUpdated(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to re-map');
    } finally {
      setRemapping(false);
    }
  };

  const confidencePct = Math.round(result.mapping.confidence * 100);
  const isLow = result.mapping.confidence < 0.6;
  const isMedium = result.mapping.confidence >= 0.6 && result.mapping.confidence < 0.85;

  return (
    <div className="space-y-4">
      {/* Confidence banner */}
      <div className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl border text-sm',
        isLow
          ? 'bg-red-500/10 border-red-500/20'
          : 'bg-yellow-500/10 border-yellow-500/20'
      )}>
        <AlertTriangle className={cn(
          'h-4 w-4 mt-0.5 shrink-0',
          isLow ? 'text-red-500' : 'text-yellow-500'
        )} />
        <div>
          <p className={cn('font-medium', isLow ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400')}>
            {isLow ? 'Low' : 'Moderate'} confidence ({confidencePct}%)
          </p>
          <p className="text-muted-foreground mt-0.5">
            {isLow
              ? 'Please verify the column mapping below before importing.'
              : 'AI detected your columns — review and adjust if needed.'}
          </p>
          {result.mapping.assumptions.length > 0 && (
            <p className="text-muted-foreground mt-1 text-xs">
              Assumptions: {result.mapping.assumptions.join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Column mapping grid */}
      <div className="rounded-2xl border p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Settings2 className="h-4 w-4 text-red-500" />
          Column Mapping
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MAPPING_FIELDS.map(({ key, label, required }) => (
            <FieldSelect
              key={key}
              label={label}
              required={required}
              value={(overrides[key as keyof ColumnMapping] as string | undefined) ?? (currentMapping[key as keyof ColumnMapping] as string | null)}
              headers={result.headers}
              onChange={(v) => setField(key, v)}
            />
          ))}
        </div>

        {/* Distance unit */}
        {currentMapping.distance && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Distance Unit</label>
              <div className="flex gap-2">
                {(['km', 'miles', 'meters'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setDistanceUnit(u)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-colors',
                      distanceUnit === u
                        ? 'border-red-500 bg-red-500/10 text-foreground'
                        : 'border-border text-muted-foreground hover:border-red-500/40'
                    )}
                  >{u}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Detected format */}
        {result.mapping.detectedFormat !== 'unknown' && (
          <p className="text-xs text-muted-foreground">
            Detected format: <span className="font-medium text-foreground">{result.mapping.detectedFormat.replace(/_/g, ' ')}</span>
          </p>
        )}
      </div>

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={remapping}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm shadow-lg shadow-red-600/25 hover:shadow-xl transition-all disabled:opacity-60"
      >
        {remapping
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Re-analyzing...</>
          : 'Apply & Re-analyze'
        }
      </button>
    </div>
  );
}
