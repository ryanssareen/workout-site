import 'package:flutter/cupertino.dart';

/// App theme configuration for The Daily Athlete.
///
/// Uses Cupertino widgets with a red primary color matching the web branding.
class AppTheme {
  AppTheme._();

  // Brand colors
  static const Color primaryRed = Color(0xFFDC2626); // red-600
  static const Color primaryRedDark = Color(0xFFEF4444); // red-500 for dark mode
  static const Color darkBackground = Color(0xFF000000);
  static const Color darkSurface = Color(0xFF1C1C1E);
  static const Color darkCard = Color(0xFF2C2C2E);
  static const Color lightBackground = Color(0xFFF9FAFB);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightCard = Color(0xFFF3F4F6);

  static const CupertinoThemeData lightTheme = CupertinoThemeData(
    brightness: Brightness.light,
    primaryColor: primaryRed,
    primaryContrastingColor: CupertinoColors.white,
    scaffoldBackgroundColor: lightBackground,
    barBackgroundColor: lightSurface,
    textTheme: CupertinoTextThemeData(
      primaryColor: primaryRed,
      textStyle: TextStyle(
        fontFamily: '.SF Pro Text',
        color: CupertinoColors.black,
        fontSize: 17,
      ),
      navTitleTextStyle: TextStyle(
        fontFamily: '.SF Pro Text',
        color: CupertinoColors.black,
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
      navLargeTitleTextStyle: TextStyle(
        fontFamily: '.SF Pro Display',
        color: CupertinoColors.black,
        fontSize: 34,
        fontWeight: FontWeight.w700,
      ),
      tabLabelTextStyle: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 10,
        fontWeight: FontWeight.w500,
      ),
    ),
  );

  static const CupertinoThemeData darkTheme = CupertinoThemeData(
    brightness: Brightness.dark,
    primaryColor: primaryRedDark,
    primaryContrastingColor: CupertinoColors.white,
    scaffoldBackgroundColor: darkBackground,
    barBackgroundColor: darkSurface,
    textTheme: CupertinoTextThemeData(
      primaryColor: primaryRedDark,
      textStyle: TextStyle(
        fontFamily: '.SF Pro Text',
        color: CupertinoColors.white,
        fontSize: 17,
      ),
      navTitleTextStyle: TextStyle(
        fontFamily: '.SF Pro Text',
        color: CupertinoColors.white,
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
      navLargeTitleTextStyle: TextStyle(
        fontFamily: '.SF Pro Display',
        color: CupertinoColors.white,
        fontSize: 34,
        fontWeight: FontWeight.w700,
      ),
      tabLabelTextStyle: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 10,
        fontWeight: FontWeight.w500,
      ),
    ),
  );
}
