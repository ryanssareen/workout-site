# CoachTrack Dynamic Report System

## Overview
Completely redesigned the CoachTrack report system from basic markdown output to a sophisticated, structured JSON-based system with beautiful component rendering.

## Architecture

### 1. Type System ([src/types/reports.ts](src/types/reports.ts))

**Report Types:**
- `progress` - Progress tracking over time
- `comparison` - Compare different metrics
- `summary` - General summaries
- `prs` - Personal records
- `insight` - AI-generated insights
- `analysis` - Detailed analysis

**Section Types:**
- **StatCard** - Key metrics with trend indicators (↑↓)
- **DataTable** - Sortable tables with zebra striping
- **ChartSection** - Line, bar, area, and pie charts
- **TextBlock** - Formatted text content
- **HighlightCallout** - Eye-catching callouts for insights
- **PRBadge** - Special badges for personal records
- **Divider** - Visual separators

### 2. Component Architecture

```
/components/reports/
├── ReportContainer.tsx      # Main wrapper with branding & export
├── ReportRenderer.tsx        # Section mapper & grid layout
└── sections/
    ├── StatCard.tsx          # Metric cards with trends
    ├── DataTable.tsx         # Data tables
    ├── ChartSection.tsx      # Recharts integration
    ├── TextBlock.tsx         # Text content
    ├── HighlightCallout.tsx  # Callout boxes
    ├── PRBadge.tsx           # PR achievements
    └── Divider.tsx           # Visual separator
```

### 3. AI Integration ([src/app/api/ai/reports/route.ts](src/app/api/ai/reports/route.ts))

**New System Prompt:**
- Instructs Groq to return structured JSON instead of markdown
- Provides complete JSON schema with examples
- Specifies when to use each section type
- Handles insufficient data gracefully

**Response Format:**
```json
{
  "reportType": "progress",
  "title": "Bench Press Progress",
  "subtitle": "January 2025",
  "dateRange": "Jan 1 - Jan 31",
  "sections": [
    {
      "type": "stat",
      "label": "Total Sets",
      "value": 48,
      "trend": "up",
      "change": "+12%"
    },
    {
      "type": "chart",
      "chartType": "line",
      "data": [...],
      "xKey": "week",
      "yKey": "weight"
    }
  ],
  "summary": "Great progress this month!",
  "footer": "Keep it up!"
}
```

## Features

### Beautiful Rendering
- **Stat Cards**: Gradient backgrounds, trend indicators, responsive grid (1-3 columns)
- **Charts**: Professional Recharts with custom styling, tooltips, legends
- **Tables**: Zebra striping, responsive, clean borders
- **Highlights**: Color-coded callouts (success, warning, info, achievement)
- **PR Badges**: Gold gradient with trophy icons for achievements

### CoachTrack Branding
- Blue-to-cyan gradient logo
- Professional header with user name and date
- Consistent spacing and shadows
- Dark/light mode support
- Footer with generation timestamp

### Export Options
1. **Copy to Clipboard** - Text summary
2. **Save as PNG** - High-quality image export (2x pixel ratio)
3. **Print/PDF** - Browser print dialog with optimized layout

### Smart Features
- **Auto-grouping**: Consecutive stat cards automatically display in grid
- **Responsive**: Adapts to mobile, tablet, desktop
- **Type-safe**: Full TypeScript support
- **Error handling**: Graceful insufficient data messages

## Usage Examples

### User Queries → AI Responses

**"Show my bench press progress this month"**
→ Progress report with stat cards (total sets, PRs), line chart showing weight over time, text analysis

**"Compare my leg day vs push day volume"**
→ Comparison report with stat cards for each, bar chart comparing volume, table with exercise breakdown

**"What are my PRs?"**
→ PRs report with PR badges for each exercise, stat card for total PRs

**"Summary of this week"**
→ Summary report with key metrics in stat cards, table of workouts, text summary

## Color Scheme

**Primary**: Blue (#3b82f6) to Cyan (#06b6d4) gradient
**Accents**:
- Success: Green (#10b981)
- Warning: Orange (#f59e0b)
- Error: Red (#ef4444)
- Achievement: Purple (#8b5cf6) to Amber (#f59e0b)

**Background**: Slate gradients (50-900 range)

## Dependencies

**New:**
- `recharts` - Chart library

**Existing:**
- `html-to-image` - PNG export
- `react-markdown` - (No longer used for reports)
- `lucide-react` - Icons

## Files Modified

1. `/src/types/reports.ts` - NEW: Type definitions
2. `/src/components/reports/**` - NEW: All report components
3. `/src/app/api/ai/reports/route.ts` - Updated: Structured JSON output
4. `/src/app/(dashboard)/reports/page.tsx` - Updated: New renderer
5. `package.json` - Added recharts

## How It Works

1. **User Input**: Types natural language query
2. **API Call**: Sends to `/api/ai/reports` with user context
3. **Data Fetch**: Backend fetches workout data from Firestore
4. **AI Processing**: Groq analyzes and returns structured JSON
5. **Rendering**: ReportRenderer maps sections to components
6. **Display**: Beautiful, branded report in modal
7. **Export**: Copy, PNG, or Print options

## Example Report Structure

```typescript
{
  reportType: "progress",
  title: "30-Day Performance Report",
  subtitle: "January 1 - 31, 2025",
  sections: [
    // Stats grid (3 cards)
    { type: "stat", label: "Total Workouts", value: 24, trend: "up", change: "+20%" },
    { type: "stat", label: "Completion Rate", value: "92%", trend: "up" },
    { type: "stat", label: "New PRs", value: 3, trend: "up" },

    // Divider
    { type: "divider" },

    // Chart
    {
      type: "chart",
      chartType: "line",
      title: "Weight Progress",
      data: [
        { week: "Week 1", weight: 90 },
        { week: "Week 2", weight: 92 },
        { week: "Week 3", weight: 95 },
        { week: "Week 4", weight: 98 }
      ],
      xKey: "week",
      yKey: "weight"
    },

    // Table
    {
      type: "table",
      caption: "Exercise Breakdown",
      headers: ["Exercise", "Sets", "Volume"],
      rows: [
        ["Bench Press", 20, "2000kg"],
        ["Squat", 16, "2400kg"]
      ]
    },

    // Highlight
    {
      type: "highlight",
      icon: "fire",
      content: "You hit 3 new PRs this month! Amazing consistency.",
      variant: "success"
    },

    // PR Badge
    {
      type: "pr",
      exercise: "Bench Press",
      value: "100kg x 5",
      date: "January 25, 2025",
      previous: "95kg x 5"
    }
  ],
  summary: "Excellent progress this month! Your consistency is paying off."
}
```

## Reports Hub (3-Zone Layout) — Added March 2026

The reports page was redesigned from a 6-tab dashboard to a focused 3-zone hub at `/reports`.

### Zone 1 — AI Smart Layer
- **`AIInsightCard`** — Gradient card showing daily AI-generated insight (from cron at 6am UTC). Links to relevant deep-dive report. Skeleton loader while fetching. Empty state for new users.
- **`AskAnythingBar`** — Search input with rotating placeholder suggestions. Calls `/api/ai/reports`. Renders structured report inline using `ReportRenderer` with collapsible header.

### Zone 2 — Your Reports
- **`YourReportsZone`** — Three gradient link cards to `/wrap` (weekly), `/review` (monthly), `/wrapped` (yearly) with live workout count subtitles.

### Zone 3 — Explore Your Data
- **`ExploreCards`** — Context-aware deep-dive cards selected by training patterns. Max 3 cards shown, prioritized:
  1. Sport Deep Dive (3+ sessions of one sport in 30 days)
  2. Trend Report (2+ months of workout data)
  3. Recovery Report (10+ workouts in 14 days)
  4. PR Timeline (any PRs recorded)
  5. Training Analysis (always — links to old dashboard at `/reports/training-analysis`)

### Hub Component Architecture
```
/components/reports/
├── ReportContainer.tsx      # Main wrapper with branding & export
├── ReportRenderer.tsx       # Section mapper & grid layout
├── hub/
│   ├── AIInsightCard.tsx    # Daily AI insight display
│   ├── AskAnythingBar.tsx   # Free-text AI query input
│   ├── YourReportsZone.tsx  # Periodic report links (wrap/review/wrapped)
│   ├── ExploreCards.tsx     # Context-aware deep-dive card selection
│   └── DeepDiveCard.tsx     # Reusable card: icon + title + teaser + arrow
└── sections/
    ├── StatCard.tsx          # Metric cards with trends
    ├── DataTable.tsx         # Data tables
    ├── ChartSection.tsx      # Recharts integration (multi-series support)
    ├── TextBlock.tsx         # Text content
    ├── HighlightCallout.tsx  # Callout boxes
    ├── PRBadge.tsx           # PR achievements
    └── Divider.tsx           # Visual separator
```

## Template-Based Deep-Dive Reports — Added March 2026

Dynamic report pages at `/reports/[reportType]` with skeleton loading, generated from templates via Groq AI.

### Report Templates

| Type | TTL | Description |
|------|-----|-------------|
| `sport-deep-dive` | 12h | Single sport analysis: pace/volume/distance trends, weekly breakdown, tag distribution, PRs. Compares current 30d vs previous 30d. |
| `trend-report` | 6h | Month-over-month comparison across all metrics and sports. Percentage changes for workouts, distance, duration, active days. |
| `pr-timeline` | 24h | PR history grouped by exercise. Monthly timeline, progression chains. |
| `recovery-report` | 6h | 14-day daily activity, rest days, consecutive training streaks, ACWR, overtraining risk zones. |
| `goal-tracker` | 8h | Event countdown + readiness assessment. 8-week training volume buildup, taper recommendations. |

### Template Architecture
Each template exports `{ type, cacheTTL, systemPrompt, buildContext(workouts, params) }`. The `buildContext()` function pre-computes focused data into a text string. Groq 70B generates structured JSON (falls back to 8B on 429). Results cached in Firestore `users/{username}/cachedReports/{type}_{paramHash}`.

### Cache System
- `src/lib/reports/cache.ts` — `getCachedReport()`, `setCachedReport()` with Firestore TTL
- Cache key: `{type}_{paramHash}` (e.g., `sport-deep-dive_abc123`)
- TTL varies by template (6-24h)
- Cache-first: checks Firestore → miss calls `/api/ai/reports/generate` → caches result

## Daily AI Insight Cron — Added March 2026

- **Route:** `/api/cron/generate-insights` — runs at 6am UTC daily via Vercel cron
- **Model:** Groq `llama-3.1-8b-instant` (cost-efficient for short insights)
- **Output:** 1-sentence personalized training insight per user
- **Storage:** `users/{username}/insights/daily` with 24h TTL
- **Limit:** Up to 50 users per run
- **Consumer:** `AIInsightCard` component in Reports Hub

## Chart Fixes — March 2026

- **Multi-series support** — Charts now handle multiple data keys (e.g., distance + duration on same chart)
- **Auto-detection of data keys** — ChartSection automatically detects y-axis keys from data
- **Explicit height** — `ResponsiveContainer` now requires explicit height to prevent zero-height rendering bugs

## Next Steps (Optional)

1. **More Chart Types**: Add combo charts, scatter plots
2. **PDF Generation**: Server-side PDF with better quality — `jspdf` already in dependencies
3. ~~**Report History**: Save and view past reports~~ → ✅ Done via Firestore caching
4. **Custom Themes**: Let users choose color schemes
5. ~~**Share Reports**: Generate shareable links~~ → ✅ Done via ShareButtons
6. **Export to Excel**: Structured data export
7. **Achievement Reports**: Auto-generated reports when PRs or milestones are hit (achievements system now built)

## Testing

### Original Report Renderer
1. Navigate to `/reports`
2. Use the "Ask Anything" bar to try queries:
   - "Performance report for last 30 days"
   - "Show my workout breakdown by type"
3. Check different section types render correctly
4. Test export options (Copy, PNG, Print)

### Reports Hub
1. Check AI Insight Card loads daily insight (or empty state for new users)
2. Click deep-dive cards → verify `/reports/[reportType]` loads with skeleton then renders
3. Verify context-aware card selection (e.g., Sport Deep Dive only shows if 3+ sessions of one sport)
4. Test cache: reload a report page → should load instantly from Firestore cache

### Template Reports
1. Navigate to `/reports/sport-deep-dive?sport=Running`
2. Verify structured JSON report renders with charts, stats, tables
3. Test 8B model fallback by triggering rate limit on 70B
4. Check Firestore cache entry created with correct TTL

---

**Built with**: Next.js 16, TypeScript, Tailwind CSS, Recharts, Groq AI

## Files (Updated)

1. `/src/types/reports.ts` - Type definitions
2. `/src/components/reports/**` - All report components (renderer + sections + hub)
3. `/src/components/reports/hub/**` - NEW: Reports Hub components (AIInsightCard, AskAnythingBar, etc.)
4. `/src/app/api/ai/reports/route.ts` - Ask Anything API (structured JSON output)
5. `/src/app/api/ai/reports/generate/route.ts` - NEW: Template-based report generation
6. `/src/app/(dashboard)/reports/page.tsx` - Redesigned: 3-zone Reports Hub
7. `/src/app/(dashboard)/reports/[reportType]/page.tsx` - NEW: Dynamic report pages
8. `/src/app/(dashboard)/reports/training-analysis/page.tsx` - Relocated old 6-tab dashboard
9. `/src/app/api/cron/generate-insights/route.ts` - NEW: Daily AI insight cron
10. `/src/lib/reports/cache.ts` - NEW: Firestore TTL cache
11. `/src/lib/reports/templates/**` - NEW: 5 report templates
12. `package.json` - Added recharts
