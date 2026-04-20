/// Models for AI-generated structured reports.
///
/// Mirrors the web's `src/types/reports.ts` section types so the same API
/// response can be rendered natively in Flutter.

class StructuredReport {
  final String title;
  final String? subtitle;
  final String? dateRange;
  final String? summary;
  final String? footer;
  final List<ReportSection> sections;

  const StructuredReport({
    required this.title,
    this.subtitle,
    this.dateRange,
    this.summary,
    this.footer,
    required this.sections,
  });

  factory StructuredReport.fromJson(Map<String, dynamic> json) {
    final rawSections = json['sections'] as List<dynamic>? ?? [];
    return StructuredReport(
      title: json['title'] as String? ?? 'Report',
      subtitle: json['subtitle'] as String?,
      dateRange: json['dateRange'] as String?,
      summary: json['summary'] as String?,
      footer: json['footer'] as String?,
      sections: rawSections
          .map((s) => ReportSection.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }
}

// ---------------------------------------------------------------------------
// Section types (sealed class hierarchy)
// ---------------------------------------------------------------------------

sealed class ReportSection {
  const ReportSection();

  factory ReportSection.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String? ?? '';
    return switch (type) {
      'stat' => StatSection.fromJson(json),
      'chart' => ChartSection.fromJson(json),
      'text' => TextSection.fromJson(json),
      'highlight' => HighlightSection.fromJson(json),
      'pr' => PRBadgeSection.fromJson(json),
      'table' => TableSection.fromJson(json),
      'divider' => const DividerSection(),
      _ => TextSection(content: json['content']?.toString() ?? ''),
    };
  }
}

class StatSection extends ReportSection {
  final String label;
  final String value;
  final String? trend; // 'up' | 'down' | 'neutral'
  final String? change; // e.g. '+15%'
  final String? subtitle;

  const StatSection({
    required this.label,
    required this.value,
    this.trend,
    this.change,
    this.subtitle,
  });

  factory StatSection.fromJson(Map<String, dynamic> json) => StatSection(
        label: json['label']?.toString() ?? '',
        value: json['value']?.toString() ?? '',
        trend: json['trend'] as String?,
        change: json['change']?.toString(),
        subtitle: json['subtitle'] as String?,
      );
}

class ChartSection extends ReportSection {
  final String chartType; // 'line' | 'bar' | 'area' | 'pie'
  final List<Map<String, dynamic>> data;
  final String xKey;
  final String yKey;
  final List<String>? yKeys; // for multi-series
  final String? label;

  const ChartSection({
    required this.chartType,
    required this.data,
    required this.xKey,
    required this.yKey,
    this.yKeys,
    this.label,
  });

  factory ChartSection.fromJson(Map<String, dynamic> json) {
    final rawData = json['data'] as List<dynamic>? ?? [];
    // Auto-detect yKeys from first data point if not provided
    List<String>? yKeys = (json['yKeys'] as List<dynamic>?)
        ?.map((e) => e.toString())
        .toList();
    final xKey = json['xKey']?.toString() ?? 'name';
    if (yKeys == null && rawData.isNotEmpty) {
      final first = rawData.first as Map<String, dynamic>;
      final numericKeys = first.entries
          .where((e) => e.key != xKey && e.value is num)
          .map((e) => e.key)
          .toList();
      if (numericKeys.length > 1) yKeys = numericKeys;
    }
    return ChartSection(
      chartType: json['chartType']?.toString() ?? 'bar',
      data: rawData
          .map((d) => Map<String, dynamic>.from(d as Map))
          .toList(),
      xKey: xKey,
      yKey: json['yKey']?.toString() ?? 'value',
      yKeys: yKeys,
      label: json['label'] as String?,
    );
  }
}

class TextSection extends ReportSection {
  final String content;
  final String? variant; // 'default' | 'muted' | 'emphasis'

  const TextSection({required this.content, this.variant});

  factory TextSection.fromJson(Map<String, dynamic> json) => TextSection(
        content: json['content']?.toString() ?? '',
        variant: json['variant'] as String?,
      );
}

class HighlightSection extends ReportSection {
  final String? icon;
  final String content;
  final String? variant; // 'success' | 'warning' | 'info' | 'achievement'

  const HighlightSection({this.icon, required this.content, this.variant});

  factory HighlightSection.fromJson(Map<String, dynamic> json) =>
      HighlightSection(
        icon: json['icon'] as String?,
        content: json['content']?.toString() ?? '',
        variant: json['variant'] as String?,
      );
}

class PRBadgeSection extends ReportSection {
  final String exercise;
  final String value;
  final String? date;
  final String? previous;

  const PRBadgeSection({
    required this.exercise,
    required this.value,
    this.date,
    this.previous,
  });

  factory PRBadgeSection.fromJson(Map<String, dynamic> json) => PRBadgeSection(
        exercise: json['exercise']?.toString() ?? '',
        value: json['value']?.toString() ?? '',
        date: json['date'] as String?,
        previous: json['previous']?.toString(),
      );
}

class TableSection extends ReportSection {
  final List<String> headers;
  final List<List<String>> rows;
  final String? caption;

  const TableSection({
    required this.headers,
    required this.rows,
    this.caption,
  });

  factory TableSection.fromJson(Map<String, dynamic> json) {
    final rawHeaders = json['headers'] as List<dynamic>? ?? [];
    final rawRows = json['rows'] as List<dynamic>? ?? [];
    return TableSection(
      headers: rawHeaders.map((h) => h.toString()).toList(),
      rows: rawRows
          .map((r) =>
              (r as List<dynamic>).map((c) => c.toString()).toList())
          .toList(),
      caption: json['caption'] as String?,
    );
  }
}

class DividerSection extends ReportSection {
  const DividerSection();
}
