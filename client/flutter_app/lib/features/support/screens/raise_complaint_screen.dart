import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';

class RaiseComplaintScreen extends ConsumerStatefulWidget {
  final String? initialCategory;
  final String? initialReferenceId;

  const RaiseComplaintScreen({
    super.key,
    this.initialCategory,
    this.initialReferenceId,
  });

  @override
  ConsumerState<RaiseComplaintScreen> createState() => _RaiseComplaintScreenState();
}

class _RaiseComplaintScreenState extends ConsumerState<RaiseComplaintScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _subjectController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _referenceIdController;
  late final TextEditingController _emailController;
  late final TextEditingController _usernameController;

  final List<String> _categories = [
    'Payment & Wallet Deposit',
    'Match Room & Slot Issue',
    'Prize & Withdrawal Query',
    'Hacking & Fair Play Report',
    'Account & KYC Verification',
    'Other / General Inquiry',
  ];

  late String _selectedCategory;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _selectedCategory = widget.initialCategory ?? _categories.first;
    _subjectController = TextEditingController();
    _descriptionController = TextEditingController();
    _referenceIdController = TextEditingController(text: widget.initialReferenceId ?? '');

    final user = ref.read(authProvider).user;
    _emailController = TextEditingController(text: user?.email ?? '');
    _usernameController = TextEditingController(text: user?.username ?? '');
  }

  @override
  void dispose() {
    _subjectController.dispose();
    _descriptionController.dispose();
    _referenceIdController.dispose();
    _emailController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  Future<void> _submitComplaint() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final user = ref.read(authProvider).user;
      final response = await ApiClient().dio.post(
        '/support/tickets',
        data: {
          'userId': user?.id,
          'username': _usernameController.text.trim().isNotEmpty
              ? _usernameController.text.trim()
              : (user?.username ?? 'Anonymous Player'),
          'email': _emailController.text.trim().toLowerCase(),
          'category': _selectedCategory,
          'referenceId': _referenceIdController.text.trim().isNotEmpty
              ? _referenceIdController.text.trim()
              : null,
          'subject': _subjectController.text.trim(),
          'description': _descriptionController.text.trim(),
        },
      );

      if (!mounted) return;
      setState(() => _isSubmitting = false);

      final data = response.data?['data'];
      final ticketNumber = data?['ticket']?['ticket_number'] ?? 'FLA-SUBMITTED';

      _showSuccessDialog(ticketNumber);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to submit complaint: $e'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _showSuccessDialog(String ticketNumber) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border, width: 1),
        ),
        title: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: AppColors.success, size: 24),
            SizedBox(width: 8),
            Text(
              'Complaint Submitted',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Your complaint has been submitted and assigned a tracking ticket ID. Our moderators and admin will review it shortly.',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'TICKET NUMBER',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                      ),
                      Text(
                        '#$ticketNumber',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.highlight,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy_rounded, color: AppColors.primary, size: 18),
                    tooltip: 'Copy Ticket ID',
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: '#$ticketNumber'));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Ticket ID copied to clipboard!'),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Need immediate assistance? Join our official Discord server for 24/7 priority live support.',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pop(context);
            },
            child: const Text('Close', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF5865F2),
              foregroundColor: Colors.white,
            ),
            icon: const Icon(Icons.forum_rounded, size: 16),
            label: const Text('Join Discord'),
            onPressed: () async {
              final uri = Uri.parse('https://discord.gg/w4dMrQsB7');
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
              if (ctx.mounted) {
                Navigator.of(ctx).pop();
              }
              if (mounted) {
                Navigator.of(context).pop();
              }
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Raise a Complaint', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        backgroundColor: AppColors.surface,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Info Banner
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.support_agent_rounded, color: AppColors.primary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Submit your issue with tournament details or payment UTR. Our support team typically responds within 2-4 hours.',
                        style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.3),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Category Selector
              const Text(
                'Issue Category',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedCategory,
                    isExpanded: true,
                    dropdownColor: AppColors.surface,
                    icon: const Icon(Icons.arrow_drop_down, color: AppColors.primary),
                    items: _categories.map((cat) {
                      return DropdownMenuItem(
                        value: cat,
                        child: Text(
                          cat,
                          style: const TextStyle(fontSize: 13, color: AppColors.textPrimary, fontWeight: FontWeight.w500),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedCategory = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Match / UTR Reference ID (Optional)
              const Text(
                'Match ID or Transaction Reference (Optional)',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _referenceIdController,
                style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'e.g. Match #104 or UPI Ref 429384918234',
                  hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                  filled: true,
                  fillColor: AppColors.surface,
                  prefixIcon: const Icon(Icons.tag_rounded, size: 20, color: AppColors.textSecondary),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.border, width: 1),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Subject
              const Text(
                'Subject / Headline',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _subjectController,
                style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Subject is required';
                  if (v.trim().length < 3) return 'Subject must be at least 3 characters';
                  return null;
                },
                decoration: InputDecoration(
                  hintText: 'Brief summary of the issue',
                  hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                  filled: true,
                  fillColor: AppColors.surface,
                  prefixIcon: const Icon(Icons.title_rounded, size: 20, color: AppColors.textSecondary),
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
              ),
              const SizedBox(height: 16),

              // Description
              const Text(
                'Detailed Description',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _descriptionController,
                maxLines: 5,
                style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Please provide details of your complaint';
                  if (v.trim().length < 10) return 'Please enter at least 10 characters';
                  return null;
                },
                decoration: InputDecoration(
                  hintText: 'Explain what happened, including Free Fire IGNs, timestamps, or payment details...',
                  hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                  filled: true,
                  fillColor: AppColors.surface,
                  alignLabelWithHint: true,
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
              ),
              const SizedBox(height: 16),

              // Contact Email
              const Text(
                'Contact Email Address',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Email is required';
                  if (!v.contains('@') || !v.contains('.')) return 'Enter a valid email address';
                  return null;
                },
                decoration: InputDecoration(
                  hintText: 'name@example.com',
                  hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                  filled: true,
                  fillColor: AppColors.surface,
                  prefixIcon: const Icon(Icons.mail_outline_rounded, size: 20, color: AppColors.textSecondary),
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
              ),
              const SizedBox(height: 28),

              // Submit Button
              ElevatedButton(
                onPressed: _isSubmitting ? null : _submitComplaint,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: const Color(0xFF0B0E17),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0B0E17)),
                      )
                    : const Text(
                        'Submit Complaint',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
