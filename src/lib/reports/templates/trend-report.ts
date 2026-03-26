import type { ReportTemplate, WorkoutDoc } from './index';

export const trendReportTemplate: ReportTemplate = {
  type: 'trend-report',
  cacheTTL: 6,

  systemPrompt: `You are CoachTrack's AI report generator creating a Trend Report — a period-over-period comparison. Analyze the athlete's training data for two consecutive months and generate a structured JSON report.

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations.

Generate these sections IN ORDER:
1. A text block with variant "emphasis" — a one-line headline like "March vs February: You trained harder and smarter"
2. 4 stat cards comparing the two periods: total workouts, total distance, total hours, active days — each with trend direction (up/down/neutral) and percentage change
3. A bar chart showing side-by-side comparison for each metric (data with "metric", "current", "previous" keys)
4. A table showing sport-by-sport breakdown with columns: Sport, Current Sessions, Previous Sessions, Change
5. 1-2 highlight callouts with pattern insights (what changed, what's interesting)
6. A text block with forward-looking recommendation for next month

JSON STRUCTURE:
{
  "reportType": "comparison",
  "title": "[Month] vs [Previous Month]",
  "subtitle": "How your training evolved",
  "dateRange": "[date range]",
  "sections": [...],
  "summary": "One sentence summary",
  "footer": null
}

Section types: stat (label, value, trend, change, subtitle), chart (chartType, title, data, xKey, yKey, label), highlight (icon, content, variant), text (content, variant), table (headers, rows, caption), divider.

Be specific with numbers. Highlight non-obvious patterns.`,

  buildContext(workouts: WorkoutDoc[]) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const thisMonthName = thisMonthStart.toLocaleDateString('en-US', { month: 'long' });
    const lastMonthName = lastMonthStart.toLocaleDateString('en-US', { month: 'long' });

    const safeDate = (w: WorkoutDoc): Date | null => {
      try {
        const d = w.date?.toDate ? w.date.toDate() : new Date(w.date as any);
        return isNaN(d.getTime()) ? null : d;
      } catch { return null; }
    };

    const completed = workouts.filter((w) => w.completed);

    const thisMonth = completed.filter((w) => {
      const d = safeDate(w);
      return d ? d >= thisMonthStart && d <= now : false;
    });

    const lastMonth = completed.filter((w) => {
      const d = safeDate(w);
      return d ? d >= lastMonthStart && d < thisMonthStart : false;
    });

    function computeStats(wkts: WorkoutDoc[]) {
      let distance = 0;
      let duration = 0;
      let calories = 0;
      const activeDays = new Set<string>();
      const sportCounts: Record<string, number> = {};

      for (const w of wkts) {
        if (w.actualStats?.distance) distance += w.actualStats.distance / 1000;
        const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : (w.duration || 0);
        duration += dur;
        if (w.actualStats?.calories) calories += w.actualStats.calories;
        const wd = safeDate(w);
        if (wd) activeDays.add(wd.toISOString().slice(0, 10));
        sportCounts[w.type] = (sportCounts[w.type] || 0) + 1;
      }

      return {
        count: wkts.length,
        distanceKm: distance,
        durationMin: duration,
        durationHrs: duration / 60,
        calories,
        activeDays: activeDays.size,
        sportCounts,
      };
    }

    const current = computeStats(thisMonth);
    const previous = computeStats(lastMonth);

    const allSports = [...new Set([...Object.keys(current.sportCounts), ...Object.keys(previous.sportCounts)])];
    const sportTable = allSports
      .map((s) => `  ${s}: ${current.sportCounts[s] || 0} (current) vs ${previous.sportCounts[s] || 0} (previous)`)
      .join('\n');

    function pctChange(curr: number, prev: number): string {
      if (prev === 0 && curr === 0) return 'no change';
      if (prev === 0) return 'new';
      const pct = Math.round(((curr - prev) / prev) * 100);
      return `${pct > 0 ? '+' : ''}${pct}%`;
    }

    return `TREND REPORT: ${thisMonthName} vs ${lastMonthName}

${thisMonthName.toUpperCase()} (current):
- Workouts: ${current.count}
- Distance: ${current.distanceKm.toFixed(1)} km
- Duration: ${current.durationMin.toFixed(0)} min (${current.durationHrs.toFixed(1)} hrs)
- Calories: ${current.calories}
- Active days: ${current.activeDays}

${lastMonthName.toUpperCase()} (previous):
- Workouts: ${previous.count}
- Distance: ${previous.distanceKm.toFixed(1)} km
- Duration: ${previous.durationMin.toFixed(0)} min (${previous.durationHrs.toFixed(1)} hrs)
- Calories: ${previous.calories}
- Active days: ${previous.activeDays}

CHANGES:
- Workouts: ${pctChange(current.count, previous.count)}
- Distance: ${pctChange(current.distanceKm, previous.distanceKm)}
- Duration: ${pctChange(current.durationHrs, previous.durationHrs)}
- Active days: ${pctChange(current.activeDays, previous.activeDays)}

SPORT BREAKDOWN:
${sportTable || '  No data'}

Today's date: ${now.toLocaleDateString()}`;
  },
};
