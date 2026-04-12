import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleSignIn() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Please enter your email and password.');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await ref.read(authStateProvider.notifier).signIn(email, password);
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleForgotPassword() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      _showAlert('Enter your email', 'Please enter your email address first.');
      return;
    }

    try {
      final repo = ref.read(authRepositoryProvider);
      await repo.sendPasswordReset(email);
      if (mounted) {
        _showAlert('Email Sent', 'Check your inbox for a password reset link.');
      }
    } catch (e) {
      if (mounted) _showAlert('Error', e.toString());
    }
  }

  void _showAlert(String title, String message) {
    showCupertinoDialog<void>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          CupertinoDialogAction(
            child: const Text('OK'),
            onPressed: () => Navigator.of(ctx).pop(),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final brightness = CupertinoTheme.of(context).brightness;
    final isDark = brightness == Brightness.dark;
    final textColor = isDark ? CupertinoColors.white : CupertinoColors.black;
    final mutedColor = CupertinoColors.systemGrey.resolveFrom(context);

    return CupertinoPageScaffold(
      child: Stack(
        children: [
          // Ambient background gradients
          Positioned(
            top: 60,
            left: -60,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  AppTheme.primaryRed.withValues(alpha: 0.1),
                  AppTheme.primaryRed.withValues(alpha: 0.0),
                ]),
              ),
            ),
          ),
          Positioned(
            bottom: 120,
            right: -40,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  const Color(0xFFFF6B00).withValues(alpha: 0.08),
                  const Color(0xFFFF6B00).withValues(alpha: 0.0),
                ]),
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                // Top bar with logo and back
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    children: [
                      CupertinoButton(
                        padding: EdgeInsets.zero,
                        onPressed: () => context.go('/welcome'),
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: textColor,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                CupertinoIcons.sportscourt,
                                color: isDark
                                    ? CupertinoColors.black
                                    : CupertinoColors.white,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'The Daily Athlete',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: textColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Form
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Logo icon
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: textColor,
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Icon(
                              CupertinoIcons.sportscourt,
                              color: isDark
                                  ? CupertinoColors.black
                                  : CupertinoColors.white,
                              size: 32,
                            ),
                          ),
                          const SizedBox(height: 16),

                          Text(
                            'WELCOME BACK',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                              color: textColor,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Sign in to The Daily Athlete',
                            style: TextStyle(fontSize: 15, color: mutedColor),
                          ),
                          const SizedBox(height: 32),

                          // Form card
                          Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: CupertinoColors.systemBackground
                                  .resolveFrom(context),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: CupertinoColors.separator
                                    .resolveFrom(context),
                                width: 0.5,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Email',
                                    style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        color: mutedColor)),
                                const SizedBox(height: 6),
                                CupertinoTextField(
                                  controller: _emailController,
                                  placeholder: 'you@example.com',
                                  keyboardType: TextInputType.emailAddress,
                                  autocorrect: false,
                                  textInputAction: TextInputAction.next,
                                  prefix: const Padding(
                                    padding: EdgeInsets.only(left: 12),
                                    child: Icon(CupertinoIcons.mail,
                                        color: CupertinoColors.systemGrey,
                                        size: 18),
                                  ),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 13),
                                  decoration: BoxDecoration(
                                    color: CupertinoColors.systemGrey6
                                        .resolveFrom(context),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                                const SizedBox(height: 18),

                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('Password',
                                        style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                            color: mutedColor)),
                                    CupertinoButton(
                                      padding: EdgeInsets.zero,
                                      minSize: 0,
                                      onPressed: _handleForgotPassword,
                                      child: Text(
                                        'Forgot password?',
                                        style: TextStyle(
                                            fontSize: 12, color: mutedColor),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                CupertinoTextField(
                                  controller: _passwordController,
                                  placeholder: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022',
                                  obscureText: true,
                                  textInputAction: TextInputAction.done,
                                  onSubmitted: (_) => _handleSignIn(),
                                  prefix: const Padding(
                                    padding: EdgeInsets.only(left: 12),
                                    child: Icon(CupertinoIcons.lock,
                                        color: CupertinoColors.systemGrey,
                                        size: 18),
                                  ),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 13),
                                  decoration: BoxDecoration(
                                    color: CupertinoColors.systemGrey6
                                        .resolveFrom(context),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),

                                if (_error != null) ...[
                                  const SizedBox(height: 14),
                                  Text(
                                    _error!,
                                    style: const TextStyle(
                                      color: CupertinoColors.destructiveRed,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],

                                const SizedBox(height: 20),

                                // Sign In button
                                SizedBox(
                                  width: double.infinity,
                                  height: 48,
                                  child: CupertinoButton(
                                    color: AppTheme.primaryRed,
                                    borderRadius: BorderRadius.circular(12),
                                    onPressed:
                                        _isLoading ? null : _handleSignIn,
                                    child: _isLoading
                                        ? const CupertinoActivityIndicator(
                                            color: CupertinoColors.white)
                                        : const Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Text(
                                                'Sign In',
                                                style: TextStyle(
                                                  color: CupertinoColors.white,
                                                  fontWeight: FontWeight.w700,
                                                  fontSize: 16,
                                                ),
                                              ),
                                              SizedBox(width: 6),
                                              Icon(CupertinoIcons.arrow_right,
                                                  color: CupertinoColors.white,
                                                  size: 16),
                                            ],
                                          ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 20),

                          // Register link
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                "Don't have an account? ",
                                style:
                                    TextStyle(fontSize: 14, color: mutedColor),
                              ),
                              CupertinoButton(
                                padding: EdgeInsets.zero,
                                minSize: 0,
                                onPressed: () => context.go('/register'),
                                child: const Text(
                                  'Sign up free',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.primaryRed,
                                  ),
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 24),

                          // Social proof
                          _SocialProof(),
                        ],
                      ),
                    ),
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

class _SocialProof extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final mutedColor = CupertinoColors.systemGrey.resolveFrom(context);

    return Column(
      children: [
        // Avatar stack
        SizedBox(
          height: 32,
          width: 120,
          child: Stack(
            children: [
              _AvatarCircle(offset: 0, color: const Color(0xFFF87171), initial: 'R'),
              _AvatarCircle(offset: 22, color: const Color(0xFF60A5FA), initial: 'K'),
              _AvatarCircle(offset: 44, color: const Color(0xFF34D399), initial: 'M'),
              _AvatarCircle(offset: 66, color: const Color(0xFFA78BFA), initial: 'J'),
              _AvatarCircle(offset: 88, color: const Color(0xFFFB923C), initial: 'S'),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text.rich(
          TextSpan(
            style: TextStyle(fontSize: 13, color: mutedColor),
            children: const [
              TextSpan(text: 'Trusted by '),
              TextSpan(
                text: '500+',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              TextSpan(text: ' athletes'),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('\u{1F3CA} Swimming',
                style: TextStyle(fontSize: 11, color: mutedColor.withValues(alpha: 0.6))),
            const SizedBox(width: 16),
            Text('\u{1F3C3} Running',
                style: TextStyle(fontSize: 11, color: mutedColor.withValues(alpha: 0.6))),
            const SizedBox(width: 16),
            Text('\u{1F6B4} Cycling',
                style: TextStyle(fontSize: 11, color: mutedColor.withValues(alpha: 0.6))),
          ],
        ),
      ],
    );
  }
}

class _AvatarCircle extends StatelessWidget {
  final double offset;
  final Color color;
  final String initial;

  const _AvatarCircle({
    required this.offset,
    required this.color,
    required this.initial,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: offset,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(
            color: CupertinoTheme.of(context).scaffoldBackgroundColor,
            width: 2,
          ),
        ),
        child: Center(
          child: Text(
            initial,
            style: const TextStyle(
              color: CupertinoColors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
