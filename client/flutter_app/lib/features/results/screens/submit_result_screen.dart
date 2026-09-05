import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
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
  static const String driveFolderUrl =
      'https://drive.google.com/drive/folders/11B5k-tOHXku9fN9qVXJJb7NPyZc0Gver?usp=sharing';

  int _claimedRank = 1;
  final TextEditingController _killsController = TextEditingController(text: '0');
  File? _selectedImage;
  final ImagePicker _picker = ImagePicker();
  bool _hasConfirmedVideoUpload = false;

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

  Future<void> _openDriveFolder() async {
    final uri = Uri.parse(driveFolderUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        Clipboard.setData(const ClipboardData(text: driveFolderUrl));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Drive folder link copied to clipboard!')),
        );
      }
    }
  }

  void _copyDriveFolderUrl() {
    Clipboard.setData(const ClipboardData(text: driveFolderUrl));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Google Drive folder link copied to clipboard!')),
    );
  }

  void _handleSubmit() async {
    if (_selectedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a screenshot proof of your match end screen.')),
      );
      return;
    }

    if (!_hasConfirmedVideoUpload) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFDC2626),
          content: Text(
            'Game record video is mandatory! Please save directly in the Drive folder and confirm below.',
          ),
        ),
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
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border, width: 0.5),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.shield_outlined, size: 14, color: AppColors.primary),
                          SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Auto-Purge: Screenshot proof is permanently deleted from server storage once verified by moderators.',
                              style: TextStyle(fontSize: 10, color: AppColors.textSecondary, height: 1.3),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Game Record Video (Mandatory) Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1F1206),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.6), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDC2626).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.videocam_rounded, color: Color(0xFFEF4444), size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Game Record Video is Mandatory 🎥',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Save directly to official Google Drive folder',
                                style: TextStyle(color: Color(0xFFFDE68A), fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDC2626),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'MANDATORY',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Game record video is mandatory. Save directly in this Drive folder:',
                      style: TextStyle(color: Color(0xFFFDE68A), fontSize: 12, height: 1.4),
                    ),
                    const SizedBox(height: 10),

                    // Drive Folder Box with Link
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF140D04),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3), width: 1),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.folder_shared_rounded, color: Color(0xFFF59E0B), size: 16),
                              SizedBox(width: 6),
                              Text(
                                'Official Google Drive Folder',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          InkWell(
                            onTap: _openDriveFolder,
                            child: const Text(
                              driveFolderUrl,
                              style: TextStyle(
                                color: Color(0xFF93C5FD),
                                fontSize: 11,
                                decoration: TextDecoration.underline,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Action buttons: Open Drive & Copy Link
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _openDriveFolder,
                            icon: const Icon(Icons.open_in_new_rounded, size: 16),
                            label: const Text('Open Drive Folder'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF59E0B),
                              foregroundColor: const Color(0xFF0B0E17),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton.icon(
                          onPressed: _copyDriveFolderUrl,
                          icon: const Icon(Icons.copy_rounded, size: 16),
                          label: const Text('Copy Link'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Confirmation Checkbox
                    InkWell(
                      onTap: () {
                        setState(() {
                          _hasConfirmedVideoUpload = !_hasConfirmedVideoUpload;
                        });
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              height: 22,
                              width: 22,
                              child: Checkbox(
                                value: _hasConfirmedVideoUpload,
                                onChanged: (val) {
                                  setState(() {
                                    _hasConfirmedVideoUpload = val ?? false;
                                  });
                                },
                                activeColor: const Color(0xFFF59E0B),
                                checkColor: const Color(0xFF0B0E17),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Text(
                                'I confirm that my game record video is mandatory and saved directly to this Google Drive folder.',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  height: 1.35,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
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
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Color(0xFF0B0E17), strokeWidth: 1.5))
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
          if (sub.status == 'pending_review') ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF1F1206),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.5), width: 1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.videocam_rounded, color: Color(0xFFEF4444), size: 16),
                      SizedBox(width: 6),
                      Text(
                        'Game Record Video Reminder',
                        style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Ensure your match video is uploaded directly in the Drive folder for fast moderator approval.',
                    style: TextStyle(color: Color(0xFFFDE68A), fontSize: 11, height: 1.3),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _openDriveFolder,
                      icon: const Icon(Icons.folder_shared_rounded, size: 14),
                      label: const Text('Open Drive Folder', style: TextStyle(fontSize: 12)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFF59E0B),
                        side: const BorderSide(color: Color(0xFFF59E0B)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
