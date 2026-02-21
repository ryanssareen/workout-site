'use client';

import { useMemo, useRef, useState } from 'react';
import { StructuredReport } from '@/types/reports';
import { ReportRenderer } from './ReportRenderer';
import { Button } from '@/components/ui/button';
import { Dumbbell, Image as ImageIcon, Printer, Copy, Loader2, Mail, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

const getTimeGreeting = (date: Date) => {
  const hour = date.getHours();
  if (hour < 12) return 'good morning';
  if (hour < 18) return 'good afternoon';
  if (hour < 22) return 'good evening';
  return 'good night';
};

const getTimeZoneAbbreviation = (date: Date) =>
  new Intl.DateTimeFormat([], { timeZoneName: 'short' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value || '';

interface ReportContainerProps {
  report: StructuredReport;
  userName: string;
  userEmail?: string;
}

export function ReportContainer({ report, userName, userEmail }: ReportContainerProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [emailing, setEmailing] = useState(false);

  // Single timestamp to keep time-aware labels consistent across actions
  const generatedAt = useMemo(() => new Date(), []);
  const firstName = useMemo(() => userName.split(' ')[0] || userName, [userName]);
  const greeting = useMemo(() => getTimeGreeting(generatedAt), [generatedAt]);
  const timeZoneAbbr = useMemo(() => getTimeZoneAbbreviation(generatedAt), [generatedAt]);
  const timeLabel = useMemo(
    () => `${format(generatedAt, "MMMM d, yyyy 'at' h:mm a")}${timeZoneAbbr ? ` ${timeZoneAbbr}` : ''}`,
    [generatedAt, timeZoneAbbr],
  );

  const getFilenameBase = () =>
    `DailyAthlete-${report.title.replace(/[^a-z0-9]/gi, '-')}-${format(generatedAt, 'yyyy-MM-dd')}`;

  const generatePng = async () => {
    if (!reportRef.current) throw new Error('Report not ready');
    const isDarkMode = document.documentElement.classList.contains('dark');

    return toPng(reportRef.current, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: isDarkMode ? '#0a0a0f' : '#ffffff',
    });
  };

  const generatePdfDataUrl = async () => {
    const pngDataUrl = await generatePng();
    const img = new Image();
    img.src = pngDataUrl;
    await img.decode();

    const pdf = new jsPDF({
      orientation: img.width > img.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [img.width, img.height],
      compress: true,
    });

    pdf.addImage(pngDataUrl, 'PNG', 0, 0, img.width, img.height);
    return pdf.output('dataurlstring');
  };

  const handleExportImage = async () => {
    setExporting(true);
    try {
      const dataUrl = await generatePng();

      const link = document.createElement('a');
      link.download = `${getFilenameBase()}.png`;
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

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const pdfDataUrl = await generatePdfDataUrl();
      const link = document.createElement('a');
      link.href = pdfDataUrl;
      link.download = `${getFilenameBase()}.pdf`;
      link.click();
      toast.success('Report saved as PDF');
    } catch (error) {
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleEmailPdf = async () => {
    if (!userEmail) {
      toast.error('No email on file to send to.');
      return;
    }
    setEmailing(true);
    try {
      const pdfDataUrl = await generatePdfDataUrl();
      const base64 = pdfDataUrl.split(',')[1];

      const res = await fetch('/api/reports/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: base64,
          filename: `${getFilenameBase()}.pdf`,
          toEmail: userEmail,
          subject: `${report.title} - The Daily Athlete Report`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to email report');

      toast.success('Report emailed!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to email report');
    } finally {
      setEmailing(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const textContent = `
${report.title}
${report.subtitle || ''}
${report.dateRange || ''}
${'-'.repeat(50)}

${report.sections
  .map((section) => {
    if (section.type === 'text') return section.content;
    if (section.type === 'highlight') return `⭐ ${section.content}`;
    if (section.type === 'pr') return `🏆 ${section.exercise}: ${section.value}`;
    return '';
  })
  .filter(Boolean)
  .join('\n\n')}

${report.summary || ''}
${report.footer || ''}

Generated by The Daily Athlete - ${timeLabel}
    `.trim();

    try {
      await navigator.clipboard.writeText(textContent);
      toast.success('Report copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div>
      {/* Export Controls - Hide on print */}
      <div className="flex items-center flex-wrap justify-end gap-2 mb-6 print:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyToClipboard}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportImage}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4 mr-2" />
          )}
          Save PNG
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPdf}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4 mr-2" />
          )}
          Save PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white border-0"
          onClick={handleEmailPdf}
          disabled={emailing || exporting}
        >
          {emailing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
          Email PDF
        </Button>
      </div>

      {/* Report Content */}
      <div
        ref={reportRef}
        data-report-container
        className="bg-gradient-to-br from-blue-50 via-white to-white dark:from-[#0a0a0f] dark:via-[#0d0d14] dark:to-[#0b0b10] text-slate-900 dark:text-slate-100 p-8 rounded-2xl border border-blue-100/60 dark:border-blue-900/40 shadow-[0_20px_80px_-50px_rgba(37,99,235,0.8)] print:shadow-none print:border-0"
      >
        {/* Header with The Daily Athlete Branding */}
        <div className="border-b-2 border-primary pb-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Dumbbell className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground drop-shadow">
                  The Daily Athlete
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Report
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-slate-500 dark:text-slate-400">
              <p className="font-medium text-slate-700 dark:text-slate-300">Hi {firstName}</p>
              <p className="capitalize">{greeting}</p>
              <p>{timeLabel}</p>
            </div>
          </div>
        </div>

        {/* Report Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {report.title}
          </h2>
          {report.subtitle && (
            <p className="text-lg text-slate-600 dark:text-slate-400">
              {report.subtitle}
            </p>
          )}
          {report.dateRange && (
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              {report.dateRange}
            </p>
          )}
        </div>

        {/* Report Sections */}
        <ReportRenderer sections={report.sections} />

        {/* Summary */}
        {report.summary && (
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Summary
            </h3>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {report.summary}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-600">
            {report.footer || `Generated by The Daily Athlete | ${timeLabel}`}
          </p>
        </div>
      </div>
    </div>
  );
}
