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
  late final TextEditingController _nameController;
  late final TextEditingController _usernameController;
  final FocusNode _nameFocusNode = FocusNode();
  final FocusNode _usernameFocusNode = FocusNode();

  Timer? _debounceTimer;
  bool _isCheckingAvailability = false;
  bool? _isAvailable;
  String? _availabilityMessage;
  bool _isSubmitting = false;
  bool _isLoadingAiTags = false;
  String? _errorMessage;

  List<String> _aiSuggestions = [];

  @override
  void initState() {
    super.initState();
    // 1. Initialize Name
    final initialName = widget.accountDetails.displayName ?? '';
    _nameController = TextEditingController(text: initialName != 'Google Player' ? initialName : '');

    // 2. Initialize Username
    String defaultHandle = widget.initialSuggestedUsername ?? '';
    if (defaultHandle.isEmpty || defaultHandle == 'google_player' || defaultHandle.startsWith('google_player_') || defaultHandle.startsWith('player_')) {
      if (initialName.isNotEmpty && initialName != 'Google Player') {
        defaultHandle = initialName.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_').toLowerCase();
      } else {
        defaultHandle = 'player_${DateTime.now().millisecondsSinceEpoch % 10000}';
      }
    }
    _usernameController = TextEditingController(text: defaultHandle);

    // Initial check
    if (defaultHandle.length >= 3) {
      _checkAvailability(defaultHandle);
    }

    _usernameController.addListener(_onUsernameChanged);
    _nameController.addListener(_onNameChanged);

    // Generate initial AI tags
    _generateAiSuggestions();
  }

  void _onNameChanged() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 600), () {
      _generateAiSuggestions();
    });
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

    _debounceTimer = Timer(const Duration(milliseconds: 400), () {
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

  Future<void> _generateAiSuggestions() async {
    if (!mounted) return;
    setState(() {
      _isLoadingAiTags = true;
    });

    final name = _nameController.text.trim().isNotEmpty
        ? _nameController.text.trim()
        : (widget.accountDetails.displayName ?? 'Player');

    // 1. Try remote AI suggestion API
    final notifier = ref.read(authProvider.notifier);
    List<String> suggestions = await notifier.fetchAiUsernames(
      name: name,
      email: widget.accountDetails.email,
    );

    // 2. On-device smart esports generator fallback
    if (suggestions.isEmpty) {
      final clean = name.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').toLowerCase();
      final base = clean.isNotEmpty ? (clean.length > 8 ? clean.substring(0, 8) : clean) : 'pro';
      suggestions = [
        'shadow_$base',
        'titan_$base',
        '${base}_sniper',
        'cyber_$base',
        'alpha_$base',
        'vortex_$base',
        '${base}_pro',
        'ghost_$base',
        '${base}_99',
        'viper_$base',
      ];
    }

    if (mounted) {
      setState(() {
        _aiSuggestions = suggestions;
        _isLoadingAiTags = false;
      });
    }
  }

  void _selectAiTag(String tag) {
    _usernameController.text = tag;
    _checkAvailability(tag);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _nameController.dispose();
    _usernameController.dispose();
    _nameFocusNode.dispose();
    _usernameFocusNode.dispose();
    super.dispose();
  }

  Future<void> _submitProfile() async {
    if (!_formKey.currentState!.validate()) return;

    final name = _nameController.text.trim();
    final username = _usernameController.text.trim().toLowerCase();

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final notifier = ref.read(authProvider.notifier);
    final result = await notifier.handleGoogleSignIn(
      chosenName: name.isNotEmpty ? name : null,
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
          content: Text('Welcome, ${name.isNotEmpty ? name : '@$username'}! Account setup complete.'),
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
          'Complete Profile',
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
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Google Account Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border, width: 1),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.35),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 52,
                            height: 52,
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
                                ? const Icon(Icons.person, color: Colors.white, size: 28)
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
                                        widget.accountDetails.displayName ?? 'Google User',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.blueAccent.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: Colors.blueAccent.withValues(alpha: 0.4)),
                                      ),
                                      child: const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.verified, color: Colors.blueAccent, size: 12),
                                          SizedBox(width: 3),
                                          Text(
                                            'Google',
                                            style: TextStyle(
                                              color: Colors.blueAccent,
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  widget.accountDetails.email,
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.65),
                                    fontSize: 12,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Section Heading
                    const Text(
                      'Personalize Your Account',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Enter your real name and customize your tournament handle below.',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.6),
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),

                    const SizedBox(height: 20),

                    // 1. YOUR NAME FIELD
                    const Text(
                      'Your Name',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _nameController,
                      focusNode: _nameFocusNode,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                      textCapitalization: TextCapitalization.words,
                      decoration: InputDecoration(
                        hintText: 'e.g. Vijay Kumar',
                        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
                        prefixIcon: const Icon(Icons.person_outline, color: AppColors.primary, size: 20),
                        filled: true,
                        fillColor: AppColors.surface,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.primary, width: 2),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Please enter your name';
                        }
                        if (val.trim().length < 2) {
                          return 'Name must be at least 2 characters';
                        }
                        return null;
                      },
                    ),

                    const SizedBox(height: 20),

                    // 2. USERNAME (GAMING TAG) FIELD
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Gaming Username',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (_isAvailable == true)
                          const Row(
                            children: [
                              Icon(Icons.check_circle, color: Colors.greenAccent, size: 14),
                              SizedBox(width: 4),
                              Text(
                                'Available',
                                style: TextStyle(
                                  color: Colors.greenAccent,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _usernameController,
                      focusNode: _usernameFocusNode,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9_]')),
                        LengthLimitingTextInputFormatter(30),
                      ],
                      decoration: InputDecoration(
                        hintText: 'e.g. shadow_player',
                        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
                        prefixIcon: const Icon(Icons.alternate_email, color: AppColors.primary, size: 20),
                        suffixIcon: _isCheckingAvailability
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
                            : (_isAvailable != null
                                ? Icon(
                                    _isAvailable! ? Icons.check_circle : Icons.cancel,
                                    color: _isAvailable! ? Colors.greenAccent : Colors.redAccent,
                                    size: 20,
                                  )
                                : null),
                        filled: true,
                        fillColor: AppColors.surface,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide(
                            color: _isAvailable == true
                                ? Colors.greenAccent.withValues(alpha: 0.6)
                                : (_isAvailable == false
                                    ? Colors.redAccent.withValues(alpha: 0.6)
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

                    if (_availabilityMessage != null) ...[
                      const SizedBox(height: 6),
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
                              size: 13,
                              color: _isAvailable == true
                                  ? Colors.greenAccent
                                  : (_isAvailable == false
                                      ? Colors.redAccent
                                      : Colors.white.withValues(alpha: 0.6)),
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
                                          : Colors.white.withValues(alpha: 0.6)),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 18),

                    // 3. AI GAMER TAG SUGGESTIONS SECTION
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.surface,
                            AppColors.surface.withBlue(35),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.35),
                          width: 1,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(5),
                                    decoration: BoxDecoration(
                                      color: AppColors.primary.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(
                                      Icons.auto_awesome,
                                      color: AppColors.primary,
                                      size: 16,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'AI Gamer Tag Suggestions',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                              InkWell(
                                onTap: _isLoadingAiTags ? null : _generateAiSuggestions,
                                borderRadius: BorderRadius.circular(8),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                  child: Row(
                                    children: [
                                      _isLoadingAiTags
                                          ? const SizedBox(
                                              width: 12,
                                              height: 12,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 1.5,
                                                color: AppColors.primary,
                                              ),
                                            )
                                          : const Icon(
                                              Icons.refresh,
                                              color: AppColors.primary,
                                              size: 14,
                                            ),
                                      const SizedBox(width: 4),
                                      const Text(
                                        'Refresh',
                                        style: TextStyle(
                                          color: AppColors.primary,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Tap any AI suggestion to automatically use it as your gaming handle:',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.55),
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _aiSuggestions.map((tag) {
                              final isSelected = _usernameController.text.trim().toLowerCase() == tag.toLowerCase();
                              return InkWell(
                                onTap: () => _selectAiTag(tag),
                                borderRadius: BorderRadius.circular(10),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? AppColors.primary
                                        : AppColors.background.withValues(alpha: 0.8),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: isSelected
                                          ? AppColors.primary
                                          : AppColors.border,
                                      width: 1,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        '✨ $tag',
                                        style: TextStyle(
                                          color: isSelected ? Colors.black : Colors.white,
                                          fontSize: 12,
                                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),

                    if (_errorMessage != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.redAccent.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.redAccent.withValues(alpha: 0.3)),
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

                    // Submit CTA Button
                    SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: (_isSubmitting || _isAvailable == false) ? null : _submitProfile,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.4),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          elevation: 4,
                          shadowColor: AppColors.primary.withValues(alpha: 0.4),
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
                                    'Complete Registration',
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
}
