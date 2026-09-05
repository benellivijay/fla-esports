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

  final Map<int, String> _cachedIgnBySlot = {};
  final Map<int, String> _cachedUidBySlot = {};

  void _showPlayerRosterSheet(List<int> selectedSlots) {
    final isSquad = widget.tournament.mode == 'squad';
    final isDuo = widget.tournament.mode == 'duo';
    final profile = ref.read(profileProvider).profile;

    final defaultTeamName = isSquad
        ? 'Team ${((selectedSlots.first - 1) ~/ 4) + 1}'
        : isDuo
            ? 'Team ${((selectedSlots.first - 1) ~/ 2) + 1}'
            : 'Team';

    final teamNameController = TextEditingController(text: defaultTeamName);
    final ignControllers = List.generate(selectedSlots.length, (_) => TextEditingController());
    final uidControllers = List.generate(selectedSlots.length, (_) => TextEditingController());

    // Pre-fill Player 1 from user profile if available
    for (int i = 0; i < selectedSlots.length; i++) {
      final slotNum = selectedSlots[i];
      if (i == 0) {
        if (profile != null) {
          final pIgn = (profile.ffIgn?.isNotEmpty == true)
              ? profile.ffIgn!
              : (profile.displayName.isNotEmpty && profile.displayName != 'Player' ? profile.displayName : '');
          ignControllers[0].text = _cachedIgnBySlot[slotNum] ?? pIgn;
          uidControllers[0].text = _cachedUidBySlot[slotNum] ?? (profile.ffUid ?? '');
        } else {
          ignControllers[0].text = _cachedIgnBySlot[slotNum] ?? '';
          uidControllers[0].text = _cachedUidBySlot[slotNum] ?? '';
        }
      } else {
        ignControllers[i].text = _cachedIgnBySlot[slotNum] ?? '';
        uidControllers[i].text = _cachedUidBySlot[slotNum] ?? '';
      }
    }

    String? modalError;
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        side: BorderSide(color: Color(0xFF334155), width: 1.0),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalContext, setModalState) {
            final bottomPadding = MediaQuery.of(modalContext).viewInsets.bottom;
            final headerTitle = isSquad
                ? 'Squad Player Details (${selectedSlots.length} Slots)'
                : isDuo
                    ? 'Duo Player Details (${selectedSlots.length} Slots)'
                    : 'Player Details (Slot #${selectedSlots.first})';

            return Padding(
              padding: EdgeInsets.only(
                bottom: bottomPadding + 16,
                left: 16,
                right: 16,
                top: 16,
              ),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(modalContext).size.height * 0.85,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header Bar
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                headerTitle,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  letterSpacing: 0.2,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Provide Free Fire Nickname & UID for each player',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.65), fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: Colors.white70, size: 22),
                          onPressed: () => Navigator.pop(modalContext),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Scrollable Player Fields
                    Flexible(
                      child: SingleChildScrollView(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Team Name Input (for Squad/Duo)
                            if (isSquad || isDuo) ...[
                              Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1E293B),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFF334155), width: 1.0),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Row(
                                      children: [
                                        Icon(Icons.shield_outlined, size: 14, color: Color(0xFF38BDF8)),
                                        SizedBox(width: 6),
                                        Text(
                                          'TEAM NAME',
                                          style: TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 11),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    TextField(
                                      controller: teamNameController,
                                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                                      decoration: InputDecoration(
                                        isDense: true,
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                                        hintText: defaultTeamName,
                                        hintStyle: const TextStyle(color: Colors.white38),
                                        filled: true,
                                        fillColor: const Color(0xFF0F172A),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(8),
                                          borderSide: const BorderSide(color: Color(0xFF475569)),
                                        ),
                                        enabledBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(8),
                                          borderSide: const BorderSide(color: Color(0xFF334155)),
                                        ),
                                        focusedBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(8),
                                          borderSide: const BorderSide(color: Color(0xFF2B88B8), width: 1.5),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            // Individual Player Cards for each selected slot
                            for (int i = 0; i < selectedSlots.length; i++) ...[
                              _buildPlayerSlotCard(
                                index: i,
                                slotNumber: selectedSlots[i],
                                isSquad: isSquad,
                                isDuo: isDuo,
                                ignController: ignControllers[i],
                                uidController: uidControllers[i],
                              ),
                              const SizedBox(height: 10),
                            ],

                            // Match Summary & Total Entry Fee Card
                            Container(
                              margin: const EdgeInsets.only(top: 4, bottom: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFF334155), width: 0.8),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.sports_esports, size: 16, color: Color(0xFF2B88B8)),
                                      const SizedBox(width: 6),
                                      Text(
                                        '${_toSentenceCase(widget.tournament.mode)} • ${_toSentenceCase(widget.tournament.map)}',
                                        style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w500),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: widget.tournament.isPaid ? const Color(0xFFF59E0B).withValues(alpha: 0.15) : const Color(0xFF10B981).withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(
                                        color: widget.tournament.isPaid ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
                                        width: 0.8,
                                      ),
                                    ),
                                    child: Text(
                                      widget.tournament.isPaid ? 'Total Fee: ₹${widget.tournament.entryFee.toStringAsFixed(0)}' : 'Free Entry',
                                      style: TextStyle(
                                        color: widget.tournament.isPaid ? const Color(0xFFF59E0B) : const Color(0xFF34D399),
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Error Box if any
                            if (modalError != null) ...[
                              Container(
                                margin: const EdgeInsets.only(bottom: 10),
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF7F1D1D).withValues(alpha: 0.6),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0xFFEF4444), width: 1.0),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.error_outline, color: Color(0xFFFCA5A5), size: 16),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        modalError!,
                                        style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 11, fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 8),

                    // Confirmation Submit Button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                setModalState(() => modalError = null);

                                // 1. Validate all player inputs
                                for (int k = 0; k < selectedSlots.length; k++) {
                                  final ign = ignControllers[k].text.trim();
                                  final uid = uidControllers[k].text.trim();
                                  final playerNum = k + 1;

                                  if (ign.isEmpty) {
                                    setModalState(() => modalError = 'Please enter Nickname (IGN) for Player $playerNum.');
                                    return;
                                  }
                                  if (uid.isEmpty) {
                                    setModalState(() => modalError = 'Please enter Free Fire UID for Player $playerNum.');
                                    return;
                                  }
                                  if (uid.length < 3) {
                                    setModalState(() => modalError = 'Free Fire UID for Player $playerNum must be at least 3 characters.');
                                    return;
                                  }
                                }

                                // 2. Cache valid entries for session
                                for (int k = 0; k < selectedSlots.length; k++) {
                                  _cachedIgnBySlot[selectedSlots[k]] = ignControllers[k].text.trim();
                                  _cachedUidBySlot[selectedSlots[k]] = uidControllers[k].text.trim();
                                }

                                // 3. Build teammates list
                                final teammates = <Map<String, dynamic>>[];
                                for (int k = 0; k < selectedSlots.length; k++) {
                                  teammates.add({
                                    'ffUid': uidControllers[k].text.trim(),
                                    'ffIgn': ignControllers[k].text.trim(),
                                  });
                                }

                                final finalTeamName = teamNameController.text.trim().isNotEmpty
                                    ? teamNameController.text.trim()
                                    : defaultTeamName;

                                setModalState(() => isSubmitting = true);

                                final success = await ref.read(slotBookingProvider.notifier).bookSelectedSlot(
                                      tournamentId: widget.tournament.id,
                                      teamName: finalTeamName,
                                      teammates: teammates,
                                    );

                                if (!mounted) return;

                                if (success) {
                                  ref.read(profileProvider.notifier).fetchProfile();
                                  if (modalContext.mounted) {
                                    Navigator.pop(modalContext);
                                  }

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

                                  if (mounted) {
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
                                  }
                                } else {
                                  setModalState(() => isSubmitting = false);
                                  final updatedState = ref.read(slotBookingProvider);
                                  final errorMsg = updatedState.errorMessage ?? 'Failed to book slot. Please try again.';

                                  if (errorMsg.contains('Authentication required') ||
                                      errorMsg.contains('Bearer token') ||
                                      errorMsg.contains('sign in')) {
                                    if (modalContext.mounted) Navigator.pop(modalContext);
                                    if (mounted) {
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
                                    }
                                  } else {
                                    setModalState(() => modalError = errorMsg);
                                  }
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2B88B8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          elevation: 0,
                        ),
                        child: isSubmitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : Text(
                                'CONFIRM & BOOK ${selectedSlots.length} SLOT${selectedSlots.length > 1 ? "S" : ""}',
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
            );
          },
        );
      },
    );
  }

  Widget _buildPlayerSlotCard({
    required int index,
    required int slotNumber,
    required bool isSquad,
    required bool isDuo,
    required TextEditingController ignController,
    required TextEditingController uidController,
  }) {
    final playerNum = index + 1;
    final String slotBadgeText;
    final String roleTag = (index == 0) ? 'Leader' : 'Teammate';

    if (isSquad) {
      final pos = ['A', 'B', 'C', 'D'][(slotNumber - 1) % 4];
      final team = ((slotNumber - 1) ~/ 4) + 1;
      slotBadgeText = 'Team $team • Slot $pos (#$slotNumber)';
    } else if (isDuo) {
      final pos = ['A', 'B'][(slotNumber - 1) % 2];
      final team = ((slotNumber - 1) ~/ 2) + 1;
      slotBadgeText = 'Team $team • Slot $pos (#$slotNumber)';
    } else {
      slotBadgeText = 'Slot #$slotNumber';
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF334155), width: 1.0),
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
                    width: 22,
                    height: 22,
                    decoration: const BoxDecoration(
                      color: Color(0xFF2B88B8),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        '$playerNum',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Player $playerNum ($slotBadgeText)',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: (index == 0) ? const Color(0xFF10B981).withValues(alpha: 0.2) : const Color(0xFF475569),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  roleTag,
                  style: TextStyle(
                    color: (index == 0) ? const Color(0xFF34D399) : Colors.white70,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              // Player In-Game Nickname
              Expanded(
                child: TextField(
                  controller: ignController,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    labelText: 'IGN (Nickname)',
                    labelStyle: const TextStyle(color: Colors.white60, fontSize: 11),
                    hintText: 'e.g. Player_$playerNum',
                    hintStyle: const TextStyle(color: Colors.white24, fontSize: 11),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFF334155))),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFF334155))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFF2B88B8))),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Player Free Fire UID
              Expanded(
                child: TextField(
                  controller: uidController,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    labelText: 'Free Fire UID',
                    labelStyle: const TextStyle(color: Colors.white60, fontSize: 11),
                    hintText: 'e.g. 1029384812',
                    hintStyle: const TextStyle(color: Colors.white24, fontSize: 11),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFF334155))),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFF334155))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFF2B88B8))),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _handleConfirmBooking() {
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

    _showPlayerRosterSheet(selectedSlots);
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
        buttonLabel = 'ENTER PLAYER DETAILS (TEAM $team - 4 SLOTS) ➔';
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
        buttonLabel = 'ENTER PLAYER DETAILS (TEAM $team - 2 SLOTS) ➔';
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
        buttonLabel = 'ENTER PLAYER DETAILS (SLOT #${selectedSlots.first}) ➔';
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
