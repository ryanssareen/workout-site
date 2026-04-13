import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/welcome_screen.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/settings/presentation/privacy_screen.dart';
import '../../features/settings/presentation/strava_screen.dart';
import '../../features/settings/presentation/terms_screen.dart';
import '../../features/reports/presentation/report_detail_screen.dart';
import '../../features/workouts/presentation/create_workout_screen.dart';
import '../../features/workouts/presentation/workout_detail_screen.dart';
import '../../shared/widgets/main_tab_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/',
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull ?? false;
      final isAuthRoute = state.matchedLocation == '/welcome' ||
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/register';

      if (!isLoggedIn && !isAuthRoute) {
        return '/welcome';
      }
      if (isLoggedIn && isAuthRoute) {
        return '/';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/welcome',
        pageBuilder: (context, state) => const CupertinoPage(
          child: WelcomeScreen(),
        ),
      ),
      GoRoute(
        path: '/login',
        pageBuilder: (context, state) => const CupertinoPage(
          child: LoginScreen(),
        ),
      ),
      GoRoute(
        path: '/register',
        pageBuilder: (context, state) => const CupertinoPage(
          child: RegisterScreen(),
        ),
      ),
      GoRoute(
        path: '/',
        pageBuilder: (context, state) => const CupertinoPage(
          child: MainTabScreen(),
        ),
        routes: [
          GoRoute(
            path: 'workout/:id',
            pageBuilder: (context, state) {
              final id = state.pathParameters['id']!;
              return CupertinoPage(
                child: WorkoutDetailScreen(workoutId: id),
              );
            },
          ),
          GoRoute(
            path: 'create-workout',
            pageBuilder: (context, state) {
              final dateStr = state.uri.queryParameters['date'];
              DateTime? date;
              if (dateStr != null) {
                date = DateTime.tryParse(dateStr);
              }
              return CupertinoPage(
                child: CreateWorkoutScreen(initialDate: date),
              );
            },
          ),
          GoRoute(
            path: 'profile',
            pageBuilder: (context, state) => const CupertinoPage(
              child: ProfileScreen(),
            ),
          ),
          GoRoute(
            path: 'strava',
            pageBuilder: (context, state) => const CupertinoPage(
              child: StravaScreen(),
            ),
          ),
          GoRoute(
            path: 'privacy',
            pageBuilder: (context, state) => const CupertinoPage(
              child: PrivacyScreen(),
            ),
          ),
          GoRoute(
            path: 'terms',
            pageBuilder: (context, state) => const CupertinoPage(
              child: TermsScreen(),
            ),
          ),
          GoRoute(
            path: 'report/:type',
            pageBuilder: (context, state) {
              final type = state.pathParameters['type']!;
              return CupertinoPage(
                child: ReportDetailScreen(reportType: type),
              );
            },
          ),
        ],
      ),
    ],
  );
});
