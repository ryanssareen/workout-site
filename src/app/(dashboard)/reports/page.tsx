'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BarChart3, FileText, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { StructuredReport } from '@/types/reports';
import { ReportContainer } from '@/components/reports/ReportContainer';

const EXAMPLE_REQUESTS = [
  "Performance report for last 30 days",
  "Compare my athletes' completion rates this month",
  "Show my workout breakdown by type for the last 90 days",
  "Summary of missed workouts this week",
  "Overall progress report for this quarter",
  "Detailed analysis of my training consistency",
];

export default function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [insufficientMessage, setInsufficientMessage] = useState<string>('');
  const [showReport, setShowReport] = useState(false);

  const isCoach = user?.role === 'coach';

  const handleGenerateReport = async (request?: string) => {
    const queryText = request || input.trim();
    if (!queryText || !user) {
      toast.error('Please describe what report you want');
      return;
    }

    setGenerating(true);
    setInput('');

    try {
      const response = await fetch('/api/ai/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: queryText,
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }

      if (data.isInsufficient) {
        setReport(null);
        setInsufficientMessage(data.insufficientMessage || 'Not enough data available.');
        setShowReport(true);
        toast.info('Insufficient data for detailed report');
      } else {
        setReport(data.report);
        setInsufficientMessage('');
        setShowReport(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerateReport();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          AI Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Ask for any report and get beautifully formatted insights with charts and stats
        </p>
      </div>

      {/* Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>
            {isCoach
              ? "Ask for any report about your athletes (e.g., 'Performance report for last 30 days')"
              : "Ask for any report about your workouts (e.g., 'Show my bench press progress this month')"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCoach
              ? "e.g., Compare my athletes' completion rates this month"
              : "e.g., Show my workout progress this week with charts"}
            className="min-h-[100px] resize-none"
            disabled={generating}
          />

          <Button
            onClick={() => handleGenerateReport()}
            disabled={generating || !input.trim()}
            className="w-full"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Press Enter to generate, Shift+Enter for new line
          </p>
        </CardContent>
      </Card>

      {/* Example Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Example Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLE_REQUESTS.map((example, i) => (
              <button
                key={i}
                onClick={() => handleGenerateReport(example)}
                disabled={generating}
                className="text-left px-3 py-2 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors text-sm disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Report Modal */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] overflow-y-auto p-4">
          {insufficientMessage ? (
            // Insufficient Data Display
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20 mb-4">
                <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Insufficient Information</h2>
              <p className="max-w-md text-muted-foreground mb-4">
                {insufficientMessage}
              </p>
              <p className="text-sm text-muted-foreground">
                Try requesting a different report or add more workout data.
              </p>
            </div>
          ) : report ? (
            // Structured Report Display
            <ReportContainer report={report} userName={user.displayName} />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          [data-report-container],
          [data-report-container] * {
            visibility: visible !important;
          }

          [data-report-container] {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 1rem !important;
          }

          [data-radix-dialog-overlay],
          [data-radix-dialog-close-button] {
            display: none !important;
          }

          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }

          @page {
            margin: 0.5in;
            size: auto;
          }
        }
      `}</style>
    </div>
  );
}
