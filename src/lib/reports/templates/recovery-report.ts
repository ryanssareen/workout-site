import type { ReportTemplate, WorkoutDoc } from './index';

export const recoveryReportTemplate: ReportTemplate = {
  type: 'recovery-report',
  cacheTTL: 6,

  systemPrompt: `You are CoachTrack's AI report generator creating a Recovery & Balance Report. Analyze the athlete's training load, rest patterns, and sport balance to assess recovery and overtraining risk.

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations.

Generate these sections IN ORDER:
1. 3 stat cards: workouts this week, workouts last 14 days, rest days in last 14 days
2. A bar chart showing daily workout count over the last 14 days (data with "date" and "count" keys)
3. A highlight callout for recovery status — use "success" variant if recovery is adequate, "warning" if there are concerns, "info" for neutral observations
4. A pie chart showing sport distribution (data with "name" and "value" keys, chartType "pie")
5. A text block analyzing training patterns: consecutive training days, hard/easy balance, volume trends
6. A highlight callout with one actionable recommendation
7. A text block with a forward-looking suggestion

JSON STRUCTURE:
{
  "reportType": "analysis",
  "title": "Recovery Check",
  "subtitle": "Your training load and recovery balance",
  "dateRange": "[date range]",
  "sections": [...],
  "summary": "One sentence summary",
  "footer": null
}

Section types: stat (label, value, trend, change, subtitle), chart (chartType, title, data, xKey, yKey, label), highlight (icon, content, variant), text (content, variant), divider.

Be honest about overtraining risks. Err on the side of recommending rest — recreational athletes undertrain recovery, not volume.`,

  buildContext(workouts: WorkoutDoc[]) {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    const completed = workouts.filter((w) => w.completed);
    const last14 = completed.filter((w) => w.date.toDate() >= fourteenDaysAgo);
    const last7 = completed.filter((w) => w.date.toDate() >= sevenDaysAgo);
    const last28 = completed.filter((w) => w.date.toDate() >= twentyEightDaysAgo);

    // Daily activity for last 14 days
    const dailyActivity: Record<string, { count: number; duration: number; types: string[] }> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyActivity[d.toISOString().slice(0, 10)] = { count: 0, duration: 0, types: [] };
    }

    for (const w of last14) {
      const dateStr = w.date.toDate().toISOString().slice(0, 10);
      if (dailyActivity[dateStr]) {
        dailyActivity[dateStr].count += 1;
        const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : (w.duration || 0);
        dailyActivity[dateStr].duration += dur;
        dailyActivity[dateStr].types.push(w.type);
      }
    }

    // Rest days
    const restDays = Object.values(dailyActivity).filter((d) => d.count === 0).length;

    // Consecutive training days
    let maxConsecutive = 0;
    let currentStreak = 0;
    const sortedDays = Object.entries(dailyActivity).sort(([a], [b]) => a.localeCompare(b));
    for (const [, data] of sortedDays) {
      if (data.count > 0) {
        currentStreak += 1;
        maxConsecutive = Math.max(maxConsecutive, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Sport distribution
    const sportCounts: Record<string, number> = {};
    for (const w of last14) {
      sportCounts[w.type] = (sportCounts[w.type] || 0) + 1;
    }

    // Tag/intensity distribution
    const tagCounts: Record<string, number> = {};
    for (const w of last14) {
      for (const tag of w.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    // Training load estimate (duration * rough intensity from tags)
    const intensityMap: Record<string, number> = {
      easy: 3, recovery: 2, moderate: 5, technique: 4,
      tempo: 7, intervals: 7, speed: 8, hard: 8,
      long: 6, endurance: 5, strength: 6, race: 9,
    };

    let totalLoad7d = 0;
    let totalLoad28d = 0;
    for (const w of last7) {
      const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : (w.duration || 0);
      const intensity = (w.tags || []).reduce((max, tag) => Math.max(max, intensityMap[tag] || 5), 5);
      totalLoad7d += dur * intensity / 10;
    }
    for (const w of last28) {
      const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : (w.duration || 0);
      const intensity = (w.tags || []).reduce((max, tag) => Math.max(max, intensityMap[tag] || 5), 5);
      totalLoad28d += dur * intensity / 10;
    }

    const weeklyAvgLoad28d = totalLoad28d / 4;
    const acwr = weeklyAvgLoad28d > 0 ? (totalLoad7d / weeklyAvgLoad28d).toFixed(2) : 'N/A';

    const dailySummary = Object.entries(dailyActivity)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => `  ${date}: ${d.count} workout${d.count !== 1 ? 's' : ''} (${d.duration.toFixed(0)} min) [${d.types.join(', ') || 'rest'}]`)
      .join('\n');

    return `RECOVERY & BALANCE REPORT

LAST 7 DAYS:
- Workouts: ${last7.length}
- Training load (estimated): ${totalLoad7d.toFixed(0)}

LAST 14 DAYS:
- Workouts: ${last14.length}
- Rest days: ${restDays} out of 14
- Max consecutive training days: ${maxConsecutive}

TRAINING LOAD RATIO (Acute:Chronic):
- 7-day load: ${totalLoad7d.toFixed(0)}
- 28-day weekly average: ${weeklyAvgLoad28d.toFixed(0)}
- ACWR: ${acwr} ${Number(acwr) > 1.5 ? '⚠️ HIGH RISK' : Number(acwr) > 1.3 ? '⚠️ CAUTION' : Number(acwr) < 0.8 ? '⚠️ DETRAINING' : '✅ SAFE ZONE'}
(Ideal range: 0.8-1.3. Above 1.5 = injury risk. Below 0.8 = fitness loss)

SPORT DISTRIBUTION (14 days):
${Object.entries(sportCounts).map(([s, c]) => `  ${s}: ${c}`).join('\n') || '  No data'}

INTENSITY TAGS (14 days):
${Object.entries(tagCounts).map(([t, c]) => `  ${t}: ${c}`).join('\n') || '  No tags'}

DAILY BREAKDOWN:
${dailySummary}

Today's date: ${now.toLocaleDateString()}`;
  },
};
