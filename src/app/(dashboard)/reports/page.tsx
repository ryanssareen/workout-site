'use client';

import { useState, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart3, FileText, Image, Printer, Loader2, Dumbbell, AlertCircle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

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
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [isInsufficient, setIsInsufficient] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
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

      setReportContent(data.report);
      setIsInsufficient(data.isInsufficient || false);
      setShowReport(true);

      if (data.isInsufficient) {
        toast.info('Insufficient data for detailed report');
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

  const handleExportImage = async () => {
    if (!reportRef.current) return;

    setExporting(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `CoachTrack-Report-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('Report saved as image');
    } catch (error) {
      toast.error('Failed to export image');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
          Describe what report you want, and AI will format it professionally
        </p>
      </div>

      {/* Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>
            {isCoach
              ? "Ask for any report about your athletes (e.g., 'Performance report for last 30 days')"
              : "Ask for any report about your workouts (e.g., 'My progress report for this month')"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCoach
              ? "e.g., Performance report for all athletes last 30 days"
              : "e.g., My workout summary for the last month"}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-0 print:hidden">
            <DialogTitle className="flex items-center justify-between">
              <span>CoachTrack Report</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportImage}
                  disabled={exporting || isInsufficient}
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Image className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Save Image</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  disabled={isInsufficient}
                >
                  <Printer className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Print</span>
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div ref={reportRef} className="bg-white text-gray-900 p-8">
            {/* Report Header with CoachTrack Branding */}
            <div className="border-b-2 border-primary pb-6 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                    <Dumbbell className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-primary">CoachTrack</h1>
                    <p className="text-sm text-gray-500">Performance Report</p>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>{user.displayName}</p>
                  <p>{format(new Date(), 'MMMM d, yyyy')}</p>
                </div>
              </div>
            </div>

            {/* Report Content */}
            {isInsufficient ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 mb-4">
                  <AlertCircle className="h-8 w-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Insufficient Information</h2>
                <div className="max-w-md text-gray-600">
                  <ReactMarkdown>{reportContent?.replace('INSUFFICIENT_DATA:', '') || 'Not enough data available to generate this report.'}</ReactMarkdown>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Try requesting a different report or add more workout data.
                </p>
              </div>
            ) : (
              <div className="prose prose-gray max-w-none">
                <ReactMarkdown
                  components={{
                    h2: ({ node, ...props }) => (
                      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="text-gray-700 leading-relaxed mb-4" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700" {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                      <strong className="font-bold text-gray-900" {...props} />
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto mb-4">
                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200" {...props} />
                      </div>
                    ),
                    th: ({ node, ...props }) => (
                      <th className="px-4 py-2 bg-gray-50 text-left text-sm font-semibold text-gray-900" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="px-4 py-2 text-sm text-gray-700 border-t border-gray-200" {...props} />
                    ),
                  }}
                >
                  {reportContent || ''}
                </ReactMarkdown>
              </div>
            )}

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
              <p>Generated by CoachTrack | {format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          [data-radix-dialog-content],
          [data-radix-dialog-content] * {
            visibility: visible;
          }
          [data-radix-dialog-content] {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
    </div>
  );
}
