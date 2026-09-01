import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/profile_provider.dart';

class FfUidVerificationScreen extends ConsumerStatefulWidget {
  const FfUidVerificationScreen({super.key});

  @override
  ConsumerState<FfUidVerificationScreen> createState() => _FfUidVerificationScreenState();
}

class _FfUidVerificationScreenState extends ConsumerState<FfUidVerificationScreen> {
  late TextEditingController _uidController;
  late TextEditingController _ignController;
  String? _selectedImagePath;

  @override
  void initState() {
    super.initState();
    final profile = ref.read(profileProvider).profile;
    _uidController = TextEditingController(text: profile?.ffUid ?? '');
    _ignController = TextEditingController(text: profile?.ffIgn ?? '');
  }

  @override
  void dispose() {
    _uidController.dispose();
    _ignController.dispose();
    super.dispose();
  }

  void _handleSave() async {
    final uid = _uidController.text.trim();
    final ign = _ignController.text.trim();

    if (uid.isEmpty || ign.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter both Free Fire UID and in-game nickname.')),
      );
      return;
    }

    final success = await ref.read(profileProvider.notifier).initiateFfVerification(
          ffUid: uid,
          ffIgn: ign,
        );

    if (success && mounted) {
      if (_selectedImagePath != null) {
        await ref.read(profileProvider.notifier).submitFfProof(filePath: _selectedImagePath!);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Free Fire ID saved and linked successfully.'),
          backgroundColor: AppColors.primary,
        ),
      );
      Navigator.pop(context);
    }
  }

  void _pickProofImage() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _selectedImagePath = image.path;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileProvider);
    final isLinked = state.profile?.ffUid != null && state.profile!.ffUid!.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Free Fire game ID'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Info Header Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: AppTheme.cardDecoration(),
              child: const Row(
                children: [
                  Icon(Icons.sports_esports_outlined, color: AppColors.textSecondary, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Link your Free Fire UID and in-game name. No diamond spending or nickname changes required.',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (isLinked) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.successBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.successBorder, width: 0.5),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Linked game account',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'UID: ${state.profile!.ffUid} • IGN: ${state.profile!.ffIgn ?? 'Not set'}',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Input Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Enter game details',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _uidController,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'Free Fire UID',
                      hintText: 'e.g. 1092837465',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _ignController,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'In-game nickname (IGN)',
                      hintText: 'Your exact Free Fire nickname',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Optional Screenshot Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'In-game profile screenshot (optional)',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Upload a screenshot of your Free Fire profile banner if you want instant verification badge.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                  ),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: _pickProofImage,
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      height: 100,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border, width: 0.5),
                      ),
                      child: Center(
                        child: _selectedImagePath != null
                            ? const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.check_circle_outline, color: AppColors.success, size: 22),
                                  SizedBox(width: 8),
                                  Text('Screenshot selected (tap to change)', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w500, fontSize: 12)),
                                ],
                              )
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.add_photo_alternate_outlined, color: AppColors.textSecondary, size: 22),
                                  SizedBox(width: 8),
                                  Text('Upload profile screenshot (optional)', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                                ],
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Save Button
            ElevatedButton(
              onPressed: state.isLoading ? null : _handleSave,
              child: state.isLoading
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5))
                  : const Text('Save Free Fire ID'),
            ),

            if (state.errorMessage != null) ...[
              const SizedBox(height: 14),
              Text(
                state.errorMessage!,
                style: const TextStyle(color: AppColors.danger, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
