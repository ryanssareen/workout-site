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

## Next Steps (Optional)

1. **More Chart Types**: Add combo charts, scatter plots
2. **PDF Generation**: Server-side PDF with better quality
3. **Report History**: Save and view past reports
4. **Custom Themes**: Let users choose color schemes
5. **Share Reports**: Generate shareable links
6. **Export to Excel**: Structured data export

## Testing

To test the new system:

1. Navigate to `/reports`
2. Try example queries:
   - "Performance report for last 30 days"
   - "Show my workout breakdown by type"
   - "Compare athletes' completion rates"
3. Check different section types render correctly
4. Test export options (Copy, PNG, Print)
5. Try insufficient data scenario (new user)

---

**Built with**: Next.js 16, TypeScript, Tailwind CSS, Recharts, Groq AI
