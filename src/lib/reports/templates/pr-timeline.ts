import type { ReportTemplate, WorkoutDoc } from './index';

export const prTimelineTemplate: ReportTemplate = {
  type: 'pr-timeline',
  cacheTTL: 24,

  systemPrompt: `You are CoachTrack's AI report generator creating a Personal Records Timeline report. Analyze the athlete's PR history and generate a structured JSON report.

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations.

Generate these sections IN ORDER:
1. 2-3 stat cards: total PRs, PRs this month, PR streak info
2. PR badges for each recent PR (type "pr" with exercise, value, date, previous if available)
3. A bar chart showing PRs per month (data with "month" and "count" keys)
4. 1-2 highlight callouts celebrating achievements or noting patterns
5. A text block with analysis of PR velocity and one forward-looking suggestion

JSON STRUCTURE:
{
  "reportType": "prs",
  "title": "Personal Records",
  "subtitle": "Your progression and milestones",
  "dateRange": "[date range]",
  "sections": [...],
  "summary": "One sentence summary",
  "footer": null
}

Section types: stat (label, value, trend, change, subtitle), chart (chartType, title, data, xKey, yKey, label), highlight (icon, content, variant), pr (exercise, value, date, previous), text (content, variant), divider.

Be celebratory about achievements. Suggest realistic next targets based on trajectory.`,

  buildContext(workouts: WorkoutDoc[]) {
    const completed = workouts.filter((w) => w.completed);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Extract all PRs
    const allPrs: Array<{ exercise: string; value: string; date: Date; workoutType: string }> = [];

    for (const w of completed) {
      if (w.prs && w.prs.length > 0) {
        for (const pr of w.prs) {
          allPrs.push({
            exercise: pr.exercise,
            value: pr.value,
            date: w.date.toDate(),
            workoutType: w.type,
          });
        }
      }
    }

    // Sort by date descending
    allPrs.sort((a, b) => b.date.getTime() - a.date.getTime());

    const recentPrs = allPrs.filter((p) => p.date >= thirtyDaysAgo);

    // Group by month for timeline
    const monthCounts: Record<string, number> = {};
    for (const pr of allPrs) {
      const monthKey = `${pr.date.getFullYear()}-${String(pr.date.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
    }

    const monthTimeline = Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => `  ${month}: ${count} PR${count !== 1 ? 's' : ''}`)
      .join('\n');

    // Group by exercise
    const byExercise: Record<string, typeof allPrs> = {};
    for (const pr of allPrs) {
      if (!byExercise[pr.exercise]) byExercise[pr.exercise] = [];
      byExercise[pr.exercise].push(pr);
    }

    const exerciseSummary = Object.entries(byExercise)
      .map(([exercise, prs]) => {
        const latest = prs[0];
        const previous = prs.length > 1 ? prs[1] : null;
        return `  ${exercise}: ${latest.value} (${latest.date.toLocaleDateString()})${previous ? ` — previous: ${previous.value}` : ''}`;
      })
      .join('\n');

    return `PERSONAL RECORDS TIMELINE

SUMMARY:
- Total PRs: ${allPrs.length}
- PRs this month: ${recentPrs.length}
- Sports with PRs: ${[...new Set(allPrs.map((p) => p.workoutType))].join(', ') || 'none'}

RECENT PRs (last 30 days):
${recentPrs.length > 0
  ? recentPrs.map((p) => `  ${p.exercise}: ${p.value} on ${p.date.toLocaleDateString()} (${p.workoutType})`).join('\n')
  : '  No recent PRs'}

ALL PRs BY EXERCISE:
${exerciseSummary || '  No PRs recorded'}

MONTHLY PR TIMELINE:
${monthTimeline || '  No data'}

Today's date: ${now.toLocaleDateString()}`;
  },
};
