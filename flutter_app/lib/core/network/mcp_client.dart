import 'dart:convert';

import 'package:dio/dio.dart';

import '../constants/api_constants.dart';

/// Exception thrown when an MCP tool call fails.
class McpException implements Exception {
  final int? code;
  final String message;
  final dynamic data;

  McpException({this.code, required this.message, this.data});

  @override
  String toString() => 'McpException($code): $message';
}

/// Client for the MCP (Model Context Protocol) server.
///
/// Sends JSON-RPC 2.0 requests over HTTP POST and parses
/// the nested response format:
/// `{result: {content: [{type: "text", text: "<json>"}]}}`
class McpClient {
  final Dio _dio;
  int _nextId = 1;

  McpClient(this._dio);

  /// Calls an MCP tool by name with the given arguments.
  ///
  /// Returns the parsed JSON from the tool's text response.
  /// Throws [McpException] on JSON-RPC errors or malformed responses.
  Future<Map<String, dynamic>> callTool(
    String toolName,
    Map<String, dynamic> arguments,
  ) async {
    final id = _nextId++;

    final payload = {
      'jsonrpc': '2.0',
      'id': id,
      'method': 'tools/call',
      'params': {
        'name': toolName,
        'arguments': arguments,
      },
    };

    try {
      print('[MCP] Calling tool: $toolName');
      final response = await _dio.post<dynamic>(
        ApiConstants.mcpUrl,
        data: payload,
        options: Options(
          headers: {
            'Content-Type': ApiConstants.contentType,
            'Accept': ApiConstants.mcpAccept,
          },
          responseType: ResponseType.plain,
        ),
      );

      print('[MCP] Response status: ${response.statusCode}');
      final raw = response.data;
      if (raw == null) {
        throw McpException(message: 'Empty response from MCP server');
      }
      print('[MCP] Response type: ${raw.runtimeType}, length: ${raw is String ? raw.length : "N/A"}');
      if (raw is String && raw.length < 500) {
        print('[MCP] Response body: $raw');
      } else if (raw is String) {
        print('[MCP] Response body (first 500): ${raw.substring(0, 500)}');
      }

      // Handle case where response is a string (e.g. SSE or redirect body)
      Map<String, dynamic> body;
      if (raw is Map<String, dynamic>) {
        body = raw;
      } else if (raw is String) {
        // Strip SSE framing if present (e.g. "event: message\ndata: {...}\n")
        var text = raw;
        if (text.contains('data: {')) {
          final lines = text.split('\n');
          final dataLines = lines
              .where((l) => l.startsWith('data: '))
              .map((l) => l.substring(6))
              .toList();
          if (dataLines.isNotEmpty) {
            text = dataLines.join('');
          }
        }
        try {
          final parsed = jsonDecode(text);
          if (parsed is Map<String, dynamic>) {
            body = parsed;
          } else {
            throw McpException(
              message: 'Unexpected MCP response type',
              data: text,
            );
          }
        } catch (_) {
          throw McpException(
            message: 'MCP returned non-JSON response',
            data: text.length > 300 ? '${text.substring(0, 300)}...' : text,
          );
        }
      } else {
        throw McpException(
          message: 'Unexpected MCP response format',
          data: raw.toString(),
        );
      }

      // Check for JSON-RPC error
      if (body.containsKey('error')) {
        final error = body['error'];
        if (error is Map<String, dynamic>) {
          throw McpException(
            code: error['code'] as int?,
            message: error['message'] as String? ?? 'Unknown MCP error',
            data: error['data'],
          );
        }
        throw McpException(message: error.toString());
      }

      return _parseResult(body);
    } on DioException catch (e) {
      print('[MCP] DioException for $toolName: ${e.type} - ${e.message}');
      print('[MCP] Status: ${e.response?.statusCode}, Body: ${e.response?.data?.toString().substring(0, 200 < (e.response?.data?.toString().length ?? 0) ? 200 : (e.response?.data?.toString().length ?? 0))}');
      throw McpException(
        code: e.response?.statusCode,
        message: e.message ?? 'Network error calling MCP tool: $toolName',
        data: e.response?.data?.toString(),
      );
    } catch (e) {
      if (e is McpException) rethrow;
      print('[MCP] Unexpected error for $toolName: $e');
      rethrow;
    }
  }

  /// Parses the nested MCP result format.
  ///
  /// Expected structure:
  /// ```json
  /// {
  ///   "result": {
  ///     "content": [
  ///       {"type": "text", "text": "{...json...}"}
  ///     ]
  ///   }
  /// }
  /// ```
  Map<String, dynamic> _parseResult(Map<String, dynamic> body) {
    final result = body['result'];
    if (result == null) {
      throw McpException(message: 'No result in MCP response');
    }

    // Check if the tool returned an error result
    if (result['isError'] == true) {
      final content = result['content'];
      String errorMsg = 'MCP tool returned an error';
      if (content is List && content.isNotEmpty) {
        final text = content[0]['text'];
        if (text is String) {
          errorMsg = text.length > 200 ? text.substring(0, 200) : text;
        }
      }
      throw McpException(message: errorMsg);
    }

    final content = result['content'];
    if (content == null || content is! List || content.isEmpty) {
      throw McpException(message: 'No content in MCP result');
    }

    final firstContent = content[0] as Map<String, dynamic>;
    final textValue = firstContent['text'];
    if (textValue == null || textValue is! String) {
      throw McpException(message: 'No text content in MCP result');
    }

    try {
      final parsed = jsonDecode(textValue);
      if (parsed is Map<String, dynamic>) {
        return parsed;
      }
      // Wrap non-map results for uniform access
      return {'data': parsed};
    } on FormatException {
      throw McpException(
        message: 'Failed to parse MCP tool response as JSON: '
            '${textValue.length > 200 ? textValue.substring(0, 200) : textValue}',
        data: textValue,
      );
    }
  }
}
