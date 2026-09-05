import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../home/providers/tournament_provider.dart';

class AdminCreateTournamentScreen extends ConsumerStatefulWidget {
  const AdminCreateTournamentScreen({super.key});

  @override
  ConsumerState<AdminCreateTournamentScreen> createState() => _AdminCreateTournamentScreenState();
}

class _AdminCreateTournamentScreenState extends ConsumerState<AdminCreateTournamentScreen> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  final TextEditingController _entryFeeController = TextEditingController(text: '50');
  final TextEditingController _prizePoolController = TextEditingController(text: '2000');
  final TextEditingController _perKillController = TextEditingController(text: '10');
  final TextEditingController _maxSlotsController = TextEditingController(text: '48');
  final TextEditingController _roomIdController = TextEditingController();
  final TextEditingController _roomPassController = TextEditingController();
  final TextEditingController _rulesController = TextEditingController();

  String _selectedMode = 'solo';
  String _selectedMap = 'Bermuda';
  String _selectedEntryType = 'paid';
  late DateTime _selectedDate;
  late TimeOfDay _selectedTime;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    // Default to next upcoming slot (2 hours from now, rounded to 15 min intervals)
    final future = now.add(const Duration(hours: 2));
    final rem = future.minute % 15;
    final roundedMin = rem == 0 ? future.minute : future.minute + (15 - rem);
    final initialDate = DateTime(
      future.year,
      future.month,
      future.day,
      future.hour,
      roundedMin >= 60 ? 0 : roundedMin,
    ).add(roundedMin >= 60 ? const Duration(hours: 1) : Duration.zero);

    _selectedDate = initialDate;
    _selectedTime = TimeOfDay(hour: initialDate.hour, minute: initialDate.minute);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _entryFeeController.dispose();
    _prizePoolController.dispose();
    _perKillController.dispose();
    _maxSlotsController.dispose();
    _roomIdController.dispose();
    _roomPassController.dispose();
    _rulesController.dispose();
    super.dispose();
  }

  void _handleCreate() async {
    if (!_formKey.currentState!.validate()) return;

    final startDateTime = DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
      _selectedTime.hour,
      _selectedTime.minute,
    );

    final prizePool = _selectedEntryType == 'paid'
        ? (double.tryParse(_prizePoolController.text.trim()) ?? 0.0)
        : (double.tryParse(_prizePoolController.text.trim()) ?? 0.0);
    final perKill = _selectedEntryType == 'paid'
        ? (double.tryParse(_perKillController.text.trim()) ?? 0.0)
        : (double.tryParse(_perKillController.text.trim()) ?? 0.0);
    final entryFee = _selectedEntryType == 'paid' ? (double.tryParse(_entryFeeController.text.trim()) ?? 0.0) : 0.0;
    
    int maxSlots = int.tryParse(_maxSlotsController.text.trim()) ?? 48;
    if (_selectedMode == 'squad' && maxSlots <= 12) {
      maxSlots = maxSlots * 4; // 12 squad teams = 48 player slots
    } else if (_selectedMode == 'duo' && maxSlots <= 24) {
      maxSlots = maxSlots * 2; // 24 duo teams = 48 player slots
    }

    final prizeDistribution = prizePool > 0
        ? [
            {'rank': 1, 'amount': (prizePool * 0.5), 'percentage': 50},
            {'rank': 2, 'amount': (prizePool * 0.3), 'percentage': 30},
            {'rank': 3, 'amount': (prizePool * 0.2), 'percentage': 20},
          ]
        : [];

    final payload = {
      'title': _titleController.text.trim(),
      'description': _descController.text.trim().isEmpty ? null : _descController.text.trim(),
      'game': 'Free Fire',
      'mode': _selectedMode,
      'map': _selectedMap,
      'entryType': _selectedEntryType,
      'entryFee': entryFee,
      'prizePool': prizePool,
      'prizeDistribution': prizeDistribution,
      'perKillPrize': perKill,
      'maxSlots': maxSlots,
      'startTime': startDateTime.toUtc().toIso8601String(),
      'roomId': _roomIdController.text.trim().isEmpty ? null : _roomIdController.text.trim(),
      'roomPassword': _roomPassController.text.trim().isEmpty ? null : _roomPassController.text.trim(),
      'rules': _rulesController.text.trim().isEmpty ? null : _rulesController.text.trim(),
    };

    setState(() => _isSubmitting = true);
    final errorResult = await ref.read(tournamentListProvider.notifier).createTournament(payload);
    setState(() => _isSubmitting = false);

    if (errorResult == null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tournament published successfully!'),
          backgroundColor: AppColors.success,
        ),
      );
      Navigator.pop(context);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(errorResult ?? 'Failed to publish tournament. Please check details.'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Create new tournament'),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Basic Information Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Basic details', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _titleController,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: const InputDecoration(labelText: 'Tournament title (e.g. Bermuda Solo Clash #1)'),
                      validator: (val) => val == null || val.trim().isEmpty ? 'Title is required' : null,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _descController,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      maxLines: 2,
                      decoration: const InputDecoration(labelText: 'Description (optional)'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Mode & Map Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Game mode and map', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedMode,
                            dropdownColor: AppColors.surface,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Mode'),
                            items: const [
                              DropdownMenuItem(value: 'solo', child: Text('Solo (48 Players)')),
                              DropdownMenuItem(value: 'duo', child: Text('Duo (24 Teams = 48 Players)')),
                              DropdownMenuItem(value: 'squad', child: Text('Squad (12 Teams = 48 Players)')),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _selectedMode = val;
                                  _maxSlotsController.text = '48';
                                });
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedMap,
                            dropdownColor: AppColors.surface,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Map'),
                            items: const [
                              DropdownMenuItem(value: 'Bermuda', child: Text('Bermuda')),
                              DropdownMenuItem(value: 'Purgatory', child: Text('Purgatory')),
                              DropdownMenuItem(value: 'Kalahari', child: Text('Kalahari')),
                              DropdownMenuItem(value: 'Alpine', child: Text('Alpine')),
                              DropdownMenuItem(value: 'NexTerra', child: Text('NexTerra')),
                            ],
                            onChanged: (val) => setState(() => _selectedMap = val!),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Entry & Prizes Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Entry fee and prizes', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedEntryType,
                            dropdownColor: AppColors.surface,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Entry type'),
                            items: const [
                              DropdownMenuItem(value: 'paid', child: Text('Paid (₹)')),
                              DropdownMenuItem(value: 'free', child: Text('Free')),
                            ],
                            onChanged: (val) => setState(() => _selectedEntryType = val!),
                          ),
                        ),
                        if (_selectedEntryType == 'paid') ...[
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextFormField(
                              controller: _entryFeeController,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                              decoration: const InputDecoration(labelText: 'Entry fee (₹)'),
                              validator: (val) => val == null || val.isEmpty ? 'Required' : null,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _prizePoolController,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Prize pool (₹)'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextFormField(
                            controller: _perKillController,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Per kill bounty (₹)'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Slots & Schedule Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Slots and schedule', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _maxSlotsController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: InputDecoration(
                        labelText: _selectedMode == 'squad'
                            ? 'Max Player Slots (48 for 12 Teams)'
                            : _selectedMode == 'duo'
                                ? 'Max Player Slots (48 for 24 Teams)'
                                : 'Max Player Slots (48)',
                        helperText: _selectedMode == 'squad'
                            ? '12 Squad Teams x 4 = 48 total individual slots'
                            : _selectedMode == 'duo'
                                ? '24 Duo Teams x 2 = 48 total individual slots'
                                : null,
                      ),
                      validator: (val) => val == null || val.isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'MATCH DATE',
                                style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5),
                              ),
                              const SizedBox(height: 6),
                              InkWell(
                                onTap: () async {
                                  final now = DateTime.now();
                                  final todayMidnight = DateTime(now.year, now.month, now.day);
                                  final d = await showDatePicker(
                                    context: context,
                                    initialDate: _selectedDate.isBefore(todayMidnight) ? todayMidnight : _selectedDate,
                                    firstDate: todayMidnight,
                                    lastDate: todayMidnight.add(const Duration(days: 60)),
                                    builder: (ctx, child) => Theme(data: AppTheme.lightTheme, child: child!),
                                  );
                                  if (d != null) setState(() => _selectedDate = d);
                                },
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: AppColors.border, width: 0.5),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.calendar_today_rounded, color: AppColors.primary, size: 16),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          DateFormat('d MMM yyyy').format(_selectedDate),
                                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'START TIME',
                                style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5),
                              ),
                              const SizedBox(height: 6),
                              InkWell(
                                onTap: () async {
                                  final t = await showTimePicker(
                                    context: context,
                                    initialTime: _selectedTime,
                                    builder: (ctx, child) => Theme(data: AppTheme.lightTheme, child: child!),
                                  );
                                  if (t != null) setState(() => _selectedTime = t);
                                },
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: AppColors.border, width: 0.5),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.access_time_rounded, color: AppColors.primary, size: 16),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          _selectedTime.format(context),
                                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.border, width: 0.5),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.schedule_rounded, color: AppColors.primary, size: 14),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Scheduled start: ${DateFormat('EEE, d MMM • h:mm a').format(DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day, _selectedTime.hour, _selectedTime.minute))}',
                              style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Custom Room Credentials Card (Optional at creation)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Custom room credentials (optional)', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 4),
                    const Text(
                      'Can be added later, any time before match start.',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _roomIdController,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(
                              labelText: 'Room ID (optional)',
                              hintText: 'e.g. 1049281',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextFormField(
                            controller: _roomPassController,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(
                              labelText: 'Password (optional)',
                              hintText: 'e.g. 8888',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Submit Pill CTA
              ElevatedButton(
                onPressed: _isSubmitting ? null : _handleCreate,
                child: _isSubmitting
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Color(0xFF0B0E17), strokeWidth: 1.5))
                    : const Text('Publish tournament'),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
