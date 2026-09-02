import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../main.dart';
import '../providers/auth_provider.dart';

class GoogleUsernameScreen extends ConsumerStatefulWidget {
  final GoogleAccountDetails accountDetails;
  final String? initialSuggestedUsername;

  const GoogleUsernameScreen({
    super.key,
    required this.accountDetails,
    this.initialSuggestedUsername,
  });

  @override
  ConsumerState<GoogleUsernameScreen> createState() => _GoogleUsernameScreenState();
}

class _GoogleUsernameScreenState extends ConsumerState<GoogleUsernameScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _usernameController;
  final FocusNode _focusNode = FocusNode();

  Timer? _debounceTimer;
  bool _isCheckingAvailability = false;
  bool? _isAvailable;
  String? _availabilityMessage;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final defaultName = widget.initialSuggestedUsername ??
        (widget.accountDetails.displayName ?? widget.accountDetails.email.split('@')[0])
            .replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_')
            .toLowerCase();
    _usernameController = TextEditingController(text: defaultName);

    // Initial check
    if (defaultName.length >= 3) {
      _checkAvailability(defaultName);
    }

    _usernameController.addListener(_onUsernameChanged);
  }

  void _onUsernameChanged() {
    final text = _usernameController.text.trim();
    _debounceTimer?.cancel();

    if (text.length < 3) {
      setState(() {
        _isCheckingAvailability = false;
        _isAvailable = false;
        _availabilityMessage = 'Username must be at least 3 characters.';
      });
      return;
    }

    if (!RegExp(r'^[a-zA-Z0-9_]+$').hasMatch(text)) {
      setState(() {
        _isCheckingAvailability = false;
        _isAvailable = false;
        _availabilityMessage = 'Only letters, numbers, and underscores allowed.';
      });
      return;
    }

    setState(() {
      _isCheckingAvailability = true;
      _availabilityMessage = 'Checking availability...';
    });

    _debounceTimer = Timer(const Duration(milliseconds: 450), () {
      _checkAvailability(text);
    });
  }

  Future<void> _checkAvailability(String username) async {
    if (!mounted) return;
    final notifier = ref.read(authProvider.notifier);
    final available = await notifier.checkUsernameAvailable(username);

    if (mounted && _usernameController.text.trim().toLowerCase() == username.toLowerCase()) {
      setState(() {
        _isCheckingAvailability = false;
        _isAvailable = available;
        _availabilityMessage = available ? 'Username is available!' : 'Username is already taken.';
      });
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _usernameController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _submitUsername() async {
    if (!_formKey.currentState!.validate()) return;

    final username = _usernameController.text.trim().toLowerCase();
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final notifier = ref.read(authProvider.notifier);
    final result = await notifier.handleGoogleSignIn(
      chosenUsername: username,
      accountDetails: widget.accountDetails,
    );

    if (!mounted) return;

    setState(() {
      _isSubmitting = false;
    });

    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Welcome, @$username! Account setup complete.'),
          backgroundColor: AppColors.primary,
          behavior: SnackBarBehavior.floating,
        ),
      );

      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
        (route) => false,
      );
    } else {
      setState(() {
        _errorMessage = result.errorMessage ?? 'Failed to complete registration. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Choose Username',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Google Account Profile Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border, width: 1),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 54,
                            height: 54,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.primary, width: 2),
                              image: widget.accountDetails.photoUrl != null
                                  ? DecorationImage(
                                      image: NetworkImage(widget.accountDetails.photoUrl!),
                                      fit: BoxFit.cover,
                                    )
                                  : null,
                            ),
                            child: widget.accountDetails.photoUrl == null
                                ? const Icon(Icons.person, color: Colors.white, size: 30)
                                : null,
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        widget.accountDetails.displayName ?? 'Google Player',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    const Icon(Icons.verified, color: Colors.blueAccent, size: 16),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  widget.accountDetails.email,
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.7),
                                    fontSize: 13,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 28),

                    // Section Heading
                    const Text(
                      'Player Handle',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Choose your unique tournament username. This handle is displayed on leaderboards, brackets, and match rooms.',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.65),
                        fontSize: 14,
                        height: 1.4,
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Username Input Field
                    TextFormField(
                      controller: _usernameController,
                      focusNode: _focusNode,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9_]')),
                        LengthLimitingTextInputFormatter(30),
                      ],
                      decoration: InputDecoration(
                        labelText: 'Username',
                        labelStyle: TextStyle(color: Colors.white.withOpacity(0.6)),
                        hintText: 'e.g. shadow_player',
                        hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                        prefixIcon: const Icon(Icons.alternate_email, color: AppColors.primary),
                        suffixIcon: _isCheckingAvailability
                            ? const Padding(
                                padding: EdgeInsets.all(12.0),
                                child: SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.primary,
                                  ),
                                ),
                              )
                            : (_isAvailable != null
                                ? Icon(
                                    _isAvailable! ? Icons.check_circle : Icons.cancel,
                                    color: _isAvailable! ? Colors.greenAccent : Colors.redAccent,
                                  )
                                : null),
                        filled: true,
                        fillColor: AppColors.surface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide(color: AppColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide(
                            color: _isAvailable == true
                                ? Colors.greenAccent.withOpacity(0.6)
                                : (_isAvailable == false
                                    ? Colors.redAccent.withOpacity(0.6)
                                    : AppColors.border),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.primary, width: 2),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Username is required';
                        }
                        if (val.trim().length < 3) {
                          return 'Username must be at least 3 characters';
                        }
                        if (val.trim().length > 30) {
                          return 'Username cannot exceed 30 characters';
                        }
                        if (!RegExp(r'^[a-zA-Z0-9_]+$').hasMatch(val.trim())) {
                          return 'Only letters, numbers, and underscores are allowed';
                        }
                        if (_isAvailable == false) {
                          return 'This username is already taken';
                        }
                        return null;
                      },
                    ),

                    const SizedBox(height: 8),

                    // Availability Subtitle Status
                    if (_availabilityMessage != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4.0),
                        child: Row(
                          children: [
                            Icon(
                              _isAvailable == true
                                  ? Icons.check_circle_outline
                                  : (_isAvailable == false
                                      ? Icons.error_outline
                                      : Icons.info_outline),
                              size: 14,
                              color: _isAvailable == true
                                  ? Colors.greenAccent
                                  : (_isAvailable == false
                                      ? Colors.redAccent
                                      : Colors.white.withOpacity(0.6)),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                _availabilityMessage!,
                                style: TextStyle(
                                  color: _isAvailable == true
                                      ? Colors.greenAccent
                                      : (_isAvailable == false
                                          ? Colors.redAccent
                                          : Colors.white.withOpacity(0.6)),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                    const SizedBox(height: 16),

                    // Guidelines Container
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.03),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withOpacity(0.08)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Username Rules:',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.8),
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          _buildRuleItem('3 - 30 characters in length'),
                          _buildRuleItem('Letters, numbers, and underscores (_) only'),
                          _buildRuleItem('Unique identifier across all tournament matches'),
                        ],
                      ),
                    ),

                    if (_errorMessage != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.redAccent.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: Colors.redAccent, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 28),

                    // Submit Button
                    SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: (_isSubmitting || _isAvailable == false) ? null : _submitUsername,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          disabledBackgroundColor: AppColors.primary.withOpacity(0.4),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          elevation: 4,
                          shadowColor: AppColors.primary.withOpacity(0.4),
                        ),
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  color: Colors.black,
                                ),
                              )
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'Complete & Continue',
                                    style: TextStyle(
                                      color: Colors.black,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                  SizedBox(width: 8),
                                  Icon(Icons.arrow_forward, color: Colors.black, size: 20),
                                ],
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRuleItem(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 4,
            height: 4,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withOpacity(0.5),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: Colors.white.withOpacity(0.6),
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
