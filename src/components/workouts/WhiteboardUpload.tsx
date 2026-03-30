'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExtractedWorkout {
  name: string;
  type: 'swim' | 'run' | 'walk' | 'bike' | 'strength';
  description: string;
  date?: string;
  duration?: number;
}

interface WhiteboardUploadProps {
  onWorkoutsExtracted: (workouts: ExtractedWorkout[]) => void;
}

export function WhiteboardUpload({ onWorkoutsExtracted }: WhiteboardUploadProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setPreview(reader.result as string); };
    reader.readAsDataURL(file);
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch('/api/vision/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64 }),
      });
      if (!response.ok) throw new Error('Failed to analyze image');
      const data = await response.json();
      if (data.workouts && data.workouts.length > 0) {
        onWorkoutsExtracted(data.workouts);
        toast.success(`Extracted ${data.workouts.length} workout(s) from whiteboard`);
      } else {
        toast.error(data.notes || 'Could not extract workout information from the image');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Upload Whiteboard Image</CardTitle><CardDescription>Take a photo of your workout planning whiteboard and we'll extract the workout details</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {preview && <div className="relative aspect-video w-full overflow-hidden rounded-lg border"><Image src={preview} alt="Whiteboard preview" className="h-full w-full object-contain" fill unoptimized /></div>}
        <div className="flex items-center justify-center w-full">
          <label htmlFor="whiteboard-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {loading ? (<><Loader2 className="h-8 w-8 mb-2 animate-spin" /><p className="text-sm text-muted-foreground">Analyzing image...</p></>) : (<><Upload className="h-8 w-8 mb-2" /><p className="text-sm text-muted-foreground">Click to upload or drag and drop</p></>)}
            </div>
            <input id="whiteboard-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={loading} />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
