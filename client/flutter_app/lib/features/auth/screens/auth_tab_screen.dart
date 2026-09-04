import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../main.dart';
import '../models/auth_state.dart';
import '../providers/auth_provider.dart';
import 'otp_code_screen.dart';
import 'google_username_screen.dart';

class AuthTabScreen extends ConsumerStatefulWidget {
  final int initialTabIndex;

  const AuthTabScreen({super.key, this.initialTabIndex = 0});

  @override
  ConsumerState<AuthTabScreen> createState() => _AuthTabScreenState();
}

class _AuthTabScreenState extends ConsumerState<AuthTabScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Sign In Controllers
  final _signInFormKey = GlobalKey<FormState>();
  final _signInIdentifierController = TextEditingController();
  final _signInPasswordController = TextEditingController();
  bool _obscureSignInPassword = true;

  // Register Controllers
  final _registerFormKey = GlobalKey<FormState>();
  final _registerNameController = TextEditingController();
  final _registerUsernameController = TextEditingController();
  final _registerEmailController = TextEditingController();
  final _registerPasswordController = TextEditingController();
  final _registerConfirmPasswordController = TextEditingController();
  bool _obscureRegisterPassword = true;
  bool _obscureRegisterConfirmPassword = true;

  // Username validation & live availability check
  Timer? _usernameDebounceTimer;
  bool _isCheckingUsername = false;
  bool? _isUsernameAvailable;
  String? _usernameStatusMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTabIndex,
    );
    _registerUsernameController.addListener(_onRegisterUsernameChanged);
    _registerPasswordController.addListener(() => setState(() {}));
    _registerConfirmPasswordController.addListener(() => setState(() {}));
  }

  void _onRegisterUsernameChanged() {
    final text = _registerUsernameController.text.trim();
    _usernameDebounceTimer?.cancel();

    if (text.isEmpty) {
      setState(() {
        _isCheckingUsername = false;
        _isUsernameAvailable = null;
        _usernameStatusMessage = null;
      });
      return;
    }

    if (text.length < 3) {
      setState(() {
        _isCheckingUsername = false;
        _isUsernameAvailable = false;
        _usernameStatusMessage = 'Username must be at least 3 characters.';
      });
      return;
    }

    if (!RegExp(r'^[a-zA-Z0-9_]+$').hasMatch(text)) {
      setState(() {
        _isCheckingUsername = false;
        _isUsernameAvailable = false;
        _usernameStatusMessage = 'Only letters, numbers, and underscores allowed.';
      });
      return;
    }

    setState(() {
      _isCheckingUsername = true;
      _usernameStatusMessage = 'Checking availability...';
    });

    _usernameDebounceTimer = Timer(const Duration(milliseconds: 450), () {
      _checkRegisterUsername(text);
    });
  }

  Future<void> _checkRegisterUsername(String username) async {
    if (!mounted) return;
    final notifier = ref.read(authProvider.notifier);
    final available = await notifier.checkUsernameAvailable(username);

    if (mounted && _registerUsernameController.text.trim().toLowerCase() == username.toLowerCase()) {
      setState(() {
        _isCheckingUsername = false;
        _isUsernameAvailable = available;
        _usernameStatusMessage = available ? 'Username is available!' : 'Username is already taken.';
      });
    }
  }

  @override
  void dispose() {
    _usernameDebounceTimer?.cancel();
    _tabController.dispose();
    _signInIdentifierController.dispose();
    _signInPasswordController.dispose();
    _registerNameController.dispose();
    _registerUsernameController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
    _registerConfirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSignIn() async {
    if (!_signInFormKey.currentState!.validate()) return;

    final notifier = ref.read(authProvider.notifier);
    final success = await notifier.signIn(
      identifier: _signInIdentifierController.text.trim(),
      password: _signInPasswordController.text,
    );

    if (!mounted) return;

    if (success) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
        (route) => false,
      );
    } else {
      final error = ref.read(authProvider).errorMessage ?? 'Incorrect username/email or password.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _handleRegister() async {
    if (!_registerFormKey.currentState!.validate()) return;

    if (_isCheckingUsername) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Checking username availability... Please wait a moment.'),
          backgroundColor: AppColors.primary,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (_isUsernameAvailable == false) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Username is already taken. Please choose another username.'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final password = _registerPasswordController.text;
    final confirmPassword = _registerConfirmPasswordController.text;

    if (password != confirmPassword) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Passwords do not match. Please verify your confirm password.'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final name = _registerNameController.text.trim();
    final email = _registerEmailController.text.trim().toLowerCase();
    final username = _registerUsernameController.text.trim().toLowerCase();

    final notifier = ref.read(authProvider.notifier);
    final success = await notifier.register(
      name: name.isNotEmpty ? name : null,
      username: username,
      email: email,
      password: password,
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Verification code sent to $email'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => OtpCodeScreen(email: email, username: username),
        ),
      );
    } else {
      final error = ref.read(authProvider).errorMessage ?? 'Failed to send verification code. Please check your details.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _handleGoogleAuth() async {
    final notifier = ref.read(authProvider.notifier);
    final result = await notifier.handleGoogleSignIn();

    if (!mounted) return;

    if (result.success) {
      if (result.isNewUser && result.account != null) {
        // Player is signing up with Google -> Open Google profile personalization
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => GoogleUsernameScreen(
              accountDetails: result.account!,
              initialSuggestedUsername: result.suggestedUsername,
            ),
          ),
        );
      } else {
        // Returning user already has an account -> Enter app immediately
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
          (route) => false,
        );
      }
    } else if (!result.cancelled && result.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.errorMessage!),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authProvider, (previous, next) {
      if (next.status == AuthStatus.error && next.errorMessage != null) {
        // Shown via UI container
      }
    });

    final authState = ref.watch(authProvider);
    final isLoading = authState.status == AuthStatus.authenticating;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Branding Header
                  Center(
                    child: Container(
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.border, width: 1),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.35),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(19),
                        child: Image.asset(
                          'assets/images/app_logo.png',
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Icon(
                              Icons.sports_esports,
                              size: 38,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'FLA ESPORTS',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Free Fire Tournaments & Rewards',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Error Banner
                  if (authState.errorMessage != null && authState.status == AuthStatus.error) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.danger.withValues(alpha: 0.4), width: 1),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              authState.errorMessage!,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.danger,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // Segmented Tabs Header
                  Container(
                    height: 46,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: AppColors.border, width: 1),
                    ),
                    padding: const EdgeInsets.all(3),
                    child: TabBar(
                      controller: _tabController,
                      indicatorSize: TabBarIndicatorSize.tab,
                      dividerColor: Colors.transparent,
                      indicator: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.2),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      labelColor: AppColors.textPrimary,
                      unselectedLabelColor: AppColors.textSecondary,
                      labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                      unselectedLabelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                      tabs: const [
                        Tab(text: 'Sign in'),
                        Tab(text: 'Register'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Tab Views Container
                  AnimatedBuilder(
                    animation: _tabController,
                    builder: (context, _) {
                      return _tabController.index == 0
                          ? _buildSignInTab(isLoading)
                          : _buildRegisterTab(isLoading);
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // --- SIGN IN TAB ---
  Widget _buildSignInTab(bool isLoading) {
    return Form(
      key: _signInFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildTextField(
            controller: _signInIdentifierController,
            label: 'Username or Email',
            hint: 'Enter your username or email',
            prefixIcon: Icons.person_outline_rounded,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Please enter username or email';
              return null;
            },
          ),
          const SizedBox(height: 16),
          _buildTextField(
            controller: _signInPasswordController,
            label: 'Password',
            hint: 'Enter your password',
            prefixIcon: Icons.lock_outline_rounded,
            obscureText: _obscureSignInPassword,
            suffixIcon: IconButton(
              icon: Icon(
                _obscureSignInPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                size: 20,
                color: AppColors.textMuted,
              ),
              onPressed: () => setState(() => _obscureSignInPassword = !_obscureSignInPassword),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Please enter your password';
              return null;
            },
          ),
          const SizedBox(height: 14),

          // Forgot Password Link
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Please contact support or register a new account.')),
                );
              },
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
              ),
              child: const Text(
                'Forgot password?',
                style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Sign In Pill Button
          ElevatedButton(
            onPressed: isLoading ? null : _handleSignIn,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: const Color(0xFF0B0E17),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              elevation: 0,
            ),
            child: isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0B0E17)),
                  )
                : const Text('Sign In', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 20),

          _buildDivider('OR'),
          const SizedBox(height: 20),

          // Google Button
          _buildGoogleButton(
            text: 'Continue with Google',
            onPressed: isLoading ? null : _handleGoogleAuth,
          ),
        ],
      ),
    );
  }

  // --- REGISTER TAB ---
  Widget _buildRegisterTab(bool isLoading) {
    return Form(
      key: _registerFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Your Name / Display Name Input
          _buildTextField(
            controller: _registerNameController,
            label: 'Your Name',
            hint: 'e.g. Rahul Sharma',
            prefixIcon: Icons.person_outline_rounded,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Please enter your name';
              if (v.trim().length < 2) return 'Name must be at least 2 characters';
              return null;
            },
          ),
          const SizedBox(height: 16),

          // Username Input with live debounce validation & formatters
          _buildTextField(
            controller: _registerUsernameController,
            label: 'Username',
            hint: 'e.g. shadow_ninja',
            prefixIcon: Icons.alternate_email_rounded,
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9_]')),
              LengthLimitingTextInputFormatter(30),
            ],
            suffixIcon: _isCheckingUsername
                ? const Padding(
                    padding: EdgeInsets.all(12.0),
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    ),
                  )
                : _isUsernameAvailable == true
                    ? const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 20)
                    : _isUsernameAvailable == false
                        ? const Icon(Icons.cancel_rounded, color: AppColors.danger, size: 20)
                        : null,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Username is required';
              if (v.trim().length < 3) return 'Username must be at least 3 characters';
              if (!RegExp(r'^[a-zA-Z0-9_]{3,30}$').hasMatch(v.trim())) {
                return '3-30 letters, numbers or underscores only';
              }
              if (_isUsernameAvailable == false) return 'Username is already taken';
              return null;
            },
            bottomHelper: _usernameStatusMessage != null
                ? Padding(
                    padding: const EdgeInsets.only(top: 4.0, left: 4.0),
                    child: Row(
                      children: [
                        Icon(
                          _isUsernameAvailable == true
                              ? Icons.check_circle_outline_rounded
                              : _isUsernameAvailable == false
                                  ? Icons.error_outline_rounded
                                  : Icons.info_outline_rounded,
                          size: 13,
                          color: _isUsernameAvailable == true
                              ? AppColors.success
                              : _isUsernameAvailable == false
                                  ? AppColors.danger
                                  : AppColors.primary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _usernameStatusMessage!,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: _isUsernameAvailable == true
                                ? AppColors.success
                                : _isUsernameAvailable == false
                                    ? AppColors.danger
                                    : AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  )
                : null,
          ),
          const SizedBox(height: 16),
          _buildTextField(
            controller: _registerEmailController,
            label: 'Email Address',
            hint: 'name@example.com',
            prefixIcon: Icons.mail_outline_rounded,
            keyboardType: TextInputType.emailAddress,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Email is required';
              if (!v.contains('@') || !v.contains('.')) return 'Enter a valid email address';
              return null;
            },
          ),
          const SizedBox(height: 16),
          _buildTextField(
            controller: _registerPasswordController,
            label: 'Password',
            hint: 'At least 6 characters',
            prefixIcon: Icons.lock_outline_rounded,
            obscureText: _obscureRegisterPassword,
            suffixIcon: IconButton(
              icon: Icon(
                _obscureRegisterPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                size: 20,
                color: AppColors.textMuted,
              ),
              onPressed: () => setState(() => _obscureRegisterPassword = !_obscureRegisterPassword),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Password is required';
              if (v.length < 6) return 'Password must be at least 6 characters';
              return null;
            },
          ),
          const SizedBox(height: 16),

          // Confirm Password Field
          _buildTextField(
            controller: _registerConfirmPasswordController,
            label: 'Confirm Password',
            hint: 'Re-enter your password',
            prefixIcon: Icons.lock_reset_rounded,
            obscureText: _obscureRegisterConfirmPassword,
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_registerConfirmPasswordController.text.isNotEmpty)
                  Icon(
                    _registerConfirmPasswordController.text == _registerPasswordController.text
                        ? Icons.check_circle_rounded
                        : Icons.cancel_rounded,
                    size: 18,
                    color: _registerConfirmPasswordController.text == _registerPasswordController.text
                        ? AppColors.success
                        : AppColors.danger,
                  ),
                IconButton(
                  icon: Icon(
                    _obscureRegisterConfirmPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    size: 20,
                    color: AppColors.textMuted,
                  ),
                  onPressed: () => setState(() => _obscureRegisterConfirmPassword = !_obscureRegisterConfirmPassword),
                ),
              ],
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Please confirm your password';
              if (v != _registerPasswordController.text) return 'Passwords do not match';
              return null;
            },
          ),
          const SizedBox(height: 10),

          // Real-time Password Rules Checklist
          if (_registerPasswordController.text.isNotEmpty || _registerConfirmPasswordController.text.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border, width: 1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildPasswordRuleItem(
                    text: 'At least 6 characters',
                    isMet: _registerPasswordController.text.length >= 6,
                  ),
                  const SizedBox(height: 4),
                  _buildPasswordRuleItem(
                    text: 'Passwords match',
                    isMet: _registerConfirmPasswordController.text.isNotEmpty &&
                        _registerConfirmPasswordController.text == _registerPasswordController.text,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],
          const SizedBox(height: 14),

          // Send verification code Button
          ElevatedButton(
            onPressed: isLoading ? null : _handleRegister,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: const Color(0xFF0B0E17),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              elevation: 0,
            ),
            child: isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0B0E17)),
                  )
                : const Text('Send verification code', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 20),

          _buildDivider('OR'),
          const SizedBox(height: 20),

          // Sign up with Google
          _buildGoogleButton(
            text: 'Sign up with Google',
            onPressed: isLoading ? null : _handleGoogleAuth,
          ),
        ],
      ),
    );
  }

  Widget _buildPasswordRuleItem({required String text, required bool isMet}) {
    return Row(
      children: [
        Icon(
          isMet ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
          size: 14,
          color: isMet ? AppColors.success : AppColors.textMuted,
        ),
        const SizedBox(width: 6),
        Text(
          text,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: isMet ? AppColors.success : AppColors.textMuted,
          ),
        ),
      ],
    );
  }

  // Common Custom Text Field
  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData prefixIcon,
    bool obscureText = false,
    Widget? suffixIcon,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    Widget? bottomHelper,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
            filled: true,
            fillColor: AppColors.surface,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            prefixIcon: Icon(prefixIcon, size: 20, color: AppColors.textSecondary),
            suffixIcon: suffixIcon,
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.border, width: 1),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.danger, width: 1),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
            ),
          ),
          validator: validator,
        ),
        if (bottomHelper != null) bottomHelper,
      ],
    );
  }

  Widget _buildDivider(String text) {
    return Row(
      children: [
        const Expanded(child: Divider(color: AppColors.border, thickness: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textMuted,
            ),
          ),
        ),
        const Expanded(child: Divider(color: AppColors.border, thickness: 1)),
      ],
    );
  }

  Widget _buildGoogleButton({
    required String text,
    required VoidCallback? onPressed,
  }) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        padding: const EdgeInsets.symmetric(vertical: 13),
        side: const BorderSide(color: AppColors.border, width: 1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Google Colorful G Icon
          Container(
            width: 20,
            height: 20,
            alignment: Alignment.center,
            child: const Text(
              'G',
              style: TextStyle(
                fontFamily: 'Roboto',
                fontWeight: FontWeight.w900,
                fontSize: 17,
                color: Color(0xFF4285F4),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            text,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
