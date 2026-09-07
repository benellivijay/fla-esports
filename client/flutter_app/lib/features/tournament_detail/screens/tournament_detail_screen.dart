import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../home/models/tournament_model.dart';
import '../../match_slot/screens/slot_picker_screen.dart';
import '../../auth/providers/auth_provider.dart';

class TournamentDetailScreen extends ConsumerStatefulWidget {
  final String tournamentId;

  const TournamentDetailScreen({
    super.key,
    required this.tournamentId,
  });

  @override
  ConsumerState<TournamentDetailScreen> createState() => _TournamentDetailScreenState();
}

class _TournamentDetailScreenState extends ConsumerState<TournamentDetailScreen> {
  final ApiClient _apiClient = ApiClient();
  TournamentModel? _tournament;
  bool _isLoading = true;
  String? _errorMessage;

  final TextEditingController _adminRoomIdController = TextEditingController();
  final TextEditingController _adminRoomPassController = TextEditingController();
  bool _isSavingRoom = false;
  bool _isReleasingRoom = false;

  @override
  void initState() {
    super.initState();
    _fetchTournamentDetails();
  }

  @override
  void dispose() {
    _adminRoomIdController.dispose();
    _adminRoomPassController.dispose();
    super.dispose();
  }

  Future<void> _fetchTournamentDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _apiClient.dio.get('/tournaments/${widget.tournamentId}');
      if (res.statusCode == 200 && res.data['success'] == true) {
        final loaded = TournamentModel.fromJson(res.data['data']);
        setState(() {
          _tournament = loaded;
          _isLoading = false;
          _adminRoomIdController.text = loaded.roomId ?? '';
          _adminRoomPassController.text = loaded.roomPassword ?? '';
        });
      } else {
        setState(() {
          _errorMessage = 'Tournament not found.';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = (e as dynamic).response?.data?['message'] ?? 'Failed to load tournament details.';
        _isLoading = false;
      });
    }
  }

  Future<void> _handleSaveRoom({bool forceUpdate = false}) async {
    final roomId = _adminRoomIdController.text.trim();
    final roomPass = _adminRoomPassController.text.trim();

    if (roomId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a room ID.')),
      );
      return;
    }

    setState(() => _isSavingRoom = true);
    try {
      final res = await _apiClient.dio.patch(
        '/admin/tournaments/${widget.tournamentId}/room',
        data: {
          'roomId': roomId,
          'roomPassword': roomPass.isEmpty ? null : roomPass,
          'forceUpdateAfterStart': forceUpdate,
        },
      );

      if (res.statusCode == 200 && res.data['data'] != null) {
        setState(() {
          _tournament = TournamentModel.fromJson(res.data['data']);
          _isSavingRoom = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Room credentials updated successfully.')),
          );
        }
      }
    } catch (e) {
      setState(() => _isSavingRoom = false);
      final code = (e as dynamic).response?.data?['code'];
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to update room.';

      if (code == 'MATCH_ALREADY_STARTED') {
        _showForceUpdateDialog();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    }
  }

  void _showForceUpdateDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border, width: 0.5),
        ),
        title: const Text('Match already started', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
        content: const Text(
          'This match is already in progress and the room was previously released. Overwriting room credentials will notify all players of the emergency lobby change. Do you want to force update?',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _handleSaveRoom(forceUpdate: true);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            child: const Text('Force update'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleReleaseRoomNow() async {
    setState(() => _isReleasingRoom = true);
    try {
      final res = await _apiClient.dio.post('/tournaments/${widget.tournamentId}/reveal-now');
      setState(() => _isReleasingRoom = false);

      if (res.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Room released to all players.')),
          );
        }
        _fetchTournamentDetails();
      }
    } catch (e) {
      setState(() => _isReleasingRoom = false);
      final msg = (e as dynamic).response?.data?['message'] ?? 'Failed to release room.';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2)),
      );
    }

    if (_tournament == null || _errorMessage != null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('Tournament details')),
        body: Center(
          child: Text(
            _errorMessage ?? 'Tournament not found.',
            style: const TextStyle(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    final t = _tournament!;
    final formattedDate = DateFormat('EEEE, d MMMM yyyy • h:mm a').format(t.startTime.toLocal());

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.title),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Overview Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _buildPillTag(_toSentenceCase(t.mode), AppColors.textSecondary, AppColors.surfaceMuted),
                      const SizedBox(width: 6),
                      _buildPillTag(_toSentenceCase(t.map), AppColors.textSecondary, AppColors.surfaceMuted),
                      const SizedBox(width: 6),
                      _buildPillTag(
                        t.isPaid ? 'Entry ₹${t.entryFee.toStringAsFixed(0)}' : 'Free entry',
                        t.isPaid ? AppColors.textPrimary : AppColors.success,
                        t.isPaid ? AppColors.surfaceMuted : AppColors.successBg,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    t.title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.calendar_today_outlined, color: AppColors.textMuted, size: 14),
                      const SizedBox(width: 6),
                      Text(formattedDate, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 14),
                  // Progress Fill Bar
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Slots filled: ${t.filledSlots}/${t.maxSlots}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          Text(
                            '${t.availableSlots} remaining',
                            style: TextStyle(
                              color: t.availableSlots <= 5 ? AppColors.danger : AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: t.maxSlots > 0 ? (t.filledSlots / t.maxSlots).clamp(0.0, 1.0) : 0.0,
                          backgroundColor: AppColors.surfaceMuted,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            t.isFull ? AppColors.danger : AppColors.primary,
                          ),
                          minHeight: 5,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Prize Distribution Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Prize pool breakdown',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      ),
                      Text(
                        t.isPaid ? '₹${t.prizePool.toStringAsFixed(0)}' : '${t.prizePool.toStringAsFixed(0)} Coins',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.highlight),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  if (t.prizeDistribution.isNotEmpty) ...[
                    Table(
                      columnWidths: const {
                        0: FlexColumnWidth(2),
                        1: FlexColumnWidth(2),
                        2: FlexColumnWidth(2),
                      },
                      children: [
                        const TableRow(
                          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5))),
                          children: [
                            Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text('Rank', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w600))),
                            Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text('Share', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w600))),
                            Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text('Prize', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w600))),
                          ],
                        ),
                        ...t.prizeDistribution.map(
                          (item) => TableRow(
                            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5))),
                            children: [
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                child: Text('Rank #${item.rank}', style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w500, fontSize: 13)),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                child: Text(item.percentage != null ? '${item.percentage}%' : '-', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                child: Text(
                                  t.isPaid ? '₹${item.amount.toStringAsFixed(0)}' : '${item.amount.toStringAsFixed(0)} Coins',
                                  style: const TextStyle(color: AppColors.highlight, fontWeight: FontWeight.w600, fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],

                  if (t.perKillPrize > 0) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border, width: 0.5),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Kill bounty', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                          Text('₹${t.perKillPrize.toStringAsFixed(0)} / kill', style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Room Credentials & Admin Management Card
            _buildRoomCredentialsCard(t),
            const SizedBox(height: 12),

            // Rules & Guidelines
            Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Rules and guidelines', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  Text(
                    t.rules ?? '1. Emulators and PC players are strictly prohibited.\n2. Hacks, scripts, and third-party tools lead to an immediate ban.\n3. Screenshot of results must be submitted within 15 minutes after match.\n4. Game recording is mandatory. Winning players must save their recording directly in our Google Drive folder or send to Support Gmail.',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.5),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Bottom CTA Pill Button
            ElevatedButton(
              onPressed: (t.isFull || t.isCompleted || t.isCancelled)
                  ? null
                  : () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => SlotPickerScreen(tournament: t),
                        ),
                      );
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                disabledBackgroundColor: AppColors.surfaceMuted,
                disabledForegroundColor: AppColors.textMuted,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(
                t.isCompleted
                    ? 'Tournament completed'
                    : t.isCancelled
                        ? 'Tournament cancelled'
                        : t.isFull 
                            ? 'Match full' 
                            : t.isPaid 
                                ? 'Select slot and join (₹${t.entryFee.toStringAsFixed(0)})' 
                                : 'Select free slot',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoomCredentialsCard(TournamentModel t) {
    final authState = ref.watch(authProvider);
    final isAdmin = authState.user?.role == 'admin' || authState.user?.role == 'moderator';

    if (isAdmin) {
      return _buildAdminRoomManagementCard(t);
    }

    // Player View
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                t.roomRevealed ? Icons.lock_open_outlined : Icons.lock_clock_outlined,
                color: t.roomRevealed ? AppColors.success : AppColors.warning,
                size: 18,
              ),
              const SizedBox(width: 8),
              const Text('Room credentials', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            ],
          ),
          const SizedBox(height: 8),
          if (!t.roomRevealed) ...[
            Text(
              'Room ID and password will be unlocked ${t.roomRevealTimeMinutes} minutes before start time.',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          ] else ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Room ID: ${t.roomId ?? 'N/A'}', style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                Text('Password: ${t.roomPassword ?? 'N/A'}', style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAdminRoomManagementCard(TournamentModel t) {
    String statusText;
    Color statusColor;
    Color statusBg;

    if (t.roomStatusProgression == 'released') {
      final timeStr = t.roomRevealedAt != null ? DateFormat('h:mm a').format(t.roomRevealedAt!) : 'Live';
      statusText = 'Released at $timeStr';
      statusColor = AppColors.success;
      statusBg = AppColors.successBg;
    } else if (t.roomStatusProgression == 'set_unreleased') {
      statusText = 'Room set, not released';
      statusColor = AppColors.warning;
      statusBg = AppColors.warningBg;
    } else {
      statusText = 'Room not set';
      statusColor = AppColors.danger;
      statusBg = AppColors.dangerBg;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Admin room management', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              _buildPillTag(statusText, statusColor, statusBg),
            ],
          ),
          const SizedBox(height: 12),

          // Editable Room ID & Password Form
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _adminRoomIdController,
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                  decoration: const InputDecoration(
                    labelText: 'Room ID',
                    hintText: 'e.g. 1049281',
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _adminRoomPassController,
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    hintText: 'e.g. 8888',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Action Buttons: Save Room & Release Room (Pill shape)
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isSavingRoom ? null : () => _handleSaveRoom(),
                  icon: _isSavingRoom 
                      ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(color: AppColors.textPrimary, strokeWidth: 1.5))
                      : const Icon(Icons.save_outlined, size: 15),
                  label: const Text('Save details', style: TextStyle(fontSize: 12)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: (t.roomRevealed || !t.isRoomSet || _isReleasingRoom)
                      ? null 
                      : _handleReleaseRoomNow,
                  icon: _isReleasingRoom
                      ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5))
                      : const Icon(Icons.lock_open_outlined, size: 15),
                  label: Text(t.roomRevealed ? 'Already released' : 'Release room now', style: const TextStyle(fontSize: 12)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor: AppColors.surfaceMuted,
                    disabledForegroundColor: AppColors.textMuted,
                  ),
                ),
              ),
            ],
          ),

          if (t.roomUpdatedAt != null) ...[
            const SizedBox(height: 8),
            Text(
              'Last updated ${DateFormat('d MMM • h:mm a').format(t.roomUpdatedAt!)}',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPillTag(String text, Color textColor, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999), // Pill shape
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
