import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/slot_booking_provider.dart';
import '../../home/models/tournament_model.dart';
import '../../profile/providers/profile_provider.dart';
import '../../auth/screens/phone_login_screen.dart';
import 'my_matches_screen.dart';

class SlotPickerScreen extends ConsumerStatefulWidget {
  final TournamentModel tournament;

  const SlotPickerScreen({
    super.key,
    required this.tournament,
  });

  @override
  ConsumerState<SlotPickerScreen> createState() => _SlotPickerScreenState();
}

class _SlotPickerScreenState extends ConsumerState<SlotPickerScreen> {
  final TextEditingController _teamNameController = TextEditingController();
  final List<TextEditingController> _teammateUidControllers = [];
  final List<TextEditingController> _teammateIgnControllers = [];

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(slotBookingProvider.notifier).fetchSlotGrid(widget.tournament.id);
      ref.read(profileProvider.notifier).fetchProfile();
    });

    final requiredTeammates = widget.tournament.mode == 'squad' ? 3 : (widget.tournament.mode == 'duo' ? 1 : 0);
    for (int i = 0; i < requiredTeammates; i++) {
      _teammateUidControllers.add(TextEditingController());
      _teammateIgnControllers.add(TextEditingController());
    }
  }

  @override
  void dispose() {
    _teamNameController.dispose();
    for (var c in _teammateUidControllers) { c.dispose(); }
    for (var c in _teammateIgnControllers) { c.dispose(); }
    super.dispose();
  }

  void _showQuickLinkUidDialog() {
    final uidController = TextEditingController();
    final ignController = TextEditingController();
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
          builder: (modalContext, setModalState) {
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
                        'Link Free Fire Game ID',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.textSecondary, size: 20),
                        onPressed: () => Navigator.pop(modalContext),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'You must enter your Free Fire UID and in-game nickname to confirm tournament slot registration.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: uidController,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'Free Fire UID (e.g. 1029384812)',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: ignController,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'In-Game Nickname (IGN)',
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: isSaving
                        ? null
                        : () async {
                            final uid = uidController.text.trim();
                            final ign = ignController.text.trim();
                            if (uid.isEmpty || ign.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Please enter both UID and Nickname.')),
                              );
                              return;
                            }
                            setModalState(() => isSaving = true);
                            final linked = await ref.read(profileProvider.notifier).linkFfUid(ffUid: uid, ffIgn: ign);
                            setModalState(() => isSaving = false);
                            if (linked && mounted) {
                              if (modalContext.mounted) {
                                Navigator.pop(modalContext);
                              }
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Free Fire ID linked! Retrying slot booking...'),
                                    backgroundColor: AppColors.success,
                                  ),
                                );
                                _handleConfirmBooking();
                              }
                            } else if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Failed to link Free Fire ID. Please check details.'),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                            }
                          },
                    child: isSaving
                        ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5))
                        : const Text('Link ID & Book Slot'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _handleConfirmBooking() async {
    final state = ref.read(slotBookingProvider);
    if (state.selectedSlotNumber == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select an available slot number first.')),
      );
      return;
    }

    final teammatesList = <Map<String, dynamic>>[];
    for (int i = 0; i < _teammateUidControllers.length; i++) {
      final uid = _teammateUidControllers[i].text.trim();
      final ign = _teammateIgnControllers[i].text.trim();
      if (uid.isNotEmpty && ign.isNotEmpty) {
        teammatesList.add({'ffUid': uid, 'ffIgn': ign});
      }
    }

    final success = await ref.read(slotBookingProvider.notifier).bookSelectedSlot(
          tournamentId: widget.tournament.id,
          teamName: _teamNameController.text.trim().isEmpty ? null : _teamNameController.text.trim(),
          teammates: teammatesList.isNotEmpty ? teammatesList : null,
        );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Slot #${state.selectedSlotNumber} booked successfully!'),
          backgroundColor: AppColors.success,
        ),
      );
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const MyMatchesScreen()),
      );
    } else {
      final updatedState = ref.read(slotBookingProvider);
      final errorMsg = updatedState.errorMessage ?? 'Failed to book slot. Please try again.';

      if (errorMsg.contains('Authentication required') || errorMsg.contains('Bearer token') || errorMsg.contains('sign in')) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please sign in to confirm and join this tournament.'),
            backgroundColor: AppColors.primary,
          ),
        );
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const PhoneLoginScreen()),
        );
      } else if (errorMsg.contains('Free Fire UID') || errorMsg.contains('FF_UID')) {
        _showQuickLinkUidDialog();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(slotBookingProvider);
    final grid = state.grid;
    final isAlreadyJoined = grid?.currentUserBookedSlot != null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Select match slot'),
      ),
      body: state.isLoading && grid == null
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
          : Column(
              children: [
                // Top Header Info
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.tournament.title,
                            style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${_toSentenceCase(widget.tournament.mode)} • ${_toSentenceCase(widget.tournament.map)} • ${widget.tournament.isPaid ? '₹${widget.tournament.entryFee.toStringAsFixed(0)}' : 'Free'}',
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceMuted,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: AppColors.border, width: 0.5),
                        ),
                        child: Text(
                          '${grid?.availableSlotsCount ?? 0} slots remaining',
                          style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w500, fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                ),

                // Legend (Pill tags)
                Container(
                  color: AppColors.background,
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildLegendItem('Available', AppColors.surface, borderColor: AppColors.border),
                      _buildLegendItem('Selected', AppColors.primary),
                      _buildLegendItem('Booked', AppColors.surfaceMuted, textColor: AppColors.textMuted),
                      _buildLegendItem('Your slot', AppColors.success),
                    ],
                  ),
                ),
                const Divider(height: 1),

                // Grid View
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (isAlreadyJoined) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            margin: const EdgeInsets.only(bottom: 16),
                            decoration: BoxDecoration(
                              color: AppColors.successBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.successBorder, width: 0.5),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.check_circle_outline, color: AppColors.success, size: 18),
                                const SizedBox(width: 10),
                                Text(
                                  'You are registered in slot #${grid!.currentUserBookedSlot}',
                                  style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w600, fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                        ],

                        // Slots Grid 1..48
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 6,
                            crossAxisSpacing: 8,
                            mainAxisSpacing: 8,
                            childAspectRatio: 1.0,
                          ),
                          itemCount: grid?.slots.length ?? 0,
                          itemBuilder: (context, index) {
                            final slot = grid!.slots[index];
                            final isSelected = state.selectedSlotNumber == slot.slotNumber;
                            final isUserSlot = slot.isCurrentUser;

                            Color bg = AppColors.surface;
                            Color textColor = AppColors.textPrimary;
                            Border border = Border.all(color: AppColors.border, width: 0.5);

                            if (slot.isBooked) {
                              bg = AppColors.surfaceMuted;
                              textColor = AppColors.textMuted;
                            }
                            if (isSelected) {
                              bg = AppColors.primary;
                              textColor = Colors.white;
                              border = Border.all(color: AppColors.primary, width: 1.0);
                            }
                            if (isUserSlot) {
                              bg = AppColors.success;
                              textColor = Colors.white;
                              border = Border.all(color: AppColors.success, width: 1.0);
                            }

                            return InkWell(
                              onTap: slot.isBooked
                                  ? () {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text('Slot #${slot.slotNumber} is booked (${slot.bookedBy ?? 'Occupied'})'),
                                          duration: const Duration(seconds: 1),
                                        ),
                                      );
                                    }
                                  : () => ref.read(slotBookingProvider.notifier).selectSlot(slot.slotNumber),
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: bg,
                                  borderRadius: BorderRadius.circular(8),
                                  border: border,
                                ),
                                child: Center(
                                  child: Text(
                                    '${slot.slotNumber}',
                                    style: TextStyle(
                                      color: textColor,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),

                        // Multi-player format inputs (Duo / Squad)
                        if (widget.tournament.mode != 'solo' && !isAlreadyJoined) ...[
                          const SizedBox(height: 20),
                          const Text(
                            'Team information',
                            style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _teamNameController,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(
                              labelText: 'Team or clan name',
                            ),
                          ),
                          const SizedBox(height: 12),
                          for (int i = 0; i < _teammateUidControllers.length; i++) ...[
                            Text(
                              'Teammate #${i + 2}',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _teammateUidControllers[i],
                                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                                    decoration: const InputDecoration(
                                      labelText: 'Free Fire UID',
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: TextField(
                                    controller: _teammateIgnControllers[i],
                                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                                    decoration: const InputDecoration(
                                      labelText: 'In-game nickname',
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                          ],
                        ],

                        if (state.errorMessage != null) ...[
                          const SizedBox(height: 12),
                          Text(
                            state.errorMessage!,
                            style: const TextStyle(color: AppColors.danger, fontSize: 12),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ],
                    ),
                  ),
                ),

                // Bottom Bar with Pill CTA
                if (!isAlreadyJoined)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: const BoxDecoration(
                      color: AppColors.surface,
                      border: Border(top: BorderSide(color: AppColors.border, width: 0.5)),
                    ),
                    child: Row(
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Selected slot', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                            Text(
                              state.selectedSlotNumber != null ? 'Slot #${state.selectedSlotNumber}' : 'None selected',
                              style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                            ),
                          ],
                        ),
                        const Spacer(),
                        ElevatedButton(
                          onPressed: state.isBooking || state.selectedSlotNumber == null
                              ? null
                              : _handleConfirmBooking,
                          child: state.isBooking
                              ? const SizedBox(
                                  height: 16,
                                  width: 16,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5),
                                )
                              : Text(
                                  widget.tournament.isPaid 
                                      ? 'Pay ₹${widget.tournament.entryFee.toStringAsFixed(0)} and book' 
                                      : 'Confirm free slot',
                                ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _buildLegendItem(String label, Color color, {Color? borderColor, Color? textColor}) {
    return Row(
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
            border: borderColor != null ? Border.all(color: borderColor, width: 0.5) : null,
          ),
        ),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(color: textColor ?? AppColors.textSecondary, fontSize: 11)),
      ],
    );
  }

  String _toSentenceCase(String input) {
    if (input.isEmpty) return '';
    return input[0].toUpperCase() + input.substring(1).toLowerCase();
  }
}
