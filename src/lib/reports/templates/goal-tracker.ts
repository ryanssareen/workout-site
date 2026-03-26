import type { ReportTemplate, WorkoutDoc } from './index';

export const goalTrackerTemplate: ReportTemplate = {
  type: 'goal-tracker',
  cacheTTL: 8,

  systemPrompt: `You are CoachTrack's AI report generator creating a Goal Tracker Report. The athlete has an upcoming event/goal — analyze their training readiness, progression, and what to focus on in the remaining weeks.

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations.

Generate these sections IN ORDER:
1. A highlight callout (variant "info") with a countdown headline: "X weeks to [Event Name]" and a one-line readiness assessment
2. 4 stat cards: total workouts in prep period, total distance (km), total training hours, weekly average workouts — each with subtitle giving context
3. A chart (chartType "bar") showing weekly training volume (distance or duration) over the last 8 weeks — data with "week" and "volume" keys. Title: "Training Volume Buildup"
4. A text block (variant "emphasis") analyzing their volume progression — are they building appropriately toward the event?
5. A table showing week-by-week breakdown with columns: Week, Workouts, Distance (km), Hours, Primary Sport
6. A highlight callout — readiness verdict: use "success" if on track (consistent volume, appropriate build), "warning" if concerns (gaps, insufficient volume, no taper), "info" for neutral observations
7. A text block with specific recommendations for the remaining weeks: what to focus on, when to taper, what to avoid

JSON STRUCTURE:
{
  "reportType": "analysis",
  "title": "Goal Tracker: [Event Name]",
  "subtitle": "[X] weeks to go — are you ready?",
  "dateRange": "[date range]",
  "sections": [...],
  "summary": "One sentence readiness summary",
  "footer": null
}

Section types: stat (label, value, trend, change, subtitle), chart (chartType, title, data, xKey, yKey, label), highlight (icon, content, variant), text (content, variant), table (headers, rows, caption), divider.

Be encouraging but honest. If the athlete needs to do more, say so clearly. If they're on track, celebrate it. Consider event type when assessing readiness (a marathon needs more volume than a 5K).`,

  buildContext(workouts: WorkoutDoc[], params: Record<string, string>) {
    const now = new Date();
    const eventName = params.event || 'Your Event';

    // Try to find the event date from params or infer from workout data
    const eventDateStr = params.eventDate;
    let eventDate: Date | null = null;
    if (eventDateStr) {
      eventDate = new Date(eventDateStr);
    }

    const safeDate = (w: WorkoutDoc): Date | null => {
      try {
        const d = w.date?.toDate ? w.date.toDate() : new Date(w.date as any);
        return isNaN(d.getTime()) ? null : d;
      } catch { return null; }
    };

    // Analyze the last 8 weeks of training
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    const completed = workouts.filter((w) => w.completed);
    const prepPeriod = completed.filter((w) => { const d = safeDate(w); return d ? d >= eightWeeksAgo : false; });

    // Weekly breakdown (last 8 weeks)
    const weeks: Array<{
      label: string;
      startDate: Date;
      workouts: number;
      distanceKm: number;
      durationMin: number;
      sports: Record<string, number>;
    }> = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekWorkouts = prepPeriod.filter((w) => {
        const d = safeDate(w);
        return d ? d >= weekStart && d < weekEnd : false;
      });

      let distance = 0;
      let duration = 0;
      const sports: Record<string, number> = {};

      for (const w of weekWorkouts) {
        if (w.actualStats?.distance) distance += w.actualStats.distance / 1000;
        const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : (w.duration || 0);
        duration += dur;
        sports[w.type] = (sports[w.type] || 0) + 1;
      }

      weeks.push({
        label: `Week ${8 - i}`,
        startDate: weekStart,
        workouts: weekWorkouts.length,
        distanceKm: distance,
        durationMin: duration,
        sports,
      });
    }

    // Totals
    let totalDistance = 0;
    let totalDuration = 0;
    const sportTotals: Record<string, number> = {};

    for (const w of prepPeriod) {
      if (w.actualStats?.distance) totalDistance += w.actualStats.distance / 1000;
      const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : (w.duration || 0);
      totalDuration += dur;
      sportTotals[w.type] = (sportTotals[w.type] || 0) + 1;
    }

    // Volume trend (are they building up?)
    const firstHalf = weeks.slice(0, 4);
    const secondHalf = weeks.slice(4);
    const firstHalfAvgVolume =
      firstHalf.reduce((sum, w) => sum + w.distanceKm, 0) / Math.max(firstHalf.length, 1);
    const secondHalfAvgVolume =
      secondHalf.reduce((sum, w) => sum + w.distanceKm, 0) / Math.max(secondHalf.length, 1);
    const volumeTrend =
      firstHalfAvgVolume > 0
        ? Math.round(((secondHalfAvgVolume - firstHalfAvgVolume) / firstHalfAvgVolume) * 100)
        : 0;

    // Consistency check: how many of the last 8 weeks had workouts?
    const activeWeeks = weeks.filter((w) => w.workouts > 0).length;

    // Tag distribution for intensity analysis
    const tagCounts: Record<string, number> = {};
    for (const w of prepPeriod) {
      for (const tag of w.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    // Long run/ride detection
    const longSessions = prepPeriod.filter((w) => {
      const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : (w.duration || 0);
      return dur >= 60;
    });

    const weeklyBreakdown = weeks
      .map((w) => {
        const primarySport =
          Object.entries(w.sports).sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';
        return `  ${w.label} (${w.startDate.toISOString().slice(0, 10)}): ${w.workouts} workout${w.workouts !== 1 ? 's' : ''}, ${w.distanceKm.toFixed(1)} km, ${(w.durationMin / 60).toFixed(1)} hrs [primary: ${primarySport}]`;
      })
      .join('\n');

    const weeksUntilEvent = eventDate
      ? Math.ceil((eventDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 'unknown';

    return `GOAL TRACKER REPORT

EVENT: ${eventName}
${eventDate ? `EVENT DATE: ${eventDate.toLocaleDateString()}` : 'EVENT DATE: Not specified'}
WEEKS UNTIL EVENT: ${weeksUntilEvent}

TRAINING PREPARATION (Last 8 Weeks):
- Total workouts: ${prepPeriod.length}
- Total distance: ${totalDistance.toFixed(1)} km
- Total training time: ${(totalDuration / 60).toFixed(1)} hrs
- Weekly average: ${(prepPeriod.length / 8).toFixed(1)} workouts/week
- Active weeks (out of 8): ${activeWeeks}
- Long sessions (60+ min): ${longSessions.length}

SPORT DISTRIBUTION:
${Object.entries(sportTotals).map(([s, c]) => `  ${s}: ${c}`).join('\n') || '  No data'}

VOLUME TREND:
- First 4 weeks avg distance/week: ${firstHalfAvgVolume.toFixed(1)} km
- Last 4 weeks avg distance/week: ${secondHalfAvgVolume.toFixed(1)} km
- Trend: ${volumeTrend > 0 ? '+' : ''}${volumeTrend}% ${volumeTrend > 10 ? '(building well ✅)' : volumeTrend < -10 ? '(volume dropping ⚠️)' : '(stable)'}

INTENSITY TAGS:
${Object.entries(tagCounts).map(([t, c]) => `  ${t}: ${c}`).join('\n') || '  No tags recorded'}

WEEKLY BREAKDOWN:
${weeklyBreakdown}

Today's date: ${now.toLocaleDateString()}`;
  },
};
