import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/settings/presentation/settings_screen.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    final CupertinoThemeData theme;
    switch (themeMode) {
      case ThemeModeSetting.light:
        theme = AppTheme.lightTheme;
      case ThemeModeSetting.dark:
        theme = AppTheme.darkTheme;
      case ThemeModeSetting.system:
        final brightness = MediaQuery.platformBrightnessOf(context);
        theme = brightness == Brightness.dark
            ? AppTheme.darkTheme
            : AppTheme.lightTheme;
    }

    return CupertinoApp.router(
      title: 'The Daily Athlete',
      theme: theme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
