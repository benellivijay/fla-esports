import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/result_provider.dart';
import '../models/result_model.dart';

class SubmitResultScreen extends ConsumerStatefulWidget {
  final String tournamentId;
  final String tournamentTitle;

  const SubmitResultScreen({
    super.key,
    required this.tournamentId,
    required this.tournamentTitle,
  });

  @override
  ConsumerState<SubmitResultScreen> createState() => _SubmitResultScreenState();
}

class _SubmitResultScreenState extends ConsumerState<SubmitResultScreen> {
  int _claimedRank = 1;
  final TextEditingController _killsController = TextEditingController(text: '0');
  File? _selectedImage;
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(resultProvider.notifier).fetchMySubmission(widget.tournamentId);
    });
  }

  @override
  void dispose() {
    _killsController.dispose();
    super.dispose();
  }

  Future<void> _pickScreenshot() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked != null) {
      setState(() {
        _selectedImage = File(picked.path);
      });
    }
  }

  void _handleSubmit() async {
    if (_selectedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a screenshot proof of your match end screen.')),
      );
      return;
    }

    final kills = int.tryParse(_killsController.text.trim()) ?? 0;

    final success = await ref.read(resultProvider.notifier).submitResult(
          tournamentId: widget.tournamentId,
          claimedRank: _claimedRank,
          claimedKills: kills,
          screenshotFile: _selectedImage,
        );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Match result submitted successfully. Awaiting admin review.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(resultProvider);
    final submission = state.mySubmission;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Submit match result'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Match', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 2),
                  Text(
                    widget.tournamentTitle,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Existing Submission Status Card
            if (submission != null) ...[
              _buildStatusCard(submission),
              const SizedBox(height: 16),
            ],

            if (submission == null || submission.status == 'rejected') ...[
              // Rank Selection Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Your placement rank',
                      style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        IconButton(
                          onPressed: _claimedRank > 1 ? () => setState(() => _claimedRank--) : null,
                          icon: const Icon(Icons.remove_circle_outline, color: AppColors.textPrimary, size: 24),
                        ),
                        Expanded(
                          child: Center(
                            child: Text(
                              'Rank #$_claimedRank ${_claimedRank == 1 ? '🏆 (Booyah)' : ''}',
                              style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: _claimedRank < 48 ? () => setState(() => _claimedRank++) : null,
                          icon: const Icon(Icons.add_circle_outline, color: AppColors.textPrimary, size: 24),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Kill Count Input Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Your total kills',
                      style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _killsController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
                      decoration: const InputDecoration(
                        labelText: 'Enter kill count (e.g. 5)',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Screenshot Picker Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Upload match end screenshot proof',
                      style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Make sure your Free Fire UID and scoreboard are clearly visible in the screenshot.',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                    const SizedBox(height: 12),

                    if (_selectedImage != null) ...[
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(
                          _selectedImage!,
                          height: 180,
                          width: double.infinity,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(height: 10),
                    ],

                    OutlinedButton.icon(
                      onPressed: _pickScreenshot,
                      icon: const Icon(Icons.add_photo_alternate_outlined, size: 16),
                      label: Text(
                        _selectedImage != null ? 'Change screenshot' : 'Choose screenshot from gallery',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Submit Pill CTA
              ElevatedButton(
                onPressed: state.isSubmitting ? null : _handleSubmit,
                child: state.isSubmitting
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5))
                    : const Text('Submit proof for review'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard(MatchResultModel sub) {
    Color statusColor = AppColors.warning;
    Color statusBg = AppColors.warningBg;
    Color statusBorder = AppColors.warningBorder;
    IconData icon = Icons.hourglass_top_rounded;
    String title = 'Pending moderator review';

    if (sub.status == 'approved') {
      statusColor = AppColors.success;
      statusBg = AppColors.successBg;
      statusBorder = AppColors.successBorder;
      icon = Icons.check_circle_outline;
      title = 'Result approved';
    } else if (sub.status == 'rejected') {
      statusColor = AppColors.danger;
      statusBg = AppColors.dangerBg;
      statusBorder = AppColors.dangerBorder;
      icon = Icons.cancel_outlined;
      title = 'Result rejected';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: statusBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusBorder, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: statusColor, size: 18),
              const SizedBox(width: 8),
              Text(title, style: TextStyle(color: statusColor, fontWeight: FontWeight.w600, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Claimed: Rank #${sub.claimedRank} • ${sub.claimedKills} kills',
            style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w500, fontSize: 13),
          ),
          if (sub.adminConfirmedRank != null) ...[
            const SizedBox(height: 4),
            Text(
              'Confirmed: Rank #${sub.adminConfirmedRank} • ${sub.adminConfirmedKills} kills',
              style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ],
          if (sub.rejectionReason != null) ...[
            const SizedBox(height: 4),
            Text(
              'Reason: ${sub.rejectionReason}',
              style: const TextStyle(color: AppColors.danger, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}
