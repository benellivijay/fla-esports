import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../auth/screens/auth_tab_screen.dart';
import '../providers/profile_provider.dart';
import 'ff_uid_verification_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  void _showVerifyIdentifierDialog(BuildContext context, WidgetRef ref, {required String type}) {
    final identifierController = TextEditingController();
    final otpController = TextEditingController();
    bool otpSent = false;
    bool isProcessing = false;
    String? errorMsg;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        side: BorderSide(color: AppColors.border, width: 0.5),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalContext, setState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(modalContext).viewInsets.bottom + 20,
                left: 20,
                right: 20,
                top: 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Verify ${type == 'phone' ? 'phone number' : 'email address'}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.textSecondary, size: 20),
                        onPressed: () => Navigator.pop(modalContext),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Complete ${type == 'phone' ? 'phone' : 'email'} verification to unlock the KYC verified badge for tournaments and withdrawals.',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 14),

                  if (!otpSent) ...[
                    TextField(
                      controller: identifierController,
                      keyboardType: type == 'phone' ? TextInputType.phone : TextInputType.emailAddress,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: InputDecoration(
                        labelText: type == 'phone' ? 'Mobile number' : 'Email address',
                      ),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton(
                      onPressed: isProcessing
                          ? null
                          : () async {
                              final text = identifierController.text.trim();
                              if (text.isEmpty) return;
                              setState(() {
                                isProcessing = true;
                                errorMsg = null;
                              });
                              final sent = await ref.read(profileProvider.notifier).sendSecondaryOtp(identifier: text, type: type);
                              setState(() {
                                isProcessing = false;
                                if (sent) {
                                  otpSent = true;
                                } else {
                                  errorMsg = 'Failed to send OTP. Please try again.';
                                }
                              });
                            },
                      child: isProcessing
                          ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5))
                          : const Text('Send verification OTP'),
                    ),
                  ] else ...[
                    TextField(
                      controller: otpController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, letterSpacing: 6, fontWeight: FontWeight.w700),
                      decoration: const InputDecoration(
                        counterText: '',
                        hintText: '• • • • • •',
                      ),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton(
                      onPressed: isProcessing
                          ? null
                          : () async {
                              final otp = otpController.text.trim();
                              if (otp.length != 6) return;
                              setState(() {
                                isProcessing = true;
                                errorMsg = null;
                              });
                              final verified = await ref.read(profileProvider.notifier).verifySecondary(
                                    identifier: identifierController.text.trim(),
                                    otpCode: otp,
                                    type: type,
                                  );
                              if (verified && modalContext.mounted) {
                                Navigator.pop(modalContext);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Verification successful. KYC status updated.')),
                                );
                              } else {
                                setState(() {
                                  isProcessing = false;
                                  errorMsg = 'Invalid OTP code. Please retry.';
                                });
                              }
                            },
                      child: isProcessing
                          ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5))
                          : const Text('Verify OTP and complete KYC'),
                    ),
                  ],

                  if (errorMsg != null) ...[
                    const SizedBox(height: 10),
                    Text(errorMsg!, style: const TextStyle(color: AppColors.danger, fontSize: 12), textAlign: TextAlign.center),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showEditNameDialog(BuildContext context, WidgetRef ref, String currentName) {
    final controller = TextEditingController(text: currentName);
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        side: BorderSide(color: AppColors.border, width: 0.5),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalContext, setState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(modalContext).viewInsets.bottom + 20,
                left: 20,
                right: 20,
                top: 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Edit Profile Name',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.textSecondary, size: 20),
                        onPressed: () => Navigator.pop(modalContext),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    textCapitalization: TextCapitalization.words,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                    decoration: const InputDecoration(
                      labelText: 'Your Name',
                      hintText: 'Enter your name',
                      prefixIcon: Icon(Icons.person_outline_rounded, size: 18),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: isSaving
                        ? null
                        : () async {
                            final newName = controller.text.trim();
                            if (newName.isEmpty) return;
                            setState(() => isSaving = true);
                            final ok = await ref.read(profileProvider.notifier).updateDisplayName(newName);
                            if (ok && modalContext.mounted) {
                              Navigator.pop(modalContext);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Profile name updated successfully!'),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                            } else if (modalContext.mounted) {
                              setState(() => isSaving = false);
                            }
                          },
                    child: isSaving
                        ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5))
                        : const Text('Save Name'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileState = ref.watch(profileProvider);
    final profile = profileState.profile;
    final kyc = profileState.kyc;
    final isKycVerified = kyc?.isKycVerified ?? false;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('My profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, size: 20),
            tooltip: 'Logout',
            onPressed: () => _confirmLogout(context, ref),
          )
        ],
      ),
      body: profileState.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
          : RefreshIndicator(
              onRefresh: () => ref.read(profileProvider.notifier).fetchProfileAndKyc(),
              color: AppColors.primary,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Profile Header Card (12px rounded, 0.5px border)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: AppTheme.cardDecoration(),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              const CircleAvatar(
                                radius: 28,
                                backgroundColor: AppColors.surfaceMuted,
                                child: Icon(Icons.person_outline_rounded, size: 30, color: AppColors.textPrimary),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          profile?.displayName ?? 'Player',
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        if (isKycVerified)
                                          const Icon(Icons.verified, color: AppColors.success, size: 18),
                                        const SizedBox(width: 6),
                                        InkWell(
                                          onTap: () => _showEditNameDialog(
                                            context,
                                            ref,
                                            profile?.displayName ?? '',
                                          ),
                                          borderRadius: BorderRadius.circular(999),
                                          child: Container(
                                            padding: const EdgeInsets.all(3),
                                            decoration: BoxDecoration(
                                              color: AppColors.surfaceMuted,
                                              shape: BoxShape.circle,
                                              border: Border.all(color: AppColors.border, width: 0.5),
                                            ),
                                            child: const Icon(
                                              Icons.edit_outlined,
                                              size: 13,
                                              color: AppColors.textSecondary,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      profile?.ffIgn != null ? '${profile!.ffIgn} (${profile.ffUid})' : 'Free Fire UID not linked',
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          const Divider(height: 1),
                          const SizedBox(height: 12),

                          // Verified Status Strip
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              _buildVerificationBadge(
                                label: 'Email',
                                isVerified: kyc?.isEmailVerified ?? false,
                                verifiedIcon: Icons.email_outlined,
                              ),
                              _buildVerificationBadge(
                                label: 'Free Fire',
                                isVerified: profile?.ffVerificationStatus == 'verified',
                                verifiedIcon: Icons.sports_esports_outlined,
                              ),
                              _buildVerificationBadge(
                                label: 'KYC status',
                                isVerified: isKycVerified,
                                verifiedIcon: Icons.shield_outlined,
                                verifiedText: 'Verified',
                                unverifiedText: 'Pending',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Stats Grid
                    Row(
                      children: [
                        _buildStatCard('Played', '${profile?.matchesPlayed ?? 0}', Icons.gamepad_outlined),
                        const SizedBox(width: 8),
                        _buildStatCard('Wins', '${profile?.wins ?? 0}', Icons.emoji_events_outlined),
                        const SizedBox(width: 8),
                        _buildStatCard('Kills', '${profile?.totalKills ?? 0}', Icons.flash_on_outlined),
                        const SizedBox(width: 8),
                        _buildStatCard('Earnings', '₹${profile?.totalEarnings.toStringAsFixed(0) ?? 0}', Icons.account_balance_wallet_outlined),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // KYC Verification Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: AppTheme.cardDecoration(),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                isKycVerified ? Icons.verified_user_outlined : Icons.shield_outlined,
                                color: isKycVerified ? AppColors.success : AppColors.warning,
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'KYC verification',
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                              ),
                              const Spacer(),
                              _buildPillTag(
                                isKycVerified ? 'Verified' : 'Action required',
                                isKycVerified ? AppColors.success : AppColors.warning,
                                isKycVerified ? AppColors.successBg : AppColors.warningBg,
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            isKycVerified
                                ? 'Your email address is verified. Your account KYC is complete and verified.'
                                : 'Verify your email address to automatically complete KYC verification.',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                          ),
                          const SizedBox(height: 12),

                          // Status of email
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceMuted,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.border, width: 0.5),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  kyc?.isEmailVerified == true ? Icons.check_circle : Icons.radio_button_unchecked,
                                  color: kyc?.isEmailVerified == true ? AppColors.success : AppColors.textMuted,
                                  size: 16,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Email: ${kyc?.email ?? 'Not linked'}',
                                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                                ),
                                const Spacer(),
                                if (kyc?.isEmailVerified != true)
                                  TextButton(
                                    onPressed: () => _showVerifyIdentifierDialog(context, ref, type: 'email'),
                                    child: const Text('Verify email', style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600)),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Free Fire UID Verification Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: AppTheme.cardDecoration(),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                profile?.isFfVerified == true ? Icons.sports_esports : Icons.sports_esports_outlined,
                                color: profile?.isFfVerified == true ? AppColors.success : AppColors.textSecondary,
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'Free Fire UID verification',
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                              ),
                              const Spacer(),
                              _buildPillTag(
                                _toSentenceCase(profile?.ffVerificationStatus ?? 'unverified'),
                                profile?.isFfVerified == true ? AppColors.success : AppColors.warning,
                                profile?.isFfVerified == true ? AppColors.successBg : AppColors.warningBg,
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            profile?.isFfVerified == true
                                ? 'Your Free Fire ID is linked (${profile?.ffUid ?? ''} • ${profile?.ffIgn ?? ''}).'
                                : 'Link your in-game Free Fire UID and nickname to join matches.',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const FfUidVerificationScreen()),
                              );
                            },
                            child: Text(profile?.isFfVerified == true ? 'Update Free Fire ID' : 'Link Free Fire game ID'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Log Out Action Card
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: AppTheme.cardDecoration(),
                      child: ListTile(
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.danger.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.logout_rounded, color: AppColors.danger, size: 18),
                        ),
                        title: const Text(
                          'Log out of account',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.danger,
                          ),
                        ),
                        subtitle: const Text(
                          'Sign out of your player session on this device',
                          style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
                        onTap: () => _confirmLogout(context, ref),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
    );
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text(
          'Log out',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        content: const Text(
          'Are you sure you want to log out of FLA ESPORTS?',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(dialogCtx);
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => const AuthTabScreen()),
                  (route) => false,
                );
              }
            },
            child: const Text('Log out'),
          ),
        ],
      ),
    );
  }

  Widget _buildVerificationBadge({
    required String label,
    required bool isVerified,
    required IconData verifiedIcon,
    String? verifiedText,
    String? unverifiedText,
  }) {
    return Column(
      children: [
        Icon(
          isVerified ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
          color: isVerified ? AppColors.success : AppColors.textMuted,
          size: 18,
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
        ),
        Text(
          isVerified ? (verifiedText ?? 'Verified') : (unverifiedText ?? 'Unverified'),
          style: TextStyle(
            fontSize: 10,
            color: isVerified ? AppColors.success : AppColors.textMuted,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: AppTheme.cardDecoration(),
        child: Column(
          children: [
            Icon(icon, size: 18, color: AppColors.textSecondary),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 2),
            Text(title, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }

  Widget _buildPillTag(String text, Color textColor, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: textColor,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  String _toSentenceCase(String input) {
    if (input.isEmpty) return '';
    return input[0].toUpperCase() + input.substring(1).toLowerCase();
  }
}
