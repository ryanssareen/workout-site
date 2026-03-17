import type { ReportTemplate, WorkoutDoc } from './index';

const SPORT_LABELS: Record<string, string> = {
  run: 'Running', bike: 'Cycling', swim: 'Swimming', walk: 'Walking', strength: 'Strength Training', other: 'Training',
};

export const sportDeepDiveTemplate: ReportTemplate = {
  type: 'sport-deep-dive',
  cacheTTL: 12,

  systemPrompt: `You are CoachTrack's AI report generator creating a Sport Deep Dive report. Analyze the athlete's training data for ONE specific sport and generate a structured JSON report.

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations.

Generate these sections IN ORDER:
1. 3-4 stat cards: total sessions, total distance/volume, total time, average pace/duration
2. A line or area chart showing weekly distance or duration trend (data array with "week" and "value" keys)
3. A bar chart showing workout distribution by tag (easy, moderate, hard, tempo, etc.)
4. 1-2 highlight callouts with key insights (use "achievement" for good things, "info" for patterns, "warning" for concerns)
5. If there are PRs, include PR badges
6. A text block with 2-3 sentences of personalized analysis and one actionable recommendation

JSON STRUCTURE:
{
  "reportType": "analysis",
  "title": "Your [Sport] This Month",
  "subtitle": "Deep dive into your [sport] training",
  "dateRange": "[date range]",
  "sections": [...sections following the types: stat, chart, highlight, pr, text, divider],
  "summary": "One sentence summary",
  "footer": null
}

Section types: stat (label, value, trend, change, subtitle), chart (chartType, title, data, xKey, yKey, label), highlight (icon, content, variant), pr (exercise, value, date, previous), text (content, variant), divider, table (headers, rows, caption).

Be specific with numbers. Lead with non-obvious insights. Keep highlights warm but not over-enthusiastic.`,

  buildContext(workouts: WorkoutDoc[], params: Record<string, string>) {
    const sport = params.sport || 'run';
    const sportLabel = SPORT_LABELS[sport] || sport;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const sportWorkouts = workouts.filter((w) => w.type === sport && w.completed);
    const recent = sportWorkouts.filter((w) => w.date.toDate() >= thirtyDaysAgo);
    const previous = sportWorkouts.filter(
      (w) => w.date.toDate() >= sixtyDaysAgo && w.date.toDate() < thirtyDaysAgo
    );

    // Compute stats
    let totalDistanceKm = 0;
    let totalDurationMin = 0;
    let totalCalories = 0;
    const tagCounts: Record<string, number> = {};
    const weeklyData: Record<string, { distance: number; duration: number; count: number }> = {};
    const prs: Array<{ exercise: string; value: string; date: string }> = [];

    for (const w of recent) {
      const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : (w.duration || 0);
      totalDurationMin += dur;
      if (w.actualStats?.distance) totalDistanceKm += w.actualStats.distance / 1000;
      if (w.actualStats?.calories) totalCalories += w.actualStats.calories;

      for (const tag of w.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }

      // Weekly bucketing
      const weekStart = new Date(w.date.toDate());
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const weekKey = weekStart.toISOString().slice(0, 10);
      if (!weeklyData[weekKey]) weeklyData[weekKey] = { distance: 0, duration: 0, count: 0 };
      weeklyData[weekKey].distance += w.actualStats?.distance ? w.actualStats.distance / 1000 : 0;
      weeklyData[weekKey].duration += dur;
      weeklyData[weekKey].count += 1;

      // PRs
      if (w.prs) {
        for (const pr of w.prs) {
          prs.push({
            exercise: pr.exercise,
            value: pr.value,
            date: w.date.toDate().toLocaleDateString(),
          });
        }
      }
    }

    // Previous period stats for comparison
    let prevDistance = 0;
    let prevDuration = 0;
    for (const w of previous) {
      if (w.actualStats?.distance) prevDistance += w.actualStats.distance / 1000;
      const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : (w.duration || 0);
      prevDuration += dur;
    }

    const avgPace = totalDistanceKm > 0
      ? (totalDurationMin / totalDistanceKm).toFixed(1)
      : null;

    const weeklyEntries = Object.entries(weeklyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, d]) => `  ${week}: ${d.count} sessions, ${d.distance.toFixed(1)}km, ${d.duration.toFixed(0)}min`);

    const tagSummary = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([tag, count]) => `${tag}: ${count}`)
      .join(', ');

    return `SPORT DEEP DIVE: ${sportLabel}
Period: Last 30 days (${thirtyDaysAgo.toLocaleDateString()} - ${now.toLocaleDateString()})

CURRENT PERIOD (last 30 days):
- Sessions: ${recent.length}
- Total distance: ${totalDistanceKm.toFixed(1)} km
- Total duration: ${totalDurationMin.toFixed(0)} minutes (${(totalDurationMin / 60).toFixed(1)} hours)
- Total calories: ${totalCalories}
${avgPace ? `- Average pace: ${avgPace} min/km` : ''}

PREVIOUS PERIOD (30-60 days ago):
- Sessions: ${previous.length}
- Total distance: ${prevDistance.toFixed(1)} km
- Total duration: ${prevDuration.toFixed(0)} minutes

WEEKLY BREAKDOWN:
${weeklyEntries.join('\n') || '  No data'}

TAG DISTRIBUTION: ${tagSummary || 'No tags'}

PERSONAL RECORDS THIS MONTH: ${prs.length > 0 ? prs.map((p) => `${p.exercise}: ${p.value} (${p.date})`).join(', ') : 'None'}

ALL-TIME ${sportLabel.toUpperCase()} WORKOUTS: ${sportWorkouts.length}`;
  },
};
