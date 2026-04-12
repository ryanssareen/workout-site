import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../features/auth/providers/auth_provider.dart';
import '../../../models/user.dart';

/// Theme mode state — persisted via SharedPreferences.
final themeModeProvider =
    StateNotifierProvider<ThemeModeNotifier, ThemeModeSetting>((ref) {
  return ThemeModeNotifier();
});

enum ThemeModeSetting { light, dark, system }

class ThemeModeNotifier extends StateNotifier<ThemeModeSetting> {
  ThemeModeNotifier() : super(ThemeModeSetting.system);

  void setMode(ThemeModeSetting mode) => state = mode;
}

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(currentUserProvider);
    final themeMode = ref.watch(themeModeProvider);

    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Settings'),
      ),
      child: SafeArea(
        child: ListView(
          children: [
            const SizedBox(height: 20),

            // Profile section
            userAsync.when(
              data: (user) => _ProfileHeader(user: user),
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CupertinoActivityIndicator()),
              ),
              error: (_, __) => const SizedBox.shrink(),
            ),

            const SizedBox(height: 24),

            // Account
            CupertinoListSection.insetGrouped(
              header: const Text('ACCOUNT'),
              children: [
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.person),
                  title: const Text('Profile'),
                  trailing: const CupertinoListTileChevron(),
                  onTap: () => context.push('/profile'),
                ),
              ],
            ),

            // Integrations
            CupertinoListSection.insetGrouped(
              header: const Text('INTEGRATIONS'),
              children: [
                CupertinoListTile(
                  leading: Icon(CupertinoIcons.link,
                      color: const Color(0xFFFC4C02)),
                  title: const Text('Strava'),
                  additionalInfo: userAsync.whenOrNull(
                    data: (u) => Text(
                      u?.stravaConnected == true ? 'Connected' : 'Not connected',
                    ),
                  ),
                  trailing: const CupertinoListTileChevron(),
                  onTap: () => context.push('/strava'),
                ),
              ],
            ),

            // Appearance
            CupertinoListSection.insetGrouped(
              header: const Text('APPEARANCE'),
              children: [
                CupertinoListTile(
                  leading: Icon(
                    themeMode == ThemeModeSetting.dark
                        ? CupertinoIcons.moon_fill
                        : themeMode == ThemeModeSetting.light
                            ? CupertinoIcons.sun_max_fill
                            : CupertinoIcons.circle_lefthalf_fill,
                  ),
                  title: const Text('Theme'),
                  trailing: CupertinoSlidingSegmentedControl<ThemeModeSetting>(
                    groupValue: themeMode,
                    onValueChanged: (v) {
                      if (v != null) {
                        ref.read(themeModeProvider.notifier).setMode(v);
                      }
                    },
                    children: const {
                      ThemeModeSetting.light: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4),
                        child: Icon(CupertinoIcons.sun_max_fill, size: 16),
                      ),
                      ThemeModeSetting.dark: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4),
                        child: Icon(CupertinoIcons.moon_fill, size: 16),
                      ),
                      ThemeModeSetting.system: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4),
                        child: Icon(CupertinoIcons.circle_lefthalf_fill,
                            size: 16),
                      ),
                    },
                  ),
                ),
              ],
            ),

            // About / Legal
            CupertinoListSection.insetGrouped(
              header: const Text('ABOUT'),
              children: [
                const CupertinoListTile(
                  leading: Icon(CupertinoIcons.info),
                  title: Text('Version'),
                  additionalInfo: Text('1.0.0'),
                ),
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.shield),
                  title: const Text('Privacy Policy'),
                  trailing: const CupertinoListTileChevron(),
                  onTap: () => context.push('/privacy'),
                ),
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.doc_text),
                  title: const Text('Terms of Service'),
                  trailing: const CupertinoListTileChevron(),
                  onTap: () => context.push('/terms'),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Sign out
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: CupertinoButton(
                color: CupertinoColors.destructiveRed,
                borderRadius: BorderRadius.circular(14),
                onPressed: () => _handleSignOut(context, ref),
                child: const Text('Sign Out'),
              ),
            ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  void _handleSignOut(BuildContext context, WidgetRef ref) {
    showCupertinoDialog<void>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          CupertinoDialogAction(
            isDefaultAction: true,
            child: const Text('Cancel'),
            onPressed: () => Navigator.of(ctx).pop(),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            child: const Text('Sign Out'),
            onPressed: () {
              Navigator.of(ctx).pop();
              ref.read(authStateProvider.notifier).signOut();
              context.go('/welcome');
            },
          ),
        ],
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  final User? user;
  const _ProfileHeader({required this.user});

  @override
  Widget build(BuildContext context) {
    if (user == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppTheme.primaryRed.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                (user!.displayName?.isNotEmpty == true
                        ? user!.displayName![0]
                        : user!.username[0])
                    .toUpperCase(),
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.primaryRed,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user!.displayName ?? user!.username,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '@${user!.username}',
                  style: TextStyle(
                    fontSize: 14,
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
