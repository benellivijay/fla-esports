import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../models/slot_model.dart';
import '../providers/slot_booking_provider.dart';
import '../../home/models/tournament_model.dart';
import '../../profile/providers/profile_provider.dart';
import '../../auth/screens/auth_tab_screen.dart';
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
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(slotBookingProvider.notifier).fetchSlotGrid(widget.tournament.id);
      ref.read(profileProvider.notifier).fetchProfile();
    });
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
                    'You must link your Free Fire UID and Nickname to confirm tournament slot registration.',
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
    final isSquad = widget.tournament.mode == 'squad';
    final isDuo = widget.tournament.mode == 'duo';
    final selectedSlots = state.selectedSlotNumbers;

    if (isSquad && selectedSlots.length != 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please select all 4 squad player slots for your team (${selectedSlots.length}/4 selected).'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (isDuo && selectedSlots.length != 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please select both 2 duo player slots for your team (${selectedSlots.length}/2 selected).'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (!isSquad && !isDuo && selectedSlots.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please choose your match slot first.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final success = await ref.read(slotBookingProvider.notifier).bookSelectedSlot(
          tournamentId: widget.tournament.id,
        );

    if (!mounted) return;

    if (success) {
      final String successMsg;
      if (isSquad) {
        final team = ((selectedSlots.first - 1) ~/ 4) + 1;
        successMsg = 'Team $team Squad (4 slots: #${selectedSlots.join(", #")}) booked successfully!';
      } else if (isDuo) {
        final team = ((selectedSlots.first - 1) ~/ 2) + 1;
        successMsg = 'Team $team Duo (2 slots: #${selectedSlots.join(", #")}) booked successfully!';
      } else {
        successMsg = 'Slot #${selectedSlots.first} booked successfully!';
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(successMsg),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
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
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const AuthTabScreen()),
        );
      } else if (errorMsg.contains('Free Fire UID') || errorMsg.contains('FF_UID')) {
        _showQuickLinkUidDialog();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  String _getSlotLabel(int slotNumber) {
    if (widget.tournament.mode == 'squad') {
      final team = ((slotNumber - 1) ~/ 4) + 1;
      final pos = ['A', 'B', 'C', 'D'][(slotNumber - 1) % 4];
      return 'Team $team - Slot $pos (Slot #$slotNumber)';
    } else if (widget.tournament.mode == 'duo') {
      final team = ((slotNumber - 1) ~/ 2) + 1;
      final pos = ['A', 'B'][(slotNumber - 1) % 2];
      return 'Team $team - Slot $pos (Slot #$slotNumber)';
    }
    return 'Slot #$slotNumber';
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(slotBookingProvider);
    final grid = state.grid;
    final isSquad = widget.tournament.mode == 'squad';
    final isDuo = widget.tournament.mode == 'duo';
    final userSlots = grid?.currentUserBookedSlots.isNotEmpty == true 
        ? grid!.currentUserBookedSlots 
        : (grid?.currentUserBookedSlot != null ? [grid!.currentUserBookedSlot!] : <int>[]);
    final isAlreadyJoined = userSlots.isNotEmpty;

    // Determine bottom button state
    final selectedSlots = state.selectedSlotNumbers;
    final bool canConfirm;
    final String buttonLabel;
    final String? selectionInfo;

    if (isSquad) {
      canConfirm = selectedSlots.length == 4;
      if (canConfirm) {
        final team = ((selectedSlots.first - 1) ~/ 4) + 1;
        buttonLabel = 'CONFIRM SQUAD (TEAM $team - 4 SLOTS)';
        selectionInfo = 'Team $team: Slots A, B, C, D (#${selectedSlots.join(", #")})';
      } else if (selectedSlots.isNotEmpty) {
        buttonLabel = 'SELECT 4 SLOTS (${selectedSlots.length}/4)';
        selectionInfo = '${selectedSlots.length} of 4 slots selected for your squad';
      } else {
        buttonLabel = 'SELECT A SQUAD (4 SLOTS)';
        selectionInfo = null;
      }
    } else if (isDuo) {
      canConfirm = selectedSlots.length == 2;
      if (canConfirm) {
        final team = ((selectedSlots.first - 1) ~/ 2) + 1;
        buttonLabel = 'CONFIRM DUO (TEAM $team - 2 SLOTS)';
        selectionInfo = 'Team $team: Slots A, B (#${selectedSlots.join(", #")})';
      } else if (selectedSlots.isNotEmpty) {
        buttonLabel = 'SELECT 2 SLOTS (${selectedSlots.length}/2)';
        selectionInfo = '1 of 2 slots selected for your duo';
      } else {
        buttonLabel = 'SELECT A DUO (2 SLOTS)';
        selectionInfo = null;
      }
    } else {
      canConfirm = selectedSlots.length == 1;
      if (canConfirm) {
        buttonLabel = 'CONFIRM SLOT #${selectedSlots.first}';
        selectionInfo = 'Selected: Slot #${selectedSlots.first}';
      } else {
        buttonLabel = 'SELECT A SLOT';
        selectionInfo = null;
      }
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: const Color(0xFF6200EE),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isSquad 
              ? 'Select Squad (4 Slots)' 
              : isDuo 
                  ? 'Select Duo (2 Slots)' 
                  : 'Choose your match slot',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
      body: state.isLoading && grid == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6200EE), strokeWidth: 2))
          : Column(
              children: [
                // Tournament Details Header
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: const BoxDecoration(
                    color: Color(0xFFF8FAFC),
                    border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1.0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.tournament.title,
                              style: const TextStyle(
                                color: Color(0xFF0F172A),
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${_toSentenceCase(widget.tournament.mode)} • ${_toSentenceCase(widget.tournament.map)} • ${widget.tournament.isPaid ? '₹${widget.tournament.entryFee.toStringAsFixed(0)}' : 'Free Entry'}',
                              style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEDE9FE),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFDDD6FE), width: 1.0),
                        ),
                        child: Text(
                          '${grid?.availableSlotsCount ?? 0} slots left',
                          style: const TextStyle(
                            color: Color(0xFF6200EE),
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Legend Indicator Row
                Container(
                  color: const Color(0xFFF1F5F9),
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildLegendItem('Available', Colors.white, borderColor: const Color(0xFF1E293B)),
                      _buildLegendItem('Selected', const Color(0xFF2B88B8), isChecked: true),
                      _buildLegendItem('Booked', const Color(0xFFB0B0B0), isChecked: true),
                      if (isAlreadyJoined)
                        _buildLegendItem('Your slot', const Color(0xFF10B981), isChecked: true),
                    ],
                  ),
                ),

                // Main Slots Table View
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Column(
                      children: [
                        if (isAlreadyJoined) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            margin: const EdgeInsets.only(bottom: 14),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFA7F3D0), width: 1.0),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.check_circle_outline, color: Color(0xFF059669), size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    isSquad 
                                        ? 'You are already registered in Team ${((userSlots.first - 1) ~/ 4) + 1} Squad (Slots: #${userSlots.join(", #")})'
                                        : isDuo
                                            ? 'You are already registered in Team ${((userSlots.first - 1) ~/ 2) + 1} Duo (Slots: #${userSlots.join(", #")})'
                                            : 'You are already registered in ${_getSlotLabel(userSlots.first)}',
                                    style: const TextStyle(color: Color(0xFF065F46), fontWeight: FontWeight.w600, fontSize: 12),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        // Render Squad 12-Team Custom Room Table (or Duo/Solo)
                        if (widget.tournament.mode == 'squad')
                          _buildSquadTable(grid, state)
                        else if (widget.tournament.mode == 'duo')
                          _buildDuoTable(grid, state)
                        else
                          _buildSoloGrid(grid, state),
                      ],
                    ),
                  ),
                ),

                // Bottom Bar with Dynamic Confirmation Button
                if (!isAlreadyJoined)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1.0)),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (selectionInfo != null) ...[
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8.0),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.sports_esports, size: 14, color: Color(0xFF2B88B8)),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    selectionInfo,
                                    style: const TextStyle(
                                      color: Color(0xFF2B88B8),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton(
                            onPressed: state.isBooking || !canConfirm
                                ? null
                                : _handleConfirmBooking,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2B88B8),
                              disabledBackgroundColor: const Color(0xFF2B88B8).withValues(alpha: 0.35),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                              elevation: 0,
                            ),
                            child: state.isBooking
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : Text(
                                    buttonLabel,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 14,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
  // --- SQUAD 12-TEAM TABLE (Team | A | B | C | D) ---
  Widget _buildSquadTable(SlotGridModel? grid, SlotBookingState state) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.0),
      ),
      child: Column(
        children: [
          // Table Header Bar (Team | A | B | C | D)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF53627A),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Row(
              children: [
                SizedBox(
                  width: 54,
                  child: Text(
                    'Team',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
                Expanded(
                  child: Text(
                    'A',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
                Expanded(
                  child: Text(
                    'B',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
                Expanded(
                  child: Text(
                    'C',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
                Expanded(
                  child: Text(
                    'D',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 6),

          // 12 Team Rows
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 12,
            padding: const EdgeInsets.symmetric(vertical: 4),
            itemBuilder: (context, teamIndex) {
              final teamNumber = teamIndex + 1;
              final startSlot = (teamIndex * 4) + 1;
              final squadSlots = [startSlot, startSlot + 1, startSlot + 2, startSlot + 3];
              final isTeamSelected = squadSlots.every((s) => state.selectedSlotNumbers.contains(s));
              final isTeamBookedByUser = squadSlots.any((s) => 
                  (grid?.currentUserBookedSlots.contains(s) == true) || 
                  (grid?.currentUserBookedSlot == s));

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6.0, horizontal: 8.0),
                child: Row(
                  children: [
                    // Clickable Team Number (tap selects/unselects entire 4-man squad)
                    InkWell(
                      onTap: () {
                        ref.read(slotBookingProvider.notifier).selectTeam(teamNumber, mode: 'squad');
                      },
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        width: 54,
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        decoration: BoxDecoration(
                          color: isTeamSelected 
                              ? const Color(0xFF2B88B8).withValues(alpha: 0.15) 
                              : isTeamBookedByUser
                                  ? const Color(0xFF10B981).withValues(alpha: 0.15)
                                  : Colors.transparent,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isTeamSelected 
                                ? const Color(0xFF2B88B8) 
                                : isTeamBookedByUser
                                    ? const Color(0xFF10B981)
                                    : Colors.transparent,
                            width: 1.0,
                          ),
                        ),
                        child: Text(
                          '$teamNumber',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: isTeamSelected 
                                ? const Color(0xFF2B88B8) 
                                : isTeamBookedByUser
                                    ? const Color(0xFF059669)
                                    : const Color(0xFF1E293B),
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),

                    // Slot A
                    Expanded(child: Center(child: _buildSlotBox(grid, state, teamNumber, 0, 'A'))),

                    // Slot B
                    Expanded(child: Center(child: _buildSlotBox(grid, state, teamNumber, 1, 'B'))),

                    // Slot C
                    Expanded(child: Center(child: _buildSlotBox(grid, state, teamNumber, 2, 'C'))),

                    // Slot D
                    Expanded(child: Center(child: _buildSlotBox(grid, state, teamNumber, 3, 'D'))),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  // --- DUO 24-TEAM TABLE (Team | A | B) ---
  Widget _buildDuoTable(SlotGridModel? grid, SlotBookingState state) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.0),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF53627A),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Row(
              children: [
                SizedBox(
                  width: 60,
                  child: Text(
                    'Team',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
                Expanded(
                  child: Text(
                    'A',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
                Expanded(
                  child: Text(
                    'B',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 24,
            padding: const EdgeInsets.symmetric(vertical: 4),
            itemBuilder: (context, teamIndex) {
              final teamNumber = teamIndex + 1;
              final slotA = ((teamIndex) * 2) + 1;
              final slotB = ((teamIndex) * 2) + 2;
              final duoSlots = [slotA, slotB];
              final isTeamSelected = duoSlots.every((s) => state.selectedSlotNumbers.contains(s));
              final isTeamBookedByUser = duoSlots.any((s) => 
                  (grid?.currentUserBookedSlots.contains(s) == true) || 
                  (grid?.currentUserBookedSlot == s));

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6.0, horizontal: 8.0),
                child: Row(
                  children: [
                    InkWell(
                      onTap: () {
                        ref.read(slotBookingProvider.notifier).selectTeam(teamNumber, mode: 'duo');
                      },
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        width: 60,
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        decoration: BoxDecoration(
                          color: isTeamSelected 
                              ? const Color(0xFF2B88B8).withValues(alpha: 0.15) 
                              : isTeamBookedByUser
                                  ? const Color(0xFF10B981).withValues(alpha: 0.15)
                                  : Colors.transparent,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isTeamSelected 
                                ? const Color(0xFF2B88B8) 
                                : isTeamBookedByUser
                                    ? const Color(0xFF10B981)
                                    : Colors.transparent,
                            width: 1.0,
                          ),
                        ),
                        child: Text(
                          '$teamNumber',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: isTeamSelected 
                                ? const Color(0xFF2B88B8) 
                                : isTeamBookedByUser
                                    ? const Color(0xFF059669)
                                    : const Color(0xFF1E293B),
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                    Expanded(child: Center(child: _buildDirectSlotBox(grid, state, slotA, 'Team $teamNumber - Slot A'))),
                    Expanded(child: Center(child: _buildDirectSlotBox(grid, state, slotB, 'Team $teamNumber - Slot B'))),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  // --- SOLO GRID (1 to 48) ---
  Widget _buildSoloGrid(SlotGridModel? grid, SlotBookingState state) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.0),
      ),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 6,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
          childAspectRatio: 1.0,
        ),
        itemCount: grid?.slots.length ?? 48,
        itemBuilder: (context, index) {
          final slotNumber = index + 1;
          return _buildDirectSlotBox(grid, state, slotNumber, 'Slot #$slotNumber', showNumber: true);
        },
      ),
    );
  }

  // --- REUSABLE CHECKBOX SLOT BOX ---
  Widget _buildSlotBox(
    SlotGridModel? grid,
    SlotBookingState state,
    int teamNumber,
    int posIndex,
    String posLetter,
  ) {
    final slotNumber = ((teamNumber - 1) * 4) + posIndex + 1;
    final label = 'Team $teamNumber - Slot $posLetter (Slot #$slotNumber)';
    return _buildDirectSlotBox(grid, state, slotNumber, label);
  }

  Widget _buildDirectSlotBox(
    SlotGridModel? grid,
    SlotBookingState state,
    int slotNumber,
    String label, {
    bool showNumber = false,
  }) {
    SlotItemModel? slot;
    if (grid != null && grid.slots.isNotEmpty) {
      for (var s in grid.slots) {
        if (s.slotNumber == slotNumber) {
          slot = s;
          break;
        }
      }
    }

    final isSelected = state.selectedSlotNumbers.contains(slotNumber);
    final isUserSlot = (slot?.isCurrentUser == true) || 
        (grid?.currentUserBookedSlots.contains(slotNumber) == true) ||
        (grid?.currentUserBookedSlot == slotNumber);
    final isBooked = (slot?.isBooked == true) && !isUserSlot;

    return InkWell(
      onTap: isBooked
          ? () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('$label is occupied (${slot?.bookedBy ?? 'Booked'})'),
                  duration: const Duration(seconds: 1),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          : () {
              ref.read(slotBookingProvider.notifier).toggleSlot(slotNumber, mode: widget.tournament.mode);
            },
      borderRadius: BorderRadius.circular(4),
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: isUserSlot
              ? const Color(0xFF10B981)
              : isSelected
                  ? const Color(0xFF2B88B8)
                  : isBooked
                      ? const Color(0xFFB0B0B0)
                      : Colors.white,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: isUserSlot
                ? const Color(0xFF10B981)
                : isSelected
                    ? const Color(0xFF2B88B8)
                    : isBooked
                        ? const Color(0xFF9E9E9E)
                        : const Color(0xFF1E293B),
            width: 1.8,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFF2B88B8).withValues(alpha: 0.4),
                    blurRadius: 6,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Center(
          child: isUserSlot || isSelected
              ? const Icon(
                  Icons.check,
                  size: 18,
                  color: Colors.white,
                )
              : isBooked
                  ? const Icon(
                      Icons.check,
                      size: 18,
                      color: Color(0xFF616161),
                    )
                  : showNumber
                      ? Text(
                          '$slotNumber',
                          style: const TextStyle(
                            color: Color(0xFF0B0E17),
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                        )
                      : null,
        ),
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color, {Color? borderColor, bool isChecked = false}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
            border: Border.all(color: borderColor ?? color, width: 1.2),
          ),
          child: isChecked
              ? Center(
                  child: Icon(
                    Icons.check,
                    size: 12,
                    color: color == const Color(0xFFB0B0B0)
                        ? const Color(0xFF616161)
                        : Colors.white,
                  ),
                )
              : null,
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(color: Color(0xFF475569), fontSize: 11, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }

  String _toSentenceCase(String input) {
    if (input.isEmpty) return '';
    return input[0].toUpperCase() + input.substring(1).toLowerCase();
  }
}
