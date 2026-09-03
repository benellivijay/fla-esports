import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/profile_provider.dart';

class KycSubmissionScreen extends ConsumerStatefulWidget {
  const KycSubmissionScreen({super.key});

  @override
  ConsumerState<KycSubmissionScreen> createState() => _KycSubmissionScreenState();
}

class _KycSubmissionScreenState extends ConsumerState<KycSubmissionScreen> {
  final TextEditingController _panController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  DateTime? _selectedDob;
  String? _documentPath;

  @override
  void dispose() {
    _panController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  void _selectDob() async {
    final now = DateTime.now();
    final maxDate = DateTime(now.year - 18, now.month, now.day);

    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(2000, 1, 1),
      firstDate: DateTime(1950),
      lastDate: maxDate,
      builder: (context, child) {
        return Theme(
          data: AppTheme.lightTheme,
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDob = picked;
      });
    }
  }

  void _pickDocument() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _documentPath = image.path;
      });
    }
  }

  void _handleSubmit() async {
    final pan = _panController.text.trim().toUpperCase();
    final name = _nameController.text.trim();

    if (pan.length != 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid 10-character PAN number.')),
      );
      return;
    }

    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your full name.')),
      );
      return;
    }

    if (_selectedDob == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select your date of birth.')),
      );
      return;
    }

    final formattedDob = DateFormat('yyyy-MM-dd').format(_selectedDob!);
    final success = await ref.read(profileProvider.notifier).submitKyc(
          panNumber: pan,
          fullName: name,
          dob: formattedDob,
          filePath: _documentPath,
        );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('KYC submitted successfully for verification.')),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('KYC verification'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: AppTheme.cardDecoration(),
              child: const Row(
                children: [
                  Icon(Icons.shield_outlined, color: AppColors.textSecondary, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Indian regulations require verification and 30% TDS compliance for real-money prize withdrawals.',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Personal details', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _nameController,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'Full name (as on identity document)',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _panController,
                    textCapitalization: TextCapitalization.characters,
                    maxLength: 10,
                    style: const TextStyle(color: AppColors.textPrimary, letterSpacing: 1.5, fontWeight: FontWeight.w600, fontSize: 13),
                    decoration: const InputDecoration(
                      counterText: '',
                      labelText: 'PAN card number (e.g. ABCDE1234F)',
                    ),
                  ),
                  const SizedBox(height: 10),
                  // DOB Selector
                  InkWell(
                    onTap: _selectDob,
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border, width: 0.5),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.calendar_today_outlined, color: AppColors.textSecondary, size: 16),
                          const SizedBox(width: 10),
                          Text(
                            _selectedDob != null ? DateFormat('dd MMMM yyyy').format(_selectedDob!) : 'Date of birth (must be 18+)',
                            style: TextStyle(
                              color: _selectedDob != null ? AppColors.textPrimary : AppColors.textMuted,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Document Photo Upload
            InkWell(
              onTap: _pickDocument,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                height: 130,
                decoration: AppTheme.cardDecoration(),
                child: Center(
                  child: _documentPath != null
                      ? const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.check_circle_outline, color: AppColors.success, size: 30),
                            SizedBox(height: 6),
                            Text('Document photo attached', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                          ],
                        )
                      : const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.upload_file_outlined, color: AppColors.textSecondary, size: 30),
                            SizedBox(height: 6),
                            Text('Upload document photo (optional)', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                          ],
                        ),
                ),
              ),
            ),
            const SizedBox(height: 20),

            if (state.errorMessage != null) ...[
              Text(
                state.errorMessage!,
                style: const TextStyle(color: AppColors.danger, fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
            ],

            ElevatedButton(
              onPressed: state.isLoading ? null : _handleSubmit,
              child: state.isLoading
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Color(0xFF0B0E17), strokeWidth: 1.5))
                  : const Text('Submit for verification'),
            ),
          ],
        ),
      ),
    );
  }
}
