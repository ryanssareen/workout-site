'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadStepProps {
  onAnalysisComplete: (result: any) => void;
  userId: string;
}

const ACCEPTED = '.csv,.tsv,.xlsx,.xls';
const MAX_SIZE = 5 * 1024 * 1024;

export function FileUploadStep({ onAnalysisComplete, userId }: FileUploadStepProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File): string | null => {
    const ext = f.name.toLowerCase().split('.').pop();
    if (!['csv', 'tsv', 'xlsx', 'xls'].includes(ext || '')) {
      return 'Please upload a CSV or XLSX file.';
    }
    if (f.size > MAX_SIZE) return 'File too large. Maximum 5MB.';
    return null;
  };

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    const err = validateFile(f);
    if (err) { setError(err); return; }

    setFile(f);
    setUploading(true);
    setProgress('Parsing file...');

    try {
      const formData = new FormData();
      formData.append('file', f);
      formData.append('userId', userId);

      setProgress('Analyzing with AI...');

      const res = await fetch('/api/import/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to analyze file');
        setUploading(false);
        return;
      }

      setProgress('Done!');
      onAnalysisComplete(data);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [userId, onAnalysisComplete]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Import Workout History</h2>
        <p className="text-muted-foreground">Have a spreadsheet of past workouts? Drop it here.</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200',
          dragging ? 'border-red-500 bg-red-500/5 scale-[1.02]' : 'border-border hover:border-red-500/40 hover:bg-red-500/[0.02]',
          uploading && 'pointer-events-none opacity-70'
        )}
      >
        <input ref={inputRef} type="file" accept={ACCEPTED} onChange={onSelect} className="hidden" />

        {uploading ? (
          <>
            <Loader2 className="h-10 w-10 text-red-500 animate-spin" />
            <div className="text-center">
              <p className="font-medium">{progress}</p>
              <p className="text-sm text-muted-foreground mt-1">This may take a few seconds</p>
            </div>
          </>
        ) : file ? (
          <>
            <FileSpreadsheet className="h-10 w-10 text-red-500" />
            <div className="text-center">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Drag & drop XLSX or CSV</p>
              <p className="text-sm text-muted-foreground">or click to browse · Max 5MB · Up to 500 workouts</p>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
          <button onClick={() => { setError(null); setFile(null); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
