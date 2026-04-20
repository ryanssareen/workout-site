import 'package:dio/dio.dart';

import '../../../core/constants/api_constants.dart';
import '../../../models/workout.dart';
import 'report_models.dart';

/// Repository for fetching AI-generated deep-dive reports.
///
/// Calls the same `/api/ai/reports/generate` endpoint as the web app.
/// Sends client workouts in the request body to minimize Firestore reads.
class ReportRepository {
  final Dio _dio;

  ReportRepository(this._dio);

  /// Generate (or fetch cached) a deep-dive report.
  ///
  /// [reportType] — one of: sport-deep-dive, trend-report, goal-tracker,
  /// recovery-report, pr-timeline, training-analysis.
  ///
  /// [params] — optional filters (e.g. `{ sport: 'run' }`).
  ///
  /// [clientWorkouts] — if provided, sent in the body so the server can
  /// skip Firestore reads (matches the web's cost-saving pattern).
  ///
  /// [refresh] — if true, bypass server cache and regenerate.
  Future<StructuredReport> generateReport(
    String reportType, {
    Map<String, dynamic>? params,
    List<Workout>? clientWorkouts,
    bool refresh = false,
  }) async {
    final body = <String, dynamic>{
      'reportType': reportType,
      if (params != null) 'params': params,
      if (refresh) 'refresh': true,
    };

    // Send workouts to save Firestore reads on the server
    if (clientWorkouts != null && clientWorkouts.isNotEmpty) {
      body['clientWorkouts'] = clientWorkouts.map((w) {
        final json = w.toJson();
        // Ensure date is ISO string for the server
        json['date'] = w.date.toIso8601String();
        if (w.completedAt != null) {
          json['completedAt'] = w.completedAt!.toIso8601String();
        }
        return json;
      }).toList();
    }

    final response = await _dio.post<Map<String, dynamic>>(
      '${ApiConstants.baseUrl}/api/ai/reports/generate',
      data: body,
      options: Options(
        headers: {'Content-Type': ApiConstants.contentType},
        receiveTimeout: const Duration(seconds: 60), // AI generation takes time
      ),
    );

    final data = response.data;
    if (data == null) {
      throw Exception('Empty response from report API');
    }

    // Check for insufficient data
    if (data['isInsufficient'] == true) {
      final msg = data['insufficientMessage'] as String? ??
          'Not enough workout data to generate this report yet.';
      throw InsufficientDataException(msg);
    }

    final report = data['report'] as Map<String, dynamic>?;
    if (report == null) {
      throw Exception('No report data in response');
    }

    return StructuredReport.fromJson(report);
  }
}

/// Thrown when the server determines there isn't enough data for a report.
class InsufficientDataException implements Exception {
  final String message;
  const InsufficientDataException(this.message);

  @override
  String toString() => message;
}
