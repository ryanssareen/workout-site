import 'dart:math';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/cupertino.dart';

import '../../data/report_models.dart';

// ---------------------------------------------------------------------------
// Colors (matching web Tailwind palette)
// ---------------------------------------------------------------------------

const _chartColors = [
  Color(0xFF3B82F6), // blue-500
  Color(0xFF22C55E), // green-500
  Color(0xFFF59E0B), // amber-500
  Color(0xFFEF4444), // red-500
  Color(0xFFA855F7), // purple-500
  Color(0xFFEC4899), // pink-500
];

const _highlightVariants = <String, (Color, Color, Color)>{
  // (bg, border, icon)
  'success': (Color(0xFF22C55E), Color(0xFF22C55E), Color(0xFF22C55E)),
  'warning': (Color(0xFFF97316), Color(0xFFF97316), Color(0xFFF97316)),
  'info': (Color(0xFF3B82F6), Color(0xFF3B82F6), Color(0xFF3B82F6)),
  'achievement': (Color(0xFFA855F7), Color(0xFFA855F7), Color(0xFFA855F7)),
};

// ---------------------------------------------------------------------------
// Section Renderer — takes a list of sections and renders them
// ---------------------------------------------------------------------------

class ReportSectionRenderer extends StatelessWidget {
  final List<ReportSection> sections;

  const ReportSectionRenderer({super.key, required this.sections});

  @override
  Widget build(BuildContext context) {
    final widgets = <Widget>[];
    int i = 0;

    while (i < sections.length) {
      final section = sections[i];

      // Group consecutive stat sections into a horizontal scroll row
      if (section is StatSection) {
        final statGroup = <StatSection>[];
        while (i < sections.length && sections[i] is StatSection) {
          statGroup.add(sections[i] as StatSection);
          i++;
        }
        widgets.add(_StatCardRow(stats: statGroup));
        continue;
      }

      widgets.add(_renderSection(context, section));
      i++;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (int j = 0; j < widgets.length; j++) ...[
          if (j > 0) const SizedBox(height: 16),
          widgets[j],
        ],
      ],
    );
  }

  Widget _renderSection(BuildContext context, ReportSection section) {
    return switch (section) {
      StatSection s => ReportStatCard(section: s),
      ChartSection s => ReportChart(section: s),
      TextSection s => ReportTextBlock(section: s),
      HighlightSection s => ReportHighlight(section: s),
      PRBadgeSection s => ReportPRBadge(section: s),
      TableSection s => ReportDataTable(section: s),
      DividerSection() => const ReportDivider(),
    };
  }
}

// ---------------------------------------------------------------------------
// Stat Card Row (horizontal scroll for grouped stats)
// ---------------------------------------------------------------------------

class _StatCardRow extends StatelessWidget {
  final List<StatSection> stats;
  const _StatCardRow({required this.stats});

  @override
  Widget build(BuildContext context) {
    if (stats.length == 1) {
      return ReportStatCard(section: stats.first);
    }
    return SizedBox(
      height: 120,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: stats.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) => SizedBox(
          width: 160,
          child: ReportStatCard(section: stats[index]),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// StatCard — label, value, trend, change badge
// ---------------------------------------------------------------------------

class ReportStatCard extends StatelessWidget {
  final StatSection section;
  const ReportStatCard({super.key, required this.section});

  @override
  Widget build(BuildContext context) {
    final isDark =
        CupertinoTheme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
              : [const Color(0xFFF8FAFC), const Color(0xFFF1F5F9)],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark
              ? const Color(0xFF334155)
              : const Color(0xFFE2E8F0),
          width: 0.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            section.label.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
              color: CupertinoColors.systemGrey.resolveFrom(context),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: Text(
                  section.value,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (section.change != null) ...[
                const SizedBox(width: 8),
                _ChangeBadge(
                  change: section.change!,
                  trend: section.trend,
                ),
              ],
            ],
          ),
          if (section.subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              section.subtitle!,
              style: TextStyle(
                fontSize: 12,
                color: CupertinoColors.systemGrey.resolveFrom(context),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}

class _ChangeBadge extends StatelessWidget {
  final String change;
  final String? trend;
  const _ChangeBadge({required this.change, this.trend});

  @override
  Widget build(BuildContext context) {
    final isUp = trend == 'up' || change.startsWith('+');
    final isDown = trend == 'down' || change.startsWith('-');
    final color = isUp
        ? const Color(0xFF22C55E)
        : isDown
            ? const Color(0xFFEF4444)
            : CupertinoColors.systemGrey;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isUp)
            Icon(CupertinoIcons.arrow_up_right, size: 10, color: color),
          if (isDown)
            Icon(CupertinoIcons.arrow_down_right, size: 10, color: color),
          const SizedBox(width: 2),
          Text(
            change,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Chart — bar, line, area, pie via fl_chart
// ---------------------------------------------------------------------------

class ReportChart extends StatelessWidget {
  final ChartSection section;
  const ReportChart({super.key, required this.section});

  @override
  Widget build(BuildContext context) {
    final isDark =
        CupertinoTheme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C1E) : CupertinoColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: CupertinoColors.separator.resolveFrom(context),
          width: 0.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (section.label != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                section.label!,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          SizedBox(
            height: 200,
            child: _buildChart(context, isDark),
          ),
        ],
      ),
    );
  }

  Widget _buildChart(BuildContext context, bool isDark) {
    if (section.data.isEmpty) {
      return Center(
        child: Text(
          'No chart data',
          style: TextStyle(
            color: CupertinoColors.systemGrey.resolveFrom(context),
          ),
        ),
      );
    }

    if (section.chartType == 'pie') return _buildPieChart(isDark);
    return _buildBarChart(context, isDark);
  }

  Widget _buildBarChart(BuildContext context, bool isDark) {
    final data = section.data;
    final yKeys = section.yKeys ?? [section.yKey];

    final groups = <BarChartGroupData>[];
    for (int i = 0; i < data.length; i++) {
      final entry = data[i];
      final rods = <BarChartRodData>[];
      for (int k = 0; k < yKeys.length; k++) {
        final val = (entry[yKeys[k]] as num?)?.toDouble() ?? 0;
        rods.add(BarChartRodData(
          toY: val,
          color: _chartColors[k % _chartColors.length],
          width: yKeys.length > 1 ? 8 : 16,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
        ));
      }
      groups.add(BarChartGroupData(
        x: i,
        barRods: rods,
        barsSpace: 2,
      ));
    }

    return BarChart(
      BarChartData(
        barGroups: groups,
        gridData: const FlGridData(show: false),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              getTitlesWidget: (value, meta) {
                final idx = value.toInt();
                if (idx < 0 || idx >= data.length) {
                  return const SizedBox.shrink();
                }
                final label =
                    data[idx][section.xKey]?.toString() ?? '';
                // Truncate long labels
                final short =
                    label.length > 5 ? label.substring(0, 5) : label;
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    short,
                    style: TextStyle(
                      fontSize: 10,
                      color:
                          CupertinoColors.systemGrey.resolveFrom(context),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        barTouchData: BarTouchData(enabled: false),
      ),
    );
  }

  Widget _buildPieChart(bool isDark) {
    final data = section.data;
    final total = data.fold<double>(
        0, (s, e) => s + ((e[section.yKey] as num?)?.toDouble() ?? 0));
    if (total == 0) {
      return const Center(child: Text('No data'));
    }

    final pieSections = <PieChartSectionData>[];
    for (int i = 0; i < data.length; i++) {
      final val = (data[i][section.yKey] as num?)?.toDouble() ?? 0;
      final pct = val / total * 100;
      pieSections.add(PieChartSectionData(
        value: val,
        color: _chartColors[i % _chartColors.length],
        radius: 40,
        title: '${pct.toStringAsFixed(0)}%',
        titleStyle: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: CupertinoColors.white,
        ),
      ));
    }

    return Row(
      children: [
        Expanded(
          child: PieChart(
            PieChartData(
              sections: pieSections,
              centerSpaceRadius: 30,
              sectionsSpace: 2,
            ),
          ),
        ),
        const SizedBox(width: 12),
        // Legend
        Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (int i = 0; i < min(data.length, 6); i++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: _chartColors[i % _chartColors.length],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      data[i][section.xKey]?.toString() ?? '',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// TextBlock — styled text with variants
// ---------------------------------------------------------------------------

class ReportTextBlock extends StatelessWidget {
  final TextSection section;
  const ReportTextBlock({super.key, required this.section});

  @override
  Widget build(BuildContext context) {
    final isMuted = section.variant == 'muted';
    final isEmphasis = section.variant == 'emphasis';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Text(
        section.content,
        style: TextStyle(
          fontSize: isEmphasis ? 16 : 14,
          fontWeight: isEmphasis ? FontWeight.w600 : FontWeight.normal,
          fontStyle: isEmphasis ? FontStyle.italic : FontStyle.normal,
          color: isMuted
              ? CupertinoColors.systemGrey.resolveFrom(context)
              : null,
          height: 1.6,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Highlight Callout — icon + content with variant color
// ---------------------------------------------------------------------------

class ReportHighlight extends StatelessWidget {
  final HighlightSection section;
  const ReportHighlight({super.key, required this.section});

  @override
  Widget build(BuildContext context) {
    final variant = section.variant ?? 'info';
    final colors = _highlightVariants[variant] ?? _highlightVariants['info']!;
    final (accentColor, _, _) = colors;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: accentColor.withValues(alpha: 0.2),
          width: 1.5,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(
                _iconForVariant(variant, section.icon),
                style: const TextStyle(fontSize: 18),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              section.content,
              style: const TextStyle(fontSize: 14, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }

  String _iconForVariant(String variant, String? icon) {
    if (icon != null) return icon;
    return switch (variant) {
      'success' => '\u{1F3C6}', // trophy
      'warning' => '\u{1F525}', // fire
      'achievement' => '\u{2B50}', // star
      _ => '\u{1F4A1}', // lightbulb
    };
  }
}

// ---------------------------------------------------------------------------
// PR Badge — trophy + exercise + value
// ---------------------------------------------------------------------------

class ReportPRBadge extends StatelessWidget {
  final PRBadgeSection section;
  const ReportPRBadge({super.key, required this.section});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFFBEB), Color(0xFFFFF7ED)], // amber-50, orange-50
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: const Color(0xFFF59E0B).withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          // Trophy circle
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFF59E0B), Color(0xFFF97316)],
              ),
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Center(
              child: Text('\u{1F3C6}', style: TextStyle(fontSize: 22)),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'PERSONAL RECORD',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                    color: const Color(0xFFF97316).withValues(alpha: 0.8),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  section.exercise,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      section.value,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (section.previous != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        'prev: ${section.previous}',
                        style: TextStyle(
                          fontSize: 12,
                          color: CupertinoColors.systemGrey
                              .resolveFrom(context),
                        ),
                      ),
                    ],
                  ],
                ),
                if (section.date != null)
                  Text(
                    section.date!,
                    style: TextStyle(
                      fontSize: 11,
                      color: CupertinoColors.systemGrey.resolveFrom(context),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// DataTable — scrollable table
// ---------------------------------------------------------------------------

class ReportDataTable extends StatelessWidget {
  final TableSection section;
  const ReportDataTable({super.key, required this.section});

  @override
  Widget build(BuildContext context) {
    final isDark =
        CupertinoTheme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (section.caption != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              section.caption!,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: CupertinoColors.separator.resolveFrom(context),
              width: 0.5,
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header row
                  Container(
                    color: isDark
                        ? const Color(0xFF1E293B)
                        : const Color(0xFFF1F5F9),
                    child: Row(
                      children: [
                        for (final h in section.headers)
                          Container(
                            width: 110,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                            child: Text(
                              h.toUpperCase(),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.3,
                                color: CupertinoColors.systemGrey
                                    .resolveFrom(context),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  // Data rows
                  for (int r = 0; r < section.rows.length; r++)
                    Container(
                      color: r.isEven
                          ? (isDark
                              ? const Color(0xFF0F172A)
                              : CupertinoColors.white)
                          : (isDark
                              ? const Color(0xFF1E293B).withValues(alpha: 0.5)
                              : const Color(0xFFF8FAFC)),
                      child: Row(
                        children: [
                          for (final cell in section.rows[r])
                            Container(
                              width: 110,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              child: Text(
                                cell,
                                style: const TextStyle(fontSize: 13),
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

class ReportDivider extends StatelessWidget {
  const ReportDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 1,
      color: CupertinoColors.separator.resolveFrom(context),
    );
  }
}
